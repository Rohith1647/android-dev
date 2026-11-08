# Roundtable — frontend

Internal, text-only team chat. React 19 + Vite, Tailwind CSS v4, lucide-react
icons, STOMP over SockJS for realtime.

The app talks to a live backend — there is no mock layer and no demo data.

## Running locally

```bash
npm install
cp .env.example .env.local   # set VITE_DEV_API_TARGET to your backend
npm run dev
```

The dev server proxies `/api` and `/ws` to `VITE_DEV_API_TARGET`
(default `http://localhost:8080`), so the browser stays same-origin and the
backend needs no CORS configuration for local work.

| Script           | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `npm run dev`    | Dev server on :5173 with API/WS proxying  |
| `npm run build`  | Production bundle into `dist/`            |
| `npm run preview`| Serve the built bundle locally            |
| `npm run lint`   | oxlint                                    |
| `npm run format` | Prettier                                  |

## Deploying

`dist/` is a static bundle. Two things the host must do:

1. **SPA fallback** — serve `index.html` for unknown paths, or deep links like
   `/chats/abc123` 404.
2. **Same-origin API** — front `/api` and `/ws` from the same host, and the app
   needs no cross-origin configuration at all.

Both are typically handled by your static file server of choice (e.g., Nginx, Caddy, Apache). Configure it to serve `dist/`, fallback to `index.html` for unknown paths, and proxy `/api` and `/ws` to your backend.

To deploy the SPA on a different origin from the API instead, build with
`VITE_API_BASE_URL` and `VITE_SOCKJS_URL` pointing at the gateway and enable
CORS plus websocket upgrade there.

### Environment variables

| Variable                  | When            | Meaning                                        |
| ------------------------- | --------------- | ---------------------------------------------- |
| `VITE_DEV_API_TARGET`     | dev only        | Proxy target for `/api` and `/ws`              |
| `VITE_API_BASE_URL`       | build time      | API origin; empty = same origin                |
| `VITE_SOCKJS_URL`         | build time      | SockJS endpoint; defaults to `<API base>/ws`   |
| `VITE_REQUEST_TIMEOUT_MS` | build time      | HTTP timeout, default 15000                    |

## Roles

`ADMIN`, `HR`, `EMPLOYEE`, `STUDENT` — returned by the login response and held
in [`AuthContext`](src/state/AuthContext.jsx).

|                            | Admin | HR  | Employee | Student |
| -------------------------- | ----- | --- | -------- | ------- |
| Chats                      | ✅    | ✅  | ✅       | ✅      |
| Send messages in own chats | ✅    | ✅  | ✅       | ✅      |
| Create new chats           | ✅    | ✅  | ✅       | ❌      |
| Admin panel                | ✅    | —   | —        | —       |
| HR panel                   | —     | ✅  | —        | —       |

Admin assigns HR / Employee / Student. HR assigns Employee / Student. **Admin is
never an assignable option in either picker.**

Role-based hiding is a convenience, not a security boundary. Students see a lock
indicator instead of "New chat", but `POST /api/chats` must reject them
server-side; the client renders the 403 body
(`{ "error": "Students cannot create new chats" }`) if it ever arrives. The same
applies to every route guard and hidden nav item — the backend is the authority.

## API contract

All authenticated requests send `Authorization: Bearer <token>`. Failures return
`{ "error": "..." }`, which the UI renders verbatim.

| Method | Path                         | Notes                                                  |
| ------ | ---------------------------- | ------------------------------------------------------ |
| POST   | `/api/auth/login`            | `{email,password}` → `{token, refreshToken?, user}`; 401 on bad credentials |
| POST   | `/api/auth/refresh`          | `{refreshToken}` → new token; called automatically on 401 |
| GET    | `/api/chats`                 | `{chats:[{id,type,name,lastMessage,lastMessageAt,unreadCount}]}` |
| POST   | `/api/chats`                 | `{type,name?,participantIds}`; 403 for students        |
| GET    | `/api/chats/{id}/messages`   | `?limit&before` → `{messages, hasMore}`                |
| POST   | `/api/chats/{id}/messages`   | `{content}` → `{message}`                              |
| GET    | `/api/users`                 | Directory for the new-chat participant picker          |
| GET    | `/api/admin/users`           | All users                                              |
| POST   | `/api/admin/users`           | 201 → `{user, temp_password}`; 400 → `{error}`         |
| PATCH  | `/api/admin/users/{id}/role` | `{role}`                                               |
| DELETE | `/api/admin/users/{id}`      | 204                                                    |
| GET    | `/api/hr/users`              | **Server-filtered** to Employee/Student                |
| POST   | `/api/hr/users`              | Same shape as the admin route                          |
| PATCH  | `/api/hr/users/{id}/role`    | `{role}`                                               |
| DELETE | `/api/hr/users/{id}`         | 204                                                    |

`GET /api/users` is the one endpoint outside the original specification — the
new-chat flow needs a list of people to pick from. It is isolated in
`getDirectory` in [`src/api/endpoints.js`](src/api/endpoints.js) if the backend
exposes the directory elsewhere.

### HTTP client behaviour

[`src/api/client.js`](src/api/client.js) is the only place that touches the
network. It attaches the bearer token, aborts requests that exceed
`VITE_REQUEST_TIMEOUT_MS`, and distinguishes three failure classes:

- **`ApiError`** — the server answered; `message` is its `error` string.
- **`NetworkError`** — the request never landed (offline, DNS, CORS, timeout).
- **`AbortError`** — the caller cancelled; views ignore these.

On a 401 it calls `/api/auth/refresh` once, replays the original request, and
only signs the user out if the refresh itself is rejected. Concurrent 401s share
a single refresh. A network blip during refresh does *not* end the session.

## Realtime

Connects after login, passing the JWT on the STOMP `CONNECT` frame.

| Destination                | Direction | Purpose                                  |
| -------------------------- | --------- | ---------------------------------------- |
| `/topic/chat.{id}`         | subscribe | New messages, appended live              |
| `/app/chat.send`           | publish   | Broadcast after the POST persists        |
| `/topic/chat.{id}.typing`  | subscribe | Typing indicator                         |
| `/app/chat.typing`         | publish   | Throttled to once per 2s                 |
| `/topic/chat.{id}.read`    | subscribe | Read receipts on own messages            |
| `/app/chat.read`           | publish   | On open and as messages scroll into view |

Sending does both halves: `POST /api/chats/{id}/messages` persists, then the
stored message is published so other participants see it instantly. Incoming
frames are de-duplicated by id, so the sender never sees a double.

[`stompClient.js`](src/realtime/stompClient.js) keeps subscriptions declarative,
so they are re-applied after every reconnect; reads the token fresh on each
CONNECT attempt; backs off exponentially (1s → 30s) while the server is
unreachable; and on an auth-rejected CONNECT refreshes the token and retries.
If the refresh fails the session ends and the user returns to the login page.

REST remains the source of truth: `publish` returns `false` when the socket is
down, and the message is already persisted regardless.

## Notes

- **Token storage.** Tokens live in `localStorage` so a refresh keeps the user
  signed in, which means an XSS bug would expose them. The CSP above is the
  main mitigation. If your threat model needs more, move to httpOnly refresh
  cookies — `client.js` is the only file that would change.
- **Bundle.** Vendor code is split into `react` and `realtime` chunks and the
  two dashboards are lazy-loaded, so a chat-only user downloads neither.
  Sourcemaps ship so production stack traces stay readable.
- **Error reporting.** [`ErrorBoundary`](src/components/ErrorBoundary.jsx)
  takes an `onError` callback — that is the hook for Sentry or equivalent.

## Layout

```
src/
  config.js            URLs, timeouts and tunables
  api/                 HTTP client (auth, refresh, timeouts) and endpoints
  realtime/            STOMP-over-SockJS client
  state/               auth and realtime contexts
  components/          ui primitives, shell, chat/, users/
  pages/               Login, Chat, AdminPanel, HrPanel
  lib/                 role colors and time formatting
deploy/                nginx config template
```
