// Session persistence. In the packaged Tauri app this reads/writes ~/.decant/ui-state.json via
// the Rust `load_state`/`save_state` commands. In browser dev (not Tauri) it falls back to
// localStorage so the UI still persists while exploring without the toolchain.

const LS_KEY = "decant-ui-state";

// Tauri injects window.__TAURI_INTERNALS__; detect it to choose real vs dev path.
const inTauri = typeof (globalThis as any).__TAURI_INTERNALS__ !== "undefined";

async function tauriInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// Load persisted state, parsing JSON. Any failure (missing, corrupt, older shape) → fallback.
export async function loadState<T>(fallback: T): Promise<T> {
  try {
    let raw = "";
    if (inTauri) {
      raw = await tauriInvoke<string>("load_state", {});
    } else {
      raw = globalThis.localStorage?.getItem(LS_KEY) ?? "";
    }
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Debounced save (~400ms) so rapid state changes coalesce into a single write.
let timer: ReturnType<typeof setTimeout> | null = null;
export function saveState(obj: unknown): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const json = JSON.stringify(obj);
    if (inTauri) {
      void tauriInvoke("save_state", { state: json }).catch(() => {
        /* best-effort persistence; ignore write failures */
      });
    } else {
      try {
        globalThis.localStorage?.setItem(LS_KEY, json);
      } catch {
        /* quota or unavailable; ignore */
      }
    }
  }, 400);
}
