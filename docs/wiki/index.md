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
- Saving a *different* base URL deletes the stored token, so you must sign in again against the new server. It also clears the locally cached notes.

## Dashboard

Placeholder screen shown after login. Content to come.

## Notes

Offline-first notes, available from **Notes** in the top bar (the HIVE logo returns to the dashboard). Notes live in a local SQLite database owned by Rust; the screen reads and writes only that database, so notes stay visible and editable when the server is unreachable.

- **Layout:** the list (title, last updated, newest first) takes the left 20%; the selected note takes the right 80%. **New note** creates one. Opening Notes selects the newest note.
- **Editing:** title, format (Plain or Markdown), body and tags. Changes save locally about half a second after you stop typing. Markdown notes use a live editor: Markdown renders as you type, in the same window (Noto Serif). Delete asks for confirmation.
- **Tags:** type in the tag field to get suggestions from tags already used locally; press Enter to add a new one. Tags are lowercased and de-duplicated.
- **Sync:** pushes local changes to the server, then pulls the server's notes. If a note has unsynced local changes, the server's version never overwrites it. A synced note deleted on the server disappears locally.
  - **Auto sync** (on by default, toggle in the Notes page header) runs every 2 minutes. With it off, nothing runs until you press **Sync** (also in the Notes page header). Edits are saved locally either way. The setting is kept across restarts.
  - A note that has not reached the server shows **Unsynced** in the list and in the note. If the server rejected it (for example, no tags), the server's message is shown beside it and the note stays local until you fix it.
  - A network error or an expired login stops the sync with a single attempt (no retry loop). An expired login sends you to `/login`; unsynced edits are kept.
- **Known limits:** each pull reads every page of notes, and there is no logout, so a different account on the same server sees the previous account's cached notes until the base URL changes.

## API access (for contributors)

All network traffic goes through the single Rust `api_request` command (method + relative path + body). Rust adds the base URL and bearer token and handles 401 once, centrally (`http::send_authed`, also used by notes sync). Screens use `src/services/api.ts` only. See `AGENTS.md` for the full architecture.
