import { Icon } from "./Icon.tsx";
import type { FieldDef } from "../lib/schemas.ts";

// Visual schema editor: define the fields to extract — name, type,
// description — and for a `table` field, its columns. Columns are folded into the field
// description so the engine model returns rows with exactly those keys (no engine change needed).

export type BCol = { name: string; type: string };
export type BField = { name: string; type: string; description: string; columns: BCol[] };

const TYPES = ["text", "number", "date", "currency", "boolean", "table"];
const COL_TYPES = ["text", "number", "date", "currency", "boolean"];

export function emptyField(): BField {
  return { name: "", type: "text", description: "", columns: [] };
}

// Build the engine SchemaDef field list from the visual fields.
export function toFieldDefs(fields: BField[]): FieldDef[] {
  return fields
    .filter((f) => f.name.trim())
    .map((f) => {
      let description = f.description.trim();
      if (f.type === "table" && f.columns.length) {
        const cols = f.columns.filter((c) => c.name.trim()).map((c) => `${c.name} (${c.type})`).join(", ");
        description = `${description ? description + ". " : ""}Array of rows with columns: ${cols}.`;
      }
      return { name: f.name.trim(), type: f.type, description };
    });
}

export function SchemaBuilder({ fields, onChange }: { fields: BField[]; onChange: (f: BField[]) => void }) {
  const set = (i: number, patch: Partial<BField>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const setCol = (i: number, ci: number, patch: Partial<BCol>) =>
    set(i, { columns: fields[i].columns.map((c, j) => (j === ci ? { ...c, ...patch } : c)) });

  return (
    <div className="sb">
      {fields.map((f, i) => (
        <div className="sb-field" key={i}>
          <div className="sb-row">
            <input className="sb-in name" placeholder="field_name" value={f.name} onChange={(e) => set(i, { name: e.target.value })} />
            <select className="sb-in type" value={f.type} onChange={(e) => set(i, { type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="sb-in desc" placeholder="What is this field? (guides the model)" value={f.description} onChange={(e) => set(i, { description: e.target.value })} />
            <button className="ibtn" title="Remove field" onClick={() => onChange(fields.filter((_, j) => j !== i))}><Icon name="minus" size={14} /></button>
          </div>
          {f.type === "table" && (
            <div className="sb-cols">
              <div className="sb-cols-label">columns</div>
              {f.columns.map((c, ci) => (
                <div className="sb-row" key={ci}>
                  <input className="sb-in name" placeholder="column_name" value={c.name} onChange={(e) => setCol(i, ci, { name: e.target.value })} />
                  <select className="sb-in type" value={c.type} onChange={(e) => setCol(i, ci, { type: e.target.value })}>
                    {COL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button className="ibtn" title="Remove column" onClick={() => set(i, { columns: f.columns.filter((_, j) => j !== ci) })}><Icon name="minus" size={14} /></button>
                </div>
              ))}
              <button className="sb-add" onClick={() => set(i, { columns: [...f.columns, { name: "", type: "text" }] })}><Icon name="plus" size={13} />Add column</button>
            </div>
          )}
        </div>
      ))}
      <button className="sb-add" onClick={() => onChange([...fields, emptyField()])}><Icon name="plus" size={14} />Add field</button>
    </div>
  );
}
