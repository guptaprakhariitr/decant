// Extraction schemas the UI offers. The selected schema is passed to the engine inline
// (the Rust side writes it to a temp .json that `decantd extract <file> <schema.json>` reads).

export type FieldDef = { name: string; type: string; description?: string; required?: boolean };
export type SchemaDef = { name: string; fields: FieldDef[]; auto?: boolean };

export const SCHEMAS: Record<string, SchemaDef> = {
  // Smart mode (default): the model discovers the fields present in the document.
  Auto: { name: "Auto", auto: true, fields: [] },
  Invoice: {
    name: "Invoice",
    fields: [
      { name: "invoice_number", type: "string", description: "Top-right ID like INV-...", required: true },
      { name: "invoice_date", type: "date", description: "Issue date", required: true },
      { name: "vendor_name", type: "string", description: "Seller / from entity", required: true },
      { name: "total", type: "currency", description: "Grand total incl tax", required: true },
      { name: "tax", type: "currency", description: "Tax amount" },
    ],
  },
  Receipt: {
    name: "Receipt",
    fields: [
      { name: "merchant", type: "string", description: "Store / merchant name", required: true },
      { name: "date", type: "date", description: "Transaction date", required: true },
      { name: "total", type: "currency", description: "Amount paid", required: true },
    ],
  },
};

export function schemaFor(name: string): SchemaDef {
  return SCHEMAS[name] ?? SCHEMAS.Invoice;
}
