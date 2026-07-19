import { Server } from "socket.io";

import { config } from "../config/env.js";

// roomId -> Set of socket ids
const rooms = new Map();
// roomId -> recent chat messages
const messages = new Map();
// socketId -> roomId, so disconnect is a lookup rather than a scan of every room
const socketRoom = new Map();

const MAX_MESSAGES_PER_ROOM = 100;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_SENDER_LENGTH = 60;

/** Removes a socket from its room and tells the others. Safe to call twice. */
const leaveRoom = (io, socketId) => {
    const roomId = socketRoom.get(socketId);
    if (!roomId) return;

    socketRoom.delete(socketId);

    const members = rooms.get(roomId);
    if (!members) return;

    members.delete(socketId);

    if (members.size === 0) {
        // Free the room's state instead of holding it for the process
        // lifetime, which previously leaked a little memory per call.
        rooms.delete(roomId);
        messages.delete(roomId);
        return;
    }

    for (const memberId of members) {
        io.to(memberId).emit("user-left", socketId);
    }
};

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: config.corsOrigins,
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        socket.on("join-call", (roomId) => {
            if (typeof roomId !== "string" || !roomId) return;

            // A socket only ever belongs to one room.
            leaveRoom(io, socket.id);

            if (!rooms.has(roomId)) rooms.set(roomId, new Set());
            const members = rooms.get(roomId);
            members.add(socket.id);
            socketRoom.set(socket.id, roomId);

            const memberList = [...members];
            for (const memberId of members) {
                io.to(memberId).emit("user-joined", socket.id, memberList);
            }

            for (const message of messages.get(roomId) || []) {
                io.to(socket.id).emit(
                    "chat-message",
                    message.data,
                    message.sender,
                    message["socket-id-sender"]
                );
            }
        });

        socket.on("signal", (toId, message) => {
            // Only relay within the sender's own room, so a client cannot
            // signal arbitrary sockets elsewhere on the server.
            const roomId = socketRoom.get(socket.id);
            if (!roomId || !rooms.get(roomId)?.has(toId)) return;

            io.to(toId).emit("signal", socket.id, message);
        });

        socket.on("chat-message", (data, sender) => {
            const roomId = socketRoom.get(socket.id);
            if (!roomId) return;
            if (typeof data !== "string" || !data.trim()) return;

            const message = {
                sender: String(sender ?? "Guest").slice(0, MAX_SENDER_LENGTH),
                data: data.slice(0, MAX_MESSAGE_LENGTH),
                "socket-id-sender": socket.id,
            };

            const history = messages.get(roomId) || [];
            history.push(message);
            // Cap the backlog so a long-running room cannot grow without bound.
            if (history.length > MAX_MESSAGES_PER_ROOM) history.shift();
            messages.set(roomId, history);

            for (const memberId of rooms.get(roomId)) {
                io.to(memberId).emit(
                    "chat-message",
                    message.data,
                    message.sender,
                    socket.id
                );
            }
        });

        socket.on("disconnect", () => leaveRoom(io, socket.id));
    });

    return io;
};
