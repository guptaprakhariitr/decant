# Contributing to Decant

Thanks for your interest! This repo is the **app shell** — the React/Tauri UI, the Rust shell that
drives the engine, and the CLI surface. The document **engine** (`decantd`) is a separate,
closed-source binary; contributions here are to the shell.

## What's welcome
- UI/UX fixes and features in `app/`
- Tauri/Rust shell improvements in `src-tauri/`
- Docs, examples, accessibility, bug reports, and reproducible issues

## Run it locally
```bash
cd app && npm install && npm run dev     # UI only, in the browser
```
For the full native app, install the toolchain and drop the engine binary in
`src-tauri/binaries/` (from Releases) — see the README's "build the shell from source".

## Pull requests
- Keep PRs focused; describe the change and how you tested it.
- Match the surrounding code style (TS/React in `app/`, idiomatic Rust in `src-tauri/`).
- The shell is **AGPL-3.0** — by contributing you agree your contribution is licensed under it.
- Don't commit secrets or the engine binary (both are gitignored; keep it that way).

## Security
Please report vulnerabilities privately — see [docs/SECURITY.md](docs/SECURITY.md).
