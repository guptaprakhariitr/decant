import { Icon } from "../components/Icon.tsx";
import { STATUS_META, type Job } from "../lib/jobs.ts";

// Default Studio view when no job is open: every job, newest first, click to open, trash to delete.
export function StudioList({ jobs, onOpen, onDelete }: { jobs: Job[]; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const sorted = [...jobs].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return (
    <div className="studio-list">
      <p className="kicker">Decant Studio</p>
      <p className="muted lede">Open a document to review its extraction, parse, and chunks. Newest first.</p>

      {sorted.length === 0 ? (
        <div className="empty">
          <div className="empty-ic"><Icon name="inbox" size={34} /></div>
          <b>No documents yet</b>
          <p>Add a file from Home to get started.</p>
        </div>
      ) : (
        <div className="recent">
          {sorted.map((j) => {
            const s = STATUS_META[j.status];
            const total = j.timings ? Object.values(j.timings).reduce((a, b) => a + (b ?? 0), 0) : 0;
            return (
              <div key={j.id} className="rr rr-row">
                <button className="rr-main" onClick={() => onOpen(j.id)}>
                  <span className="rr-ic"><Icon name={j.kind} size={18} /></span>
                  <div className="rr-text">
                    <div className="fn">{j.name}{j.sample && <span className="tag sample">SAMPLE</span>}</div>
                    <div className="tp">{j.meta}{total > 0 ? ` · ${total.toFixed(1)}s` : ""}</div>
                  </div>
                  <span className={`pill ${s.tone}`}><Icon name={s.icon} size={12} />{s.label}</span>
                </button>
                <button className="rr-del" title="Delete job" onClick={() => onDelete(j.id)}><Icon name="trash" size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
