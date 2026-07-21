"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { planRow, summarize } = require("../server-reference/lib/matcher.js");

test("invalid row -> invalid", () => {
  assert.strictEqual(planRow({ __valid: false, __errors: ["x"] }, {}).action, "invalid");
});

test("already linked -> skip-duplicate", () => {
  const r = planRow({ __valid: true }, { matchedUserId: 5, alreadyLinked: true });
  assert.strictEqual(r.action, "skip-duplicate");
});

test("matched but not linked -> link", () => {
  assert.strictEqual(planRow({ __valid: true }, { matchedUserId: 5, alreadyLinked: false }).action, "link");
});

test("no match -> create", () => {
  assert.strictEqual(planRow({ __valid: true }, { matchedUserId: null, alreadyLinked: false }).action, "create");
});

test("summarize counts each action", () => {
  const plans = [
    { action: "create" }, { action: "create" }, { action: "link" },
    { action: "skip-duplicate" }, { action: "invalid" },
  ];
  assert.deepStrictEqual(summarize(plans), { create: 2, link: 1, skipDuplicate: 1, invalid: 1 });
});
