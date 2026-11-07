# AGENTS.md

Desktop Jarvis: a desktop app built with **Tauri** (Rust backend) and a **React** frontend.

> Status: planning. No code yet. Update this file as the stack and commands become real.

## Stack

- Shell/backend: Tauri (Rust), code in `src-tauri/`
- Frontend: React (TypeScript, Vite), code in `src/`
- Frontend talks to Rust via Tauri commands (`invoke`) and events

## Commands (standard Tauri scaffold; adjust if they change)

- Dev: `npm run tauri dev`
- Build: `npm run tauri build`
- Frontend only: `npm run dev`
- Rust check/test: `cd src-tauri && cargo check && cargo test`
- Lint: `cargo clippy` (Rust), `npm run lint` (frontend)

## Backend API & Auth

- The app consumes a Laravel API. Auth is Laravel Sanctum bearer tokens.
- Login: user submits email + password to the login endpoint; the response contains a Sanctum token.
- Store the token in the OS keychain from Rust (e.g. the `keyring` crate). Never use `localStorage`, plain files, or the frontend for token storage.
- Never persist or log the email/password. Pass them straight to the login request and drop them; clear them from React state afterward.
- All API calls go through Rust (single HTTP client), which reads the token from the keychain and sends `Authorization: Bearer <token>`. The frontend never sees the token.
- On a `401 Unauthenticated` from any call: delete the stored token, emit an event (e.g. `auth-expired`), and the frontend routes to the login page. Handle this once in the shared HTTP client, not per call site.
- Logout: call the API's logout endpoint (revokes the token), then delete the keychain entry.
- API base URL is configuration, not hardcoded.

## Architecture

Layers: React screens -> one frontend API service -> Tauri commands -> Rust (HTTP client, SQLite, keychain).

- **Frontend**: UI only. Screens never call `fetch`/`invoke` directly; they use a single service module (`src/services/api.ts`) that wraps `invoke('api_request', { method, path, body })`. Local-data access goes through similarly thin wrappers around commands.
- **`api_request` (Rust)**: the only network path.
  - Accepts method + relative path + body only. Rust prepends the configured base URL. Never accept a full URL or caller-supplied `Authorization` header.
  - Reads the token from the keychain and adds the bearer header.
  - On 401: delete the token, keep the request in memory (never on disk), emit `auth-expired`, and leave the original `invoke` pending.
  - After successful login: replay the held request and resolve the original call. Screens need no retry logic.
  - Drop the held request after a timeout (a few minutes), on login cancel, or if a different account logs in. Hold one pending request; concurrent 401s share a single re-login.
  - Only replay user-initiated requests, not background polling.
- **Local data**: SQLite owned by Rust (`rusqlite` or `tauri-plugin-sql`) for app data and settings. Secrets only in the keychain. Frontend has no direct filesystem access.

## Folder structure

```
src/                         # React frontend
  pages/
    <page>/
      index.tsx              # page layout; composes the pieces below
      <PageComponent>.tsx    # components used only by this page
      <Entity>Form.tsx       # one form for both add and edit
  components/                # shared across 2+ pages (nav, modal, ...)
  services/
    api.ts                   # the only module that calls invoke('api_request')
src-tauri/                   # Rust backend
  src/
    main.rs / lib.rs
    commands/                # #[tauri::command] fns, thin
    (http, db, auth modules added as they appear)
```

- Every page is a folder with an `index.tsx` that owns the main layout.
- Page-specific components live inside that page's folder.
- A component used by more than one page moves to `src/components/` (the same level as `pages/`). Don't pre-emptively put things there.
- Add/edit use one form component (`<Entity>Form.tsx`) that takes optional initial values. Never create separate Add and Edit forms. It lives in the page folder.

## Conventions

- Keep logic in Rust behind `#[tauri::command]` functions; React stays UI-only.
- Expose the minimum set of commands and Tauri capabilities/permissions needed.
- Validate all input crossing the `invoke` boundary on the Rust side.
- Return `Result<T, String>` (or a serializable error type) from commands, never panic.
- Prefer existing dependencies and the std library over new crates/packages.
- No speculative abstractions; add structure when a second use appears.

## Agent rules

- Read the relevant code before editing; run `cargo check` and the frontend build after changes.
- Don't commit secrets or API keys; keep them out of the frontend bundle.
- Ask before adding dependencies or changing `tauri.conf.json` permissions.
