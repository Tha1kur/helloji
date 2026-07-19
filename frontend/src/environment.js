// Backend base URL.
// Set REACT_APP_SERVER_URL in frontend/.env (see frontend/.env.example).
// Falls back to the local dev server so `npm start` works out of the box.
const server = process.env.REACT_APP_SERVER_URL || "http://localhost:8000";

export default server;
