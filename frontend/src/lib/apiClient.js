import axios from "axios";

import server from "../environment";
import {
    clearSession,
    getAccessToken,
    getRefreshToken,
    saveSession,
} from "./tokenStorage";

const BASE_URL = `${server}/api/v1/users`;

export const apiClient = axios.create({ baseURL: BASE_URL });

// A bare instance for the refresh call itself. Using apiClient here would let
// a failing refresh trigger the response interceptor and recurse.
const refreshClient = axios.create({ baseURL: BASE_URL });

// Attach the access token in one place, so no individual call has to remember,
// and so it travels in a header rather than a query string where it would be
// captured by server and proxy logs.
apiClient.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let refreshPromise = null;
let onSessionExpired = () => {};

/** Lets the app decide what happens when the session cannot be renewed. */
export const setSessionExpiredHandler = (handler) => {
    onSessionExpired = handler;
};

/**
 * Renews the token pair.
 *
 * Concurrent 401s share a single in-flight request: if three calls fail at
 * once we refresh once, not three times, which also avoids the rotation
 * racing against itself and invalidating the new token.
 */
const refreshSession = () => {
    if (refreshPromise) return refreshPromise;

    const refreshToken = getRefreshToken();
    if (!refreshToken) return Promise.reject(new Error("No refresh token"));

    refreshPromise = refreshClient
        .post("/refresh", { refreshToken })
        .then(({ data }) => {
            saveSession(data);
            return data.accessToken;
        })
        .finally(() => {
            refreshPromise = null;
        });

    return refreshPromise;
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        const status = error.response?.status;
        const code = error.response?.data?.code;

        // Only retry once, and only for an expired token. A malformed or
        // missing token will not be fixed by refreshing.
        if (status === 401 && code === "TOKEN_EXPIRED" && !original._retried) {
            original._retried = true;
            try {
                const accessToken = await refreshSession();
                original.headers.Authorization = `Bearer ${accessToken}`;
                return apiClient(original);
            } catch {
                clearSession();
                onSessionExpired();
            }
        }

        return Promise.reject(error);
    }
);
