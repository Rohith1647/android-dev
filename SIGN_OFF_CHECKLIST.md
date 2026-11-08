# Sign-off Checklist — Frontend (Week 3)

Scope: Mounish's Week 3 QA/security items that are verifiable inside this repo
(no staging/backend deploy). One line per role, per core action.
`AUTOMATED` = covered by `npm test` in this PR. `MANUAL` = requires a live
staging environment with all four backend domains deployed; not runnable from
this repo alone, tracked here as outstanding.

## JWT expiry edge cases (`src/api/client.js`)

| # | Case | Status |
|---|------|--------|
| 1 | Access token expires mid-request → silent refresh → original request replayed once | AUTOMATED (`src/api/client.test.js`) |
| 2 | Refresh token itself is invalid/expired → session cleared, `onSessionExpired` listeners notified | AUTOMATED |
| 3 | Refresh fails due to a network blip (not a rejection) → session is *not* cleared | AUTOMATED |
| 4 | Concurrent 401s during a burst of requests → single shared refresh call | AUTOMATED |
| 5 | Unauthenticated (`auth:false`) request never triggers a refresh attempt | AUTOMATED |
| 6 | Full login → idle past token expiry → UI redirects to Login with "session expired" notice | MANUAL — needs live backend token TTL |

## WebSocket auth edge cases (`src/realtime/stompClient.js`)

| # | Case | Status |
|---|------|--------|
| 1 | STOMP CONNECT rejected as unauthorized/expired → triggers token refresh, reconnects on success | AUTOMATED (`src/realtime/stompClient.test.js`) |
| 2 | Token refresh fails during a STOMP auth failure → socket deactivates, status → `disconnected` | AUTOMATED |
| 3 | Non-auth STOMP error (e.g. malformed frame) does not trigger a refresh | AUTOMATED |
| 4 | Every (re)connect attempt reads the token fresh via `beforeConnect` | AUTOMATED |
| 5 | Dropped connection widens reconnect backoff instead of hammering the server | AUTOMATED |
| 6 | Real browser: log in, let the access token expire with the socket open, confirm it reconnects live | MANUAL — needs live backend + real token TTL |

## `canInitiateChat` / role gating (`src/lib/roles.js`)

| # | Case | Status |
|---|------|--------|
| 1 | `canCreateChat` returns `false` only for Student, `true` for Admin/HR/Employee | AUTOMATED (`src/lib/roles.test.js`) |
| 2 | Admin can never be assigned from either the Admin or HR panel's role picker | AUTOMATED |
| 3 | HR-assignable roles are limited to Employee/Student (HR can't grant HR) | AUTOMATED |
| 4 | "New chat" control is hidden for a logged-in Student (`ChatList`, `ChatPage`) | MANUAL — visual/e2e check, needs running app + backend |
| 5 | A Student token calling `POST /api/chats` directly is rejected with 403 | MANUAL — backend contract test, owned by Vignesh's domain; frontend only consumes the error |

## HR/Admin account isolation (`UserManagementPanel`, `RowMenu`)

| # | Case | Status |
|---|------|--------|
| 1 | A row is only manageable when its role is in the panel's `roleOptions` and it isn't the current user | Covered by existing component logic; no isolated unit under test yet — flagged as follow-up, not blocking this PR |
| 2 | HR panel never lists Admin/HR accounts | MANUAL — needs live backend data per role |

## Regression / production smoke test (Aug 27–30 items)

Full end-to-end staging test, regression pass #2, and the final production
smoke test all require a deployed backend + staging/production environment
that this repo does not own. They stay **MANUAL**, to be run by Mounish
against staging once Vignesh/Anjani's Tue–Wed deploys and Aghamarsh/Rohit's
Thursday staging deploy land, per the team work plan.
