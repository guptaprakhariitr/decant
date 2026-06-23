import { baseName, type PickedFile } from "./files.ts";
import type { Extraction, ParseResult, ChunkResult, Mode } from "./engine.ts";
import { SCHEMAS, type SchemaDef } from "./schemas.ts";
import type { IconName } from "../components/Icon.tsx";

export type JobStatus = "queued" | "extracting" | "needs_review" | "done" | "error";

export type Job = {
  id: string;
  name: string;
  kind: "file" | "folder";
  meta: string;
  status: JobStatus;
  schema: string; // display name (schemaDef.name)
  schemaDef: SchemaDef; // the actual schema sent to the engine (Auto / built-in / custom)
  mode: Mode;
  pages?: string; // optional page range, e.g. "1-3"
  notes?: string; // extra instructions passed to the model for this job
  vision?: boolean; // force figure/chart vision pass
  picked?: PickedFile; // present for user-opened files; absent for seed/demo jobs
  extraction?: Extraction | null;
  parse?: ParseResult | null; // PARSE mode result (markdown), computed lazily on demand
  chunks?: ChunkResult | null; // RAG chunks, computed lazily on demand
  error?: string;
  createdAt: number; // epoch ms — for sorting the Studio list by date
  timings?: { extract?: number; parse?: number; chunks?: number }; // seconds per step
  sample?: boolean; // bundled demo job (not the user's real document)
};

export const STATUS_META: Record<JobStatus, { label: string; tone: "amber" | "blue" | "green" | "red"; icon: IconName }> = {
  queued: { label: "Queued", tone: "blue", icon: "refresh" },
  extracting: { label: "Extracting…", tone: "blue", icon: "refresh" },
  needs_review: { label: "Needs review", tone: "amber", icon: "alert" },
  done: { label: "Done", tone: "green", icon: "check" },
  error: { label: "Failed", tone: "red", icon: "alert" },
};

let seq = 0;
export function jobFromPicked(p: PickedFile, schemaDef: SchemaDef, mode: Mode = "balanced", pages?: string, notes?: string): Job {
  const name = p.name;
  const ext = name.split(".").pop()?.toUpperCase();
  seq += 1;
  const now = Date.now();
  return {
    id: `job-${now}-${seq}`,
    name,
    kind: "file",
    meta: `${ext ?? "DOC"} · ${schemaDef.name}`,
    status: "queued",
    schema: schemaDef.name,
    schemaDef,
    mode,
    pages,
    notes,
    picked: p,
    extraction: null,
    createdAt: now,
  };
}

// One demo job so first run isn't empty (uses the bundled sample invoice).
export const SEED_JOBS: Job[] = [
  { id: "seed-1", name: "invoice-4820.pdf", kind: "file", meta: "Invoice · 1 page", status: "needs_review", schema: "Invoice", schemaDef: SCHEMAS.Invoice, mode: "balanced", createdAt: 0, sample: true },
];
