import { beforeEach, describe, expect, it } from "vitest";

import {
    clearSession,
    getAccessToken,
    getRefreshToken,
    getStoredUser,
    isSignedIn,
    saveSession,
} from "./tokenStorage";

const session = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    user: { username: "tester", name: "Test User" },
};

beforeEach(() => {
    localStorage.clear();
});

describe("tokenStorage", () => {
    it("round-trips a session", () => {
        saveSession(session);

        expect(getAccessToken()).toBe(session.accessToken);
        expect(getRefreshToken()).toBe(session.refreshToken);
        expect(getStoredUser()).toEqual(session.user);
        expect(isSignedIn()).toBe(true);
    });

    it("reports signed out before any sign-in", () => {
        expect(isSignedIn()).toBe(false);
        expect(getStoredUser()).toBeNull();
    });

    it("removes everything on clear", () => {
        saveSession(session);
        clearSession();

        expect(getAccessToken()).toBeNull();
        expect(getRefreshToken()).toBeNull();
        expect(getStoredUser()).toBeNull();
        expect(isSignedIn()).toBe(false);
    });

    it("returns null rather than throwing when the stored user is corrupt", () => {
        localStorage.setItem("helloji.user", "{not valid json");

        // A parse error here would crash the app on load, locking the user
        // out until they cleared site data by hand.
        expect(() => getStoredUser()).not.toThrow();
        expect(getStoredUser()).toBeNull();
    });
});
