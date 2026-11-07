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
