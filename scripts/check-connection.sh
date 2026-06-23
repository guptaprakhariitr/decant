#!/usr/bin/env bash
# Verify Decant's connection to YOUR Claude works end-to-end, through the shipped engine binary.
# Run after installing the Claude Code CLI (`claude`) and/or Cursor (`cursor-agent`).
# Usage: scripts/check-connection.sh [claude-cli|cursor|api-key] [path/to.pdf]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TRIPLE="aarch64-apple-darwin"
BIN="${DECANT_ENGINE:-$ROOT/src-tauri/binaries/decantd-$TRIPLE}"
[ -x "$BIN" ] || { echo "engine binary not found at $BIN — download it from Releases into src-tauri/binaries/ (or set DECANT_ENGINE)"; exit 1; }

PDF="${2:-$ROOT/app/public/samples/invoice.pdf}"
SCHEMA="$(mktemp -t decant-schema).json"
trap 'rm -f "$SCHEMA"' EXIT
cat > "$SCHEMA" <<'JSON'
{ "name": "Invoice", "fields": [
  { "name": "invoice_number", "type": "string",   "required": true },
  { "name": "total",          "type": "currency", "required": true }
] }
JSON

echo "── adapters available here ──"
"$BIN" detect

echo
echo "── live extract through your real engine (no --adapter = auto-pick best non-dry-run) ──"
PREF="${1:-}"            # optionally: claude-cli | cursor | api-key
ARGS=( extract "$PDF" "$SCHEMA" )
[ -n "$PREF" ] && ARGS+=( --adapter "$PREF" )

OUT="$("$BIN" "${ARGS[@]}")"
echo "$OUT" | head -c 600; echo

echo "$OUT" | grep -q '"values"'      || { echo "FAIL: no values"; exit 1; }
echo "$OUT" | grep -q '"block_id"'    || { echo "FAIL: no citations"; exit 1; }
echo "$OUT" | grep -q '"valid": true' || { echo "FAIL: no valid citation resolved to a bbox"; exit 1; }
echo
echo "✓ PASS — your Claude produced cited, validated JSON. Connection works."
