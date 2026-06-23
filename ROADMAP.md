# Roadmap

Decant is local-first, $0-inference (your own Claude), citation-grounded, and open-source (shell).
Near-term, in rough priority:

- **Split** — segment a packet into labeled sections (e.g. a statement bundling several accounts).
- **Local MCP server** — expose `extract / parse / chunk` as tools so agents in Claude Code / Cursor can call Decant directly (private, $0).
- **Batch / folder runs** — run a folder and export one combined CSV/JSONL.
- **Figure descriptions** — natural-language captions for charts/figures (Deep + vision).
- **Scanned-doc upgrade** — stronger layout + table reconstruction for photographed/scanned pages, behind the same block-model interface.
- **Platforms** — Apple-Silicon first; Intel macOS and other OSes later.

Deliberately out of scope (would break the local-first, $0, private model): credit metering, cloud webhooks, a hosted Studio. See [docs/USE-CASES.md](docs/USE-CASES.md) for how Decant differs from cloud APIs.

Have a use case or request? Open an issue.
