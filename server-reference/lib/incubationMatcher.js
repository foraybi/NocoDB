/* incubationMatcher.js — pure planning logic for the incubation import (no I/O). */
"use strict";

// Normalize a raw registration_status value.
function normStatus(v) {
  return String(v == null ? "" : v).trim().toLowerCase();
}

/**
 * Decide what an incubation import row should do, independent of NocoDB lookups.
 * @param {object} row normalized row: { user:{...}, company:{...}, status, __hasIdentity }
 * @param {object} cfg incubationImport config (status names)
 * @returns {{ process:boolean, incubation:boolean, action:string, messages:string[] }}
 *   action ∈ "skip-rejected" | "invalid" | "user-company" | "user-company-incubation"
 */
function planRow(row, cfg) {
  const messages = [];
  const status = normStatus(row && row.status);
  const S = (cfg && cfg.status) || { approved: "approved", registered: "registered" };

  const isApproved = status === normStatus(S.approved);
  const isRegistered = status === normStatus(S.registered);

  // rejected / blank / unknown -> skip entirely (no user, no company)
  if (!isApproved && !isRegistered) {
    return { process: false, incubation: false, action: "skip-rejected", messages: [`status "${status || "(blank)"}" — skipped`] };
  }

  // must have at least a name or an id to create a person
  if (!row.__hasIdentity) {
    return { process: false, incubation: false, action: "invalid", messages: ["missing name and all id numbers"] };
  }

  if (isApproved) {
    return { process: true, incubation: true, action: "user-company-incubation", messages };
  }
  return { process: true, incubation: false, action: "user-company", messages };
}

function summarize(plans) {
  const t = { approved: 0, registered: 0, skipped: 0, invalid: 0 };
  plans.forEach((p) => {
    if (p.action === "user-company-incubation") t.approved++;
    else if (p.action === "user-company") t.registered++;
    else if (p.action === "skip-rejected") t.skipped++;
    else if (p.action === "invalid") t.invalid++;
  });
  return t;
}

module.exports = { planRow, summarize, normStatus };
