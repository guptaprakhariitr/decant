// Minimal GitHub-Flavored Markdown renderer — no external dependency, CSP-safe. Supports the
// subset Parse mode emits: headings, paragraphs, bold/italic/code, lists, hr, and GFM tables.
// Input is escaped first, so model output can't inject HTML.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}
function cells(row: string): string[] {
  return row.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

function toHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // GFM table: a | row followed by a |---| separator
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      flush();
      const header = cells(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|?\s*$/.test(lines[i]) && lines[i].includes("|")) {
        rows.push(cells(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${header.map((_, c) => `<td>${inline(r[c] ?? "")}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      out.push(`<div class="md-table"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      const n = h[1].length;
      out.push(`<h${n}>${inline(h[2])}</h${n}>`);
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      out.push("<hr/>");
      i++;
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }

    if (line.trim() === "") {
      flush();
      i++;
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flush();
  // Each top-level block sits in its own neutral bordered card (not multi-colored).
  return out.map((el) => `<div class="md-block">${el}</div>`).join("");
}

export function Markdown({ md }: { md: string }) {
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: toHtml(md) }} />;
}
