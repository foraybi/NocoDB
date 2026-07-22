"use strict";
const test = require("node:test");
const assert = require("node:assert");

global.window = global.window || {};
require("../config.js");
const IMP = global.window.CONFIG.incubationImport;
const V = require("../validate.js");
const { buildRow } = require("../incubationBuild.js");

test("the real failing value: '+966 54 115 5254' into a Number column", () => {
  const r = V.normalizeValue("number", "+966 54 115 5254");
  assert.strictEqual(r.action, "adjusted");
  assert.strictEqual(r.value, "966541155254"); // digits only -> NocoDB accepts
});

test("number: unusable value is dropped, clean value untouched", () => {
  assert.deepStrictEqual(V.normalizeValue("number", "abc"), { value: "", action: "dropped", reason: "not a number" });
  assert.strictEqual(V.normalizeValue("number", "7017401162").action, "ok");
});

test("email / date / url normalization", () => {
  assert.strictEqual(V.normalizeValue("email", "not-an-email").action, "dropped");
  assert.strictEqual(V.normalizeValue("email", "a@b.com").action, "ok");
  assert.strictEqual(V.normalizeValue("date", "2026-07-22").action, "ok");
  assert.strictEqual(V.normalizeValue("date", "not a date").action, "dropped");
  const url = V.normalizeValue("url", "www.example.com");
  assert.strictEqual(url.action, "adjusted");
  assert.strictEqual(url.value, "https://www.example.com");
});

test("validateRow corrects payloads in place and reports issues", () => {
  const row = {
    user: { phone_number: "+966 54 115 5254", Email: "bad email", national_id: "1079132013" },
    company: { cr_number: "70-174 011", website: "www.x.sa" },
    incubation: { "Team Size": "2" },
  };
  const issues = V.validateRow(row, IMP.validate, 0);

  assert.strictEqual(row.user.phone_number, "966541155254"); // adjusted
  assert.ok(!("Email" in row.user));                          // dropped
  assert.strictEqual(row.user.national_id, "1079132013");     // untouched
  assert.strictEqual(row.company.cr_number, "70174011");      // adjusted
  assert.strictEqual(row.company.website, "https://www.x.sa");

  const fields = issues.map((i) => `${i.key}.${i.field}:${i.action}`);
  assert.ok(fields.includes("user.phone_number:adjusted"));
  assert.ok(fields.includes("user.Email:dropped"));
  assert.ok(fields.includes("company.cr_number:adjusted"));
});

test("match pairs are digitized so Number-column filters never 422", () => {
  const r = buildRow({
    name: "فيصل", mobile: " +966 54 115 5254", national_id_number: "1079132013",
    cr_number: "70-174 011", registration_status: "approved",
  }, IMP, "2026-07-22");

  const phonePair = r.match.user.find(([c]) => c === "phone_number");
  assert.deepStrictEqual(phonePair, ["phone_number", "966541155254"]); // no "+" or spaces
  const crPair = r.match.company.find(([c]) => c === "cr_number");
  assert.deepStrictEqual(crPair, ["cr_number", "70174011"]);
  // every numeric match value must be digits only
  r.match.user.concat(r.match.company).forEach(([col, v]) => {
    if (["national_id", "phone_number", "cr_number"].includes(col)) assert.match(v, /^\d+$/);
  });
});

test("validateRows returns issues for every row, corrected in place", () => {
  const rows = [
    { user: { phone_number: "+966 1" }, company: {}, incubation: {} },
    { user: { phone_number: "9662" }, company: {}, incubation: {} },
  ];
  const issues = V.validateRows(rows, IMP.validate);
  assert.strictEqual(issues.length, 1);      // only the first needed fixing
  assert.strictEqual(issues[0].row, 0);
  assert.strictEqual(rows[0].user.phone_number, "9661");
});
