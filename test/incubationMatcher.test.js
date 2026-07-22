"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { planRow, summarize } = require("../server-reference/lib/incubationMatcher.js");

const cfg = { status: { approved: "approved", registered: "registered" } };

test("approved -> user + company + incubation", () => {
  const p = planRow({ status: "approved", __hasIdentity: true }, cfg);
  assert.strictEqual(p.action, "user-company-incubation");
  assert.strictEqual(p.process, true);
  assert.strictEqual(p.incubation, true);
});

test("registered -> user + company, no incubation", () => {
  const p = planRow({ status: "registered", __hasIdentity: true }, cfg);
  assert.strictEqual(p.action, "user-company");
  assert.strictEqual(p.incubation, false);
});

test("rejected -> skipped entirely", () => {
  const p = planRow({ status: "rejected", __hasIdentity: true }, cfg);
  assert.strictEqual(p.action, "skip-rejected");
  assert.strictEqual(p.process, false);
});

test("blank/unknown status -> skipped", () => {
  assert.strictEqual(planRow({ status: "", __hasIdentity: true }, cfg).action, "skip-rejected");
  assert.strictEqual(planRow({ status: "pending", __hasIdentity: true }, cfg).action, "skip-rejected");
});

test("approved but no identity -> invalid", () => {
  const p = planRow({ status: "approved", __hasIdentity: false }, cfg);
  assert.strictEqual(p.action, "invalid");
  assert.strictEqual(p.process, false);
});

test("status match is case/space-insensitive", () => {
  assert.strictEqual(planRow({ status: " Approved ", __hasIdentity: true }, cfg).action, "user-company-incubation");
});

test("summarize counts each action", () => {
  const plans = [
    { action: "user-company-incubation" },
    { action: "user-company" }, { action: "user-company" },
    { action: "skip-rejected" },
    { action: "invalid" },
  ];
  assert.deepStrictEqual(summarize(plans), { approved: 1, registered: 2, skipped: 1, invalid: 1 });
});
