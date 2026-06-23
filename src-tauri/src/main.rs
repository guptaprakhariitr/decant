// Decant — Tauri shell. Thin native window; all real work goes to the engine (`decantd`).
// The engine runs the deterministic pipeline locally and calls the USER'S OWN Claude → $0.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;

// Resolve how to invoke the engine. The engine (`decantd`) ships as a prebuilt, self-contained
// binary — its source is not part of this open-source shell repo.
// - Release: the bundled `decantd` sidecar placed next to the app executable by Tauri.
// - Dev: the prebuilt binary in src-tauri/binaries/ (download it from Releases).
// - Override: set DECANT_ENGINE to any decantd path.
fn engine_command(args: &[&str]) -> Command {
    // 1) explicit override
    if let Ok(bin) = std::env::var("DECANT_ENGINE") {
        let mut c = Command::new(bin);
        c.args(args);
        return c;
    }
    // 2) bundled sidecar — Tauri places `decantd` next to the app executable (Contents/MacOS/)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let sidecar = dir.join("decantd");
            if sidecar.exists() {
                let mut c = Command::new(sidecar);
                c.args(args);
                return c;
            }
        }
    }
    // 3) dev fallback: the prebuilt sidecar checked into src-tauri/binaries/ for the host triple
    let bin = concat!(env!("CARGO_MANIFEST_DIR"), "/binaries/decantd-aarch64-apple-darwin");
    let mut c = Command::new(bin);
    c.args(args);
    c
}

fn run_engine(args: &[&str]) -> Result<String, String> {
    let out = engine_command(args).output().map_err(|e| format!("engine spawn failed: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    // The compiled engine can emit non-JSON noise on stdout (e.g. bun's "@napi-rs/canvas"
    // load warnings). Slice from the first JSON token so parsing stays robust.
    let json_start = stdout.find(['[', '{']).unwrap_or(0);
    Ok(stdout[json_start..].to_string())
}

#[tauri::command]
fn detect_adapters() -> Result<serde_json::Value, String> {
    // The CLI prints a human table for `detect`; expose JSON via a dedicated flag if needed.
    // For now we shell `detect --json` (engine returns the availability array).
    let raw = run_engine(&["detect", "--json"])?;
    serde_json::from_str(&raw).map_err(|e| format!("bad detect json: {e}"))
}

use std::sync::atomic::{AtomicU64, Ordering};
static JOB_SEQ: AtomicU64 = AtomicU64::new(0);

// Run a real extraction. ASYNC + spawn_blocking so the slow engine/model call runs OFF the
// main thread — the UI stays responsive and multiple jobs can be queued. The schema is passed
// inline and written to a per-call temp .json the engine reads (engine itself is untouched).
#[tauri::command]
async fn extract(file: String, schema_json: String, local_only: bool, mode: String, pages: String, image_b64: String, notes: String, vision: bool) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let n = JOB_SEQ.fetch_add(1, Ordering::Relaxed);
        let schema_path = std::env::temp_dir().join(format!("decant-schema-{n}.json"));
        std::fs::write(&schema_path, &schema_json).map_err(|e| format!("schema write failed: {e}"))?;
        let sp = schema_path.to_string_lossy().to_string();

        // Optional page image (Deep + vision): decode base64 → temp PNG → pass with --image.
        let mut img_path = String::new();
        if !image_b64.is_empty() {
            if let Ok(bytes) = base64_decode(&image_b64) {
                let p = std::env::temp_dir().join(format!("decant-page-{n}.png"));
                if std::fs::write(&p, &bytes).is_ok() {
                    img_path = p.to_string_lossy().to_string();
                }
            }
        }

        let mut args: Vec<&str> = vec!["extract", &file, &sp];
        if local_only {
            args.push("--local-only");
        }
        if !mode.is_empty() {
            args.push("--mode");
            args.push(&mode);
        }
        if !pages.is_empty() {
            args.push("--pages");
            args.push(&pages);
        }
        if !img_path.is_empty() {
            args.push("--image");
            args.push(&img_path);
        }
        if !notes.is_empty() {
            args.push("--notes");
            args.push(&notes);
        }
        if vision {
            args.push("--vision");
        }
        let raw = run_engine(&args)?;
        let parsed = serde_json::from_str::<serde_json::Value>(&raw).map_err(|e| format!("bad extract json: {e}"));
        let _ = std::fs::remove_file(&schema_path);
        if !img_path.is_empty() {
            let _ = std::fs::remove_file(&img_path);
        }
        parsed
    })
    .await
    .map_err(|e| format!("extract task failed: {e}"))?
}

// Minimal base64 decoder (no extra crate) for the optional page image.
fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut rev = [255u8; 256];
    for (i, &c) in T.iter().enumerate() {
        rev[c as usize] = i as u8;
    }
    let mut out = Vec::with_capacity(s.len() / 4 * 3);
    let mut buf = 0u32;
    let mut bits = 0u32;
    for &b in s.as_bytes() {
        if b == b'=' || b == b'\n' || b == b'\r' {
            continue;
        }
        let v = rev[b as usize];
        if v == 255 {
            return Err("invalid base64".into());
        }
        buf = (buf << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    Ok(out)
}

// Resolve ~/.decant/ui-state.json, creating the ~/.decant dir if needed.
fn state_path() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "no HOME set".to_string())?;
    let dir = std::path::Path::new(&home).join(".decant");
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir ~/.decant failed: {e}"))?;
    Ok(dir.join("ui-state.json"))
}

// Persist the UI state JSON to ~/.decant/ui-state.json so the user's jobs/settings survive restart.
#[tauri::command]
fn save_state(state: String) -> Result<(), String> {
    // Atomic: write a temp file then rename over the target, so an interrupted write can never
    // leave a truncated ui-state.json (which would wipe the user's jobs on next load).
    let path = state_path()?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, state).map_err(|e| format!("save_state write failed: {e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("save_state rename failed: {e}"))
}

// Load the persisted UI state JSON; returns an empty string if no state file exists yet.
#[tauri::command]
fn load_state() -> Result<String, String> {
    let path = state_path()?;
    match std::fs::read_to_string(&path) {
        Ok(s) => Ok(s),
        Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!("load_state read failed: {e}")),
    }
}

// PARSE mode: full document → faithful Markdown. Async/off-thread like extract.
#[tauri::command]
async fn parse_doc(file: String, local_only: bool, mode: String, pages: String, notes: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut args: Vec<&str> = vec!["format", &file];
        if local_only {
            args.push("--local-only");
        }
        if !mode.is_empty() {
            args.push("--mode");
            args.push(&mode);
        }
        if !pages.is_empty() {
            args.push("--pages");
            args.push(&pages);
        }
        if !notes.is_empty() {
            args.push("--notes");
            args.push(&notes);
        }
        let raw = run_engine(&args)?;
        serde_json::from_str::<serde_json::Value>(&raw).map_err(|e| format!("bad format json: {e}"))
    })
    .await
    .map_err(|e| format!("parse task failed: {e}"))?
}

// CHUNK mode: local RAG chunks (no model). Fast + off-thread.
#[tauri::command]
async fn chunk_doc(file: String, pages: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut args: Vec<&str> = vec!["chunk", &file];
        if !pages.is_empty() {
            args.push("--pages");
            args.push(&pages);
        }
        let raw = run_engine(&args)?;
        serde_json::from_str::<serde_json::Value>(&raw).map_err(|e| format!("bad chunk json: {e}"))
    })
    .await
    .map_err(|e| format!("chunk task failed: {e}"))?
}

// Write a text file to a user-chosen path (for Export downloads). Off-thread.
#[tauri::command]
async fn write_file(path: String, contents: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || std::fs::write(&path, contents).map_err(|e| format!("write failed: {e}")))
        .await
        .map_err(|e| format!("write task failed: {e}"))?
}

// Read a file's raw bytes so pdf.js can render the *actual* document the user opened.
// Async + spawn_blocking so a large read never stalls the UI thread.
#[tauri::command]
async fn read_file(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || std::fs::read(&path).map_err(|e| format!("read failed: {e}")))
        .await
        .map_err(|e| format!("read task failed: {e}"))??;
    Ok(tauri::ipc::Response::new(bytes))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![detect_adapters, extract, parse_doc, chunk_doc, read_file, write_file, load_state, save_state])
        .run(tauri::generate_context!())
        .expect("error while running Decant");
}
