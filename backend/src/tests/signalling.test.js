import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { io as ioClient } from "socket.io-client";

import { server } from "../app.js";

let url;
const clients = [];

/** Connects a client and resolves once the socket has an id. */
const connect = () =>
    new Promise((resolve) => {
        const socket = ioClient(url, { transports: ["websocket"] });
        clients.push(socket);
        socket.on("connect", () => resolve(socket));
    });

/** Collects events of a given name into an array for later assertion. */
const collect = (socket, event) => {
    const received = [];
    socket.on(event, (...args) => received.push(args));
    return received;
};

const settle = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
    await new Promise((resolve) => {
        // Port 0 asks the OS for any free port, so the suite never collides
        // with a development server already running on 8000.
        server.listen(0, () => {
            url = `http://localhost:${server.address().port}`;
            resolve();
        });
    });
});

afterEach(() => {
    clients.forEach((socket) => socket.disconnect());
    clients.length = 0;
});

afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
});

describe("joining a room", () => {
    it("tells everyone in the room who is present", async () => {
        const a = await connect();
        const joins = collect(a, "user-joined");

        a.emit("join-call", "room-1");
        await settle();

        const b = await connect();
        b.emit("join-call", "room-1");
        await settle();

        const [latestId, members] = joins.at(-1);
        expect(latestId).toBe(b.id);
        expect(members).toHaveLength(2);
        expect(members).toContain(a.id);
        expect(members).toContain(b.id);
    });

    it("keeps separate rooms separate", async () => {
        const a = await connect();
        const b = await connect();
        const joins = collect(a, "user-joined");

        a.emit("join-call", "room-a");
        await settle();
        b.emit("join-call", "room-b");
        await settle();

        expect(joins.flatMap(([id]) => id)).not.toContain(b.id);
    });
});

describe("signal relay", () => {
    it("forwards a signal to the addressed peer with the sender's id", async () => {
        const a = await connect();
        const b = await connect();
        const signals = collect(b, "signal");

        a.emit("join-call", "room-2");
        b.emit("join-call", "room-2");
        await settle();

        a.emit("signal", b.id, JSON.stringify({ sdp: "offer" }));
        await settle();

        expect(signals).toHaveLength(1);
        expect(signals[0][0]).toBe(a.id);
    });

    it("refuses to relay a signal to a socket in a different room", async () => {
        const a = await connect();
        const outsider = await connect();
        const signals = collect(outsider, "signal");

        a.emit("join-call", "room-3");
        outsider.emit("join-call", "somewhere-else");
        await settle();

        a.emit("signal", outsider.id, JSON.stringify({ sdp: "offer" }));
        await settle();

        // Otherwise any client could push signalling data at arbitrary
        // sockets elsewhere on the server.
        expect(signals).toHaveLength(0);
    });
});

describe("chat", () => {
    it("broadcasts a message to the whole room, including the sender", async () => {
        const a = await connect();
        const b = await connect();
        const fromA = collect(a, "chat-message");
        const fromB = collect(b, "chat-message");

        a.emit("join-call", "room-4");
        b.emit("join-call", "room-4");
        await settle();

        a.emit("chat-message", "hello", "Alice");
        await settle();

        expect(fromA.at(-1)[0]).toBe("hello");
        expect(fromB.at(-1)[0]).toBe("hello");
        expect(fromB.at(-1)[1]).toBe("Alice");
    });

    it("ignores a blank message", async () => {
        const a = await connect();
        const b = await connect();
        const received = collect(b, "chat-message");

        a.emit("join-call", "room-5");
        b.emit("join-call", "room-5");
        await settle();

        a.emit("chat-message", "   ", "Alice");
        await settle();

        expect(received).toHaveLength(0);
    });

    it("truncates an oversized message", async () => {
        const a = await connect();
        const b = await connect();
        const received = collect(b, "chat-message");

        a.emit("join-call", "room-6");
        b.emit("join-call", "room-6");
        await settle();

        a.emit("chat-message", "x".repeat(5000), "Alice");
        await settle();

        expect(received.at(-1)[0]).toHaveLength(2000);
    });

    it("replays room history to someone who joins later", async () => {
        const a = await connect();
        a.emit("join-call", "room-7");
        await settle();
        a.emit("chat-message", "said before you arrived", "Alice");
        await settle();

        const late = await connect();
        const received = collect(late, "chat-message");
        late.emit("join-call", "room-7");
        await settle();

        expect(received.at(-1)[0]).toBe("said before you arrived");
    });
});

describe("leaving", () => {
    it("notifies every remaining peer", async () => {
        const a = await connect();
        const b = await connect();
        const c = await connect();

        [a, b, c].forEach((socket) => socket.emit("join-call", "room-8"));
        await settle();

        const bLeft = collect(b, "user-left");
        const cLeft = collect(c, "user-left");

        // Captured before disconnecting: socket.io clears the id on disconnect.
        const aId = a.id;
        a.disconnect();
        await settle(400);

        expect(bLeft.flat()).toContain(aId);
        expect(cLeft.flat()).toContain(aId);
    });

    it("frees a room's chat history once the last person leaves", async () => {
        const a = await connect();
        a.emit("join-call", "room-9");
        await settle();
        a.emit("chat-message", "temporary", "Alice");
        await settle();
        a.disconnect();
        await settle(400);

        const fresh = await connect();
        const received = collect(fresh, "chat-message");
        fresh.emit("join-call", "room-9");
        await settle();

        // The room's state previously lived for the lifetime of the process.
        expect(received).toHaveLength(0);
    });
});
