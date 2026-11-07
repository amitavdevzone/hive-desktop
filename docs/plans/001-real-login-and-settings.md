# Real login, base URL settings, placeholder dashboard

Ticket: #1 (https://github.com/amitavdevzone/hive-desktop/issues/1)
Status: planned
Date: 2026-11-07

## Summary
Replace the fake login with a real call to the Laravel API (`POST /api/login`, see `docs/bruno/login.bru`) through the agreed architecture. Add a Settings screen, available without login, to configure the backend base URL; changing it clears the stored token. After login, show a placeholder dashboard.

## Requirements
- `login` Rust command posts `{email,password}` to `{baseUrl}/api/login`, stores `access_token` in the OS keychain; token never reaches the frontend.
- `api_request` Rust command (method, relative path, body) is the only network path; adds the bearer token; on 401 deletes the token and emits `auth-expired`.
- Settings page: view/save base URL, reachable without login; stored as JSON in the app config dir.
- Changing the base URL deletes the stored token.
- Login shows validation/credential errors inline.
- Placeholder dashboard after login; startup routes by token presence.
- New dependencies (approved): `reqwest` (rustls), `keyring`, `react-router`.

## Acceptance criteria
1. AC1: Valid credentials store the token in the OS keychain and navigate to /dashboard.
2. AC2: Invalid credentials (422/401) show the API's message inline; no navigation.
3. AC3: Unreachable server shows "Cannot reach server".
4. AC4: Login with no base URL set shows an inline error linking to Settings; no request is made.
5. AC5: Settings is reachable from login without authentication and saves a validated http(s) URL.
6. AC6: Saving a different base URL deletes the stored token.
7. AC7: Credentials and token are never persisted in files/localStorage, logged, or exposed to React; password state is cleared after submit.
8. AC8: App start with a stored token opens /dashboard; without one, /login.
9. AC9: A 401 from `api_request` deletes the token, emits `auth-expired`, and the frontend routes to /login.

## Tasks
- [x] Add Rust deps (`reqwest` rustls, `keyring`) and the `commands/` module skeleton registered in `lib.rs` (replace `greet`)
- [x] Rust settings: `get_base_url` / `set_base_url` (JSON in app config dir, URL validation, delete token when URL changes) with unit tests
- [x] Rust HTTP core: shared `send` (relative-path and method validation, base URL, bearer from keychain), serializable error type mapping 422/401/connection failures, with unit tests
- [x] Rust commands: `api_request` (401 -> delete token + emit `auth-expired`), `login` (store `access_token` in keychain), `is_authenticated`
- [x] Frontend: add `react-router`, `src/services/api.ts`, routes in `App.tsx` (`/login`, `/settings`, `/dashboard`), startup routing and `auth-expired` listener
- [x] Wire login page to `login` (inline 422/401/unreachable/no-URL errors, clear password, navigate to dashboard, Settings link)
- [x] Settings page (`pages/settings/index.tsx`): base URL form, save feedback, back link
- [x] Placeholder dashboard page
- [x] End-to-end verification against the Bruno local env (AC1-AC9), `cargo clippy`, `npm run build`

## Test cases
- AC1 -> Given base URL set and valid creds, when Sign in, then keychain entry exists and /dashboard shows.
- AC2 -> Given wrong password, when Sign in, then API message shows and login stays.
- AC3 -> Given a base URL pointing to a dead host, when Sign in, then "Cannot reach server".
- AC4 -> Given no base URL, when Sign in, then settings-link error and no network call.
- AC5 -> Given logged out, when opening Settings and saving `https://hive-be.test`, then it persists across restart; `ftp://x` or garbage is rejected.
- AC6 -> Given a stored token, when saving a different URL, then keychain entry is gone; saving the same URL keeps it.
- AC7 -> Inspect app config dir, localStorage and devtools: no password/token.
- AC8 -> Restart with/without token, check landing page.
- AC9 -> Given an invalid token, when `api_request` returns 401, then token deleted, event emitted, /login shown.
- Rust unit tests for path validation, URL normalization and error mapping; `cargo check`, `cargo clippy`, `npm run build`.

## Architectural decisions
- Base URL in a JSON file in the app config dir: one value, avoids adding SQLite yet; migrate when real app data arrives.
- `react-router` (`MemoryRouter`) for navigation, per user choice.
- Custom commands need no `tauri.conf.json` or capability changes.
- Follows AGENTS.md: token in keychain from Rust, single `api_request` path, relative paths only, `Result<T, E>` errors.
- Error type is serializable `{status, message, errors}` mapping Laravel 422/401 bodies.

## Out of scope
- 401 hold-and-replay of the original request after re-login (needed once real API calls exist beyond login).
- Logout / Sign out (no logout endpoint in the Bruno collection).
- Dashboard design.

## Open questions
- `https://hive-be.test` may use a self-signed local cert; TLS trust for local dev is unresolved.
