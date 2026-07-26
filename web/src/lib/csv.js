/* csv.js (ESM) — pure CSV parsing + header auto-mapping + row normalization.
 * Ported verbatim from the legacy UMD module; only the export style changed. */

// RFC-4180-ish parser: handles BOM, quotes, escaped quotes, CRLF, commas.
export function parseCSV(text) {
  if (text == null) return { headers: [], rows: [] };
  let s = String(text);
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // strip BOM

  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); field = ""; row = [];
    } else if (c === "\r") {
      row.push(field); rows.push(row); field = ""; row = [];
      if (s[i + 1] === "\n") i++;
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }

  const cleanRows = rows.filter((r) => r.some((v) => String(v).trim() !== ""));
  if (cleanRows.length === 0) return { headers: [], rows: [] };

  const headers = cleanRows[0].map((h) => String(h).trim());
  const dataRows = cleanRows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] != null ? r[idx] : ""; });
    return obj;
  });
  return { headers, rows: dataRows };
}

export function autoMap(headers, headerMap) {
  const mapping = {};
  headers.forEach((h) => {
    const key = h.trim();
    mapping[h] = headerMap[key] || "__unmapped";
  });
  return mapping;
}

export const digits = (v) => String(v == null ? "" : v).replace(/\D+/g, "");
export const clean = (v) => String(v == null ? "" : v).trim();

export function normalizeRow(rawRow, mapping, cfg) {
  const out = { __attendance: false, __errors: [] };
  Object.keys(rawRow).forEach((header) => {
    const key = mapping[header];
    if (!key || key === "__ignore" || key === "__unmapped") return;
    const val = clean(rawRow[header]);
    if (val === "") return;

    switch (key) {
      case "phone_number":
        out.phone_number = digits(val);
        break;
      case "national_id":
        out.national_id = digits(val) || val;
        break;
      case "gender":
        out.gender = cfg.genderMap[val] || cfg.genderMap[val.toLowerCase()] || "";
        if (!out.gender) delete out.gender;
        break;
      case "region_of_residence": {
        const mapped = cfg.cityMap[val];
        if (mapped) out.region_of_residence = mapped;
        break;
      }
      case "__attendance":
        out.__attendance = cfg.attendanceTruthy.includes(val.toLowerCase());
        break;
      default:
        out[key] = val;
    }
  });

  if (!out.en_full_name && !out.national_id) {
    out.__valid = false;
    out.__errors.push("missing name and national_id");
  } else {
    out.__valid = true;
  }
  return out;
}

export function userFieldsForCreate(normalized, writableUserFields) {
  const fields = {};
  writableUserFields.forEach((k) => {
    if (normalized[k] != null && normalized[k] !== "") fields[k] = normalized[k];
  });
  return fields;
}

export function mapFields(rawRow, fieldMap) {
  const out = {};
  Object.keys(fieldMap).forEach((csvCol) => {
    const v = clean(rawRow[csvCol]);
    if (v !== "") out[fieldMap[csvCol]] = v;
  });
  return out;
}

export function firstValue(rawRow, csvCols) {
  for (const c of csvCols) {
    const v = clean(rawRow[c]);
    if (v !== "") return v;
  }
  return "";
}
