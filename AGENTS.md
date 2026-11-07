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
