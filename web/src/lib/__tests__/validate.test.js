import { test } from "vitest";
import assert from "node:assert";
import { CONFIG } from "../config.js";
import * as V from "../validate.js";
import { buildRow } from "../incubationBuild.js";

const IMP = CONFIG.incubationImport;

test("the real failing value: '+966 54 115 5254' into a Number column", () => {
  const r = V.normalizeValue("number", "+966 54 115 5254");
  assert.strictEqual(r.action, "adjusted");
  assert.strictEqual(r.value, "966541155254");
});

test("number/email/date/url normalization", () => {
  assert.strictEqual(V.normalizeValue("number", "abc").action, "dropped");
  assert.strictEqual(V.normalizeValue("email", "a@b.com").action, "ok");
  assert.strictEqual(V.normalizeValue("email", "bad").action, "dropped");
  assert.strictEqual(V.normalizeValue("date", "2026-07-26").action, "ok");
  const url = V.normalizeValue("url", "www.example.com");
  assert.strictEqual(url.value, "https://www.example.com");
});

test("validateRow corrects payloads in place and reports issues", () => {
  const row = {
    user: { phone_number: "+966 54 115 5254", Email: "bad email", national_id: "1079132013" },
    company: { cr_number: "70-174 011", website: "www.x.sa" },
    incubation: { "Team Size": "2" },
  };
  const issues = V.validateRow(row, IMP.validate, 0);
  assert.strictEqual(row.user.phone_number, "966541155254");
  assert.ok(!("Email" in row.user));
  assert.strictEqual(row.company.cr_number, "70174011");
  assert.strictEqual(row.company.website, "https://www.x.sa");
  const fields = issues.map((i) => `${i.key}.${i.field}:${i.action}`);
  assert.ok(fields.includes("user.phone_number:adjusted"));
  assert.ok(fields.includes("user.Email:dropped"));
});

test("match pairs are digitized so Number-column filters never 422", () => {
  const r = buildRow(
    { name: "فيصل", mobile: " +966 54 115 5254", national_id_number: "1079132013", cr_number: "70-174 011", registration_status: "approved" },
    IMP, "2026-07-26"
  );
  assert.deepStrictEqual(r.match.user.find(([c]) => c === "phone_number"), ["phone_number", "966541155254"]);
  assert.deepStrictEqual(r.match.company.find(([c]) => c === "cr_number"), ["cr_number", "70174011"]);
});
