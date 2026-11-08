# HIVE wiki

Feature documentation for HIVE, the desktop developer assistant (Tauri + React). One section per feature; updated when a ticket closes.

## Login and session

Sign in with the email and password of your Laravel API account.

- The app posts the credentials to `POST {baseUrl}/api/login`. The returned Sanctum token is stored in the OS keychain by Rust; it never reaches the frontend, and the email/password are never saved or logged. The password field is cleared after submit.
- Errors show inline on the login screen: the API's message for invalid credentials (401/422), "Cannot reach server" if the server is down, and a link to Settings if no base URL is configured (no request is sent in that case).
- On start, the app opens `/dashboard` if a token is stored, otherwise `/login`.
- If any API call returns 401, the stored token is deleted and you are sent back to `/login`.

## Settings

Reachable from the login screen without signing in.

- Set the backend **base URL** (must be a valid http/https URL). It is saved as JSON in the app config directory.
- Saving a *different* base URL deletes the stored token, so you must sign in again against the new server.

## Dashboard

Placeholder screen shown after login. Content to come.

## API access (for contributors)

All network traffic goes through the single Rust `api_request` command (method + relative path + body). Rust adds the base URL and bearer token and handles 401 once, centrally. Screens use `src/services/api.ts` only. See `AGENTS.md` for the full architecture.
