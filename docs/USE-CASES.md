# Decant — what it's for

Decant turns documents (PDF · scans · images · XLSX) into clean, **cited** structured data, running
the AI step on an engine **you already have** — Claude Code, Cursor, an Anthropic API key, or a local
model. $0 inference, and nothing leaves your Mac.

It does three jobs, all from the same local block model:

| Job | What you get | Export |
|-----|--------------|--------|
| **Extract** | The fields & tables you ask for (auto-discovered or via a schema), each value cited to its source box on the page | JSON · CSV |
| **Parse** | The whole document as clean Markdown + a typed block layout (heading / table / text / figure) | Markdown |
| **Chunk** | Retrieval-ready chunks with page provenance for RAG | JSONL |

## Who it's for

- **Analysts / ops** — pull fields off invoices, receipts, bank statements, KYC forms, and contracts into JSON/CSV, on-device.
- **RAG / data engineers** — parse + chunk private corpora locally into JSONL; zero egress, $0 per page.
- **Developers** — script `decantd` in pipelines (`extract / parse / chunk`), or use the desktop app; every value carries `{value, confidence, citations[]}`.
- **Privacy-bound teams** (finance, legal, healthcare, gov) — documents physically never leave the machine; parsing & OCR even work offline.

## Concrete examples

- Invoice / PO → `{invoice_number, date, line_items[], total}` with each value boxed on the page.
- Bank statement → account summary + a multi-page transaction array, fully cited.
- KYC / biodata / ID forms → flat key/values via Auto-discover (no schema needed).
- Contract → nested terms + enums; checkbox/enum forms → typed booleans.
- Research report / filing → Markdown for reading + JSONL chunks for a local RAG index.

## Why local-first

- **Private** — your documents never touch a server; a hard local-only switch blocks any egress.
- **$0 inference** — the AI runs on a seat you already pay for (or a local model), not a metered API.
- **Cited & grounded** — every value is checked against the block it came from, and unverifiable citations are flagged for review.
- **Yours** — open-source shell, self-contained binary, no account or lock-in.
