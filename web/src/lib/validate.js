/* validate.js (ESM) — local validation of import payloads BEFORE any NocoDB call.
 * Ported verbatim from the legacy UMD module; only the export style changed.
 *
 * NocoDB rejects type-mismatched values (e.g. "+966 54 115 5254" into a Number
 * column -> ERR_FILTER_VERIFICATION_FAILED / 422). This normalizes what it can
 * and reports what it changed/dropped so the user can fix it in the preview. */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// -> { value, action: "ok"|"adjusted"|"dropped", reason }
export function normalizeValue(type, raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (s === "") return { value: "", action: "ok" };

  if (type === "number") {
    const digits = s.replace(/[^\d]/g, "");
    if (digits === "") return { value: "", action: "dropped", reason: "not a number" };
    if (digits !== s) return { value: digits, action: "adjusted", reason: "stripped to digits (Number column)" };
    return { value: s, action: "ok" };
  }

  if (type === "email") {
    const e = s.replace(/\s+/g, "");
    if (!EMAIL_RE.test(e)) return { value: "", action: "dropped", reason: "invalid email" };
    if (e !== s) return { value: e, action: "adjusted", reason: "removed spaces" };
    return { value: s, action: "ok" };
  }

  if (type === "date") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: s, action: "ok" };
    const d = new Date(s);
    if (isNaN(d.getTime())) return { value: "", action: "dropped", reason: "unrecognized date" };
    const iso = d.toISOString().slice(0, 10);
    return { value: iso, action: "adjusted", reason: "normalized to YYYY-MM-DD" };
  }

  if (type === "url") {
    if (/^https?:\/\//i.test(s)) return { value: s, action: "ok" };
    if (/^www\./i.test(s) || /\.[a-z]{2,}(\/|$)/i.test(s)) {
      return { value: "https://" + s, action: "adjusted", reason: "added https://" };
    }
    return { value: "", action: "dropped", reason: "invalid URL" };
  }

  return { value: s, action: "ok" };
}

// Validate + auto-correct one normalized row IN PLACE; returns issues found.
export function validateRow(row, rules, rowIndex) {
  const issues = [];
  const targets = [
    ["user_profile", "user", rules.user],
    ["company_profile", "company", rules.company],
    ["incubated_startups", "incubation", rules.incubation],
  ];

  targets.forEach(([label, key, fieldRules]) => {
    const payload = row[key];
    if (!payload || !fieldRules) return;
    Object.keys(fieldRules).forEach((field) => {
      if (!(field in payload)) return;
      const raw = payload[field];
      const r = normalizeValue(fieldRules[field], raw);
      if (r.action === "ok") return;
      if (r.action === "adjusted") payload[field] = r.value;
      else delete payload[field]; // unusable -> don't send it to NocoDB
      issues.push({
        row: rowIndex, table: label, key, field,
        raw: String(raw), value: r.value, action: r.action, reason: r.reason,
      });
    });
  });

  return issues;
}

export function validateRows(rows, rules) {
  let all = [];
  rows.forEach((row, i) => { all = all.concat(validateRow(row, rules, i)); });
  return all;
}
