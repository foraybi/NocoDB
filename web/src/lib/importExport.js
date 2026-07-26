/* importExport.js — parse an uploaded CSV/XLSX into rows, and export the edited
 * data back in the ORIGINAL file format. Ported from the legacy incubation.js. */
import * as XLSXImport from "../../vendor/xlsx.full.min.js";
import { parseCSV } from "./csv.js";
import { CONFIG } from "./config.js";

// The vendored SheetJS is a UMD bundle; normalize its shape for ESM interop.
const XLSX = XLSXImport.read ? XLSXImport : (XLSXImport.default || XLSXImport);

const IMP = CONFIG.incubationImport;

// canonical "key.field" -> original CSV column (invert user/company field maps).
const REVERSE = (() => {
  const m = {};
  Object.entries(IMP.userFieldMap).forEach(([csv, col]) => { m["user." + col] = csv; });
  Object.entries(IMP.companyFieldMap).forEach(([csv, col]) => { m["company." + col] = csv; });
  return m;
})();

// Read a File -> { headers, rows } (strings). CSV read as UTF-8; xlsx via SheetJS.
export function readImportFile(file) {
  const isExcel = /\.xlsx?$/i.test(file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      try {
        if (isExcel) {
          const wb = XLSX.read(reader.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
          const headers = (aoa[0] || []).map((h) => String(h).trim());
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
          resolve({ headers, rows, fileType: "xlsx" });
        } else {
          const { headers, rows } = parseCSV(reader.result);
          resolve({ headers, rows, fileType: "csv" });
        }
      } catch (e) { reject(e); }
    };
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file, "utf-8");
  });
}

// Build export rows in original column shape, applying edited status + corrected
// user/company fields (mapped back to their original columns).
export function buildExportRows(rawRows, normalized) {
  return rawRows.map((raw, i) => {
    const n = normalized[i];
    const out = Object.assign({}, raw);
    if (n) {
      out[IMP.statusColumn] = n.status;
      Object.entries(REVERSE).forEach(([nkey, origCol]) => {
        if (!(origCol in raw)) return;
        const dot = nkey.indexOf(".");
        const key = nkey.slice(0, dot), field = nkey.slice(dot + 1);
        const present = n[key] && Object.prototype.hasOwnProperty.call(n[key], field);
        out[origCol] = present ? n[key][field] : "";
      });
    }
    return out;
  });
}

function toCSV(headers, rows) {
  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(esc).join(",")];
  rows.forEach((r) => lines.push(headers.map((h) => esc(r[h])).join(",")));
  return "﻿" + lines.join("\r\n"); // BOM so Excel renders Arabic
}

function triggerDownload(filename, data, mime) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadEdited(format, headers, rawRows, normalized) {
  const cols = headers && headers.length ? headers : Object.keys(rawRows[0] || {});
  const rows = buildExportRows(rawRows, normalized);
  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rows, { header: cols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    triggerDownload("incubation-edited.xlsx", XLSX.write(wb, { type: "array", bookType: "xlsx" }), "application/octet-stream");
  } else {
    triggerDownload("incubation-edited.csv", toCSV(cols, rows), "text/csv;charset=utf-8");
  }
}
