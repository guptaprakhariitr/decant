// Engine bridge. In the packaged Tauri app this calls the bundled `decantd` binary via the
// Rust `invoke` commands. In browser dev (npm run dev) it falls back to the bundled sample so
// the UI is fully explorable without the toolchain.

export interface Citation {
  block_id: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
  valid: boolean;
}
export interface FieldResult {
  confidence: "high" | "medium" | "low";
  citations: Citation[];
}
export interface Extraction {
  schema: string;
  source: string;
  engine?: string; // adapter that produced this — "dry-run" means offline mock
  values: Record<string, unknown>;
  citations: Record<string, FieldResult>;
  issues: { field: string; problem: string }[];
}

export interface Availability {
  id: string;
  available: boolean;
  ready?: boolean;
  light?: "green" | "amber" | "gray";
  detail: string;
  egress: boolean;
  cost: string;
  vision?: boolean; // can accept page images (gates figure/chart extraction)
}

export function lightOf(a: Availability): "green" | "amber" | "gray" {
  if (a.light) return a.light;
  if (!a.available) return "gray";
  return (a.ready ?? a.available) ? "green" : "amber";
}

// Tauri injects window.__TAURI_INTERNALS__; detect it to choose real vs dev path.
const inTauri = typeof (globalThis as any).__TAURI_INTERNALS__ !== "undefined";

async function tauriInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export async function detect(): Promise<Availability[]> {
  if (inTauri) return tauriInvoke<Availability[]>("detect_adapters", {});
  // dev: load a real detection snapshot captured from `decantd detect --json` on this machine
  try {
    const res = await fetch("/samples/detect.json");
    if (res.ok) return res.json();
  } catch {
    /* fall through */
  }
  return [{ id: "dry-run", available: true, detail: "deterministic offline mock", egress: false, cost: "none" }];
}

import type { SchemaDef } from "./schemas.ts";
import type { PickedFile } from "./files.ts";

export type Mode = "fast" | "balanced" | "deep";
export interface ExtractOpts {
  localOnly?: boolean;
  mode?: Mode;
  pages?: string; // e.g. "1-3"
  imageB64?: string; // optional page image (Deep + vision) — base64 PNG, no data: prefix
  notes?: string; // extra per-job instructions appended to the model prompt
  vision?: boolean; // force the figure/chart vision pass
  adapter?: string; // pin a specific engine (e.g. "cursor"); empty = auto-pick by priority
}

export async function extract(file: string, schema: SchemaDef, opts: ExtractOpts = {}): Promise<Extraction> {
  // A real file path in the Tauri app → run the live engine (parses the PDF + calls the
  // user's Claude). Otherwise ("sample", or browser dev) → the bundled demo fixture.
  if (file !== "sample" && inTauri) {
    return tauriInvoke<Extraction>("extract", {
      file,
      schemaJson: JSON.stringify(schema),
      localOnly: !!opts.localOnly,
      mode: opts.mode ?? "balanced",
      pages: opts.pages ?? "",
      imageB64: opts.imageB64 ?? "",
      notes: opts.notes ?? "",
      vision: !!opts.vision,
      adapter: opts.adapter ?? "",
    });
  }
  const res = await fetch("/samples/invoice.extract.json");
  if (!res.ok) throw new Error(`could not load extraction (${res.status})`);
  return res.json();
}

export interface ParseBlock {
  block_id: string;
  page: number;
  type: string; // heading | paragraph | line | table | figure
  bbox: { x: number; y: number; w: number; h: number };
  text: string;
}
export interface ParsePage {
  page: number;
  width: number;
  height: number;
  blocks: ParseBlock[];
}
export interface ParseResult {
  source: string;
  markdown: string;
  pages?: ParsePage[]; // block model for layout overlays
}

export interface Chunk {
  id: string;
  text: string;
  heading: string | null;
  page_start: number;
  page_end: number;
  block_ids: string[];
  chars: number;
  tokens: number;
}
export interface ChunkResult {
  source: string;
  chunk_count: number;
  chunks: Chunk[];
}

// CHUNK mode: local, deterministic RAG chunks (no model, no tokens).
export async function chunkDoc(file: string, opts: ExtractOpts = {}): Promise<ChunkResult> {
  if (file !== "sample" && inTauri) {
    return tauriInvoke<ChunkResult>("chunk_doc", { file, pages: opts.pages ?? "" });
  }
  const res = await fetch("/samples/invoice.chunks.json");
  if (!res.ok) throw new Error(`could not load chunks (${res.status})`);
  return res.json();
}

// PARSE mode: full document → faithful Markdown (+ tables). Real engine in Tauri; sample in browser.
export async function parseDoc(file: string, opts: ExtractOpts = {}): Promise<ParseResult> {
  if (file !== "sample" && inTauri) {
    return tauriInvoke<ParseResult>("parse_doc", {
      file,
      localOnly: !!opts.localOnly,
      mode: opts.mode ?? "balanced",
      pages: opts.pages ?? "",
      notes: opts.notes ?? "",
      adapter: opts.adapter ?? "",
    });
  }
  const res = await fetch("/samples/invoice.parse.json");
  if (!res.ok) throw new Error(`could not load parse (${res.status})`);
  return res.json();
}

// Bytes of the actual opened document, so pdf.js renders *that* file (not the sample).
// Tauri: read from disk via the read_file command. Browser: the File handle. Null → sample.
export async function loadPdfBytes(picked?: PickedFile | null): Promise<ArrayBuffer | null> {
  if (!picked) return null;
  if (picked.file) return picked.file.arrayBuffer();
  if (picked.path && inTauri) {
    const buf = await tauriInvoke<ArrayBuffer>("read_file", { path: picked.path });
    return buf;
  }
  return null;
}

// The sample PDF is bundled into the app, so it renders in dev and in the packaged DMG.
export const samplePdfUrl = "/samples/invoice.pdf";
