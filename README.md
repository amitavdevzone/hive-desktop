# HIVE

A desktop developer assistant built with Tauri 2 (Rust) and React.

## Development

### Prerequisites

- Node.js and npm
- Rust (via [rustup](https://rustup.rs))
- Linux system packages (Debian/Ubuntu):

  ```sh
  sudo apt update
  sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  ```

  `libayatana-appindicator3` is required for the system tray (reminders keep running there when the window is closed).

  Other distros and macOS/Windows: see the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

### Run

```sh
npm install
npm run tauri dev
```

The first run compiles all Rust crates and takes a few minutes. The dev server uses port 1420; if it is busy, stop whatever holds it (`ss -ltnp | grep 1420`).

### Other commands

- `npm run dev`: frontend only, in the browser
- `npm run build`: type-check and build the frontend
- `npm run tauri build`: production app bundle
- `cd src-tauri && cargo check`: check the Rust code

## Docs

- [Architecture](docs/architecture/index.md)
- [Design guide](docs/architecture/design.md)
- [Plans](docs/plans/)
