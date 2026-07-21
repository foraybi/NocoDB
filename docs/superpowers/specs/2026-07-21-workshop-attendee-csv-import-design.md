# Workshop Attendee CSV Import — Design

**Date:** 2026-07-21
**Project:** Monshaat NocoDB consultation/events site
**Status:** Approved design (pending written-spec review)

## Purpose

Let staff record workshop/event attendance in bulk. A user picks (or creates) an
event, uploads a CSV of attendees, and the system finds-or-creates each attendee
in `user_profile` and links them to the event via the attendees junction table —
with a safe dry-run preview before anything is written.

This is **phase 1** of the events feature. Out of scope (separate later specs):
poster OCR auto-fill, and a rich standalone event-management UI.

## Constraints & context

- NocoDB base `https://ic-nocodb.monshaat.gov.sa` is on a **private network**; only
  the user (on VPN) can reach it. All NocoDB access goes through the existing
  Express proxy that holds the `xc-token`.
- Reuses the existing static SPA + Express architecture, `config.js`, `i18n.js`,
  `styles.css`. Bilingual (AR RTL / EN LTR).
- The app only reads and creates records — never deletes.

## Tables

| Purpose | Table ID |
|---|---|
| User Profile | `mlr66su3m4ef4bs` |
| Events | `mzcq4lgx8vxs7oo` |
| Event registration & attendees (junction) | `mdusjzr5zes3rmm` |

**Junction (`events_registration_and_attendees_table`) key fields:**
- `user_profiles` (Link → user_profile)
- `events_tables` (Link → events_table)
- `user_id` (Text)
- `event_attendance_status` (Checkbox)
- Lookups auto-fill name/phone/email from the linked user profile.

**Events table key fields (subset used):** `event_name_en` (primary), `event_name_ar`,
`event_starting_date`, `event_ending_date`, `event_date`, `event_type` (SingleSelect),
`event_delivery_type` (SingleSelect), `event_city` (SingleSelect), `event_venue`,
`event_presenter_name`, plus many Link/other fields not used in phase 1.

## Key decisions (confirmed with user)

1. **Event is chosen once in the UI**, not carried in the CSV (the CSV is
   attendee-only; the event name lives in the sheet title).
2. **User match key:** `national_id` → fall back to `phone_number` → fall back to `Email`.
3. **Dry-run preview** before committing any writes.
4. Junction `user_id` (text) = the attendee's **national ID**.
5. City mapping AR→EN: الرياض→Riyadh, جدة→Jeddah, الخرج→Al Kharj; unrecognized → left
   blank (never write an invalid SingleSelect option).

## Architecture

Chosen approach: **client parses CSV → backend matches & commits.**
- Browser parses the CSV (offline, vendored parser) and sends clean JSON rows.
- Backend does all NocoDB matching and writing (token stays server-side).
- Preview and commit are two separate endpoints.

Rejected: raw-file multipart upload to backend (unneeded complexity); all-client-side
matching (chatty, would expose token).

### New UI — `events.html` + `events.js`

4-step wizard (shares `styles.css`, `i18n.js`, `config.js`):

1. **Select event** — search `events_table` by `event_name_en` / `event_name_ar`;
   pick one, or **Add event** via a small form (name EN/AR required; date, type,
   city, venue, delivery type optional; SingleSelects offer blank + known options).
2. **Upload CSV** — parsed in-browser; handles UTF-8 Arabic, BOM, quoted fields, commas.
3. **Map & review columns** — headers auto-mapped by Arabic name to canonical keys;
   user can adjust the mapping before continuing.
4. **Preview → Confirm** — shows counts (new users / existing / links to create /
   duplicates / invalid rows) and a per-issue list; **Confirm** commits; final report shown.

### New backend routes (same Express proxy)

- `GET /api/events?search=` → search events_table → `{ list }`.
- `POST /api/events` → create event → `{ record }`.
- `POST /api/attendees/preview` → `{ eventId, rows }` → **read-only**. For each row:
  match user by national_id→phone→email; detect already-linked attendees for this
  event; validate. Returns per-row plan `{ index, action: create|link|skip-duplicate|invalid, matchedUserId, messages }` plus totals. Writes nothing.
- `POST /api/attendees/commit` → `{ eventId, rows }` → **idempotent**. Per row:
  find-or-create user; create junction link only if the (event, user) link does not
  already exist. Returns a summary `{ createdUsers, linked, skippedDuplicates, failed:[{index,reason}] }`.

Commit re-runs matching itself (does not trust the preview payload), so it is safe and
idempotent even if data changed between preview and commit.

## CSV → field mapping (canonical; configurable in `config.js`)

| CSV column (AR) | Target |
|---|---|
| الاسم الأول / الاسم الأخير | `user_profile.en_full_name` |
| الهاتف المحمول | `phone_number` |
| الهوية الوطنية | `national_id` (match key) |
| البريد الإلكتروني | `Email` |
| الجنس | `gender` (ذكر→Male, أنثى→Female) |
| المدينة | `region_of_residence` (AR→EN city map; unknown → blank) |
| حالة الحضور | junction `event_attendance_status` (1→checked) |
| المستوى التعليمي / التصنيف / مستوى اللغة الإنجليزية / حالة التوظيف | mapped **only if** a matching `user_profile` column exists; otherwise held as configurable TODO and ignored |

Header auto-mapping uses an Arabic-header → canonical-key dictionary. Unmapped columns
are shown in the mapping step and can be assigned or ignored.

## User find-or-create logic

For each row (given normalized values):
1. If `national_id` present → query `user_profile` where `national_id = value`.
2. Else if `phone_number` present → query where `phone_number = normalizedDigits`.
3. Else if `Email` present → query where `Email = value` (case-insensitive as NocoDB allows).
4. If a match → use that record's `Id`. If none → create a new `user_profile` with the
   mapped fields (only writing columns that exist / have valid values).
5. A row with neither a name nor a national ID is **invalid** → excluded from commit.

Matching is per-row queries with small concurrency; acceptable for typical attendee
counts (dozens–few hundred). No bulk `where IN` needed in phase 1.

## Attendance link logic

Duplicate detection uses a **one-time pre-fetch**, not per-row queries, so it works
even when a row has no national ID (matched by phone/email):

1. At the start of preview/commit, fetch the event's **existing attendee junction
   records once** (list records linked to the event via the event→attendees link, or
   query the junction filtered by the event). Build two in-memory sets from them:
   already-linked **user profile Ids** and already-linked **national IDs (`user_id`)**.
2. For each row's matched/created user: if its profile Id is in the set (or its national
   ID is in the national-ID set) → `skip-duplicate`.
3. Else create a junction record: link `user_profiles` → user Id, link `events_tables`
   → event Id, set `user_id` = national_id (text, may be blank if unknown),
   `event_attendance_status` from CSV. Add the new Id to the in-memory sets so
   duplicates **within the same CSV** are also collapsed.

Link column ids are resolved **by title** from the junction table meta (cached), same
pattern already used for consultations. The exact "list linked records" endpoint
(`GET /api/v2/tables/{eventsTable}/links/{attendeesLinkColId}/records/{eventId}`) is
confirmed against NocoDB during implementation; if link-listing proves awkward, fall
back to querying the junction by its `event_name_en (from events_table)` lookup.

## Value normalization

- **Attendance:** `1` / `نعم` / `true` / `yes` → checked; blank / `0` / `لا` → unchecked.
- **Phone:** strip non-digits for matching and storage; keep leading country code as-is.
- **Gender:** ذكر→Male, أنثى→Female; anything else → blank.
- **City:** AR→EN dictionary; unknown → blank.
- Trim whitespace; treat empty strings as absent.

## Error handling

- CSV parse failure (malformed) → show error, abort before any step.
- Invalid rows (no name and no national id) → excluded from commit, listed in preview/report.
- Per-row NocoDB write failure on commit → caught; import continues; failed rows listed
  with reasons (partial success allowed).
- Preview endpoint is itself the safe verification path on the VPN.

## Components & testability

- `csv.js` — pure: parse + auto-map headers + normalize rows. Unit-testable without NocoDB.
- Backend `matcher` module — pure validation/plan building (row → action decision),
  separated from the NocoDB I/O functions. Unit-testable with sample rows.
- `events.js` — UI wizard wiring only.
- Sample-row unit tests for `csv.js` and `matcher` included; live NocoDB verification is
  done by the user via the dry-run preview on the VPN.

## Config additions (`config.js`)

- `events` block: search fields, display fields, add-event form fields (+ select options).
- `attendeeImport` block: Arabic-header → canonical-key dictionary, gender map, city map,
  attendance-truthy values, and the junction field titles (`user_profiles`, `events_tables`,
  `user_id`, `event_attendance_status`).

## Open TODOs to confirm during implementation

- Full `user_profile` schema for education / classification / English-level / employment
  columns (map if they exist; otherwise ignore).
- Complete SingleSelect option lists for event `event_type`, `event_city`,
  `event_delivery_type` (partial known; blank-safe until filled).
