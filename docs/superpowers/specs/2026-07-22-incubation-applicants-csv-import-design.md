# Incubation Applicants CSV Import — Design

**Date:** 2026-07-22
**Project:** Monshaat NocoDB site
**Status:** Approved (user said "go ahead")

## Purpose

Bulk-import incubation program applicants from the Drupal webform CSV export.
Each row describes an applicant (person) and their company plus a
`registration_status`. The system creates/reuses the person in `user_profile`
and the company in `company_profile`, links them, and — only for approved
applicants — creates an `incubated_startups` record with a start date. A dry-run
preview precedes any writes.

Phase 1 of the incubation feature. Tech-adoption auto-linking is a later spec.

## Tables

| Purpose | Table ID |
|---|---|
| User Profile | `mlr66su3m4ef4bs` |
| Company Profile | `msbt5wtpnrij5as` |
| Incubated Startups (incubation) | `msmze54dz2aeihh` |

## Status rules (confirmed)

Normalize `registration_status` (trim + lowercase):
- **approved** → create/reuse user, create/reuse company, link them, AND create an
  `incubated_startups` record with the user-entered start date.
- **registered** → create/reuse user, create/reuse company, link them. NO incubation record.
- **rejected** (or blank/unknown) → **skip the entire row**. No user, no company, no incubation.

## Match keys (confirmed)

- **User:** `national_id_number` → `residency_number` → `passport_number` → `mail` → `mobile`
  (first non-empty wins; existing match is reused, else created).
- **Company:** `cr_number` → `company_name_en` → `company_name_ar`. Reuse on match (no overwrite).

## Architecture

Reuses the attendee-import pattern: the browser parses the CSV (`csv.js`, UTF-8 +
BOM strip, quoted multi-line fields) and sends normalized rows as JSON; the backend
does all matching, creation, linking, and writes. Preview and commit are separate
endpoints; the token stays server-side.

### UI — `incubation.html` + `incubation.js`

4-step wizard (third nav tab: Consultations · Events · Incubation):
1. **Upload CSV.**
2. **Map & review** — columns auto-map by their stable machine names to canonical
   user/company keys; editable.
3. **Preview (dry-run)** — per row: user create/link, company create/reuse, and whether
   an incubation record will be created (approved only). Each **approved** company shows a
   **start-date input**. Totals + invalid rows shown. No writes.
4. **Confirm** — commit (idempotent) + report.

### Backend routes

- `POST /api/incubation/preview` `{ rows }` → read-only plan per row
  `{ index, status, userAction, companyAction, incubation: bool, invalid, messages }` + totals.
- `POST /api/incubation/commit` `{ rows }` where approved rows include `startDate` →
  find/create user, find/create company, link, and (approved) create incubation. Returns
  `{ createdUsers, createdCompanies, linked, incubated, skipped, invalid, failed:[] }`.

## Field mapping (config; clean fields only for phase 1)

**CSV → user_profile:**
`name→full_name`, `name_en→en_full_name`, `mobile→phone_number`, `mail→Email`,
`national_id_number→national_id`, `passport_number→passport_id`, `dob→birthdate`.
Deferred (coded/UUID): `gender` (1/2 code), `user_type` (AR text), `nationalities`,
`country`, `city`.

**CSV → company_profile (1:1 machine names):**
`company_name_ar`, `company_name_en`, `business_brief_ar`, `business_brief_en`,
`cr_number`, `number_of_founding_team`, `number_of_employees`, `number_of_customers`,
`revenue_till_date_sar`, `registration_date`, `website`, `linkedin`, `x`, and the four
questionnaire columns `m_ldhy_trgb_fy_thqyqh_mn_khll_tsjylk_fy_brnmj_lhtdn`,
`mhw_mstwk_lhly_fy_ryd_laaml`, `hl_trgb_blstfd_mn_mvplab`,
`mqr_brnmj_l_htdn_ldhy_trgb_bltqdym_aalyh`.
Deferred (coded/UUID): `company_industry`, `technologies_table`, `company_country_base`,
`company_city_base`, `company_stage` (if a coded select).

Webform bookkeeping columns (`serial, sid, uuid, token, uri, created, completed, changed,
in_draft, current_page, remote_addr, uid, langcode, webform_id, entity_type, entity_id,
locked, sticky, notes, auto_fill, company_profile`) are ignored.

## Link resolution — by target table, not by title

The backend reads each table's meta and picks the link column whose **related table ID**
matches the target:
- `company_profile` → the link column pointing to `user_profile` (owner).
- `incubated_startups` → link to `company_profile`, and link to `user_profile`.

If a table has multiple links to the same target, a configurable title hint disambiguates.
This avoids guessing exact column titles (e.g. "Company Profiles" / "Beneficiaries").

## Arabic / UTF-8

CSV read as UTF-8 (`FileReader.readAsText(file, "utf-8")`), BOM stripped, Arabic values
passed through unchanged. A unit test asserts Arabic name/company values survive parse +
normalize. The whole UI is already bilingual RTL/LTR.

## Idempotency & errors

- Re-running won't duplicate: users/companies match by key; an incubation record is created
  only if one doesn't already exist for that company (checked via the company→incubation link
  or existing incubation for that company id).
- Invalid row (no name AND no ID number) → excluded, reported.
- `rejected`/blank status → skipped, counted separately.
- Per-row write failure → caught; import continues; failures listed with reasons.

## Testability

- `csv.js` normalization stays pure; add Arabic/UTF-8 test.
- Backend `incubationMatcher` module: pure `planRow(normalized, ctx)` → action plan;
  unit-tested for approved/registered/rejected/invalid/duplicate branches.
- Dry-run preview is the live verification path on the VPN.
