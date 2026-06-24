// Lightweight "update available" check — pings the public GitHub Releases API on launch, compares
// the latest tag to this build's version, and (if newer) surfaces a dismissible banner. No config,
// no secrets, no telemetry — just a version string in, a yes/no out. Silent on any failure (offline,
// rate-limit, running in the browser during dev).
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";

const REPO = "guptaprakhariitr/decant";

export type UpdateInfo = { latest: string; url: string };

// semver-ish compare on dotted numbers; returns >0 when a is newer than b.
function newer(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const current = await getVersion(); // throws outside the Tauri runtime (e.g. vite dev) → skip
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const tag = String(j?.tag_name ?? "");
    if (tag && newer(tag, current) > 0) {
      return { latest: tag, url: String(j?.html_url ?? `https://github.com/${REPO}/releases/latest`) };
    }
    return null;
  } catch {
    return null; // never let an update check break or block the app
  }
}

export async function openExternal(url: string): Promise<void> {
  try {
    await invoke("open_url", { url });
  } catch {
    /* dev/browser fallback */
    try { window.open(url, "_blank"); } catch {}
  }
}
