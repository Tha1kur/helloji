import "@testing-library/jest-dom/vitest";

// jsdom implements neither of these, and components under test touch both.
if (!globalThis.crypto?.getRandomValues) {
    globalThis.crypto = await import("node:crypto").then((m) => m.webcrypto);
}

if (!window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    });
}
