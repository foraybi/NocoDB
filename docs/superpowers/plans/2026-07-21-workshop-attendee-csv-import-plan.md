# Workshop Attendee CSV Import — Implementation Plan

Derived from `docs/superpowers/specs/2026-07-21-workshop-attendee-csv-import-design.md`.
Build order is bottom-up (pure/testable pieces first), so each step is verifiable
before the UI depends on it. NocoDB live verification is done by the user on the VPN.

## Step 1 — Config additions (`config.js`)
- Add `events` block: `searchFields` (`event_name_en`, `event_name_ar`), `display`
  (primary/secondary), and `addEventFields` (name_en required, name_ar, dates, type,
  city, venue, delivery type — selects with known options + blank).
- Add `attendeeImport` block:
  - `headerMap`: Arabic CSV header → canonical key
    (name→en_full_name, mobile→phone_number, national→national_id, email→Email,
    gender→gender, city→region_of_residence, attendance→__attendance).
  - `genderMap` (ذكر→Male, أنثى→Female), `cityMap` (الرياض→Riyadh, جدة→Jeddah, الخرج→Al Kharj),
    `attendanceTruthy` (["1","نعم","true","yes"]).
  - `junction` field titles: `user_profiles`, `events_tables`, `user_id`, `event_attendance_status`.
- **Verify:** `node --check config.js`.

## Step 2 — `csv.js` (pure, no NocoDB)
- Vendor a small offline CSV parser (PapaParse standalone, inlined as `vendor/papaparse.min.js`)
  OR a compact hand-rolled RFC-4180 parser handling BOM, quotes, embedded commas, Arabic UTF-8.
- Functions: `parseCSV(text) -> {headers, rows}`; `autoMap(headers, headerMap) -> mapping`;
  `normalizeRow(row, mapping, cfg) -> {en_full_name, phone_number, national_id, Email,
  gender, region_of_residence, __attendance, __valid, __errors}`.
- Normalization: trim, empty→absent, phone digits-only, gender/city via maps, attendance truthy.
- **Verify:** small Node test (`test/csv.test.js`) with sample Arabic rows incl. quoted commas.

## Step 3 — Backend `matcher` module (pure, no I/O)
- `planRow(normalizedRow, {matchedUserId, alreadyLinked}) -> {action, messages}`
  where action ∈ create | link | skip-duplicate | invalid.
- Invalid when no name AND no national_id.
- **Verify:** `test/matcher.test.js` covering each action branch.

## Step 4 — Backend NocoDB helpers (in `server-reference/server.js`)
- `findUser(row)`: query user_profile by national_id (eq) → phone_number (eq) → Email (eq);
  return record or null.
- `createUser(fields)`: create user_profile row (only mapped, valid columns).
- `fetchEventAttendees(eventId)`: list junction records linked to the event (via event→attendees
  link col resolved by title; fallback: filter junction by the `event_name_en (from events_table)`
  lookup). Return sets of linked profile Ids + national IDs.
- `linkAttendee(eventId, userId, national_id, attended)`: create junction row + set links by
  resolved column ids + checkbox.
- Reuse existing `noco()` + `linkColumnId()` (generalize the latter to take a tableId).

## Step 5 — Backend routes
- `GET /api/events?search=` → search events_table → `{list}`.
- `POST /api/events` → create event → `{record}`.
- `POST /api/attendees/preview` `{eventId, rows}` → pre-fetch attendees once; for each row
  findUser + planRow; return `{ totals:{create,link,skipDuplicate,invalid}, rows:[...] }`. No writes.
- `POST /api/attendees/commit` `{eventId, rows}` → pre-fetch attendees once; per row
  find-or-create user, skip if already linked (in-memory set updated per insert), else link;
  catch per-row errors; return `{createdUsers, linked, skippedDuplicates, failed:[{index,reason}]}`.
- **Verify:** boot server with dummy token; assert routes return JSON (NocoDB unreachable here → clean error).

## Step 6 — i18n strings (`i18n.js`)
- Add AR/EN strings for the events wizard: step labels, event search/add, CSV upload,
  column mapping, preview totals, confirm, report, errors.

## Step 7 — `events.html`
- 4-step wizard markup mirroring `index.html` structure: select event → upload CSV →
  map columns → preview/confirm; shares header, stepper, toast, styles.
- Add a small nav link between the consultation site (`index.html`) and events (`events.html`).

## Step 8 — `events.js`
- Wizard controller + API client for the new routes.
- Step 1: event search/select/add (reuse patterns from `app.js`).
- Step 2: file input → `csv.js` parse → hold rows.
- Step 3: mapping table (auto-mapped, editable) → normalize rows.
- Step 4: call `/preview`, render totals + issues; Confirm → `/commit`, render report.

## Step 9 — Styles
- Reuse `styles.css`; add minimal classes for the mapping table, preview totals cards,
  and the import report. Keep RTL/LTR-safe (logical properties).

## Step 10 — Verification
- Local: `node --check` all JS; run `test/csv.test.js` + `test/matcher.test.js`; boot server
  and probe routes.
- User (VPN): pick a real event, upload the sample attendee CSV, review the dry-run preview,
  confirm, then check user_profile + junction rows in NocoDB.

## Notes / deferred
- Education / classification / English-level / employment columns: mapped only if target
  `user_profile` columns are confirmed; otherwise ignored.
- Complete SingleSelect option lists for event fields when available.
- Poster OCR + rich event UI are separate future specs.
