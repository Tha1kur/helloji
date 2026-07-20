import { describe, expect, it } from "vitest";

import { generateMeetingCode } from "./meetingCode";

describe("generateMeetingCode", () => {
    it("returns three groups of three characters", () => {
        expect(generateMeetingCode()).toMatch(/^[a-z2-9]{3}-[a-z2-9]{3}-[a-z2-9]{3}$/);
    });

    it("never uses characters that are easy to confuse when read aloud", () => {
        const codes = Array.from({ length: 200 }, () => generateMeetingCode()).join("");

        // 0/O and 1/I/l are excluded so a code dictated over a call is not
        // mistyped by the person joining.
        expect(codes).not.toMatch(/[01oil]/);
    });

    it("produces a different code each time", () => {
        const codes = new Set(Array.from({ length: 500 }, () => generateMeetingCode()));

        // A collision here would mean two people silently sharing a room.
        expect(codes.size).toBe(500);
    });

    it("honours a requested shape", () => {
        expect(generateMeetingCode(2, 4)).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    });
});
