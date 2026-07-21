/* matcher.js — pure planning logic for the attendee import (no I/O). */
"use strict";

/**
 * Decide what to do with one normalized attendee row.
 * @param {object} row        normalized row (from csv.js normalizeRow)
 * @param {object} ctx
 * @param {string|number|null} ctx.matchedUserId  existing user_profile Id, or null
 * @param {boolean} ctx.alreadyLinked             already linked to this event?
 * @returns {{action: "invalid"|"skip-duplicate"|"link"|"create", messages: string[]}}
 */
function planRow(row, ctx) {
  const messages = [];
  if (!row || row.__valid === false) {
    return { action: "invalid", messages: (row && row.__errors) || ["invalid row"] };
  }
  if (ctx && ctx.alreadyLinked) {
    return { action: "skip-duplicate", messages: ["already registered for this event"] };
  }
  if (ctx && ctx.matchedUserId != null) {
    return { action: "link", messages };
  }
  return { action: "create", messages };
}

/** Summarize a list of plans into totals. */
function summarize(plans) {
  const totals = { create: 0, link: 0, skipDuplicate: 0, invalid: 0 };
  plans.forEach((p) => {
    if (p.action === "create") totals.create++;
    else if (p.action === "link") totals.link++;
    else if (p.action === "skip-duplicate") totals.skipDuplicate++;
    else if (p.action === "invalid") totals.invalid++;
  });
  return totals;
}

module.exports = { planRow, summarize };
