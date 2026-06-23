# Decant — Accuracy

How Decant keeps extraction accurate. The model does one step; most accuracy work is
**deterministic post-processing + tests** that run locally and for $0. The layers below are all
implemented.

## The accuracy layers
1. **Cross-check engine**: rules run locally after extraction —
   - arithmetic: `sum(line_items.amount) ≈ subtotal`, `subtotal + tax ≈ total`, `qty*unit ≈ amount` per row;
   - dates: `invoice_date ≤ due_date`, plausible year; 
   - presence: required-ish fields; — each emits an issue + downgrades confidence. **Generic + schema-aware.**
2. **Grounding verification**: normalize value + cited block text, assert the value
   (or its digits) appears in the block; if not → `valid:false` + "ungrounded" issue + low confidence.
   Kills hallucinations automatically.
3. **Type normalization**: currency→number, date→ISO, numbers de-formatted; store both
   raw + normalized; validation runs on normalized.
4. **Confidence recalibration**: final confidence = f(model_conf, grounded?, type_valid?, cross_checks_pass?).
   Evidence-based, not the model's say-so.
5. **Prompt hardening**: "quote the value **verbatim** from the document; null if absent; never guess;
   block_ids must contain the exact source text" + a compact few-shot for invoices/tables.
6. **JSON self-repair**: on parse/validation failure, re-prompt once with the error → far fewer hard fails.
7. **Self-consistency (Deep)**: run extraction 3× for low-confidence/critical fields, take consensus.
8. **Static/golden tests**: fixtures with known expected values + expected cross-check
   verdicts; assert the deterministic layers (normalize, ground, cross-check, confidence) — runs in CI,
   no model, deterministic. This is the regression guard that makes accuracy *stay* high.

## Build order
1 → 2 → 3 → 4 (the deterministic core) + 8 (tests) — all **offline-verifiable**, biggest accuracy lift,
zero token cost. Then 5 (prompts) + 6 (repair). Then 7 (self-consistency, Deep, opt-in tokens).
