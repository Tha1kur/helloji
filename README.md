# HelloJi

Browser-based video calling. Open a link, share the meeting code, talk. No app
to install, and no account needed to join a call.

Built with React, Express, MongoDB and WebRTC.

---

## Features

- **Multi-party video calls** over WebRTC peer connections
- **Screen sharing** via the Screen Capture API
- **Live text chat** inside the call, with unread-message badges
- **Mute / camera toggle** during a call
- **Accounts** with bcrypt-hashed passwords
- **Meeting history** — every call you join is saved to your account
- **Guest access** — join a call without signing up

## Architecture

```
Browser A  <────── media (peer-to-peer) ──────>  Browser B
    │                                                │
    └────────── signalling (Socket.IO) ──────────────┘
                          │
                   Express server ──── MongoDB
                   (users, history)
```

Audio and video never touch the server. The backend only does two jobs:

1. **Signalling** — relays SDP offers/answers and ICE candidates so two browsers
   can find each other and negotiate a direct connection.
2. **REST API** — accounts, authentication, and meeting history.

Peers connect in a **mesh**: every participant holds a direct connection to every
other participant. Simple and low-latency for small calls, but connection count
grows as O(n²) — see [Known limitations](#known-limitations).

### Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 18, React Router 6, hand-written CSS |
| Build | Vite |
| Real-time | WebRTC, Socket.IO |
| Backend | Node.js, Express |
| Database | MongoDB with Mongoose |
| Auth | JWT access tokens, rotating refresh tokens, bcrypt |
| Hardening | helmet, express-rate-limit, zod validation |

## Running locally

**Requirements:** Node.js 18+, and a MongoDB database (local or Atlas).

```bash
git clone <your-repo-url>
cd Zoom-main
```

**Backend**

```bash
cd backend
npm install
cp .env.example .env     # then fill in MONGO_URI
npm run dev              # http://localhost:8000
```

**Frontend** (in a second terminal)

```bash
cd frontend
npm install
cp .env.example .env     # defaults to the local backend
npm run dev              # http://localhost:3000
```

Other frontend scripts: `npm run build` produces `build/`, and `npm run preview`
serves that production build locally.

### Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `MONGO_URI` | MongoDB connection string |
| `backend/.env` | `PORT` | API/socket port (default `8000`) |
| `backend/.env` | `CORS_ORIGINS` | Comma-separated allowed origins |
| `backend/.env` | `JWT_SECRET` | Access-token signing key (32+ chars) |
| `frontend/.env` | `VITE_SERVER_URL` | Backend base URL |
| `frontend/.env` | `VITE_TURN_URL` | TURN relay URL (optional) |
| `frontend/.env` | `VITE_TURN_USERNAME` | TURN username (optional) |
| `frontend/.env` | `VITE_TURN_CREDENTIAL` | TURN credential (optional) |

Both `.env` files are gitignored. Only the `.env.example` templates are committed.

## API

Base path: `/api/v1/users`

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/register` | — | Create an account |
| `POST` | `/login` | — | Authenticate, returns a token pair |
| `POST` | `/refresh` | refresh token | Exchange for a new token pair |
| `POST` | `/logout` | refresh token | Revoke the presented refresh token |
| `POST` | `/add_to_activity` | access token | Record a joined meeting |
| `GET` | `/get_all_activity` | access token | Fetch meeting history |
| `GET` | `/health` | — | Health check (root path) |

### Authentication

Signing in returns two tokens:

- An **access token** (JWT, 15 minutes) sent as `Authorization: Bearer <token>`.
  It is verified by checking its signature, so an authenticated request costs
  no database round trip.
- A **refresh token** (7 days) used only to obtain a new pair. Only its SHA-256
  hash is stored, so a database leak does not yield usable tokens.

Refresh tokens are **rotated**: each one can be used once, and using it issues a
replacement. A token replayed after the legitimate client has already spent it
is rejected, which is what makes theft detectable. Each sign-in gets its own
entry, so signing in on a phone does not sign you out on a laptop, and
`/logout` revokes only the session it is given.

The browser client refreshes automatically on expiry and retries the original
request once, so a session ending mid-use is invisible to the user.

## Known limitations

Being upfront about what this does not yet do:

- **Mesh topology caps call size.** Each peer connects to every other peer, so
  bandwidth and CPU scale quadratically. Comfortable up to ~4 participants;
  beyond that it needs an SFU (selective forwarding unit) to route streams
  through a media server instead.
- **No TURN relay is provisioned.** The client reads TURN credentials from the
  environment, but with STUN alone a call cannot connect between peers behind
  symmetric NAT or a restrictive corporate firewall.
- **Room state is in memory.** Active rooms and chat history live in server
  process memory, so a restart drops them and the app cannot yet run across
  multiple server instances. Chat backlog is capped per room and freed when
  the last participant leaves.
- **Tokens are stored in `localStorage`.** That makes them readable by any
  script running on the page, so a cross-site scripting bug would expose a
  session. `httpOnly` cookies would prevent that, but bring CSRF and
  cross-site cookie handling with them, since the frontend and backend are
  deployed on different origins. Short access-token lifetimes and rotation
  limit the blast radius in the meantime.

## Roadmap

- [x] JWT authentication with expiry and rotating refresh tokens
- [x] Migrate to the modern `addTrack` / `ontrack` WebRTC API
- [ ] Provision a TURN server (the client reads credentials already)
- [ ] Redis-backed room state for horizontal scaling
- [ ] Waiting room and host controls
- [ ] Test coverage and CI

## Deployment

The frontend is a static bundle; the backend is a long-running Node process
because Socket.IO needs a persistent connection, so it cannot go on a
serverless platform.

**Backend (Render).** Create a Web Service from `render.yaml`, then set
`MONGO_URI`, `JWT_SECRET` and `CORS_ORIGINS` in the dashboard. Generate a
different `JWT_SECRET` from the one used locally — sharing a signing key
across environments means a token minted in development is valid in
production.

**Frontend (Vercel).** Set the root directory to `frontend` and add
`VITE_SERVER_URL` pointing at the deployed backend. `vercel.json` rewrites
every path to `index.html`; without that, opening a meeting link directly
returns 404, because the host looks for a file at that path rather than
letting the router handle it.

**After both are live**, set `CORS_ORIGINS` on the backend to the Vercel URL
and redeploy. Vite inlines `VITE_` variables at build time, so changing
`VITE_SERVER_URL` needs a rebuild, not just a restart.

On Render's free tier the service sleeps after inactivity, so the first
request after an idle period takes around a minute to wake it.

## Acknowledgements

This project began from a course exercise and has been substantially rewritten —
secrets and configuration handling, authentication, the signalling layer, the
WebRTC implementation, the build toolchain, and the interface. The limitations
and roadmap above reflect ongoing work.

## License

ISC
