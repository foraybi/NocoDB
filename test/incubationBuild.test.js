"use strict";
const test = require("node:test");
const assert = require("node:assert");

// Load the real config.js (it assigns window.CONFIG).
global.window = {};
require("../config.js");
const IMP = global.window.CONFIG.incubationImport;
const { buildRow } = require("../incubationBuild.js");

const TODAY = "2026-07-22";

// A representative Saudi applicant row (approved, entrepreneur, male).
const rowSaudi = {
  name: "سعود حسن الغامدي", name_en: "SAUD ALGHAMDI",
  mobile: " +966544555171", mail: "saud36@gmail.com",
  user_type: "رائد أعمال", national_id_number: "1079132013", residency_number: "", passport_number: "",
  gender: "1", dob: "1992-10-13",
  company_name_ar: "شركة الرمز الأفضل", company_name_en: "Wise",
  business_brief_ar: "وصف عربي", business_brief_en: "EN brief",
  company_industry: "Technology", technologies_table: "الذكاء الاصطناعي",
  cr_number: "7017401162", number_of_founding_team: "2",
  registration_status: "approved",
};

test("Saudi approved row: user_profile derived fields", () => {
  const r = buildRow(rowSaudi, IMP, TODAY);
  assert.strictEqual(r.user.full_name, "سعود حسن الغامدي");
  assert.strictEqual(r.user.en_full_name, "SAUD ALGHAMDI");
  assert.strictEqual(r.user.phone_number, "966544555171"); // digits only
  assert.strictEqual(r.user.Email, "saud36@gmail.com");
  assert.strictEqual(r.user.national_id, "1079132013"); // from national_id_number
  assert.strictEqual(r.user.gender, "Male");                 // 1 -> Male
  assert.strictEqual(r.user.id_type, "saudi national id");   // national id present
  assert.strictEqual(r.user.user_type, "entrepreneur");      // AR -> tag
  assert.strictEqual(r.user.Program, "الاحتضان");
  assert.strictEqual(r.user.registration_date, TODAY);
});

test("company_profile derived fields (user_id is server-side, absent here)", () => {
  const r = buildRow(rowSaudi, IMP, TODAY);
  assert.strictEqual(r.company.company_name_ar, "شركة الرمز الأفضل");
  assert.strictEqual(r.company.company_unified_number, "7017401162"); // from cr_number
  assert.strictEqual(r.company.company_email, "saud36@gmail.com");     // from mail
  assert.strictEqual(r.company.business_industry, "Technology");       // plain text
  assert.strictEqual(r.company.technology_used, "الذكاء الاصطناعي");
  assert.strictEqual(r.company.company_registration_date, TODAY);
  assert.ok(!("user_id" in r.company)); // injected by backend, not here
});

test("incubated_startups fields (approved)", () => {
  const r = buildRow(rowSaudi, IMP, TODAY);
  assert.strictEqual(r.incubation["Company name"], "شركة الرمز الأفضل"); // ar preferred
  assert.strictEqual(r.incubation["Description"], "وصف عربي");
  assert.strictEqual(r.incubation["Email"], "saud36@gmail.com");
  assert.strictEqual(r.incubation["Phone"], "966544555171");
  assert.strictEqual(r.incubation["Name"], "سعود حسن الغامدي");
  assert.strictEqual(r.incubation["Sector"], "Technology");
  assert.strictEqual(r.incubation["Tech Used"], "الذكاء الاصطناعي");
  assert.strictEqual(r.incubation["Team Size"], "2");
  assert.strictEqual(r.incubation["Add_date"], TODAY);
});

test("id_type: residency -> iqama; passport -> no-id; gender 2 -> Female", () => {
  const iqama = buildRow({ name: "x", residency_number: "2195327370", gender: "2", registration_status: "registered" }, IMP, TODAY);
  assert.strictEqual(iqama.user.id_type, "saudi iqama");
  assert.strictEqual(iqama.user.gender, "Female");
  const pass = buildRow({ name: "y", passport_number: "A123", registration_status: "registered" }, IMP, TODAY);
  assert.strictEqual(pass.user.id_type, "no saudi id or iqama");
});

test("CSV company_profile URL maps to incubated_startups 'Intro Link'", () => {
  const r = buildRow({ name: "x", company_profile: "https://innov.example.sa/p/123", registration_status: "approved" }, IMP, TODAY);
  assert.strictEqual(r.incubation["Intro Link"], "https://innov.example.sa/p/123");
  const empty = buildRow({ name: "y", company_profile: "", registration_status: "approved" }, IMP, TODAY);
  assert.ok(!("Intro Link" in empty.incubation)); // omitted when blank
});

test("company name falls back to EN when AR empty; brief too", () => {
  const r = buildRow({ name: "z", company_name_en: "OnlyEn", business_brief_en: "onlyEnBrief", registration_status: "approved" }, IMP, TODAY);
  assert.strictEqual(r.incubation["Company name"], "OnlyEn");
  assert.strictEqual(r.incubation["Description"], "onlyEnBrief");
});

test("match pairs built in priority order", () => {
  const r = buildRow(rowSaudi, IMP, TODAY);
  assert.deepStrictEqual(r.match.user[0], ["national_id", "1079132013"]);
  assert.deepStrictEqual(r.match.company[0], ["cr_number", "7017401162"]);
});
