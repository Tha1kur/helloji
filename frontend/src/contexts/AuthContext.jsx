import { createContext, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiClient, setSessionExpiredHandler } from "../lib/apiClient";
import {
    clearSession,
    getRefreshToken,
    getStoredUser,
    saveSession,
} from "../lib/tokenStorage";

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const [user, setUser] = useState(getStoredUser);

    const signOutLocally = useCallback(() => {
        clearSession();
        setUser(null);
        navigate("/auth");
    }, [navigate]);

    // When a refresh fails the session is genuinely over, so send the user to
    // the sign-in page instead of leaving the app in a half-authenticated state.
    useEffect(() => {
        setSessionExpiredHandler(signOutLocally);
    }, [signOutLocally]);

    const handleRegister = async (name, username, password) => {
        const { data } = await apiClient.post("/register", {
            name,
            username,
            password,
        });
        return data.message;
    };

    const handleLogin = async (username, password) => {
        const { data } = await apiClient.post("/login", { username, password });
        saveSession(data);
        setUser(data.user);
        navigate("/home");
    };

    const handleLogout = async () => {
        const refreshToken = getRefreshToken();

        // Revoke server-side so the refresh token cannot be reused, but never
        // block signing out on that request succeeding.
        if (refreshToken) {
            try {
                await apiClient.post("/logout", { refreshToken });
            } catch {
                // Ignored on purpose - local sign-out still proceeds.
            }
        }

        signOutLocally();
    };

    const getHistoryOfUser = async () => {
        const { data } = await apiClient.get("/get_all_activity");
        return data;
    };

    const addToUserHistory = async (meetingCode) => {
        return apiClient.post("/add_to_activity", { meeting_code: meetingCode });
    };

    const value = {
        user,
        handleRegister,
        handleLogin,
        handleLogout,
        getHistoryOfUser,
        addToUserHistory,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};
