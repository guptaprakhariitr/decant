// Native file picker. In the packaged/dev Tauri app this drives the OS dialog through the
// dialog plugin via the core invoke API (no extra npm dependency). In browser dev it falls
// back to a hidden <input type=file>. Either way it returns enough to read the bytes later:
// a filesystem path (Tauri) or a File handle (browser).

const inTauri = typeof (globalThis as any).__TAURI_INTERNALS__ !== "undefined";

const EXTS = ["pdf", "png", "jpg", "jpeg", "tiff", "tif", "docx", "xlsx"];

export type PickedFile = { name: string; path?: string; file?: File };

export function baseName(p: string): string {
  return p.split(/[\\/]/).pop() || p;
}

// Save text to a file the user chooses. Tauri → native Save dialog + write (returns the chosen
// path so we can tell them where it went). Browser → <a download> fallback (returns the filename).
// Returns null if the user cancelled.
export async function saveDownload(name: string, text: string, mime = "text/plain"): Promise<string | null> {
  if (inTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string | null>("plugin:dialog|save", { options: { defaultPath: name } });
    if (!path) return null; // cancelled
    await invoke("write_file", { path, contents: text });
    return path;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  return name;
}

export async function openFiles(): Promise<PickedFile[]> {
  if (inTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const picked = await invoke<string | string[] | null>("plugin:dialog|open", {
      options: {
        title: "Add documents to extract",
        multiple: true,
        directory: false,
        filters: [{ name: "Documents", extensions: EXTS }],
      },
    });
    if (!picked) return [];
    const paths = Array.isArray(picked) ? picked : [picked];
    return paths.map((p) => ({ name: baseName(p), path: p }));
  }

  // browser dev fallback — keep the real File so pdf.js can render it
  return new Promise<PickedFile[]>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = EXTS.map((e) => "." + e).join(",");
    input.style.display = "none";
    const done = (files: PickedFile[]) => {
      input.remove();
      resolve(files);
    };
    input.onchange = () => done(Array.from(input.files ?? []).map((f) => ({ name: f.name, file: f })));
    input.oncancel = () => done([]);
    document.body.appendChild(input); // attached → reliable across browsers + testable
    input.click();
  });
}
