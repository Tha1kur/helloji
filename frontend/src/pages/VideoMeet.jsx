import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom';
import io from "socket.io-client";
import { Badge, Button, IconButton, TextField } from '@mui/material';
import {
    CallEnd as CallEndIcon,
    Chat as ChatIcon,
    Mic as MicIcon,
    MicOff as MicOffIcon,
    ScreenShare as ScreenShareIcon,
    StopScreenShare as StopScreenShareIcon,
    Videocam as VideocamIcon,
    VideocamOff as VideocamOffIcon,
} from '@mui/icons-material';

import styles from "../styles/videoComponent.module.css";
import server from '../environment';
import { peerConnectionConfig } from '../lib/iceServers';

export default function VideoMeetComponent() {

    const navigate = useNavigate();
    const { url: roomIdParam } = useParams();

    // The room is the path segment, not window.location.href. Using the full
    // URL meant a stray query string or hash put people in different rooms.
    const roomId = roomIdParam;

    const socketRef = useRef(null);
    const socketIdRef = useRef(null);
    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);

    // socketId -> { pc, polite, makingOffer, ignoreOffer }
    // Held in a ref rather than a module-level global so two mounts can never
    // share connection state.
    const peersRef = useRef(new Map());

    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);
    const [screenAvailable, setScreenAvailable] = useState(false);

    const [video, setVideo] = useState(true);
    const [audio, setAudio] = useState(true);
    const [screen, setScreen] = useState(false);

    const [showModal, setModal] = useState(false);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState(0);

    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");
    const [videos, setVideos] = useState([]);
    const [statusMessage, setStatusMessage] = useState("");

    /* ------------------------------------------------------------------ */
    /* Media                                                               */
    /* ------------------------------------------------------------------ */

    // Placeholder tracks used when a device is unavailable or switched off,
    // so a peer connection always has something to send and negotiation does
    // not have to be torn down and rebuilt.
    const silentAudioTrack = () => {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const destination = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        ctx.resume();
        return Object.assign(destination.stream.getAudioTracks()[0], { enabled: false });
    };

    const blackVideoTrack = ({ width = 640, height = 480 } = {}) => {
        const canvas = Object.assign(document.createElement("canvas"), { width, height });
        canvas.getContext("2d").fillRect(0, 0, width, height);
        return Object.assign(canvas.captureStream().getVideoTracks()[0], { enabled: false });
    };

    /** Swaps a track into every existing peer connection without renegotiating. */
    const replaceTrackOnPeers = useCallback((kind, track) => {
        peersRef.current.forEach(({ pc }) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === kind);
            if (sender) {
                sender.replaceTrack(track).catch((e) => console.error("replaceTrack", e));
            } else if (track) {
                pc.addTrack(track, localStreamRef.current);
            }
        });
    }, []);

    /** Points the local preview at the current stream. */
    const attachLocalPreview = () => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    };

    const probePermissions = useCallback(async () => {
        let hasVideo = false;
        let hasAudio = false;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            hasVideo = stream.getVideoTracks().length > 0;
            hasAudio = stream.getAudioTracks().length > 0;
            stream.getTracks().forEach((t) => t.stop());
        } catch {
            // Fall back to probing each device separately: the user may have
            // granted only one of the two.
            try {
                const v = await navigator.mediaDevices.getUserMedia({ video: true });
                hasVideo = true;
                v.getTracks().forEach((t) => t.stop());
            } catch { /* no camera */ }

            try {
                const a = await navigator.mediaDevices.getUserMedia({ audio: true });
                hasAudio = true;
                a.getTracks().forEach((t) => t.stop());
            } catch { /* no microphone */ }
        }

        setVideoAvailable(hasVideo);
        setAudioAvailable(hasAudio);
        setVideo(hasVideo);
        setAudio(hasAudio);
        setScreenAvailable(Boolean(navigator.mediaDevices?.getDisplayMedia));

        if (!hasVideo && !hasAudio) {
            setStatusMessage("No camera or microphone available. You can still join and use chat.");
        }

        return { hasVideo, hasAudio };
    }, []);

    /** Builds the stream we send to peers, substituting placeholders as needed. */
    const buildLocalStream = useCallback(async ({ wantVideo, wantAudio }) => {
        let captured = null;

        if (wantVideo || wantAudio) {
            try {
                captured = await navigator.mediaDevices.getUserMedia({
                    video: wantVideo,
                    audio: wantAudio,
                });
            } catch (error) {
                console.error("getUserMedia failed", error);
                setStatusMessage("Could not access your camera or microphone.");
            }
        }

        const videoTrack = captured?.getVideoTracks()[0] || blackVideoTrack();
        const audioTrack = captured?.getAudioTracks()[0] || silentAudioTrack();

        return new MediaStream([videoTrack, audioTrack]);
    }, []);

    /* ------------------------------------------------------------------ */
    /* Peer connections                                                    */
    /* ------------------------------------------------------------------ */

    const removePeer = useCallback((peerId) => {
        const peer = peersRef.current.get(peerId);
        if (peer) {
            try { peer.pc.close(); } catch (e) { console.error(e); }
            peersRef.current.delete(peerId);
        }
        setVideos((current) => current.filter((v) => v.socketId !== peerId));
    }, []);

    const createPeer = useCallback((peerId) => {
        if (peersRef.current.has(peerId)) return peersRef.current.get(peerId);

        const pc = new RTCPeerConnection(peerConnectionConfig);

        // Perfect negotiation: exactly one side of each pair is "polite" and
        // yields when both offer at the same time. Comparing socket ids gives
        // both peers the same answer without extra signalling.
        const peer = {
            pc,
            polite: socketIdRef.current < peerId,
            makingOffer: false,
            ignoreOffer: false,
        };
        peersRef.current.set(peerId, peer);

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                socketRef.current?.emit("signal", peerId, JSON.stringify({ ice: candidate }));
            }
        };

        // ontrack replaces the deprecated onaddstream. It fires once per track,
        // so the stream is read from the event rather than assembled by hand.
        pc.ontrack = ({ streams: [stream] }) => {
            if (!stream) return;
            setVideos((current) =>
                current.some((v) => v.socketId === peerId)
                    ? current.map((v) => (v.socketId === peerId ? { ...v, stream } : v))
                    : [...current, { socketId: peerId, stream }]
            );
        };

        pc.onnegotiationneeded = async () => {
            try {
                peer.makingOffer = true;
                await pc.setLocalDescription();
                socketRef.current?.emit(
                    "signal",
                    peerId,
                    JSON.stringify({ sdp: pc.localDescription })
                );
            } catch (error) {
                console.error("negotiation failed", error);
            } finally {
                peer.makingOffer = false;
            }
        };

        pc.onconnectionstatechange = () => {
            if (["failed", "closed"].includes(pc.connectionState)) {
                removePeer(peerId);
            }
        };

        // Adding tracks triggers onnegotiationneeded, which starts the offer.
        localStreamRef.current?.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current);
        });

        return peer;
    }, [removePeer]);

    const handleSignal = useCallback(async (fromId, raw) => {
        if (fromId === socketIdRef.current) return;

        const peer = peersRef.current.get(fromId) || createPeer(fromId);
        const { pc } = peer;

        let signal;
        try {
            signal = JSON.parse(raw);
        } catch {
            return;
        }

        try {
            if (signal.sdp) {
                const description = signal.sdp;

                const offerCollision =
                    description.type === "offer" &&
                    (peer.makingOffer || pc.signalingState !== "stable");

                // The impolite peer ignores a colliding offer; the polite peer
                // rolls back its own and accepts. Without this, simultaneous
                // offers leave both sides stuck.
                peer.ignoreOffer = !peer.polite && offerCollision;
                if (peer.ignoreOffer) return;

                await pc.setRemoteDescription(description);

                if (description.type === "offer") {
                    await pc.setLocalDescription();
                    socketRef.current?.emit(
                        "signal",
                        fromId,
                        JSON.stringify({ sdp: pc.localDescription })
                    );
                }
            } else if (signal.ice) {
                try {
                    await pc.addIceCandidate(signal.ice);
                } catch (error) {
                    // Candidates arriving for an offer we deliberately ignored
                    // are expected and harmless.
                    if (!peer.ignoreOffer) throw error;
                }
            }
        } catch (error) {
            console.error("signal handling failed", error);
        }
    }, [createPeer]);

    /* ------------------------------------------------------------------ */
    /* Chat                                                                */
    /* ------------------------------------------------------------------ */

    const addMessage = useCallback((data, sender, senderSocketId) => {
        setMessages((current) => [...current, { sender, data }]);
        if (senderSocketId !== socketIdRef.current) {
            setNewMessages((count) => count + 1);
        }
    }, []);

    /* ------------------------------------------------------------------ */
    /* Connect / teardown                                                  */
    /* ------------------------------------------------------------------ */

    const connectToSocketServer = useCallback(() => {
        const socket = io(server, { transports: ["websocket", "polling"] });
        socketRef.current = socket;

        socket.on("connect", () => {
            socketIdRef.current = socket.id;
            socket.emit("join-call", roomId);
        });

        socket.on("signal", handleSignal);
        socket.on("chat-message", addMessage);
        socket.on("user-left", (id) => removePeer(id));

        socket.on("user-joined", (joinedId, members) => {
            members.forEach((memberId) => {
                if (memberId !== socketIdRef.current) createPeer(memberId);
            });
        });

        socket.on("connect_error", () => {
            setStatusMessage("Lost connection to the server. Trying to reconnect...");
        });
    }, [roomId, handleSignal, addMessage, createPeer, removePeer]);

    const teardown = useCallback(() => {
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;

        peersRef.current.forEach(({ pc }) => {
            try { pc.close(); } catch (e) { console.error(e); }
        });
        peersRef.current.clear();

        socketRef.current?.disconnect();
        socketRef.current = null;

        setVideos([]);
    }, []);

    // Releases the camera, microphone, peer connections and socket whenever the
    // user leaves the call - including via the back button or by closing the tab.
    useEffect(() => teardown, [teardown]);

    useEffect(() => {
        probePermissions();
    }, [probePermissions]);

    // Local preview in the lobby, before joining.
    useEffect(() => {
        if (!askForUsername) return;
        let cancelled = false;

        (async () => {
            const stream = await buildLocalStream({ wantVideo: true, wantAudio: false });
            if (cancelled) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            localStreamRef.current = stream;
        })();

        return () => { cancelled = true; };
    }, [askForUsername, buildLocalStream]);

    const connect = async () => {
        setAskForUsername(false);

        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = await buildLocalStream({
            wantVideo: videoAvailable,
            wantAudio: audioAvailable,
        });
        attachLocalPreview();

        connectToSocketServer();
    };

    /* ------------------------------------------------------------------ */
    /* Controls                                                            */
    /* ------------------------------------------------------------------ */

    // Toggling only flips `enabled` on the existing track. The old code
    // re-ran getUserMedia and renegotiated every connection, which made the
    // camera light flicker and briefly dropped the remote video.
    const handleVideo = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        setVideo(track.enabled);
    };

    const handleAudio = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        setAudio(track.enabled);
    };

    const handleScreen = async () => {
        if (screen) {
            // Stop sharing: go back to the camera.
            const camera = await buildLocalStream({
                wantVideo: videoAvailable,
                wantAudio: audioAvailable,
            });
            localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
            const cameraTrack = camera.getVideoTracks()[0];
            replaceTrackOnPeers("video", cameraTrack);
            localStreamRef.current = camera;
            attachLocalPreview();
            setScreen(false);
            return;
        }

        try {
            const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const displayTrack = display.getVideoTracks()[0];

            replaceTrackOnPeers("video", displayTrack);

            const audioTrack = localStreamRef.current?.getAudioTracks()[0];
            localStreamRef.current = new MediaStream(
                audioTrack ? [displayTrack, audioTrack] : [displayTrack]
            );
            attachLocalPreview();
            setScreen(true);

            // Fires when the user stops sharing from the browser's own bar.
            displayTrack.onended = () => handleScreen();
        } catch (error) {
            console.error("screen share failed", error);
        }
    };

    const handleEndCall = () => {
        teardown();
        navigate("/");
    };

    const toggleChat = () => {
        setModal((isOpen) => {
            if (!isOpen) setNewMessages(0);
            return !isOpen;
        });
    };

    const sendMessage = () => {
        const text = message.trim();
        if (!text) return;
        socketRef.current?.emit("chat-message", text, username || "Guest");
        setMessage("");
    };

    /* ------------------------------------------------------------------ */

    return (
        <div>
            {askForUsername ? (
                <div>
                    <h2>Enter into Lobby</h2>
                    <TextField
                        id="lobby-username"
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
                        variant="outlined"
                    />
                    <Button variant="contained" onClick={connect}>Connect</Button>

                    {statusMessage && <p>{statusMessage}</p>}

                    <div>
                        <video ref={localVideoRef} autoPlay muted playsInline></video>
                    </div>
                </div>
            ) : (
                <div className={styles.meetVideoContainer}>

                    {showModal && (
                        <div className={styles.chatRoom}>
                            <div className={styles.chatContainer}>
                                <h1>Chat</h1>

                                <div className={styles.chattingDisplay}>
                                    {messages.length ? messages.map((item, index) => (
                                        <div style={{ marginBottom: "20px" }} key={index}>
                                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                            <p>{item.data}</p>
                                        </div>
                                    )) : <p>No Messages Yet</p>}
                                </div>

                                <div className={styles.chattingArea}>
                                    <TextField
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                                        id="chat-input"
                                        label="Enter Your chat"
                                        variant="outlined"
                                    />
                                    <Button variant="contained" onClick={sendMessage}>Send</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={styles.buttonContainers}>
                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {video ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>

                        <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                            <CallEndIcon />
                        </IconButton>

                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>

                        {screenAvailable && (
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton>
                        )}

                        <Badge badgeContent={newMessages} max={999} color="secondary">
                            <IconButton onClick={toggleChat} style={{ color: "white" }}>
                                <ChatIcon />
                            </IconButton>
                        </Badge>
                    </div>

                    <video
                        className={styles.meetUserVideo}
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                    ></video>

                    <div className={styles.conferenceView}>
                        {videos.map((remote) => (
                            <div key={remote.socketId}>
                                <video
                                    data-socket={remote.socketId}
                                    ref={(element) => {
                                        if (element && remote.stream && element.srcObject !== remote.stream) {
                                            element.srcObject = remote.stream;
                                        }
                                    }}
                                    autoPlay
                                    playsInline
                                ></video>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
