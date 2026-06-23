import * as pdfjs from "pdfjs-dist";
import { loadPdfBytes } from "./engine.ts";
import type { PickedFile } from "./files.ts";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// Prepare the page image for the vision/OCR pass — but only when it's actually worth it:
// Deep mode (figures) OR a scanned/low-text page (hybrid OCR). Loads the bytes once, checks the
// text layer, and renders page 1 to a PNG (base64, no prefix). Returns "" when not needed,
// when there are no bytes (sample/browser), or on any failure (vision then simply skips).
export async function prepPageImage(picked: PickedFile | undefined, mode: string, force = false, scale = 2): Promise<string> {
  try {
    const bytes = await loadPdfBytes(picked);
    if (!bytes) return "";
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
    try {
      const page = await doc.getPage(1);
      const tc = await page.getTextContent();
      const scanned = (tc.items?.length ?? 0) < 5; // little/no extractable text → likely scanned
      if (!force && mode !== "deep" && !scanned) return ""; // text doc + not Deep + not forced → skip
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    } finally {
      await doc.destroy(); // free the PDF transport/buffers
    }
  } catch (e) {
    console.error("[Decant] page image prep failed:", e);
    return "";
  }
}
