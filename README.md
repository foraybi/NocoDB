# Monshaat Consultation Booking Site

A bilingual (Arabic RTL / English LTR) web app that lets staff:

1. **Search** the User Profile table for a beneficiary — and **create** one if not found.
2. **Fill** consultation details.
3. **Select** a consultant from the Expert table.
4. **Submit** — creating a consultation record linked to the user and expert.

It talks to NocoDB (`https://ic-nocodb.monshaat.gov.sa`) **only through your backend**, which
holds the API token. The browser never sees the token.

```
Browser (static SPA)  ──►  Your backend proxy  ──►  NocoDB V2 API
   index.html / app.js       adds xc-token           (private network)
```

## Tables

| Purpose      | Table ID          |
|--------------|-------------------|
| User Profile | `mlr66su3m4ef4bs` |
| Consultation | `mlvt0see64vuztv` |
| Expert       | `mb0s0zf680dx712` |

## Files

| File | What it is |
|------|-----------|
| `index.html`, `styles.css`, `app.js`, `i18n.js` | Consultation booking frontend. |
| `events.html`, `events.js`, `csv.js` | Workshop attendee CSV-import frontend. |
| `incubation.html`, `incubation.js` | Incubation applicants CSV-import frontend. |
| `config.js` | **Edit this** — field names, display fields, link-column titles, CSV header map. |
| `server-reference/` | A ready-to-run reference backend (Node + Express) that holds the token. Use it or adapt your own. |
| `test/` | Node unit tests for `csv.js` and the backend `matcher` (run `npm test` or `node --test`). |
| `docs/superpowers/` | Design spec + implementation plan for the events feature. |

## Frontend ↔ Backend contract

Implement these on your backend (the reference server already does). All requests/responses are JSON.

| Method & path | Request body | Response |
|---|---|---|
| `GET /api/users?search={q}` | — | `{ "list": [ userRecord, ... ] }` |
| `POST /api/users` | `{ field: value, ... }` | `{ "record": userRecord }` (must include `Id`) |
| `GET /api/experts?search={q}` | — | `{ "list": [ expertRecord, ... ] }` |
| `POST /api/consultations` | `{ "fields": {…}, "userId": <id>, "expertId": <id> }` | `{ "record": consultationRecord }` |
| `GET /api/events?search={q}` | — | `{ "list": [ eventRecord, ... ] }` |
| `POST /api/events` | `{ field: value, ... }` | `{ "record": eventRecord }` |
| `POST /api/attendees/preview` | `{ "eventId": <id>, "rows": [normalizedRow] }` | `{ "totals": {create,link,skipDuplicate,invalid}, "rows": [...] }` (writes nothing) |
| `POST /api/attendees/commit` | `{ "eventId": <id>, "rows": [normalizedRow] }` | `{ createdUsers, linked, skippedDuplicates, invalid, failed:[] }` |
| `POST /api/incubation/preview` | `{ "rows": [normalizedRow] }` | `{ "totals": {approved,registered,skipped,invalid}, "rows": [...] }` (writes nothing) |
| `POST /api/incubation/commit` | `{ "rows": [normalizedRow(+startDate)] }` | `{ createdUsers, createdCompanies, linked, incubated, skipped, invalid, failed:[] }` |

### Incubation applicants flow

`incubation.html` imports the Drupal webform CSV export. For each row it finds-or-creates
the person in `user_profile` (match: national_id → residency → passport → email → mobile) and
the company in `company_profile` (match: cr_number → name), links them, and — **only when
`registration_status == approved`** — creates an `incubated_startups` record with a start date
entered per company in the preview. `registered` = user + company only; `rejected`/blank = the
row is skipped entirely. Link columns are resolved by **related-table id** from the table meta,
so exact link-column names aren't needed. Coded/UUID CSV columns (gender code, nationalities,
industry, etc.) are deferred until lookups are provided.

### Events / attendee import flow

`events.html` is a 4-step wizard: **select or create an event → upload attendee CSV →
map columns → preview → confirm**. The browser parses the CSV (`csv.js`, offline) and
sends normalized rows; the backend finds-or-creates each user in `user_profile`
(matched by **national_id → phone → email**) and links them to the event via the
`events_registration_and_attendees_table` junction, skipping anyone already registered.
`npm test` runs the unit tests for parsing/matching.

The backend is responsible for:
- Adding the `xc-token` header.
- Building the NocoDB `where=(field,like,%q%)~or(...)` search clause.
- After creating a consultation, **linking** the user and expert via the NocoDB link API:
  `POST /api/v2/tables/{consultationTable}/links/{linkColumnId}/records/{consultationId}` with body `[{ "Id": relatedId }]`.

## Setup — quick start (reference backend)

```bash
cd server-reference
cp .env.example .env        # then edit NOCODB_TOKEN
npm install
npm start                   # serves the whole site at http://localhost:3000
```

Run this on a machine that can reach the private NocoDB network.

## Field mapping (already done)

Mapped from your real schema:

- **User Profile** — display/search on `en_full_name`, `full_name`, `Email`; phone/national ID matched exactly when the query is digits. Create form: `en_full_name`, `full_name`, `phone_number`, `Email`, `national_id`, `gender`.
- **Expert** — search/display on `expert_name_ar`, `expert_name_en`, `email`, `phone_number`.
- **Consultation** — form fields such as `consultation_topic`, `consultation_date`, `Consultation_duration`, `Actions_and_comments`, plus SingleSelect fields. Linked to the user via the **`User Profile`** column and to the expert via the **`Expert_ID`** column — the backend resolves these link-column IDs by title automatically from the table meta, so no manual IDs are needed. `beneficiary_name` is auto-filled from the selected user's `en_full_name`.

### Optional: complete the SingleSelect option lists

The dropdowns (`consultation_type`, `consultation_delivery`, `consultation_source`, `consultation_center`, `Status`, `MVP opportunity`, `gender`) only include the option values visible in your sample records, marked `// TODO complete options` in `config.js`. They are optional, so submissions still work if left blank — but fill in the full lists so staff can pick every valid value. Get them by reading each column's `colOptions.options` from `GET /api/v2/meta/tables/{tableId}`.

## Security notes

- The token lives only in `server-reference/.env` (git-ignored). Never put it in `config.js` or any browser file.
- Deletion is never performed by this app — it only reads and creates records.
- Restrict the backend to your internal network / authenticated users as appropriate.
