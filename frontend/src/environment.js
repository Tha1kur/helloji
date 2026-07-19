// Backend base URL.
// Set VITE_SERVER_URL in frontend/.env (see frontend/.env.example).
// Falls back to the local dev server so `npm run dev` works out of the box.
const server = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";

export default server;
