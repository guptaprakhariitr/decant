import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { extract, parseDoc, chunkDoc, loadPdfBytes, samplePdfUrl, type Extraction, type Mode } from "../lib/engine.ts";
import { SCHEMAS } from "../lib/schemas.ts";
import { Icon } from "../components/Icon.tsx";
import { Dropdown } from "../components/Dropdown.tsx";
import { Processing } from "../components/Processing.tsx";
import { Markdown } from "../components/Markdown.tsx";
import { ElapsedTimer } from "../components/ElapsedTimer.tsx";
import { saveDownload } from "../lib/files.ts";
import { pushToast } from "../lib/toast.ts";
import type { Job } from "../lib/jobs.ts";

function copyText(s: string) {
  navigator.clipboard?.writeText(s).then(() => pushToast("Copied to clipboard")).catch(() => pushToast("Copy failed", "err"));
}
function download(name: string, text: string, type = "text/plain") {
  saveDownload(name, text, type)
    .then((p) => p && pushToast(`Saved to ${p}`))
    .catch((e) => pushToast(String(e?.message ?? e), "err"));
}

// Worker served from public/ — a stable absolute path that resolves in dev and in the
// packaged app (Vite's ?url import 404'd against node_modules in dev).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const SCALE = 2; // render the page at 2x PDF points → crisp + roomy
const GAP_PT = 14; // vertical gap between stacked pages, in PDF points
const MAX_RENDER_PAGES = 20; // cap rasterized pages to bound memory on huge PDFs
const MODE_LABEL: Record<Mode, string> = { fast: "Fast", balanced: "Balanced", deep: "Deep" };
const MODE_VAL: Record<string, Mode> = { Fast: "fast", Balanced: "balanced", Deep: "deep" };

export function Review({
  job,
  localOnly,
  onApprove,
  onRerun,
  onParsed,
  onChunked,
  onBack,
  onExtractionChange,
  engineAdapter,
}: {
  job?: Job | null;
  localOnly?: boolean;
  onApprove?: () => void;
  onParsed?: (id: string, parse: Job["parse"], secs?: number) => void;
  onChunked?: (id: string, chunks: Job["chunks"], secs?: number) => void;
  onRerun?: (patch?: { notes?: string; mode?: Mode; pages?: string; vision?: boolean }) => void;
  onBack?: () => void;
  onExtractionChange?: (id: string, extraction: Extraction) => void;
  engineAdapter?: string;
}) {
  const [tab, setTab] = useState<"extract" | "parse" | "chunks">("extract");
  const [view, setView] = useState<"formatted" | "json">("formatted"); // Extract: field list vs raw JSON
  const [editKey, setEditKey] = useState<string | null>(null); // field whose value is being fixed
  const [editVal, setEditVal] = useState("");
  // per-job options (editable here, applied on Reparse)
  const [noteDraft, setNoteDraft] = useState(job?.notes ?? "");
  const [optMode, setOptMode] = useState<Mode>(job?.mode ?? "balanced");
  const [optPages, setOptPages] = useState(job?.pages ?? "");
  const [optVision, setOptVision] = useState(!!job?.vision);
  useEffect(() => {
    setNoteDraft(job?.notes ?? "");
    setOptMode(job?.mode ?? "balanced");
    setOptPages(job?.pages ?? "");
    setOptVision(!!job?.vision);
    setEditKey(null);
    setView("formatted");
  }, [job?.id]);
  const reparse = () =>
    onRerun?.({ notes: noteDraft.trim() || undefined, mode: optMode, pages: optPages.trim() || undefined, vision: optVision });
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [chunkLoading, setChunkLoading] = useState(false);
  const [chunkError, setChunkError] = useState<string | null>(null);
  const docName = job?.name ?? "invoice-4820.pdf";
  const inFlight = job?.status === "queued" || job?.status === "extracting";
  const [data, setData] = useState<Extraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  // Click-to-navigate, both directions: select a field, scroll its first citation into view in the
  // document AND scroll its row into view in the results. (Hover only highlights — no scroll.)
  function navTo(k: string) {
    setActive(k);
    requestAnimationFrame(() => {
      try {
        paneRef.current?.querySelector(`[data-fk="${CSS.escape(k)}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch {}
      rowRefs.current[k]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  // Review actions on flagged (low-confidence / validation-failed) fields. Edits are kept locally
  // AND pushed up so the job's saved extraction reflects the human review.
  function commitData(next: Extraction) {
    setData(next);
    if (job) onExtractionChange?.(job.id, next);
  }
  function approveField(k: string) {
    if (!data) return;
    commitData({ ...data, issues: data.issues.filter((i) => i.field !== k) });
  }
  function startFix(k: string) {
    setEditKey(k);
    setEditVal(data?.values[k] == null ? "" : String(data.values[k]));
  }
  function saveFix(k: string) {
    if (!data) return;
    commitData({ ...data, values: { ...data.values, [k]: editVal }, issues: data.issues.filter((i) => i.field !== k) });
    setEditKey(null);
  }
  // per-page size in PDF points (canvas bitmaps are SCALE× this for crispness)
  const [pageDims, setPageDims] = useState<{ w: number; h: number }[]>([]);
  const [extraPages, setExtraPages] = useState(0); // pages beyond the render cap (large PDFs)
  const [pane, setPane] = useState({ w: 0, h: 0 });
  // null = "fit to view" (auto); a number = explicit zoom (1 = 100%)
  const [zoom, setZoom] = useState<number | null>(null);

  function loadSample() {
    setData(null);
    setError(null);
    extract("sample", job?.schemaDef ?? SCHEMAS.Auto, { localOnly: !!localOnly, mode: job?.mode })
      .then(setData)
      .catch((e) => setError(String(e?.message ?? e)));
  }

  // Pick where the fields come from: the job's real extraction, an error, a spinner while it
  // runs, or the bundled sample for seed/demo jobs.
  useEffect(() => {
    setError(null);
    if (!job) return loadSample();
    if (job.status === "error") return setError(job.error ?? "Extraction failed");
    if (job.extraction) return setData(job.extraction);
    if (inFlight) return setData(null); // spinner
    loadSample(); // seed/demo job with no real extraction
  }, [job?.id, job?.status, job?.extraction]);

  // Render the ACTUAL opened document — EVERY page, stacked vertically into its own canvas.
  // (Earlier this rendered only page 1, so multi-page citations/blocks all piled onto page 1.)
  useEffect(() => {
    if (inFlight) return; // canvas isn't mounted while the spinner shows
    let cancelled = false;
    let doc: any = null;
    (async () => {
      try {
        const bytes = await loadPdfBytes(job?.picked);
        const src = bytes ? { data: new Uint8Array(bytes) } : samplePdfUrl;
        doc = await pdfjs.getDocument(src as any).promise;
        if (cancelled) return;
        const total = doc.numPages as number;
        const n = Math.min(total, MAX_RENDER_PAGES);
        const stack = stackRef.current;
        if (!stack) return;
        stack.replaceChildren(); // clear any previous job's pages
        const dims: { w: number; h: number }[] = [];
        for (let p = 1; p <= n; p++) {
          const page = await doc.getPage(p);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: SCALE });
          const canvas = document.createElement("canvas");
          canvas.className = "pagecanvas";
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          if (p < n) canvas.style.marginBottom = `${GAP_PT * SCALE}px`;
          stack.appendChild(canvas);
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          dims.push({ w: viewport.width / SCALE, h: viewport.height / SCALE });
          if (!cancelled) setPageDims([...dims]); // progressive: pages appear as they finish
        }
        if (!cancelled) setExtraPages(Math.max(0, total - n));
      } catch (e) {
        console.error("[Decant] pdf render failed:", e);
      } finally {
        await doc?.destroy?.(); // free the PDF transport/buffers — no leak across job switches
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job?.id, inFlight, data !== null]);

  // keep the available pane size current so "fit" recomputes on window resize
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPane({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  // Parse mode runs lazily — only when the user opens the Parse tab (and isn't re-run if cached).
  useEffect(() => {
    if (tab !== "parse" || !job || job.parse || parseLoading) return;
    setParseLoading(true);
    setParseError(null);
    const t0 = Date.now();
    parseDoc(job.picked?.path ?? "sample", { localOnly: !!localOnly, mode: job.mode, pages: job.pages, adapter: engineAdapter })
      .then((r) => onParsed?.(job.id, r, (Date.now() - t0) / 1000))
      .catch((e) => setParseError(String(e?.message ?? e)))
      .finally(() => setParseLoading(false));
  }, [tab, job?.id, job?.parse]);

  // Chunks run lazily — only when the Chunks tab is opened (local, instant), cached on the job.
  useEffect(() => {
    if (tab !== "chunks" || !job || job.chunks || chunkLoading) return;
    setChunkLoading(true);
    setChunkError(null);
    const t0 = Date.now();
    chunkDoc(job.picked?.path ?? "sample", { pages: job.pages })
      .then((r) => onChunked?.(job.id, r, (Date.now() - t0) / 1000))
      .catch((e) => setChunkError(String(e?.message ?? e)))
      .finally(() => setChunkLoading(false));
  }, [tab, job?.id, job?.chunks]);

  const PAD = 36; // breathing room inside the pane
  // document dimensions in PDF points: widest page, total height incl. inter-page gaps
  const maxW = pageDims.reduce((m, d) => Math.max(m, d.w), 0);
  const totalH =
    pageDims.reduce((s, d) => s + d.h, 0) + GAP_PT * Math.max(0, pageDims.length - 1);
  // multi-page docs scroll vertically → fit to width
  const fitZoom = maxW && pane.w ? (pane.w - PAD) / maxW : 1;
  const effZoom = zoom ?? fitZoom;
  const clamp = (z: number) => Math.min(5, Math.max(0.1, z));
  const dispW = maxW * effZoom;
  const dispH = totalH * effZoom;
  const tScale = effZoom / SCALE; // canvas bitmap → display
  // vertical offset (in canvas-bitmap px) of a page's top within the stack
  const pageTopPx = (idx: number) =>
    pageDims.slice(0, idx).reduce((s, d) => s + (d.h + GAP_PT) * SCALE, 0);

  // Trackpad pinch-zoom on the document (pinch → ctrl+wheel). Non-passive so we can preventDefault.
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // plain scroll stays scroll; pinch/⌘-zoom adjusts zoom
      e.preventDefault();
      setZoom((z) => clamp((z ?? fitZoom) * (1 - e.deltaY * 0.01)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fitZoom, data]);

  if (error)
    return (
      <div className="empty">
        <div className="empty-ic err"><Icon name="alert" size={34} /></div>
        <b>Couldn’t extract this document</b>
        <p>{error}</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn pri" onClick={() => (onRerun ? onRerun() : loadSample())}><Icon name="refresh" size={14} />Retry</button>
          {onBack && <button className="btn" onClick={onBack}><Icon name="back" size={14} />Back to list</button>}
        </div>
      </div>
    );

  if (inFlight || !data) return <Processing fileName={docName} queued={job?.status === "queued"} />;

  const fieldKeys = Object.keys(data.values);
  const issuesByField = new Set(data.issues.map((i) => i.field));
  const issueMsg = new Map(data.issues.map((i) => [i.field, i.problem]));
  // sort: issues / low-confidence first (needs-attention)
  const ordered = [...fieldKeys].sort((a, b) => {
    const score = (k: string) => (issuesByField.has(k) ? 0 : data.citations[k]?.confidence === "low" ? 1 : 2);
    return score(a) - score(b);
  });
  // Per-field colors — purely for visual clarity (so each highlight maps to its row), NOT confidence.
  // Solid border + a LIGHT, see-through interior so the underlying text stays readable (and so
  // overlapping citations don't stack into an opaque blob). Active state is shown via the border.
  const colorOf = (k: string) => {
    const hue = (Math.max(0, ordered.indexOf(k)) * 47) % 360;
    return { stroke: `hsl(${hue} 65% 42%)`, fill: `hsl(${hue} 70% 50% / 0.10)`, strong: `hsl(${hue} 70% 50% / 0.20)` };
  };

  return (
    <div className="review">
      <div className="docpane">
        <div className="doctitle" title={docName}>
          <Icon name="file" size={14} />
          <span>{docName}</span>
        </div>
        <div className="zoombar">
          <button className="zbtn" title="Zoom out" onClick={() => setZoom(clamp(effZoom / 1.2))}><Icon name="minus" size={15} /></button>
          <button className="zpct" title="Reset to fit" onClick={() => setZoom(null)}>{Math.round(effZoom * 100)}%</button>
          <button className="zbtn" title="Zoom in" onClick={() => setZoom(clamp(effZoom * 1.2))}><Icon name="plus" size={15} /></button>
          <button className={`zbtn fit ${zoom === null ? "on" : ""}`} title="Fit to view" onClick={() => setZoom(null)}><Icon name="fit" size={15} /></button>
        </div>
        <div className="docscroll" ref={paneRef}>
          <div className="pagesizer" style={{ width: dispW || "auto", height: dispH || "auto" }}>
            <div className="pagewrap" style={{ transform: `scale(${tScale})`, transformOrigin: "top left" }}>
              <div className="pagestack" ref={stackRef} />
              {tab === "parse" && job?.parse?.pages?.length
                ? /* Parse: color every block by type, on its own page (layout view) */
                  job.parse.pages.flatMap((pg) => {
                    const idx = pg.page - 1;
                    if (idx < 0 || idx >= pageDims.length) return [];
                    const off = pageTopPx(idx);
                    return pg.blocks.map((bk, i) => (
                      <div
                        key={`pb-${pg.page}-${i}`}
                        className={`bbox blk blk-${bk.type}`}
                        style={{ left: bk.bbox.x * SCALE, top: off + bk.bbox.y * SCALE, width: bk.bbox.w * SCALE, height: bk.bbox.h * SCALE }}
                        title={`${bk.type}: ${bk.text.slice(0, 80)}`}
                      />
                    ));
                  })
                : /* Extract: every cited value highlighted on its own page; color = clarity, not confidence */
                  fieldKeys.flatMap((k) => {
                    const col = colorOf(k);
                    const isActive = active === k;
                    return (data.citations[k]?.citations ?? []).flatMap((c, i) => {
                      const idx = (c.page || 1) - 1;
                      if (idx < 0 || idx >= pageDims.length) return [];
                      const off = pageTopPx(idx);
                      return [
                        <div
                          key={`${k}-${i}`}
                          data-fk={k}
                          className={`bbox clarity ${isActive ? "on" : ""}`}
                          style={{
                            left: c.bbox.x * SCALE,
                            top: off + c.bbox.y * SCALE,
                            width: c.bbox.w * SCALE,
                            height: c.bbox.h * SCALE,
                            borderColor: col.stroke,
                            color: col.stroke,
                            background: isActive ? col.strong : col.fill,
                          }}
                          onMouseEnter={() => setActive(k)}
                          onClick={() => navTo(k)}
                          title={`${k} — click to find in results`}
                        />,
                      ];
                    });
                  })}
            </div>
          </div>
          {extraPages > 0 && (
            <div className="pagemore">+{extraPages} more page{extraPages > 1 ? "s" : ""} not shown in the viewer (extraction still covers them)</div>
          )}
        </div>
      </div>

      <aside className="opts">
        {onBack && <button className="opt-back" onClick={onBack}><Icon name="back" size={14} />All jobs</button>}
        <p className="opts-h">Options · Parse &amp; Extract</p>
        <Dropdown label="Depth" value={MODE_LABEL[optMode]} onChange={(v) => setOptMode(MODE_VAL[v] ?? "balanced")} options={["Fast", "Balanced", "Deep"]} />
        <span className="pages-in opt-w">
          <span className="dd-label">Pages</span>
          <input value={optPages} onChange={(e) => setOptPages(e.target.value)} placeholder="all" />
        </span>
        <button className="opt-toggle" onClick={() => setOptVision((v) => !v)} aria-pressed={optVision}>
          <span className={`switch sm ${optVision ? "on" : ""}`}><span className="knob" /></span>
          <span>Figures &amp; charts (vision)</span>
        </button>
        <textarea className="opt-notes" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Notes for the model…" rows={4} />
        <button className="btn pri opt-reparse" onClick={reparse}><Icon name="refresh" size={14} />Reparse</button>
        {tab === "parse" && (
          <div className="legend">
            <span><i className="lg blk-heading" />heading</span>
            <span><i className="lg blk-table" />table</span>
            <span><i className="lg blk-paragraph" />text</span>
            <span><i className="lg blk-figure" />figure</span>
          </div>
        )}
      </aside>

      <div className="fields">
        {job?.timings && (Object.values(job.timings).some((v) => v != null)) && (
          <div className="timings-strip">
            {(["extract", "parse", "chunks"] as const).map((k) =>
              job.timings?.[k] != null ? (
                <span className="tchip" key={k} title={`${k} took ${job.timings![k]!.toFixed(1)}s`}>
                  <Icon name="clock" size={11} />{k} {job.timings![k]!.toFixed(1)}s
                </span>
              ) : null,
            )}
          </div>
        )}
        {data.engine === "dry-run" && (
          <div className="banner warn">
            <Icon name="alert" size={15} />
            <div><b>Offline mock</b><p>No AI engine is connected — these values are a deterministic placeholder. Connect an engine in Settings ▸ Models for real extraction.</p></div>
          </div>
        )}
        <div className="tabs">
          <button className={`tab ${tab === "extract" ? "on" : ""}`} onClick={() => setTab("extract")}>Extract</button>
          <button className={`tab ${tab === "parse" ? "on" : ""}`} onClick={() => setTab("parse")}>Parse</button>
          <button className={`tab ${tab === "chunks" ? "on" : ""}`} onClick={() => setTab("chunks")}>Chunks</button>
          <div className="tab-actions">
            {tab === "extract" && (
              <>
                <button className="ibtn" title="Copy JSON" onClick={() => copyText(JSON.stringify(data.values, null, 2))}><Icon name="file" size={14} /></button>
                <button className="ibtn" title="Download JSON" onClick={() => download(`${docName}.json`, JSON.stringify(data.values, null, 2), "application/json")}><Icon name="download" size={14} /></button>
              </>
            )}
            {tab === "parse" && (
              <>
                <button className="ibtn" title="Copy Markdown" disabled={!job?.parse} onClick={() => job?.parse && copyText(job.parse.markdown)}><Icon name="file" size={14} /></button>
                <button className="ibtn" title="Download Markdown" disabled={!job?.parse} onClick={() => job?.parse && download(`${docName}.md`, job.parse.markdown, "text/markdown")}><Icon name="download" size={14} /></button>
              </>
            )}
            {tab === "chunks" && (
              <>
                <button className="ibtn" title="Copy JSONL" disabled={!job?.chunks} onClick={() => job?.chunks && copyText(job.chunks.chunks.map((c) => JSON.stringify(c)).join("\n"))}><Icon name="file" size={14} /></button>
                <button className="ibtn" title="Download JSONL (RAG)" disabled={!job?.chunks} onClick={() => job?.chunks && download(`${docName}.chunks.jsonl`, job.chunks.chunks.map((c) => JSON.stringify(c)).join("\n"), "application/x-ndjson")}><Icon name="download" size={14} /></button>
              </>
            )}
          </div>
        </div>

        {tab === "parse" ? (
          parseError ? (
            <div className="empty">
              <div className="empty-ic err"><Icon name="alert" size={30} /></div>
              <b>Couldn’t format this document</b>
              <p>{parseError}</p>
              <button className="btn pri" onClick={() => onParsed?.(job!.id, null)}><Icon name="refresh" size={14} />Retry</button>
            </div>
          ) : !job?.parse ? (
            <div className="empty">
              <div className="empty-ic spin"><Icon name="refresh" size={30} /></div>
              <b>Formatting… <ElapsedTimer className="ldr-time" /></b>
              <p>Converting {docName} to Markdown with tables on your AI engine.</p>
            </div>
          ) : (
            <div className="parsepane"><Markdown md={job.parse.markdown} /></div>
          )
        ) : tab === "chunks" ? (
          chunkError ? (
            <div className="empty">
              <div className="empty-ic err"><Icon name="alert" size={30} /></div>
              <b>Couldn’t chunk this document</b>
              <p>{chunkError}</p>
              <button className="btn pri" onClick={() => onChunked?.(job!.id, null)}><Icon name="refresh" size={14} />Retry</button>
            </div>
          ) : !job?.chunks ? (
            <div className="empty">
              <div className="empty-ic spin"><Icon name="refresh" size={30} /></div>
              <b>Chunking… <ElapsedTimer className="ldr-time" /></b>
              <p>Splitting {docName} into retrieval-ready chunks (local, free).</p>
            </div>
          ) : (
            <div className="parsepane">
              <p className="chunk-sum">{job.chunks.chunk_count} chunks · ~{job.chunks.chunks.reduce((s, c) => s + c.tokens, 0)} tokens · export JSONL for RAG</p>
              {job.chunks.chunks.map((c) => (
                <div className="chunk" key={c.id}>
                  <div className="chunk-meta">
                    <span className="chunk-id">{c.id}</span>
                    {c.heading && <span className="chunk-head">{c.heading}</span>}
                    <span className="chunk-stat">p{c.page_start}{c.page_end !== c.page_start ? `–${c.page_end}` : ""} · {c.tokens} tok</span>
                  </div>
                  <div className="chunk-text">{c.text}</div>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
        <div className="extract-bar">
          <div className="viewseg">
            <button className={`vseg ${view === "formatted" ? "on" : ""}`} onClick={() => setView("formatted")}>Formatted</button>
            <button className={`vseg ${view === "json" ? "on" : ""}`} onClick={() => setView("json")}>JSON</button>
          </div>
        </div>
        {view === "json" ? (
          <pre className="jsonview">{JSON.stringify(data.values, null, 2)}</pre>
        ) : (
          <>
        {data.issues.length > 0 && (
          <div className="attn">
            <Icon name="alert" size={14} />
            {data.issues.length} field(s) need attention — Fix or Approve each below
          </div>
        )}
        <div className="flist" onMouseLeave={() => setActive(null)}>
          {ordered.map((k) => {
            const v = data.values[k];
            const flagged = issuesByField.has(k);
            const dotColor = colorOf(k).stroke;
            const rows = Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null
              ? (v as Record<string, unknown>[])
              : null;

            // table field (line items, transactions, …) → render as a real grid
            if (rows) {
              const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
              return (
                <div
                  key={k}
                  ref={(el) => { rowRefs.current[k] = el; }}
                  className={`ftable ${active === k ? "active" : ""}`}
                  onMouseEnter={() => setActive(k)}
                  onClick={() => navTo(k)}
                >
                  <div className="ft-head">
                    <span className="cdot" style={{ background: dotColor }} />
                    <span className="fk">{k}</span>
                    {flagged && <span className="needs" title={issueMsg.get(k)}><Icon name="alert" size={12} /></span>}
                    <span className="ft-count">{rows.length} rows</span>
                    {flagged && (
                      <button className="btn xs pri" onClick={(e) => { e.stopPropagation(); approveField(k); }}>
                        <Icon name="check" size={11} />Approve
                      </button>
                    )}
                  </div>
                  <div className="ft-scroll">
                    <table className="ft">
                      <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>{cols.map((c) => <td key={c}>{r[c] == null ? "" : String(r[c])}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // scalar field
            return (
              <div
                key={k}
                ref={(el) => { rowRefs.current[k] = el; }}
                className={`frow ${active === k ? "active" : ""}`}
                onMouseEnter={() => setActive(k)}
                onClick={() => navTo(k)}
              >
                <span className="cdot" style={{ background: dotColor }} />
                <span className="fk" title={k}>{k}</span>
                {editKey === k ? (
                  <span className="fix" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="fixin"
                      autoFocus
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveFix(k); if (e.key === "Escape") setEditKey(null); }}
                    />
                    <button className="btn xs pri" onClick={() => saveFix(k)}><Icon name="check" size={12} />Save</button>
                    <button className="btn xs" onClick={() => setEditKey(null)}>Cancel</button>
                  </span>
                ) : (
                  <>
                    <span className="fv" title={v == null ? "" : String(v)}>{v == null || v === "" ? "—" : String(v)}</span>
                    {flagged ? (
                      <span className="rowact" onClick={(e) => e.stopPropagation()}>
                        <span className="needs" title={issueMsg.get(k)}><Icon name="alert" size={13} /></span>
                        <button className="btn xs" onClick={() => startFix(k)}>Fix</button>
                        <button className="btn xs pri" onClick={() => approveField(k)}><Icon name="check" size={12} />Approve</button>
                      </span>
                    ) : (
                      <span className="cite" title="jump to citation"><Icon name="link" size={14} /></span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
