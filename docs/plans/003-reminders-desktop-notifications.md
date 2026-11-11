# Reminders: frontend and native OS notifications

Ticket: #5 (https://github.com/amitavdevzone/hive-desktop/issues/5)
Status: planned
Date: 2026-11-11

## Summary
Desktop side of the reminders API (backend: GH-3, `003-reminders-api.md`). A Reminders page manages reminders; a Rust-owned scheduler fires native OS notifications, including from the system tray when the window is closed. The server does no due-tracking, so the app schedules everything itself.

## Requirements
- Rust scheduler (not React timers; webview timers are throttled/suspended when hidden) fires notifications via `tauri-plugin-notification`.
- Local SQLite cache of active reminders. Create/update/delete/list go online through `api_request`; no offline edit sync.
- System tray (Show/Quit); closing the window hides it instead of quitting.
- Reminders page: list, All/Active filter, add/edit with one form, toggle active, delete.

## Tasks
- [x] Slice 1, Rust: add `tauri-plugin-notification` (Cargo, `lib.rs`, `capabilities/default.json` `notification:default`); request permission at startup (macOS)
- [x] Slice 1: `reminders` table in `db.rs` `SCHEMA` (`remote_id` PK, title, notes, type, remind_at, interval_minutes, is_active, created_at, last_fired_at)
- [x] Slice 1: `reminders.rs` with `pull_reminders` (GET `/api/reminders?active=1` via `send_authed`, walk pages, upsert keeping local `last_fired_at`, prune missing) and `refresh_reminders` command registered in `lib.rs`
- [x] Slice 1: pure `due()` decision fn + `cargo test` unit tests (once, recurring, overdue, stale)
- [x] Slice 1: scheduler loop (30s tick) firing notifications; start it from `setup`
- [x] Slice 1: tray (`tray-icon` feature on `tauri`) with Show/Quit; hide on `CloseRequested`
- [ ] Slice 1: manual check with a 1-minute recurring reminder created in Bruno
- [ ] Slice 2: `api.ts` types and wrappers (`Reminder`, list/create/update/delete via `request()`, `refreshReminders`)
- [ ] Slice 2: `npx shadcn@latest add switch`
- [ ] Slice 2: `pages/reminders/index.tsx`, `ReminderList.tsx`, `ReminderForm.tsx` (per `design.md`)
- [ ] Slice 2: route `/reminders` in `App.tsx`, nav link in `AppLayout.tsx`, call `refreshReminders` on the 2-min sync tick and after writes
- [ ] Slice 3: wiki section, README/AGENTS notes (Linux needs `libayatana-appindicator3`), archive plan

## Acceptance criteria
1. AC1: Active reminders are pulled and cached on startup (after auth), after each UI write, and on the 2-min sync tick; inactive or deleted ones leave the cache.
2. AC2: A due one-time reminder fires one OS notification, exactly once.
3. AC3: A one-time reminder overdue by < 24h at startup/sync fires once; overdue by >= 24h is marked fired silently.
4. AC4: A recurring reminder fires every N minutes while the app runs.
5. AC5: A recurring reminder overdue after downtime fires once, then restarts its interval from now.
6. AC6: Deactivating or deleting a reminder stops its notifications.
7. AC7: Changing `remind_at`/`interval_minutes` or reactivating resets its fired state.
8. AC8: Cached reminders still fire when the network is down.
9. AC9: Closing the window hides to tray; the scheduler keeps running; tray offers Show and Quit.
10. AC10: The Reminders page lists reminders with All/Active filter, type summary ("Once, <date>" / "Every N min") and an empty state.
11. AC11: The form creates once/recurring reminders (ISO 8601 with offset) and shows 422 field errors.
12. AC12: The same form edits; changing type sends the matching field and null for the other.
13. AC13: The user can toggle active and delete from the list.

## Test cases
- AC2 -> Given a cached once reminder with `remind_at` 1 min ago and no `last_fired_at`, when the scheduler ticks, then one notification fires and `last_fired_at` is set; next tick fires nothing.
- AC3 -> Given `remind_at` 3h ago, fires once; given 30h ago, no notification but `last_fired_at` is set. (`due()` unit tests)
- AC4/AC5 -> Given interval 30 and `last_fired_at` 31 min ago, `due()` is true and next fire is now + 30 min; given 10 min ago, false. (unit tests)
- AC1/AC6/AC7 -> Pull upsert test: row stays after pull keeps `last_fired_at`; changed `remind_at` clears it; id absent from server is pruned.
- AC8, AC9 -> Manual: disconnect network, a cached 1-min recurring reminder still fires; close window, it still fires; tray Show restores, Quit exits.
- AC10-AC13 -> Manual in `npm run tauri dev` against the local API: list/filter/empty state, create once and recurring, trigger a 422, edit with type change, toggle, delete.
- Also: `cargo check && cargo clippy`, `npm run build`, `npm run lint`.

## Architectural decisions
- Scheduler lives in Rust; React is UI only (AGENTS.md "logic in Rust"; hidden webview timers are unreliable).
- No CRUD Tauri commands: the UI uses `api_request` (single network path), then calls `refresh_reminders`.
- Cache is a plain mirror with local-only `last_fired_at`; no dirty/deleted sync status (reminders are small, rarely edited offline).
- Missed one-timers: fire if < 24h overdue, else mark fired silently. Missed recurring: fire once, restart interval from now (no catch-up burst).
- Per-reminder `is_active` is the only control; no global notifications setting.
- New dependency `tauri-plugin-notification` and the `tray-icon` feature on `tauri` (AGENTS.md: ask before adding dependencies; approved by filing this plan).
- Desktop notification click actions are not delivered to the app, so a click only dismisses.
- UI follows shadcn + `docs/architecture/design.md`.

## Out of scope
- Snooze/acknowledge, daily-at-time or cron schedules, offline edits, notification click actions, autostart at login, global notifications toggle.

## Open questions
- On logout or `auth-expired`, should cached reminders keep firing or should the cache be cleared? (Default proposal: clear on logout/different account, keep firing on a plain 401 until re-login.)
