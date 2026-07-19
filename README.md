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
| Frontend | React 18, React Router 6, Material UI |
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
| `frontend/.env` | `VITE_SERVER_URL` | Backend base URL |

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
- **STUN only, no TURN.** Calls can fail between peers behind symmetric NAT or
  restrictive corporate firewalls, because there is no relay server to fall
  back on.
- **Room state is in memory.** Active rooms and chat history live in server
  process memory, so a restart drops them and the app cannot yet run across
  multiple server instances.
- **Tokens are stored in `localStorage`.** That makes them readable by any
  script running on the page, so a cross-site scripting bug would expose a
  session. `httpOnly` cookies would prevent that, but bring CSRF and
  cross-site cookie handling with them, since the frontend and backend are
  deployed on different origins. Short access-token lifetimes and rotation
  limit the blast radius in the meantime.

## Roadmap

- [x] JWT authentication with expiry and rotating refresh tokens
- [ ] TURN server so calls survive restrictive networks
- [ ] Migrate to the modern `addTrack` / `ontrack` WebRTC API
- [ ] Redis-backed room state for horizontal scaling
- [ ] Waiting room and host controls
- [ ] Test coverage and CI

## Acknowledgements

This project began from a course exercise and has been substantially rewritten —
configuration and secrets management, CORS and auth handling, the signalling
layer, and the UI. The limitations and roadmap above reflect ongoing work.

## License

ISC
