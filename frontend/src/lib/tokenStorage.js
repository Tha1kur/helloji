const ACCESS_KEY = "helloji.accessToken";
const REFRESH_KEY = "helloji.refreshToken";
const USER_KEY = "helloji.user";

// Kept in one module so the storage keys and shape are defined once. If this
// ever moves to httpOnly cookies, only this file and the API client change.
export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export const getStoredUser = () => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const saveSession = ({ accessToken, refreshToken, user }) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
};

export const isSignedIn = () => Boolean(getAccessToken());
