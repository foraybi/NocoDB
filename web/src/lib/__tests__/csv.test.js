import { test } from "vitest";
import assert from "node:assert";
import * as CSVKit from "../csv.js";

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
});

test("autoMap maps known Arabic headers and flags unknown", () => {
  const m = CSVKit.autoMap(["الهوية الوطنية", "الجنس", "عمود غير معروف"], cfg.headerMap);
  assert.strictEqual(m["الهوية الوطنية"], "national_id");
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
  assert.strictEqual(n.gender, "Female");
  assert.strictEqual(n.region_of_residence, "Riyadh");
  assert.strictEqual(n.__attendance, true);
  assert.strictEqual(n.__valid, true);
  assert.ok(!("التصنيف" in n));
});

test("normalizeRow: row with neither name nor id is invalid", () => {
  const raw = { "الهاتف المحمول": "0555", "حالة الحضور": "" };
  const mapping = CSVKit.autoMap(Object.keys(raw), cfg.headerMap);
  const n = CSVKit.normalizeRow(raw, mapping, cfg);
  assert.strictEqual(n.__valid, false);
});

test("mapFields + firstValue", () => {
  const row = { national_id_number: "", residency_number: " 219 ", name: "x" };
  assert.strictEqual(CSVKit.firstValue(row, ["national_id_number", "residency_number"]), "219");
  assert.deepStrictEqual(CSVKit.mapFields(row, { name: "full_name" }), { full_name: "x" });
});

test("Arabic UTF-8 survives parse + mapFields (quoted multi-line + comma)", () => {
  const text =
    'name,company_name_ar,business_brief_ar\r\n' +
    '"سعود","شركة الرمز","وصف\nمتعدد, بفاصلة"\n';
  const { rows } = CSVKit.parseCSV(text);
  const c = CSVKit.mapFields(rows[0], { company_name_ar: "company_name_ar", business_brief_ar: "business_brief_ar" });
  assert.strictEqual(c.company_name_ar, "شركة الرمز");
  assert.strictEqual(c.business_brief_ar, "وصف\nمتعدد, بفاصلة");
});
