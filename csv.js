/* csv.js — pure CSV parsing + header auto-mapping + row normalization.
 *
 * No DOM, no network: usable in the browser (window.CSVKit) and in Node tests
 * (module.exports). All value normalization for the attendee import lives here.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Node
  root.CSVKit = api; // browser
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // --- RFC-4180-ish parser: handles BOM, quotes, escaped quotes, CRLF, commas ---
  function parseCSV(text) {
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
        // handle \r\n and lone \r
        row.push(field); rows.push(row); field = ""; row = [];
        if (s[i + 1] === "\n") i++;
      } else {
        field += c;
      }
    }
    // last field/row (unless file ended on a newline with no trailing data)
    if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }

    // drop fully-empty trailing rows
    const clean = rows.filter((r) => r.some((v) => String(v).trim() !== ""));
    if (clean.length === 0) return { headers: [], rows: [] };

    const headers = clean[0].map((h) => String(h).trim());
    const dataRows = clean.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = r[idx] != null ? r[idx] : ""; });
      return obj;
    });
    return { headers, rows: dataRows };
  }

  // --- auto-map raw headers to canonical keys via the config headerMap ---
  function autoMap(headers, headerMap) {
    const mapping = {};
    headers.forEach((h) => {
      const key = h.trim();
      mapping[h] = headerMap[key] || "__unmapped";
    });
    return mapping;
  }

  const digits = (v) => String(v == null ? "" : v).replace(/\D+/g, "");
  const clean = (v) => String(v == null ? "" : v).trim();

  // --- normalize one raw CSV row into canonical fields using a mapping + cfg ---
  // mapping: { rawHeader -> canonicalKey }
  // cfg: attendeeImport config block
  function normalizeRow(rawRow, mapping, cfg) {
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
          if (mapped) out.region_of_residence = mapped; // else leave blank (SingleSelect-safe)
          break;
        }
        case "__attendance":
          out.__attendance = cfg.attendanceTruthy.includes(val.toLowerCase());
          break;
        default:
          out[key] = val; // en_full_name, Email, etc.
      }
    });

    // validity: need at least a name or a national id
    if (!out.en_full_name && !out.national_id) {
      out.__valid = false;
      out.__errors.push("missing name and national_id");
    } else {
      out.__valid = true;
    }
    return out;
  }

  // keep only user_profile columns we're allowed to write on create
  function userFieldsForCreate(normalized, writableUserFields) {
    const fields = {};
    writableUserFields.forEach((k) => {
      if (normalized[k] != null && normalized[k] !== "") fields[k] = normalized[k];
    });
    return fields;
  }

  return { parseCSV, autoMap, normalizeRow, userFieldsForCreate };
});
