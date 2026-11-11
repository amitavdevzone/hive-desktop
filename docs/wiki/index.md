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

## Reminders

Desktop reminders that fire native OS notifications, available from **Reminders** in the top bar. They are managed online through the API (create, edit, toggle, delete); the app keeps a local SQLite cache of the **active** ones and a Rust scheduler fires notifications from that cache, so they still fire with the network down.

- **Screen:** stat tiles (Active, Paused, Recurring, Upcoming) and sections for **Upcoming** (one-time, with a Next 7 / 30 days / All filter), **Recurring**, **Past** (active one-time reminders whose time has passed) and **Paused**. Each row shows the title, a summary ("Once, Dec 1, 2026, 2:00 PM" or "Every 30 min"), a badge (when it fires, "Next: in 28 min", or Paused), an active switch, edit and delete. The **Show** dropdown filters All / Active / Paused. Delete asks for confirmation.
- **Add / edit:** one form in a dialog. Title is required; **Once** takes a date and time (sent as ISO 8601 with the local offset), **Recurring** takes an interval in minutes. Server validation errors show under the field. The API rejects `null` for the field that does not apply, so create sends only the matching one; editing sends `null` for the other only when the type changes.
- **Cache:** active reminders are pulled on startup (after login), after every change made in the app, and on the 2-minute sync tick. Inactive or deleted reminders leave the cache. Changing a reminder's time or interval resets its fired state.
- **When they fire:** the scheduler checks every 30 seconds, in Rust (not the webview, which is throttled when hidden).
  - A one-time reminder fires once. If the app was closed when it came due, it still fires once when overdue by less than 24 hours; older than that it is marked fired silently.
  - A recurring reminder fires every N minutes, counted from its last fire (from creation if it never fired). After downtime it fires once and restarts its interval from then, with no catch-up burst.
- **System tray:** closing the window hides it to the tray and the scheduler keeps running. The tray menu has **Notifications**, **Show** and **Quit**. Untick **Notifications** to silence everything without opening the app; the choice is saved across restarts. While off nothing fires and nothing is marked fired, so on re-enable the rules above apply.
- **Linux:** the tray needs `libayatana-appindicator3` (see the README prerequisites). On macOS the app asks for notification permission at first start.
- **Known limits:** no snooze or acknowledge, no daily/cron schedules, no offline edits, and clicking a notification only dismisses it. If a login expires, cached reminders keep firing until you sign in again.

## API access (for contributors)

All network traffic goes through the single Rust `api_request` command (method + relative path + body). Rust adds the base URL and bearer token and handles 401 once, centrally (`http::send_authed`, also used by notes sync). Screens use `src/services/api.ts` only. See `AGENTS.md` for the full architecture.
