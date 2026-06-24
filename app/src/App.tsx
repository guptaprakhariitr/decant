import { useEffect, useRef, useState } from "react";
import { Home } from "./screens/Home.tsx";
import { Review } from "./screens/Review.tsx";
import { StudioList } from "./screens/StudioList.tsx";
import { Settings, type Theme } from "./screens/Settings.tsx";
import { Guide } from "./screens/Guide.tsx";
import { Icon, type IconName } from "./components/Icon.tsx";
import { Logo } from "./components/Logo.tsx";
import { Toaster } from "./components/Toaster.tsx";
import { detect, extract, lightOf, type Availability, type Extraction, type Mode } from "./lib/engine.ts";
import { jobFromPicked, SEED_JOBS, type Job } from "./lib/jobs.ts";
import type { PickedFile } from "./lib/files.ts";
import { SCHEMAS } from "./lib/schemas.ts";
import { toFieldDefs, emptyField, type BField } from "./components/SchemaBuilder.tsx";
import { prepPageImage } from "./lib/render.ts";
import { loadState, saveState } from "./lib/persist.ts";
import { checkForUpdate, openExternal, type UpdateInfo } from "./lib/update.ts";

type Screen = "home" | "review" | "settings" | "guide";

type PersistedState = {
  v: 1;
  jobs: Job[];
  activeJobId: string | null;
  localOnly: boolean;
  screen: Screen;
  theme?: Theme;
  defSchema?: string;
  defMode?: Mode;
  defCustom?: BField[];
};

// On load, a transient "extracting" job (no result) must not stick: re-queue it.
function reconcileLoadedJobs(jobs: Job[]): Job[] {
  return jobs.map((j) => {
    if (j.status === "extracting" && !j.extraction) return { ...j, status: "queued" as const };
    if (j.status === "extracting" && j.extraction) return { ...j, status: "needs_review" as const };
    return j;
  });
}

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [adapters, setAdapters] = useState<Availability[]>([]);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [localOnly, setLocalOnly] = useState(true);
  const [theme, setTheme] = useState<Theme>("light");
  const [settingsSection, setSettingsSection] = useState<"appearance" | "models" | "extraction">("appearance");
  // ---- extraction defaults (live in Settings; applied to each new job) ----
  const [defSchema, setDefSchema] = useState("Auto");
  const [defMode, setDefMode] = useState<Mode>("balanced");
  const [defCustom, setDefCustom] = useState<BField[]>([emptyField()]);
  const [jobs, setJobs] = useState<Job[]>(SEED_JOBS);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [updDismissed, setUpdDismissed] = useState(false);
  const activeJob = jobs.find((j) => j.id === activeJobId) ?? null;

  // ---- theme: resolve system → apply data-theme on <html>, react to OS changes ----
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved = theme === "system" ? (mq.matches ? "light" : "dark") : theme;
      document.documentElement.setAttribute("data-theme", resolved);
    };
    apply();
    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  // ---- persistence ----
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let alive = true;
    loadState<PersistedState | null>(null)
      .then((s) => {
        if (!alive || !s || s.v !== 1 || !Array.isArray(s.jobs)) return;
        setJobs(reconcileLoadedJobs(s.jobs));
        setActiveJobId(s.activeJobId ?? null);
        if (typeof s.localOnly === "boolean") setLocalOnly(s.localOnly);
        if (s.theme === "dark" || s.theme === "light" || s.theme === "system") setTheme(s.theme);
        if (typeof s.defSchema === "string") setDefSchema(s.defSchema);
        if (s.defMode === "fast" || s.defMode === "balanced" || s.defMode === "deep") setDefMode(s.defMode);
        if (Array.isArray(s.defCustom) && s.defCustom.length) setDefCustom(s.defCustom);
        if (["home", "review", "settings", "guide"].includes(s.screen as string)) setScreen(s.screen);
      })
      .catch(() => {})
      .finally(() => { if (alive) setHydrated(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Cap retained jobs (newest first) so ui-state.json stays bounded even after heavy use.
    const kept = [...jobs].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 200);
    saveState({ v: 1, jobs: kept, activeJobId, localOnly, screen, theme, defSchema, defMode, defCustom } satisfies PersistedState);
  }, [hydrated, jobs, activeJobId, localOnly, screen, theme, defSchema, defMode, defCustom]);

  // New jobs inherit the extraction defaults set in Settings (per-job overrides live in the Studio Options panel).
  function addFiles(files: PickedFile[]) {
    const schemaDef =
      defSchema === "Custom"
        ? { name: "Custom", fields: toFieldDefs(defCustom) }
        : SCHEMAS[defSchema] ?? SCHEMAS.Auto;
    const created = files.map((f) => jobFromPicked(f, schemaDef, defMode));
    setJobs((prev) => [...created, ...prev]);
    setActiveJobId(created[0]?.id ?? null);
    setScreen("review");
  }

  function openJob(id: string) {
    setActiveJobId(id);
    setScreen("review");
  }

  function deleteJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setActiveJobId((cur) => (cur === id ? null : cur));
  }

  // Reparse: re-run a job from scratch, optionally applying updated per-job options.
  function rerun(id: string, patch?: Partial<Pick<Job, "notes" | "mode" | "pages" | "vision">>) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, status: "queued", extraction: null, parse: null, chunks: null, error: undefined, ...(patch ?? {}) }
          : j,
      ),
    );
  }

  // cache lazily-computed artifacts + their timing
  function setParse(id: string, parse: Job["parse"], secs?: number) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, parse, timings: { ...j.timings, ...(secs != null ? { parse: secs } : {}) } } : j)));
  }
  // Human review edits (fix value / approve flag) → persist back onto the job and re-derive status.
  function setExtraction(id: string, extraction: Extraction) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id ? { ...j, extraction, status: extraction.issues?.length ? "needs_review" : "done" } : j,
      ),
    );
  }
  function setChunks(id: string, chunks: Job["chunks"], secs?: number) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, chunks, timings: { ...j.timings, ...(secs != null ? { chunks: secs } : {}) } } : j)));
  }

  const visionReady = adapters.some(
    (a) => lightOf(a) === "green" && a.id !== "dry-run" && a.vision && !(localOnly && a.egress),
  );

  // Sequential queue: one queued job at a time through the real engine.
  const running = useRef(false);
  useEffect(() => {
    if (running.current) return;
    const next = jobs.find((j) => j.status === "queued");
    if (!next) return;
    running.current = true;
    setJobs((prev) => prev.map((j) => (j.id === next.id ? { ...j, status: "extracting" } : j)));
    (async () => {
      const t0 = Date.now();
      try {
        let imageB64 = "";
        if (visionReady && next.picked) imageB64 = await prepPageImage(next.picked, next.mode, !!next.vision);
        const ex = await extract(next.picked?.path ?? "sample", next.schemaDef, { localOnly, mode: next.mode, pages: next.pages, imageB64, notes: next.notes, vision: next.vision });
        const secs = (Date.now() - t0) / 1000;
        setJobs((prev) =>
          prev.map((j) =>
            j.id === next.id
              ? { ...j, extraction: ex, status: ex.issues?.length ? "needs_review" : "done", timings: { ...j.timings, extract: secs } }
              : j,
          ),
        );
      } catch (e: any) {
        setJobs((prev) => prev.map((j) => (j.id === next.id ? { ...j, status: "error", error: String(e?.message ?? e) } : j)));
      } finally {
        running.current = false;
        setJobs((prev) => [...prev]);
      }
    })();
  }, [jobs, localOnly, visionReady]);

  function approveActive() {
    if (!activeJob) return setActiveJobId(null);
    const next = jobs.find((j) => j.id !== activeJob.id && j.status === "needs_review");
    setJobs((prev) => prev.map((j) => (j.id === activeJob.id ? { ...j, status: "done" } : j)));
    setActiveJobId(next ? next.id : null); // back to the Studio list when none left
  }

  function recheck() {
    setChecking(true);
    detect().then((a) => { setAdapters(a); setDetectError(null); }).catch((e) => setDetectError(String(e))).finally(() => setChecking(false));
  }
  useEffect(recheck, []);
  // Non-blocking "update available" check against the public GitHub release (silent on failure).
  useEffect(() => { checkForUpdate().then(setUpdate).catch(() => {}); }, []);

  const ready = adapters.filter((a) => lightOf(a) === "green" && a.id !== "dry-run");
  const goConnect = () => { setSettingsSection("models"); setScreen("settings"); };
  const goDefaults = () => { setSettingsSection("extraction"); setScreen("settings"); };

  const nav: { id: Screen; icon: IconName; label: string }[] = [
    { id: "home", icon: "home", label: "Home" },
    { id: "review", icon: "layout", label: "Decant Studio" },
  ];

  return (
    <div className="app">
      <nav className="rail">
        <button className="rail-brand" title="Decant" onClick={() => setScreen("home")}><Logo size={34} /></button>
        {nav.map((n) => (
          <button key={n.id} className={`rico ${screen === n.id ? "on" : ""}`} title={n.label}
            onClick={() => { if (n.id === "review") setActiveJobId(null); setScreen(n.id); }}>
            <Icon name={n.icon} />
            <span className="rico-tip">{n.label}</span>
          </button>
        ))}
        <div className="spacer" />
        <button className={`rico ${screen === "guide" ? "on" : ""}`} title="How to use" onClick={() => setScreen("guide")}>
          <Icon name="help" />
          <span className="rico-tip">How to use</span>
        </button>
        <button className={`rico ${screen === "settings" ? "on" : ""}`} title="Settings" onClick={() => setScreen("settings")}>
          <Icon name="sliders" />
          <span className="rico-tip">Settings</span>
        </button>
      </nav>
      <div className="main">
        <header className="top">
          <div className="brand">
            <h1>Decant</h1>
            <span className="tagline">Accurate, cited document extraction</span>
          </div>
          <span className="conn">
            <button className="conn-btn" onClick={goConnect} title="View engines & connection">
              {ready.length ? (
                <span className="ok">{ready.length} engine{ready.length > 1 ? "s" : ""} ready</span>
              ) : (
                <span className="no">connect an engine →</span>
              )}
            </button>
          </span>
          <span className={`lock ${localOnly ? "on" : ""}`} title={localOnly ? "No data leaves your Mac" : "API-key egress allowed"}>
            <Icon name={localOnly ? "lock" : "unlock"} size={13} />
            {localOnly ? "Local-only" : "Egress on"}
          </span>
        </header>
        {update && !updDismissed && (
          <div className="updatebar">
            <Icon name="arrowRight" size={13} />
            <span>Decant <b>{update.latest}</b> is available.</span>
            <button className="upd-link" onClick={() => openExternal(update.url)}>Download</button>
            <button className="upd-x" title="Dismiss" onClick={() => setUpdDismissed(true)} aria-label="Dismiss">×</button>
          </div>
        )}
        <div className="body">
          {screen === "home" && <Home jobs={jobs} engineReady={ready.length > 0} onConnect={goConnect} onAddFiles={addFiles} onOpenJob={openJob} onDeleteJob={deleteJob} onEditDefaults={goDefaults} />}
          {screen === "review" &&
            (activeJob ? (
              <Review
                job={activeJob}
                localOnly={localOnly}
                onApprove={approveActive}
                onRerun={(patch) => rerun(activeJob.id, patch)}
                onParsed={setParse}
                onChunked={setChunks}
                onExtractionChange={setExtraction}
                onBack={() => setActiveJobId(null)}
              />
            ) : (
              <StudioList jobs={jobs} onOpen={openJob} onDelete={deleteJob} />
            ))}
          {screen === "settings" && (
            <Settings
              adapters={adapters}
              localOnly={localOnly}
              detectError={detectError}
              checking={checking}
              theme={theme}
              onSetTheme={setTheme}
              section={settingsSection}
              onSection={setSettingsSection}
              onRecheck={recheck}
              onToggleLocalOnly={() => setLocalOnly((v) => !v)}
              defSchema={defSchema}
              onDefSchema={setDefSchema}
              defMode={defMode}
              onDefMode={setDefMode}
              defCustom={defCustom}
              onDefCustom={setDefCustom}
            />
          )}
          {screen === "guide" && <Guide onConnect={goConnect} />}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
