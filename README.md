# Monshaat Innovation Center Platform

A bilingual (Arabic RTL / English LTR) **dashboard** for staff, covering three tools:

- **Consultations** — find/create a beneficiary, fill a consultation, pick a consultant, submit.
- **Events** — pick/create an event, upload an attendee CSV/XLSX, map columns, link attendees.
- **Incubation** — import the applicants export (CSV/XLSX): find/create users + companies, link
  them, and create incubation records for approved applicants.

The browser talks to NocoDB (`https://ic-nocodb.monshaat.gov.sa`) **only through the Express
proxy**, which holds the API token. The SPA never sees the token.

```
React SPA (web/dist)  ──►  Express proxy (server-reference/)  ──►  NocoDB V2 API
  Mantine dashboard          adds xc-token, paces requests          (private network)
```

## Stack

- **Frontend:** React + Vite + **Mantine** (RTL via `DirectionProvider`, light/dark), React
  Router, **TanStack Query** (server calls) + **Zustand** (UI/wizard state). Keyboard-first:
  Spotlight command palette (Ctrl/Cmd-K) and `g` `c/e/i/o` navigation shortcuts.
- **Fonts:** self-hosted (Geist + IBM Plex Sans Arabic via Fontsource) — **no runtime CDN**.
- **Backend:** Node + Express proxy that holds the token, resolves link columns from table
  meta, and paces requests to respect NocoDB's rate limit.

## Layout

| Path | What it is |
|------|-----------|
| `web/` | Vite React dashboard. Source in `web/src/`. |
| `web/src/lib/` | **Framework-agnostic logic** — `config.js` (field maps/table IDs — **edit here**), `csv.js`, `validate.js`, `incubationBuild.js`, `importExport.js`, `i18n.js`. |
| `web/src/features/{consultations,events,incubation,overview}/` | The four dashboard views. |
| `web/src/{components,stores,api}/` | Shared UI, Zustand stores, API client. |
| `web/vendor/xlsx.full.min.js` | Vendored offline SheetJS (xlsx/xls parsing + export). |
| `server-reference/` | Express proxy: holds the token, serves `web/dist`, exposes `/api/*`. |
| `test/` | Backend matcher unit tests (`npm test` at root). Frontend logic tests live in `web` (`npm test` in `web/`, Vitest). |
| `docs/superpowers/` | Design specs + implementation plan. |

## Run

Build the SPA, then start the proxy (do this on a machine that can reach the NocoDB network):

```bash
# 1) build the dashboard
npm run build                     # = cd web && npm install && npm run build  -> web/dist

# 2) configure + start the proxy (serves web/dist + /api on http://localhost:3000)
cd server-reference
cp .env.example .env              # set NOCODB_TOKEN
npm install
cd .. && npm start
```

Dev mode (hot reload): run the proxy (`npm start`) and, in another terminal, `npm run dev:web`
— Vite serves on :5173 and proxies `/api` to the backend on :3000.

## Frontend ↔ Backend contract

All requests/responses are JSON. The reference server implements all of these.

| Method & path | Request body | Response |
|---|---|---|
| `GET /api/users?search={q}` | — | `{ "list": [ userRecord, ... ] }` |
| `POST /api/users` | `{ field: value, ... }` | `{ "record": userRecord }` (includes `Id`) |
| `GET /api/experts?search={q}` | — | `{ "list": [ expertRecord, ... ] }` |
| `POST /api/consultations` | `{ "fields": {…}, "userId": <id>, "expertId": <id> }` | `{ "record": consultationRecord }` |
| `GET /api/events?search={q}` | — | `{ "list": [ eventRecord, ... ] }` |
| `POST /api/events` | `{ field: value, ... }` | `{ "record": eventRecord }` |
| `POST /api/attendees/preview` | `{ "eventId": <id>, "rows": [normalizedRow] }` | `{ "totals": {create,link,skipDuplicate,invalid}, "rows": [...] }` (no writes) |
| `POST /api/attendees/commit` | `{ "eventId": <id>, "rows": [normalizedRow] }` | `{ createdUsers, linked, skippedDuplicates, invalid, failed:[] }` |
| `POST /api/incubation/preview` | `{ "rows": [normalizedRow] }` | `{ "totals": {approved,registered,skipped,invalid}, "rows": [...] }` (no writes) |
| `POST /api/incubation/commit` | `{ "rows": [normalizedRow(+startDate)] }` | `{ createdUsers, createdCompanies, linked, incubated, skipped, invalid, failed:[] }` |

## Tables

| Purpose | Table ID |
|---|---|
| User Profile | `mlr66su3m4ef4bs` |
| Consultation | `mlvt0see64vuztv` |
| Expert | `mb0s0zf680dx712` |
| Events | `mzcq4lgx8vxs7oo` |
| Event attendees (junction) | `mdusjzr5zes3rmm` |
| Company Profile | `msbt5wtpnrij5as` |
| Incubated Startups | `msmze54dz2aeihh` |

## Incubation flow (details)

Imports the Drupal webform export. For each row: find-or-create the person in `user_profile`
(match: national_id → residency → passport → email → mobile) and the company in
`company_profile` (match: cr_number → name), link them, and — **only when
`registration_status == approved`** — create an `incubated_startups` record with a per-company
start date. `registered` = user + company only; `rejected`/blank = row skipped. **Local
validation runs before any NocoDB call** (numbers→digits, dates, emails, urls) with an issues
panel and inline fixes. The review table supports search, select-all/custom (only selected are
uploaded), read-only rejected rows, per-approved start dates, and pagination (10/page). After
upload you can **download the edited data as CSV/XLSX in the original file format**. Link
columns are resolved by **related-table id** from table meta.

## Notes

- **Field mapping** lives in `web/src/lib/config.js`. Some SingleSelect option lists and a few
  coded/UUID CSV columns are deferred (marked in that file); fill them in as needed.
- **Security:** the token lives only in `server-reference/.env` (git-ignored). The app only
  reads and creates records — never deletes. Restrict the proxy to your internal network.
- **Tests:** `npm test` (root) runs backend matcher tests; `cd web && npm test` runs the
  frontend logic tests (Vitest).
