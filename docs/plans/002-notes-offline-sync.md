# Notes: top nav + offline-first notes with SQLite sync

Ticket: #3 (https://github.com/amitavdevzone/hive-desktop/issues/3)
Status: planned
Date: 2026-11-08

## Summary
Add a top navigation and an offline-first Notes screen. Notes are synced from the Laravel API (backend GH-2) into a local SQLite database owned by Rust; the UI reads and writes only the local DB. Edits are saved locally first and pushed by auto sync (every 2 minutes) or manually.

## Requirements
- Top nav: HIVE logo links to the dashboard; a Notes link opens `/notes`.
- Notes page: 30/70 split. Left: list (title, last updated, unsynced status), newest updated first. Right: the selected note.
- Notes are pulled from the server into SQLite and rendered from it.
- Formats: `plain` (shown as text) and `markdown` (Preview/Edit toggle; Preview renders, Edit is a textarea).
- Tags at the bottom of a note: add/remove chips with autocomplete from existing local tags (shadcn Command + Popover).
- Create, edit, delete notes; every change is saved to SQLite first (debounced), even in manual mode.
- Sync: push then pull; local wins on conflict. A failed push leaves the note unsynced, stores `last_error`, shows it in the UI, and does nothing else.
- Global sync mode: auto (every 2 minutes) or manual (Save/Sync button).

## Tasks
- [ ] Slice 1: `AppLayout` with top nav (logo to `/dashboard`, Notes link), move `HiveLogo` to `src/components/`, nest `/dashboard` and `/notes` under the layout route, empty Notes page
- [ ] Slice 2: add `rusqlite` (bundled); `db.rs` with schema, `Mutex<Connection>` managed state opened in `setup`
- [ ] Slice 2: `list_notes` and `get_note` commands; frontend wrappers in `services/api.ts`
- [ ] Slice 2: pull half of `sync.rs` (walk all pages, upsert synced rows, remove remotely deleted synced rows) and `sync_now`; emit `notes-changed`
- [ ] Slice 2: 30/70 Notes page with `NoteList` and read-only view (plain text, markdown preview via `react-markdown`)
- [ ] Slice 3: `create_note`, `save_note` (validation and tag normalisation), `delete_note`, `list_tag_names` commands
- [ ] Slice 3: `NoteForm` (title, format, body, Delete) with debounced save and Markdown Preview/Edit toggle; add shadcn `textarea`, `select`, `dialog`
- [ ] Slice 3: `TagInput` using shadcn Command + Popover with autocomplete from local tags
- [ ] Slice 4: push half of `sync.rs` (POST/PUT/DELETE, `last_error`, stop on network error or 401)
- [ ] Slice 4: extract the 401 handling from `api_request` into a shared helper and reuse it in sync
- [ ] Slice 4: unsynced indicator in list and note with error reason; wipe local DB when the base URL changes
- [ ] Slice 4: `auto_sync` setting (get/set commands, in `settings.json`), top-bar toggle and Sync button, 2-minute timer in `AppLayout`
- [ ] Rust unit tests on in-memory SQLite; `cargo check`/`clippy`/`test`, `npm run build`/`lint`
- [ ] Update `docs/wiki/index.md` with a Notes section

## Acceptance criteria
1. AC1: The top nav shows the HIVE logo and a Notes link on authenticated pages; the logo opens `/dashboard` and Notes opens `/notes`.
2. AC2: `/notes` shows a 30/70 layout with the list on the left and the selected note on the right.
3. AC3: After login the server notes are in local SQLite and the list renders from it (still visible when the server is unreachable).
4. AC4: The list is ordered by last updated, newest first, each row showing title and last updated time.
5. AC5: A plain note is shown as text; a markdown note has a Preview/Edit toggle (Preview renders markdown, Edit shows a textarea).
6. AC6: Tags can be added and removed on a note, with autocomplete suggestions from existing tags.
7. AC7: Creating, editing or deleting a note writes to SQLite immediately and marks the note unsynced.
8. AC8: When a sync succeeds the note is marked synced and the server has the change.
9. AC9: When a push fails the note stays unsynced, the error is stored, and an unsynced indicator with the reason is shown; no retry loop runs.
10. AC10: A note with unsynced local changes is never overwritten by a pull; a synced note deleted on the server is removed locally.
11. AC11: In auto mode a sync runs every 2 minutes; in manual mode nothing runs automatically and the Sync button pushes changes.
12. AC12: The sync mode is a global setting that persists across restarts.
13. AC13: A 401 during sync routes to login and keeps unsynced local edits.
14. AC14: A note the server rejects (e.g. no tags) stays local with the server's message shown.

## Test cases
- AC1 -> Given I am logged in, when I click the logo, then `/dashboard` opens; when I click Notes, then `/notes` opens.
- AC2 -> Given I open `/notes`, then the list takes about 30% width and the note about 70%.
- AC3 -> Given a first sync completed, when the server is stopped and I reopen Notes, then the same notes are listed. (Rust test: pull upserts pages into an in-memory DB.)
- AC4 -> Given notes with different updated times, then the list is newest first; editing an older note moves it to the top. (Rust test on `list_notes` ordering.)
- AC5 -> Given a plain note, then text is shown; given a markdown note, when I toggle Preview, then `**bold**` renders bold, and Edit shows a textarea.
- AC6 -> Given existing tags `server` and `office`, when I type `se`, then `server` is suggested; adding then removing a tag updates the note.
- AC7 -> Given I edit a synced note, then SQLite row is `dirty` with a new `updated_at`. (Rust test.) Deleting a never-pushed note removes the row; deleting a synced note marks it `deleted`.
- AC8 -> Given a dirty note, when sync succeeds, then it is `synced` and the API returns the change.
- AC9 -> Given the server is down, when sync runs, then the note stays dirty, `last_error` is set, the badge shows, and only one attempt is made.
- AC10 -> Given a dirty row and a different server version, when pull runs, then the dirty row is unchanged. Given a synced row missing from the server, then it is removed. (Rust tests.)
- AC11 -> Given auto mode, then a sync fires after 2 minutes; given manual mode, then none fires until I click Sync.
- AC12 -> Given I switch to manual and restart the app, then it is still manual.
- AC13 -> Given an expired token, when sync runs, then `auth-expired` routes to login and dirty rows remain.
- AC14 -> Given a note with no tags, when it is pushed, then the 422 message is shown on it and it stays dirty.

## Architectural decisions
- SQLite via `rusqlite` (bundled), owned by Rust, so the frontend never touches SQL (AGENTS.md: local data owned by Rust). Approved dependency.
- Sync runs entirely in Rust through the single `http::send` client; the UI only triggers it, so all network goes through the one path (AGENTS.md architecture).
- Push before pull, one run at a time, stop on network error or 401 to avoid retry loops.
- Local wins on conflict: a pull never touches a non-synced row. Chosen for simplicity (single user).
- Tags stored as a JSON array column; autocomplete via `json_each`. No tags table until needed.
- Sync mode is global, stored in the existing `settings.json` `Settings` struct.
- Manual mode still saves edits locally at once; the button only controls the server push.
- Invalid-for-server notes are kept locally and show the server message (no duplicated validation in the app).
- Tag autocomplete uses shadcn Command + Popover per `docs/architecture/index.md` ("don't hand-roll primitives shadcn provides"). New dependencies: `rusqlite`, `react-markdown`, and `cmdk` via shadcn.
- `HiveLogo` moves from `pages/login/` to `src/components/` because it is now used by more than one place.
- UI follows `docs/architecture/design.md` (dark, `#FFC400` accent).
- Local timestamps are normalised to UTC `YYYY-MM-DDTHH:MM:SSZ` through SQLite `strftime` so string ordering is consistent.

## Out of scope
- Conflict UI or merge; per-note sync mode.
- Logout and wiping the DB on account switch (no logout exists yet).
- Server-side changes (`updated_since`, soft deletes).
- Note search and tag filter UI.

## Open questions
- Known gap: with no logout, a different account on the same server would see the previous account's cached notes until the base URL changes.
- Every pull walks all pages (backend has no `updated_since`); revisit if notes reach the thousands.
