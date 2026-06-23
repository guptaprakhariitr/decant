# Decant — security notes

## Local-only by default
The app runs on the user's own Claude; **Local-only mode** hard-blocks any egress adapter (the
API-key path). Documents never leave the Mac unless the user explicitly turns Local-only off.

## Vision via Claude Code CLI — prompt-injection trade-off (tracked)
The figure/OCR pass for the **claude-cli** adapter runs:
`claude -p … --permission-mode bypassPermissions --allowed-tools Read --image <temp.png>`.

- **Risk:** the page image / document content / user notes are attacker-controllable. With the **Read**
  tool enabled and permissions bypassed, a malicious document could instruct Claude to read another
  local file and place its contents into the extracted JSON (which the user then sees/exports). In
  Local-only mode there is **no network exfiltration**, but the value is still surfaced locally.
- **Current mitigation:** only the **Read** tool is allowed (no Write/Bash/network); the image is a
  temp file we create and delete; vision only fires when a vision-capable engine is ready.
- **Preferred path:** the **api-key** adapter uses **native API vision** (image content block, *no
  tools, no file access*) — strictly safer. When an API key is configured, vision should prefer it.
- **TODO:** route the vision pass to api-key when available; otherwise consider dropping
  `bypassPermissions` (accept a one-time permission prompt) or sandboxing the temp dir.

## Schema / image temp files
Per-call temp files (`decant-schema-<n>.json`, `decant-page-<n>.png`) are written to the OS temp dir
with a per-call counter and **removed after the run**. No secrets are written to disk by Decant.

## Secrets
No credential files are committed (enforced by `.gitignore` + global RULE #1). The API key is read
from the environment / keychain at runtime and stripped before claude-cli calls so the free seat is
used, not the metered key.
