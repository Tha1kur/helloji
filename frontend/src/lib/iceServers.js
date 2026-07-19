/**
 * ICE servers used to establish peer connections.
 *
 * STUN alone is enough when at least one peer can accept an inbound
 * connection. Behind symmetric NAT or a restrictive corporate firewall it is
 * not, and the call silently fails to connect - which is why a TURN relay is
 * needed for the app to work on real networks.
 *
 * TURN credentials are optional so the app still runs locally without them.
 * Set VITE_TURN_URL, VITE_TURN_USERNAME and VITE_TURN_CREDENTIAL to enable.
 */
const STUN_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

const turnUrl = import.meta.env.VITE_TURN_URL;
const turnUsername = import.meta.env.VITE_TURN_USERNAME;
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

const turnServer =
    turnUrl && turnUsername && turnCredential
        ? [
              {
                  urls: turnUrl.split(",").map((url) => url.trim()),
                  username: turnUsername,
                  credential: turnCredential,
              },
          ]
        : [];

export const hasTurnConfigured = turnServer.length > 0;

export const peerConnectionConfig = {
    iceServers: [...STUN_SERVERS, ...turnServer],
};
