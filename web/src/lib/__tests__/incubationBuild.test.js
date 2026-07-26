import { test } from "vitest";
import assert from "node:assert";
import { CONFIG } from "../config.js";
import { buildRow } from "../incubationBuild.js";

const IMP = CONFIG.incubationImport;
const TODAY = "2026-07-26";

const rowSaudi = {
  name: "سعود حسن الغامدي", name_en: "SAUD ALGHAMDI",
  mobile: " +966544555171", mail: "saud36@gmail.com",
  user_type: "رائد أعمال", national_id_number: "1079132013",
  gender: "1", dob: "1992-10-13",
  company_name_ar: "شركة الرمز الأفضل", company_name_en: "Wise",
  business_brief_ar: "وصف عربي", business_brief_en: "EN brief",
  company_industry: "Technology", technologies_table: "الذكاء الاصطناعي",
  cr_number: "7017401162", number_of_founding_team: "2",
  company_profile: "https://innov.example.sa/p/123",
  registration_status: "approved",
};

test("user_profile derived fields", () => {
  const r = buildRow(rowSaudi, IMP, TODAY);
  assert.strictEqual(r.user.full_name, "سعود حسن الغامدي");
  assert.strictEqual(r.user.phone_number, "966544555171"); // digits
  assert.strictEqual(r.user.gender, "Male");               // 1 -> Male
  assert.strictEqual(r.user.id_type, "saudi national id");
  assert.strictEqual(r.user.user_type, "entrepreneur");
  assert.strictEqual(r.user.Program, "الاحتضان");
  assert.strictEqual(r.user.registration_date, TODAY);
});

test("company_profile derived fields (user_id injected server-side, absent here)", () => {
  const r = buildRow(rowSaudi, IMP, TODAY);
  assert.strictEqual(r.company.company_unified_number, "7017401162");
  assert.strictEqual(r.company.company_email, "saud36@gmail.com");
  assert.strictEqual(r.company.business_industry, "Technology");
  assert.strictEqual(r.company.technology_used, "الذكاء الاصطناعي");
  assert.strictEqual(r.company.company_registration_date, TODAY);
  assert.ok(!("user_id" in r.company));
});

test("incubated_startups fields incl. Intro Link from company_profile", () => {
  const r = buildRow(rowSaudi, IMP, TODAY);
  assert.strictEqual(r.incubation["Company name"], "شركة الرمز الأفضل");
  assert.strictEqual(r.incubation["Description"], "وصف عربي");
  assert.strictEqual(r.incubation["Phone"], "966544555171");
  assert.strictEqual(r.incubation["Sector"], "Technology");
  assert.strictEqual(r.incubation["Tech Used"], "الذكاء الاصطناعي");
  assert.strictEqual(r.incubation["Team Size"], "2");
  assert.strictEqual(r.incubation["Add_date"], TODAY);
  assert.strictEqual(r.incubation["Intro Link"], "https://innov.example.sa/p/123");
});

test("id_type: residency -> iqama; passport -> no-id; gender 2 -> Female; EN fallbacks", () => {
  const iqama = buildRow({ name: "x", residency_number: "2195327370", gender: "2", registration_status: "registered" }, IMP, TODAY);
  assert.strictEqual(iqama.user.id_type, "saudi iqama");
  assert.strictEqual(iqama.user.gender, "Female");
  const pass = buildRow({ name: "y", passport_number: "A123", registration_status: "registered" }, IMP, TODAY);
  assert.strictEqual(pass.user.id_type, "no saudi id or iqama");
  const en = buildRow({ name: "z", company_name_en: "OnlyEn", business_brief_en: "onlyEn", registration_status: "approved" }, IMP, TODAY);
  assert.strictEqual(en.incubation["Company name"], "OnlyEn");
  assert.strictEqual(en.incubation["Description"], "onlyEn");
});
