"use strict";
const test = require("node:test");
const assert = require("node:assert");
const CSVKit = require("../csv.js");

// minimal stand-in of the config.attendeeImport block
const cfg = {
  headerMap: {
    "الاسم الأول / الاسم الأخير": "en_full_name",
    "الهاتف المحمول": "phone_number",
    "الهوية الوطنية": "national_id",
    "البريد الإلكتروني": "Email",
    "الجنس": "gender",
    "المدينة": "region_of_residence",
    "حالة الحضور": "__attendance",
    "التصنيف": "__ignore",
  },
  writableUserFields: ["en_full_name", "phone_number", "national_id", "Email", "gender", "region_of_residence"],
  genderMap: { "ذكر": "Male", "أنثى": "Female" },
  cityMap: { "الرياض": "Riyadh", "جدة": "Jeddah" },
  attendanceTruthy: ["1", "نعم", "true", "yes"],
};

test("parseCSV handles BOM, quotes, embedded commas, CRLF", () => {
  const text = '﻿a,b,c\r\n"x,1","y""q",z\n1,2,3\n';
  const { headers, rows } = CSVKit.parseCSV(text);
  assert.deepStrictEqual(headers, ["a", "b", "c"]);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].a, "x,1");
  assert.strictEqual(rows[0].b, 'y"q');
  assert.strictEqual(rows[0].c, "z");
});

test("autoMap maps known Arabic headers and flags unknown", () => {
  const headers = ["الهوية الوطنية", "الجنس", "عمود غير معروف"];
  const m = CSVKit.autoMap(headers, cfg.headerMap);
  assert.strictEqual(m["الهوية الوطنية"], "national_id");
  assert.strictEqual(m["الجنس"], "gender");
  assert.strictEqual(m["عمود غير معروف"], "__unmapped");
});

test("normalizeRow maps values, gender, city, phone digits, attendance", () => {
  const raw = {
    "الاسم الأول / الاسم الأخير": " دانه احمد ",
    "الهاتف المحمول": "966-555-773 057",
    "الهوية الوطنية": "1069179958",
    "البريد الإلكتروني": "loliafactory@gmail.com",
    "الجنس": "أنثى",
    "المدينة": "الرياض",
    "حالة الحضور": "1",
    "التصنيف": "صاحب منشأة",
  };
  const mapping = CSVKit.autoMap(Object.keys(raw), cfg.headerMap);
  const n = CSVKit.normalizeRow(raw, mapping, cfg);
  assert.strictEqual(n.en_full_name, "دانه احمد");
  assert.strictEqual(n.phone_number, "966555773057");
  assert.strictEqual(n.national_id, "1069179958");
  assert.strictEqual(n.Email, "loliafactory@gmail.com");
  assert.strictEqual(n.gender, "Female");
  assert.strictEqual(n.region_of_residence, "Riyadh");
  assert.strictEqual(n.__attendance, true);
  assert.strictEqual(n.__valid, true);
  // ignored column must not leak through
  assert.ok(!("التصنيف" in n));
});

test("normalizeRow: unknown city stays blank; unknown gender dropped", () => {
  const raw = { "المدينة": "أبها", "الجنس": "غير محدد", "الهوية الوطنية": "123" };
  const mapping = CSVKit.autoMap(Object.keys(raw), cfg.headerMap);
  const n = CSVKit.normalizeRow(raw, mapping, cfg);
  assert.ok(!("region_of_residence" in n));
  assert.ok(!("gender" in n));
  assert.strictEqual(n.__valid, true);
});

test("normalizeRow: row with neither name nor id is invalid", () => {
  const raw = { "الهاتف المحمول": "0555", "حالة الحضور": "" };
  const mapping = CSVKit.autoMap(Object.keys(raw), cfg.headerMap);
  const n = CSVKit.normalizeRow(raw, mapping, cfg);
  assert.strictEqual(n.__valid, false);
  assert.strictEqual(n.__attendance, false);
});

test("userFieldsForCreate keeps only writable non-empty fields", () => {
  const n = { en_full_name: "x", national_id: "1", __attendance: true, __valid: true, foo: "bar" };
  const fields = CSVKit.userFieldsForCreate(n, cfg.writableUserFields);
  assert.deepStrictEqual(fields, { en_full_name: "x", national_id: "1" });
});

test("Arabic UTF-8 values survive parse + mapFields (with quoted multi-line briefs)", () => {
  const text =
    'name,name_en,company_name_ar,business_brief_ar\r\n' +
    '"سعود حسن الغامدي","SAUD ALGHAMDI","شركة الرمز الأفضل","وصف\nمتعدد الأسطر, وبه فاصلة"\n';
  const { headers, rows } = CSVKit.parseCSV(text);
  assert.deepStrictEqual(headers, ["name", "name_en", "company_name_ar", "business_brief_ar"]);
  assert.strictEqual(rows.length, 1);
  const userMap = { name: "full_name", name_en: "en_full_name" };
  const companyMap = { company_name_ar: "company_name_ar", business_brief_ar: "business_brief_ar" };
  const user = CSVKit.mapFields(rows[0], userMap);
  const company = CSVKit.mapFields(rows[0], companyMap);
  assert.strictEqual(user.full_name, "سعود حسن الغامدي");
  assert.strictEqual(user.en_full_name, "SAUD ALGHAMDI");
  assert.strictEqual(company.company_name_ar, "شركة الرمز الأفضل");
  assert.strictEqual(company.business_brief_ar, "وصف\nمتعدد الأسطر, وبه فاصلة"); // newline + comma preserved
});

test("firstValue returns first non-empty among columns", () => {
  const row = { national_id_number: "", residency_number: " 2195327370 ", passport_number: "X1" };
  assert.strictEqual(CSVKit.firstValue(row, ["national_id_number", "residency_number", "passport_number"]), "2195327370");
});
