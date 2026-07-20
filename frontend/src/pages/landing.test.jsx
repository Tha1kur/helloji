import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";

import LandingPage from "./landing";

/** Reports the room id the router resolved to, so navigation can be asserted. */
const RoomProbe = () => <div data-testid="room">{useParams().url}</div>;

const renderLanding = () =>
    render(
        <MemoryRouter initialEntries={["/"]}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<div data-testid="auth">auth page</div>} />
                <Route path="/:url" element={<RoomProbe />} />
            </Routes>
        </MemoryRouter>
    );

describe("landing page", () => {
    it("shows the product name and value proposition", () => {
        renderLanding();

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/HelloJi/i);
        expect(screen.getByText(/no sign-up to join/i)).toBeInTheDocument();
        expect(screen.getByText(/share a link/i)).toBeInTheDocument();
    });

    it("carries no branding from the original course project", () => {
        renderLanding();
        expect(document.body.textContent).not.toMatch(/apna/i);
    });

    it("sends a guest into a generated room", async () => {
        // The original navigated every guest to one hardcoded room id, so
        // strangers landed in the same call.
        const user = userEvent.setup();
        renderLanding();

        await user.click(screen.getByRole("button", { name: /join as guest/i }));

        const room = await screen.findByTestId("room");
        expect(room).toHaveTextContent(/^[a-z2-9]{3}-[a-z2-9]{3}-[a-z2-9]{3}$/);
    });

    it("routes the sign-in link to the auth page", async () => {
        const user = userEvent.setup();
        renderLanding();

        await user.click(screen.getByRole("link", { name: /sign in/i }));

        expect(await screen.findByTestId("auth")).toBeInTheDocument();
    });
});
