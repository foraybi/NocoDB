/* techAdoptionBuild.js — turn raw CSV/XLSX rows into the payload the backend
 * bulk endpoints expect: match pairs (company + user) + the session fields.
 * Match pairs are [col, value] tuples so they slot straight into buildMatchMaps. */
import { digits, clean } from "./csv.js";

function pairs(raw, keys) {
  const out = [];
  for (const k of keys) {
    let v = clean(raw[k.csv]);
    if (!v) continue;
    if (k.numeric) v = digits(v);
    if (!v) continue;
    out.push([k.col, v]);
  }
  return out;
}

// Build one bulk row. TA = CONFIG.techAdoption.
export function buildRow(raw, TA) {
  const company = pairs(raw, TA.bulk.companyMatchKeys);
  const user = pairs(raw, TA.bulk.userMatchKeys);
  const session = {};
  for (const f of TA.formFields) {
    const v = clean(raw[f.key]);
    if (v) session[f.key] = v;
  }
  return { match: { company, user }, session, __hasCompany: company.length > 0 };
}

export function buildRows(rawRows, TA) {
  return rawRows.map((r) => buildRow(r, TA));
}
