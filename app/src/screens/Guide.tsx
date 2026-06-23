import { Icon, type IconName } from "../components/Icon.tsx";

// ---- small themed SVG illustrations (no raster assets; crisp + theme-aware) ----
function ArtDrop() {
  return (
    <svg viewBox="0 0 160 100" className="art">
      <rect x="8" y="8" width="144" height="84" rx="12" fill="none" stroke="var(--line2)" strokeWidth="2" strokeDasharray="6 5" />
      <circle cx="80" cy="42" r="16" fill="color-mix(in srgb, var(--accent) 16%, transparent)" />
      <path d="M80 50V34M73 41l7-7 7 7" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="52" y="70" width="56" height="6" rx="3" fill="var(--line2)" />
    </svg>
  );
}
function ArtExtract() {
  const hl = (x: number, y: number, w: number) => <rect x={x} y={y} width={w} height="9" rx="2" fill="color-mix(in srgb, var(--green) 22%, transparent)" stroke="var(--green)" />;
  return (
    <svg viewBox="0 0 160 100" className="art">
      <rect x="8" y="8" width="92" height="84" rx="6" fill="var(--panel2)" stroke="var(--line)" />
      {hl(16, 20, 44)}{hl(58, 34, 30)}{hl(16, 52, 28)}{hl(16, 70, 50)}
      <rect x="108" y="8" width="44" height="84" rx="6" fill="var(--panel)" stroke="var(--line)" />
      {[20, 34, 48, 62].map((y) => (
        <g key={y}><circle cx="116" cy={y + 3} r="2.4" fill="var(--green)" /><rect x="123" y={y} width="23" height="6" rx="3" fill="var(--line2)" /></g>
      ))}
    </svg>
  );
}
function ArtParse() {
  return (
    <svg viewBox="0 0 160 100" className="art">
      <rect x="8" y="8" width="144" height="84" rx="6" fill="var(--panel2)" stroke="var(--line)" />
      <rect x="18" y="16" width="58" height="11" rx="2" fill="color-mix(in srgb, var(--red) 16%, transparent)" stroke="var(--red)" />
      <rect x="18" y="33" width="124" height="22" rx="2" fill="color-mix(in srgb, var(--green) 14%, transparent)" stroke="var(--green)" />
      <rect x="18" y="61" width="104" height="9" rx="2" fill="color-mix(in srgb, var(--amber) 12%, transparent)" stroke="var(--amber)" />
      <rect x="18" y="74" width="84" height="9" rx="2" fill="color-mix(in srgb, var(--amber) 12%, transparent)" stroke="var(--amber)" />
    </svg>
  );
}
function ArtIcon({ name }: { name: IconName }) {
  return <div className="art art-icon"><Icon name={name} size={34} /></div>;
}

type Step = { n: number; title: string; body: string; art: JSX.Element; cta?: boolean };

const CFG: { name: string; what: string }[] = [
  { name: "Schema", what: "What to pull. Auto discovers the fields present in the document; Invoice/Receipt use a preset field set; Custom lets you define your own fields (and table columns) in the Schema Builder." },
  { name: "Depth", what: "How thorough. Fast sends fewer blocks (cheapest/quickest); Balanced is the default; Deep sends the most context and adds an iterative refine pass + figure vision." },
  { name: "Pages", what: "Limit to a page range like 1-3 — much faster on long documents. Leave as “all” to process everything." },
  { name: "Figures & charts (vision)", what: "Sends the rendered page image to your AI engine so it can read charts, figures, and scanned text that plain parsing misses. Needs a vision-capable engine (claude-cli or API key)." },
  { name: "Notes", what: "Free-text hints passed to the model for this job, e.g. “amounts are in EUR”, “dates are DD/MM/YYYY”, “ignore the header logo”." },
  { name: "Local-only", what: "Hard-blocks any engine that would send data off your Mac (the API key). On by default — your documents stay private." },
  { name: "Reparse", what: "Re-runs the job from scratch with the current options/notes. Use it after changing Depth, Pages, vision, or Notes." },
];

export function Guide({ onConnect }: { onConnect?: () => void }) {
  const steps: Step[] = [
    { n: 1, title: "Connect an AI engine", body: "Decant runs the AI on an engine you already have — Claude Code CLI, Cursor, an Anthropic API key, or a local model (Ollama) — so it’s free to run and nothing leaves your Mac. Parsing & OCR work offline; field extraction needs a connected engine.", art: <ArtIcon name="terminal" />, cta: true },
    { n: 2, title: "Add a document", body: "On Home, drop a file or click Browse — PDF, scans/images, or XLSX spreadsheets. Folders work too. It opens in Decant Studio.", art: <ArtDrop /> },
    { n: 3, title: "Set your defaults (once)", body: "In Settings ▸ Extraction, choose the default Schema and Depth every new job starts with — including a Custom schema you build by hand. Per-document tweaks (Depth, Pages, vision, Notes) live in the Studio Options panel. Full meanings are in the table below.", art: <ArtIcon name="sliders" /> },
    { n: 4, title: "Review — Extract", body: "The Extract tab shows the fields (auto-discovered or per your schema) and tables. Each value is highlighted on the page where it was found (a citation) — each field gets its own color just so you can tell the highlights apart. Hover a row to flash its highlight; a ⚠ marks fields worth a second look.", art: <ArtExtract /> },
    { n: 5, title: "Parse the whole document", body: "The Parse tab renders the document as clean Markdown with tables, and overlays every block on the page color-coded by type (heading / table / text / figure).", art: <ArtParse /> },
    { n: 6, title: "Chunk for RAG", body: "The Chunks tab splits the document into retrieval-ready chunks with provenance — export as JSONL for your RAG pipeline. Local and free.", art: <ArtIcon name="layout" /> },
    { n: 7, title: "Tweak & Reparse", body: "Use the Options panel (left of the tabs) to change Depth, Pages, toggle Figures (vision), or add Notes — then Reparse to re-run with those settings.", art: <ArtIcon name="refresh" /> },
    { n: 8, title: "Export", body: "Copy or Download from any tab — JSON for Extract, Markdown for Parse, JSONL for Chunks. Download opens a Save dialog so you choose where it lands.", art: <ArtIcon name="download" /> },
  ];

  return (
    <div className="guide">
      <p className="kicker">How to use Decant</p>
      <p className="muted lede">Any document → accurate, cited structured data, on the AI engine you already use — nothing leaves your Mac. Here’s the whole flow.</p>

      <ol className="steps">
        {steps.map((s) => (
          <li className="gstep" key={s.n}>
            <div className="gstep-art">{s.art}<span className="gstep-n">{s.n}</span></div>
            <div className="gstep-body">
              <b>{s.title}</b>
              <p>{s.body}</p>
              {s.cta && onConnect && <button className="btn pri" onClick={onConnect}>Connect an engine <Icon name="arrowRight" size={14} /></button>}
            </div>
          </li>
        ))}
      </ol>

      <h2 className="guide-h">Configuration — what each option means</h2>
      <div className="cfg-list">
        {CFG.map((c) => (
          <div className="cfg-row" key={c.name}>
            <div className="cfg-name">{c.name}</div>
            <div className="cfg-what">{c.what}</div>
          </div>
        ))}
      </div>

      <h2 className="guide-h">Color key</h2>
      <div className="key-grid">
        <div className="key-col">
          <p className="key-h">Extract — citations</p>
          <p className="key-note">Each extracted value is highlighted on the page where it was found. The colors simply distinguish one field from another for clarity — they are <b>not</b> a confidence score. Fields worth a second look are marked with a ⚠.</p>
        </div>
        <div className="key-col">
          <p className="key-h">Parse — block types</p>
          <span className="key"><i className="sw" style={{ background: "color-mix(in srgb,var(--red) 16%,transparent)", borderColor: "var(--red)" }} />Heading</span>
          <span className="key"><i className="sw" style={{ background: "color-mix(in srgb,var(--green) 14%,transparent)", borderColor: "var(--green)" }} />Table</span>
          <span className="key"><i className="sw" style={{ background: "color-mix(in srgb,var(--amber) 12%,transparent)", borderColor: "var(--amber)" }} />Text</span>
          <span className="key"><i className="sw" style={{ background: "color-mix(in srgb,var(--accent) 14%,transparent)", borderColor: "var(--accent)" }} />Figure</span>
        </div>
      </div>

      <p className="muted guide-foot">Tip: accuracy is grounded — every extracted value is checked against its cited block, and cross-field checks (sums, totals, dates) flag inconsistencies automatically.</p>
    </div>
  );
}
