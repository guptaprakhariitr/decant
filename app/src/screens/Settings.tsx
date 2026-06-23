import { useState } from "react";
import { lightOf, type Availability, type Mode } from "../lib/engine.ts";
import { Icon, type IconName } from "../components/Icon.tsx";
import { Dropdown } from "../components/Dropdown.tsx";
import { SchemaBuilder, type BField } from "../components/SchemaBuilder.tsx";

export type Theme = "dark" | "light" | "system";

// Per-engine presentation + how to enable it when it isn't ready.
const META: Record<string, { icon: IconName; name: string; cost: string; setup?: { how: string; cmd?: string } }> = {
  "claude-cli": {
    icon: "terminal", name: "Claude Code CLI", cost: "Free · your seat",
    setup: { how: "Install Claude Code and make sure the `claude` command is on your PATH, then re-check.", cmd: "claude --version" },
  },
  "agent-sdk": {
    icon: "box", name: "Claude Agent SDK", cost: "Free · your seat",
    setup: { how: "Install the Claude Agent SDK so Decant can drive it locally.", cmd: "npm i -g @anthropic-ai/claude-agent-sdk" },
  },
  cursor: {
    icon: "cursor", name: "Cursor", cost: "Free · your seat",
    setup: { how: "Cursor’s agent is installed but not signed in. Log in, then re-check.", cmd: "cursor-agent login" },
  },
  "api-key": {
    icon: "key", name: "Anthropic API key", cost: "Paid · metered",
    setup: { how: "Set your key in the environment and relaunch Decant. Note: this engine sends content off-device, so it’s blocked while Local-only is on.", cmd: "export ANTHROPIC_API_KEY=sk-ant-…" },
  },
  local: {
    icon: "cpu", name: "Local model (Ollama)", cost: "Free · on-device",
    setup: { how: "Start Ollama and pull a model, then re-check.", cmd: "ollama serve" },
  },
  "dry-run": { icon: "flask", name: "Offline mock", cost: "No model" },
};

const STATUS: Record<string, { label: string; icon: IconName }> = {
  green: { label: "Ready", icon: "checkCircle" },
  amber: { label: "Needs setup", icon: "alert" },
  gray: { label: "Not available", icon: "dash" },
};

function CmdRow({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="cmd">
      <code>{cmd}</code>
      <button
        className="cmd-copy"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard?.writeText(cmd).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
      >
        <Icon name={copied ? "check" : "file"} size={13} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function EngineRow({ a, active, blocked, onRecheck, checking }: {
  a: Availability; active: boolean; blocked: boolean; onRecheck: () => void; checking: boolean;
}) {
  const [open, setOpen] = useState(false);
  const lt = lightOf(a);
  const m = META[a.id] ?? { icon: "box" as IconName, name: a.id, cost: a.cost };
  const s = STATUS[lt];
  const expandable = a.id !== "dry-run";

  return (
    <div className={`engrow ${lt} ${active ? "active" : ""} ${lt === "gray" ? "dim" : ""} ${open ? "open" : ""}`}>
      <button className="eng-head" onClick={() => expandable && setOpen((v) => !v)}>
        <div className="eng-ic"><Icon name={m.icon} size={20} /></div>
        <div className="eng-body">
          <div className="eng-line">
            <b>{m.name}</b>
            {active && <span className="tag using">In use</span>}
            {blocked && <span className="tag blocked">Blocked by Local-only</span>}
          </div>
          <p className="eng-detail">{a.detail}</p>
        </div>
        <div className="eng-right">
          <span className={`status ${lt}`}><Icon name={s.icon} size={14} />{s.label}</span>
          <span className="eng-cost">{a.egress ? "Sends data off-device" : m.cost}</span>
        </div>
        {expandable && <Icon name="chevron" size={16} className={`eng-chev ${open ? "up" : ""}`} />}
      </button>

      {open && expandable && (
        <div className="eng-drawer">
          {lt === "green" ? (
            <p className="drawer-ok"><Icon name="checkCircle" size={14} /> Connection verified — {a.detail}</p>
          ) : (
            <>
              <p className="drawer-how">{m.setup?.how ?? "Re-check after setting this engine up."}</p>
              {m.setup?.cmd && <CmdRow cmd={m.setup.cmd} />}
            </>
          )}
          <button className="btn" onClick={(e) => { e.stopPropagation(); onRecheck(); }} disabled={checking}>
            <Icon name="refresh" size={13} className={checking ? "spin" : ""} />
            {checking ? "Testing…" : "Test connection"}
          </button>
        </div>
      )}
    </div>
  );
}

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: "layout" as IconName },
  { id: "extraction", label: "Extraction", icon: "sliders" as IconName },
  { id: "models", label: "Models", icon: "terminal" as IconName },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const MODE_LABEL: Record<Mode, string> = { fast: "Fast", balanced: "Balanced", deep: "Deep" };
const MODE_VAL: Record<string, Mode> = { Fast: "fast", Balanced: "balanced", Deep: "deep" };

const THEMES: { id: Theme; label: string; icon: IconName }[] = [
  { id: "dark", label: "Dark", icon: "layout" },
  { id: "light", label: "Light", icon: "fit" },
  { id: "system", label: "System", icon: "cpu" },
];

export function Settings({
  adapters,
  localOnly,
  detectError,
  checking,
  theme,
  onSetTheme,
  section,
  onSection,
  onRecheck,
  onToggleLocalOnly,
  defSchema,
  onDefSchema,
  defMode,
  onDefMode,
  defCustom,
  onDefCustom,
}: {
  adapters: Availability[];
  localOnly: boolean;
  detectError?: string | null;
  checking?: boolean;
  theme: Theme;
  onSetTheme: (t: Theme) => void;
  section: SectionId;
  onSection: (s: SectionId) => void;
  onRecheck: () => void;
  onToggleLocalOnly: () => void;
  defSchema: string;
  onDefSchema: (s: string) => void;
  defMode: Mode;
  onDefMode: (m: Mode) => void;
  defCustom: BField[];
  onDefCustom: (f: BField[]) => void;
}) {
  const usable = adapters.filter((a) => lightOf(a) === "green" && a.id !== "dry-run" && !(localOnly && a.egress));
  const activeId = usable[0]?.id ?? "dry-run";

  return (
    <div className="settings">
      <p className="kicker">Settings</p>
      <div className="set-layout">
        <nav className="set-nav">
          {SECTIONS.map((s) => (
            <button key={s.id} className={`set-navitem ${section === s.id ? "on" : ""}`} onClick={() => onSection(s.id)}>
              <Icon name={s.icon} size={16} />{s.label}
            </button>
          ))}
        </nav>

        <div className="set-panel">
          {section === "appearance" && (
            <>
              <p className="grouphdr" style={{ marginTop: 0 }}>Theme</p>
              <p className="muted" style={{ marginTop: 0 }}>Applies across the whole app.</p>
              <div className="seg">
                {THEMES.map((t) => (
                  <button key={t.id} className={`seg-opt ${theme === t.id ? "on" : ""}`} onClick={() => onSetTheme(t.id)}>
                    <Icon name={t.icon} size={15} />{t.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {section === "extraction" && (
            <>
              <p className="grouphdr" style={{ marginTop: 0 }}>Defaults for new jobs</p>
              <p className="muted" style={{ marginTop: 0 }}>
                What every document you drop on Home starts with. You can still override Depth, Pages, vision and Notes
                per&nbsp;job from the Options panel in the Studio, then Reparse.
              </p>
              <div className="row">
                <Dropdown label="Schema" value={defSchema} onChange={onDefSchema} options={["Auto", "Invoice", "Receipt", "Custom"]} />
                <Dropdown label="Depth" value={MODE_LABEL[defMode]} onChange={(v) => onDefMode(MODE_VAL[v] ?? "balanced")} options={["Fast", "Balanced", "Deep"]} />
              </div>

              {defSchema === "Custom" && (
                <div className="sb-wrap">
                  <p className="sb-hint">Define the fields to extract. Add a <b>table</b> field for repeating rows (line items, transactions).</p>
                  <SchemaBuilder fields={defCustom} onChange={onDefCustom} />
                </div>
              )}
            </>
          )}

          {section === "models" && (
            <>
              <p className="muted lede" style={{ marginTop: 0 }}>
                Decant runs the AI on an engine you connect — <b style={{ color: "var(--text)" }}>your own</b> Claude Code,
                Cursor, an Anthropic API key, or a local model — no inference cost, nothing leaves your Mac. Parsing, OCR and
                export work even with no model connected.
              </p>

              {detectError && (
                <div className="banner err">
                  <Icon name="alert" size={16} />
                  <div><b>Couldn’t detect engines</b><p>{detectError}</p></div>
                </div>
              )}

              <div className="switchrow" onClick={onToggleLocalOnly}>
                <div className="sw-ic"><Icon name={localOnly ? "lock" : "unlock"} size={18} /></div>
                <div className="sw-body">
                  <b>Local-only mode</b>
                  <p>
                    {localOnly
                      ? "On — any engine that would send data off your Mac (the API key) is hard-blocked."
                      : "Off — the Anthropic API-key engine is allowed to send document content off-device."}
                  </p>
                </div>
                <button className={`switch ${localOnly ? "on" : ""}`} role="switch" aria-checked={localOnly}
                  onClick={(e) => { e.stopPropagation(); onToggleLocalOnly(); }}>
                  <span className="knob" />
                </button>
              </div>

              <div className="grouprow">
                <p className="grouphdr" style={{ margin: 0 }}>Engines</p>
                <button className="btn ghost" onClick={onRecheck} disabled={checking}>
                  <Icon name="refresh" size={13} className={checking ? "spin" : ""} />
                  {checking ? "Checking…" : "Re-check engines"}
                </button>
              </div>

              {adapters.map((a) => (
                <EngineRow key={a.id} a={a} active={a.id === activeId}
                  blocked={localOnly && a.egress && lightOf(a) !== "gray"} onRecheck={onRecheck} checking={!!checking} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
