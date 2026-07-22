/* =============================================================================
 * server.js — REFERENCE backend proxy (Node + Express).
 *
 * This is the ONLY place the NocoDB API token lives. The browser never sees it.
 * It implements the contract in ../README.md and forwards to NocoDB V2.
 *
 * Run:
 *   cd server-reference
 *   cp .env.example .env      # then edit .env
 *   npm install
 *   npm start
 *
 * Serves the static frontend (../) AND the /api/* routes on the same origin,
 * so config.js can keep API_BASE = "".
 * ===========================================================================*/
const express = require("express");
const path = require("path");
const { planRow, summarize } = require("./lib/matcher");
const incubation = require("./lib/incubationMatcher");

const app = express();
app.use(express.json());

// ---- Environment -----------------------------------------------------------
const {
  NOCODB_BASE = "https://ic-nocodb.monshaat.gov.sa",
  NOCODB_TOKEN,
  PORT = 3000,
} = process.env;

if (!NOCODB_TOKEN) {
  console.error("Missing NOCODB_TOKEN. Copy .env.example to .env and set it.");
  process.exit(1);
}

// ---- Table + field mapping (keep in sync with ../config.js) ----------------
const T = {
  userProfile: "mlr66su3m4ef4bs",
  consultation: "mlvt0see64vuztv",
  expert: "mb0s0zf680dx712",
  events: "mzcq4lgx8vxs7oo",
  attendees: "mdusjzr5zes3rmm", // junction: events_registration_and_attendees_table
  companyProfile: "msbt5wtpnrij5as",
  incubation: "msmze54dz2aeihh", // incubated_startups
};

// Incubation import settings (keep in sync with ../config.js incubationImport).
const INC_STATUS = { approved: "approved", registered: "registered" };
const INCUBATION_START_DATE_FIELD = "incubation_start_date";
// Title hints only needed if a table has >1 link to the same target table.
const INC_HINTS = { companyToUser: "", incubationToCompany: "", incubationToUser: "", companyToIncubation: "" };

// Events search + attendee-import config (keep in sync with ../config.js).
const EVENT_SEARCH_FIELDS = ["event_name_en", "event_name_ar"];
const JUNCTION = {
  userLinkTitle: "user_profiles",
  eventLinkTitle: "events_tables",
  userIdField: "user_id",
  attendanceField: "event_attendance_status",
};

// Text fields searched with `like` (mapped from your real schema).
const USER_SEARCH_TEXT_FIELDS = ["en_full_name", "full_name", "Email"];
// Number fields matched exactly when the search query is all digits.
const USER_SEARCH_NUMBER_FIELDS = ["phone_number", "national_id"];
const EXPERT_SEARCH_FIELDS = ["expert_name_ar", "expert_name_en", "email", "phone_number"];

// Link column TITLES on the consultation table. Resolved to ids at runtime from
// the table meta (no need to look up column ids by hand).
const LINK_USER_FIELD_TITLE = "User Profile";  // consultation -> user_profile
const LINK_EXPERT_FIELD_TITLE = "Expert_ID";   // consultation -> experts_list

// ---- NocoDB helper ---------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries on 429 (rate limit) with backoff, honoring Retry-After when present.
async function noco(pathname, { method = "GET", query, body } = {}, _attempt = 0) {
  const url = new URL(NOCODB_BASE + pathname);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, {
    method,
    headers: { "xc-token": NOCODB_TOKEN, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429 && _attempt < 6) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(500 * 2 ** _attempt, 8000);
    await sleep(waitMs);
    return noco(pathname, { method, query, body }, _attempt + 1);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`NocoDB ${method} ${pathname} -> ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

// Build a `(f,like,%q%)~or(...)` where clause across the given fields.
function likeWhere(fields, q) {
  if (!q) return undefined;
  const esc = q.replace(/[()]/g, "");
  return fields.map((f) => `(${f},like,%${esc}%)`).join("~or");
}

// User search: like across text fields, plus exact match on number fields when
// the query is all digits (NocoDB `like` is unreliable on Number columns).
function buildUserWhere(q) {
  if (!q) return undefined;
  const esc = q.replace(/[()]/g, "");
  const clauses = USER_SEARCH_TEXT_FIELDS.map((f) => `(${f},like,%${esc}%)`);
  if (/^\d+$/.test(esc)) {
    USER_SEARCH_NUMBER_FIELDS.forEach((f) => clauses.push(`(${f},eq,${esc})`));
  }
  return clauses.join("~or");
}

// ---- Resolve a column id by title on any table (cached) --------------------
const _colIdCache = {};
async function columnId(tableId, title) {
  const cacheKey = `${tableId}:${title}`;
  if (_colIdCache[cacheKey]) return _colIdCache[cacheKey];
  const meta = await noco(`/api/v2/meta/tables/${tableId}`);
  const col = (meta.columns || []).find((c) => c.title === title);
  if (!col) throw new Error(`Column "${title}" not found on table ${tableId}`);
  _colIdCache[cacheKey] = col.id;
  return col.id;
}

// Link one related record into a Link column of a row on the given table.
function linkRecords(tableId, linkColId, recordId, relatedId) {
  return noco(
    `/api/v2/tables/${tableId}/links/${linkColId}/records/${recordId}`,
    { method: "POST", body: [{ Id: relatedId }] }
  );
}

const recId = (r) => (r ? (r.Id ?? r.id ?? r.ID) : undefined);

// ---- Routes ----------------------------------------------------------------

// GET /api/users?search=  -> { list: [...] }
app.get("/api/users", async (req, res, next) => {
  try {
    const data = await noco(`/api/v2/tables/${T.userProfile}/records`, {
      query: { where: buildUserWhere(req.query.search), limit: 25 },
    });
    res.json({ list: data.list || [] });
  } catch (e) { next(e); }
});

// POST /api/users  { field: value, ... }  -> { record }
app.post("/api/users", async (req, res, next) => {
  try {
    const created = await noco(`/api/v2/tables/${T.userProfile}/records`, {
      method: "POST", body: req.body,
    });
    // NocoDB returns the created row (may be an array for bulk); normalize.
    const record = Array.isArray(created) ? created[0] : created;
    res.json({ record });
  } catch (e) { next(e); }
});

// GET /api/experts?search=  -> { list: [...] }
app.get("/api/experts", async (req, res, next) => {
  try {
    const data = await noco(`/api/v2/tables/${T.expert}/records`, {
      query: { where: likeWhere(EXPERT_SEARCH_FIELDS, req.query.search), limit: 100 },
    });
    res.json({ list: data.list || [] });
  } catch (e) { next(e); }
});

// POST /api/consultations  { fields, userId, expertId }  -> { record }
app.post("/api/consultations", async (req, res, next) => {
  try {
    const { fields = {}, userId, expertId } = req.body;

    // 1) create the consultation row
    const created = await noco(`/api/v2/tables/${T.consultation}/records`, {
      method: "POST", body: fields,
    });
    const record = Array.isArray(created) ? created[0] : created;
    const consultationId = record.Id ?? record.id;

    // 2) link the user profile
    if (userId != null) {
      const colId = await columnId(T.consultation, LINK_USER_FIELD_TITLE);
      await linkRecords(T.consultation, colId, consultationId, userId);
    }
    // 3) link the expert
    if (expertId != null) {
      const colId = await columnId(T.consultation, LINK_EXPERT_FIELD_TITLE);
      await linkRecords(T.consultation, colId, consultationId, expertId);
    }

    res.json({ record });
  } catch (e) { next(e); }
});

// ============================================================================
// EVENTS + ATTENDEE CSV IMPORT
// ============================================================================
const EVENT_ATTENDEES_LINK_TITLE = "events_registration_and_attendees_tables";
const WRITABLE_USER_FIELDS = ["en_full_name", "phone_number", "national_id", "Email", "gender", "region_of_residence"];

function userFieldsForCreate(row) {
  const f = {};
  WRITABLE_USER_FIELDS.forEach((k) => { if (row[k] != null && row[k] !== "") f[k] = row[k]; });
  return f;
}

// Find an existing user_profile by national_id -> phone -> email.
async function findUser(row) {
  const wheres = [];
  if (row.national_id) wheres.push(`(national_id,eq,${row.national_id})`);
  if (row.phone_number) wheres.push(`(phone_number,eq,${row.phone_number})`);
  if (row.Email) wheres.push(`(Email,eq,${row.Email})`);
  for (const where of wheres) {
    const data = await noco(`/api/v2/tables/${T.userProfile}/records`, { query: { where, limit: 1 } });
    if (data.list && data.list.length) return data.list[0];
  }
  return null;
}

async function createUserProfile(fields) {
  const created = await noco(`/api/v2/tables/${T.userProfile}/records`, { method: "POST", body: fields });
  return Array.isArray(created) ? created[0] : created;
}

// Best-effort set of national IDs already registered for this event (for dedup).
async function fetchEventAttendeeNationalIds(eventId) {
  const nationalIds = new Set();
  try {
    const colId = await columnId(T.events, EVENT_ATTENDEES_LINK_TITLE);
    const data = await noco(`/api/v2/tables/${T.events}/links/${colId}/records/${eventId}`, { query: { limit: 1000 } });
    const list = Array.isArray(data) ? data : (data.list || []);
    list.forEach((r) => { if (r[JUNCTION.userIdField]) nationalIds.add(String(r[JUNCTION.userIdField])); });
  } catch (e) {
    console.warn("fetchEventAttendeeNationalIds failed (proceeding without existing dedup):", e.message);
  }
  return nationalIds;
}

// Create a junction row linking a user to the event with attendance status.
async function linkAttendee(eventId, user, row) {
  const created = await noco(`/api/v2/tables/${T.attendees}/records`, {
    method: "POST",
    body: {
      [JUNCTION.userIdField]: row.national_id || "",
      [JUNCTION.attendanceField]: !!row.__attendance,
    },
  });
  const junctionId = recId(Array.isArray(created) ? created[0] : created);
  const userCol = await columnId(T.attendees, JUNCTION.userLinkTitle);
  await linkRecords(T.attendees, userCol, junctionId, recId(user));
  const eventCol = await columnId(T.attendees, JUNCTION.eventLinkTitle);
  await linkRecords(T.attendees, eventCol, junctionId, eventId);
  return junctionId;
}

// GET /api/events?search=  -> { list: [...] }
app.get("/api/events", async (req, res, next) => {
  try {
    const data = await noco(`/api/v2/tables/${T.events}/records`, {
      query: { where: likeWhere(EVENT_SEARCH_FIELDS, req.query.search), limit: 25 },
    });
    res.json({ list: data.list || [] });
  } catch (e) { next(e); }
});

// POST /api/events  { field: value, ... }  -> { record }
app.post("/api/events", async (req, res, next) => {
  try {
    const created = await noco(`/api/v2/tables/${T.events}/records`, { method: "POST", body: req.body });
    res.json({ record: Array.isArray(created) ? created[0] : created });
  } catch (e) { next(e); }
});

// POST /api/attendees/preview  { eventId, rows:[normalizedRow] }  -> dry-run plan
app.post("/api/attendees/preview", async (req, res, next) => {
  try {
    const { eventId, rows = [] } = req.body;
    const seenNat = await fetchEventAttendeeNationalIds(eventId);
    const seenProfile = new Set();
    const plans = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let action, matchedUserId = null;
      if (row.__valid === false) {
        action = "invalid";
      } else if (row.national_id && seenNat.has(String(row.national_id))) {
        action = "skip-duplicate";
      } else {
        const user = await findUser(row);
        matchedUserId = user ? recId(user) : null;
        if (matchedUserId != null && seenProfile.has(String(matchedUserId))) {
          action = "skip-duplicate";
        } else {
          action = matchedUserId != null ? "link" : "create";
          if (row.national_id) seenNat.add(String(row.national_id));
          if (matchedUserId != null) seenProfile.add(String(matchedUserId));
        }
      }
      plans.push({ index: i, action, matchedUserId, messages: planRow(row, { matchedUserId, alreadyLinked: action === "skip-duplicate" }).messages });
    }
    res.json({ totals: summarize(plans), rows: plans });
  } catch (e) { next(e); }
});

// POST /api/attendees/commit  { eventId, rows:[normalizedRow] }  -> summary
app.post("/api/attendees/commit", async (req, res, next) => {
  try {
    const { eventId, rows = [] } = req.body;
    const seenNat = await fetchEventAttendeeNationalIds(eventId);
    const seenProfile = new Set();
    const result = { createdUsers: 0, linked: 0, skippedDuplicates: 0, invalid: 0, failed: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (row.__valid === false) { result.invalid++; continue; }
        if (row.national_id && seenNat.has(String(row.national_id))) { result.skippedDuplicates++; continue; }
        let user = await findUser(row);
        if (!user) { user = await createUserProfile(userFieldsForCreate(row)); result.createdUsers++; }
        const pid = String(recId(user));
        if (seenProfile.has(pid)) { result.skippedDuplicates++; continue; }
        await linkAttendee(eventId, user, row);
        result.linked++;
        if (row.national_id) seenNat.add(String(row.national_id));
        seenProfile.add(pid);
      } catch (e) {
        result.failed.push({ index: i, reason: e.message });
      }
    }
    res.json(result);
  } catch (e) { next(e); }
});

// ============================================================================
// INCUBATION APPLICANTS CSV IMPORT
// ============================================================================

// Find a record matching ANY of the [column, value] pairs, in ONE OR query
// (keeps request count low so we don't hit NocoDB's rate limit).
async function findByPairs(tableId, pairs) {
  const clauses = (pairs || [])
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([col, v]) => `(${col},eq,${String(v).replace(/[()]/g, "")})`);
  if (!clauses.length) return null;
  const data = await noco(`/api/v2/tables/${tableId}/records`, { query: { where: clauses.join("~or"), limit: 1 } });
  return (data.list && data.list[0]) || null;
}

async function createRecord(tableId, fields) {
  const created = await noco(`/api/v2/tables/${tableId}/records`, { method: "POST", body: fields || {} });
  return Array.isArray(created) ? created[0] : created;
}

// Resolve the link column on `tableId` whose related table is `targetTableId`.
// Robust to naming; a titleHint disambiguates when several links share a target.
const _linkToTableCache = {};
async function linkColumnToTable(tableId, targetTableId, titleHint) {
  const key = `${tableId}->${targetTableId}:${titleHint || ""}`;
  if (_linkToTableCache[key]) return _linkToTableCache[key];
  const meta = await noco(`/api/v2/meta/tables/${tableId}`);
  const links = (meta.columns || []).filter((c) => {
    if (c.uidt !== "Links" && c.uidt !== "LinkToAnotherRecord") return false;
    const o = c.colOptions || {};
    return o.fk_related_model_id === targetTableId || o.fk_related_table_id === targetTableId;
  });
  let col = links[0];
  if (titleHint) { const h = links.find((c) => c.title === titleHint); if (h) col = h; }
  if (!col) throw new Error(`No link column on table ${tableId} pointing to ${targetTableId}`);
  _linkToTableCache[key] = col.id;
  return col.id;
}

// Best-effort: does this company already have an incubation record linked?
async function companyAlreadyIncubated(companyId) {
  try {
    const colId = await linkColumnToTable(T.companyProfile, T.incubation, INC_HINTS.companyToIncubation);
    const data = await noco(`/api/v2/tables/${T.companyProfile}/links/${colId}/records/${companyId}`, { query: { limit: 1 } });
    const list = Array.isArray(data) ? data : (data.list || []);
    return list.length > 0;
  } catch (e) {
    return false; // link not resolvable -> can't check; proceed (may duplicate on re-run)
  }
}

// POST /api/incubation/preview  { rows:[normalizedRow] }  -> dry-run plan
app.post("/api/incubation/preview", async (req, res, next) => {
  try {
    const { rows = [] } = req.body;
    const plans = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const base = incubation.planRow(row, { status: INC_STATUS });
      let userAction = null, companyAction = null;
      if (base.process) {
        const u = await findByPairs(T.userProfile, (row.match && row.match.user) || []);
        userAction = u ? "link-existing" : "create";
        const c = await findByPairs(T.companyProfile, (row.match && row.match.company) || []);
        companyAction = c ? "reuse-existing" : "create";
      }
      plans.push({ index: i, status: row.status, action: base.action, incubation: base.incubation, userAction, companyAction, messages: base.messages });
    }
    res.json({ totals: incubation.summarize(plans), rows: plans });
  } catch (e) { next(e); }
});

// POST /api/incubation/commit  { rows:[normalizedRow(+startDate)] }  -> summary
app.post("/api/incubation/commit", async (req, res, next) => {
  try {
    const { rows = [] } = req.body;
    const result = { createdUsers: 0, createdCompanies: 0, linked: 0, incubated: 0, skipped: 0, invalid: 0, failed: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const base = incubation.planRow(row, { status: INC_STATUS });
        if (base.action === "skip-rejected") { result.skipped++; continue; }
        if (base.action === "invalid") { result.invalid++; continue; }

        // find-or-create user
        let user = await findByPairs(T.userProfile, (row.match && row.match.user) || []);
        if (!user) { user = await createRecord(T.userProfile, row.user || {}); result.createdUsers++; }

        // find-or-create company
        let company = await findByPairs(T.companyProfile, (row.match && row.match.company) || []);
        if (!company) { company = await createRecord(T.companyProfile, row.company || {}); result.createdCompanies++; }

        // link company <-> user
        const cuCol = await linkColumnToTable(T.companyProfile, T.userProfile, INC_HINTS.companyToUser);
        await linkRecords(T.companyProfile, cuCol, recId(company), recId(user));
        result.linked++;

        // incubation (approved only), idempotent per company
        if (base.incubation && !(await companyAlreadyIncubated(recId(company)))) {
          const fields = {};
          if (row.startDate) fields[INCUBATION_START_DATE_FIELD] = row.startDate;
          const inc = await createRecord(T.incubation, fields);
          const icCol = await linkColumnToTable(T.incubation, T.companyProfile, INC_HINTS.incubationToCompany);
          await linkRecords(T.incubation, icCol, recId(inc), recId(company));
          const iuCol = await linkColumnToTable(T.incubation, T.userProfile, INC_HINTS.incubationToUser);
          await linkRecords(T.incubation, iuCol, recId(inc), recId(user));
          result.incubated++;
        }
      } catch (e) {
        result.failed.push({ index: i, reason: e.message });
      }
    }
    res.json(result);
  } catch (e) { next(e); }
});

// ---- Static frontend + error handler ---------------------------------------
app.use(express.static(path.join(__dirname, "..")));

app.use((err, _req, res, _next) => {
  console.error(err.message, err.body || "");
  res.status(err.status || 500).json({ error: err.message, details: err.body });
});

app.listen(PORT, () => console.log(`Consultation site running on http://localhost:${PORT}`));
