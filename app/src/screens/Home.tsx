import { Icon } from "../components/Icon.tsx";
import { openFiles, type PickedFile } from "../lib/files.ts";
import { STATUS_META, type Job } from "../lib/jobs.ts";

export function Home({
  jobs,
  engineReady,
  onConnect,
  onAddFiles,
  onOpenJob,
  onDeleteJob,
  onEditDefaults,
}: {
  jobs: Job[];
  engineReady: boolean;
  onConnect: () => void;
  onAddFiles: (files: PickedFile[]) => void;
  onOpenJob: (id: string) => void;
  onDeleteJob: (id: string) => void;
  onEditDefaults: () => void;
}) {
  async function pick() {
    const files = await openFiles();
    if (files.length) onAddFiles(files);
  }

  return (
    <div className="home">
      <p className="kicker">New extraction</p>

      {!engineReady && (
        <div className="connect-banner">
          <div className="cb-ic"><Icon name="terminal" size={20} /></div>
          <div className="cb-body">
            <b>Connect an AI engine to extract</b>
            <p>Decant runs on an engine you already have — Claude Code CLI, Cursor, an Anthropic API key, or a local model — $0 to us, nothing leaves your Mac. Parsing &amp; OCR work offline meanwhile; field extraction needs a connected engine.</p>
          </div>
          <button className="btn pri" onClick={onConnect}>Connect <Icon name="arrowRight" size={15} /></button>
        </div>
      )}

      <div className="drop" onClick={pick}>
        <div className="drop-ic"><Icon name="upload" size={30} /></div>
        <h2>Drop PDFs, scans, or images — or a whole folder</h2>
        <p>
          PDF · PNG · JPG · TIFF · DOCX · XLSX&nbsp;&nbsp;·&nbsp;&nbsp;
          <b style={{ color: "var(--accent)" }}>Browse…</b>
        </p>
      </div>

      <p className="home-defaults">
        New jobs use your extraction defaults (schema &amp; depth).{" "}
        <button className="linkbtn" onClick={onEditDefaults}>Change defaults in Settings</button>{" "}
        — or tweak Depth, Pages, vision &amp; Notes per&nbsp;job in the Studio.
      </p>

      <p className="grouphdr">Recent jobs</p>
      {jobs.length === 0 ? (
        <div className="empty">
          <div className="empty-ic"><Icon name="inbox" size={34} /></div>
          <b>No jobs yet</b>
          <p>Drop a document above to run your first extraction.</p>
        </div>
      ) : (
        <div className="recent">
          {[...jobs].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).map((j) => {
            const s = STATUS_META[j.status];
            return (
              <div key={j.id} className="rr rr-row">
                <button className="rr-main" onClick={() => onOpenJob(j.id)}>
                  <span className="rr-ic"><Icon name={j.kind} size={18} /></span>
                  <div className="rr-text">
                    <div className="fn">{j.name}{j.sample && <span className="tag sample">SAMPLE</span>}</div>
                    <div className="tp">{j.meta}</div>
                  </div>
                  <span className={`pill ${s.tone}`}>
                    <Icon name={s.icon} size={12} />
                    {s.label}
                  </span>
                </button>
                <button className="rr-del" title="Delete job" onClick={() => onDeleteJob(j.id)}><Icon name="trash" size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
