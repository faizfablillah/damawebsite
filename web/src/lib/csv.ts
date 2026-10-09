import "server-only";
import Papa from "papaparse";

// Cells starting with = + - @ get a leading quote so a name can't run as a formula in Excel
export const toCsv = (rows: object[]) => Papa.unparse(rows, { escapeFormulae: true });

export function csvResponse(name: string, body: string) {
  // BOM so Excel opens UTF-8 correctly
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
