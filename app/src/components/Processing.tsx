import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.tsx";

// Claude-style progressive loading. Early (local) stages tick through quickly; the long pole —
// the model call — parks on its step with rotating status text + a live elapsed timer, so the
// wait always feels alive. The parent unmounts this the moment the real result arrives.
const STEPS = [
  { key: "read", label: "Reading document", at: 0 },
  { key: "parse", label: "Parsing layout & text", at: 0.6 },
  { key: "tables", label: "Detecting tables & figures", at: 1.8 },
  { key: "model", label: "Extracting with your AI", at: 3.0, hold: true },
];

// Varied, truthful status lines for the long model-call hold. Shown in a fresh random order each
// run (and re-shuffled when the pool is exhausted) so the wait never reads like a fixed script.
const HOLD_MSGS = [
  "Reading the document on your AI engine…",
  "Identifying the fields that are present…",
  "Structuring line items and tables…",
  "Cross-checking values against the page…",
  "Resolving citations to their source blocks…",
  "Normalizing dates, amounts and numbers…",
  "Grounding every value back in the document…",
  "Running cross-field checks — sums & totals…",
  "Reconciling tables row by row…",
  "Mapping each value to where it appears…",
  "Calibrating confidence on extracted fields…",
  "Tidying the raw layout into clean structure…",
  "$0 inference — running on your own AI…",
  "Nothing leaves your Mac — all local…",
  "Matching headers against the schema…",
  "Finalizing the structured output…",
];

// A few distinct entrance animations; each line picks one so consecutive lines feel different.
const TRANSITIONS = ["t-up", "t-down", "t-fade", "t-blur", "t-scale"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Pair each shuffled message with a random transition, avoiding repeating the previous transition.
function buildReel(prevT?: string): { m: string; t: string }[] {
  let last = prevT;
  return shuffle(HOLD_MSGS).map((m) => {
    let t = TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];
    if (t === last && TRANSITIONS.length > 1) t = TRANSITIONS[(TRANSITIONS.indexOf(t) + 1) % TRANSITIONS.length];
    last = t;
    return { m, t };
  });
}

export function Processing({ fileName, queued }: { fileName: string; queued?: boolean }) {
  const start = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((Date.now() - start.current) / 1000), 150);
    return () => clearInterval(id);
  }, []);

  // Rotating status reel — advances on its own ~2.6s cadence (independent of the elapsed ticker so
  // re-renders don't churn it); re-shuffles with a fresh transition mix when it runs out.
  const reel = useRef(buildReel());
  const [mi, setMi] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setMi((p) => {
        const n = p + 1;
        if (n >= reel.current.length) {
          reel.current = buildReel(reel.current[reel.current.length - 1]?.t);
          return 0;
        }
        return n;
      });
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const holdIdx = STEPS.findIndex((s) => s.hold);
  // current step = last step whose threshold has passed, capped at the hold step
  let current = 0;
  for (let i = 0; i < STEPS.length; i++) if (elapsed >= STEPS[i].at) current = i;
  current = Math.min(current, holdIdx);

  const reelItem = reel.current[mi] ?? reel.current[0];

  if (queued)
    return (
      <div className="proc">
        <div className="proc-ic"><Icon name="refresh" size={30} className="spin" /></div>
        <b>Queued</b>
        <p>Waiting for a free slot — another document is processing.</p>
      </div>
    );

  return (
    <div className="proc">
      <div className="proc-head">
        <div className="proc-file"><Icon name="file" size={15} /><span>{fileName}</span></div>
        <div className="proc-elapsed">{elapsed.toFixed(0)}s</div>
      </div>
      <div className="proc-steps">
        {STEPS.map((s, i) => {
          const state = i < current ? "done" : i === current ? "active" : "pending";
          return (
            <div key={s.key} className={`proc-step ${state}`}>
              <div className="proc-dot">
                {state === "done" && <Icon name="check" size={14} />}
                {state === "active" && <Icon name="refresh" size={14} className="spin" />}
              </div>
              <div className="proc-text">
                <span className="proc-label">{s.label}</span>
                {state === "active" && s.hold && (
                  <span key={mi} className={`proc-sub ${reelItem.t}`}>{reelItem.m}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
