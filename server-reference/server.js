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
// Imports post the whole file as JSON (long Arabic briefs), so the default
// 100kb body limit is far too small — allow large import payloads.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "50mb" }));

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
  techAdoption: "mm7wmx8m3jsovrj",
  voucherType: "vwm8s3ijw9togl3i",
  digitalVouchers: "muzyau6buu5xwfr",
  voucherProvider: "mo77shlm8fbhnfe",
  regions: "c54hdyvjr74fu23", // event holding regions
};

// Event scalar-field copies + attachment column.
const EVENT_FIELDS = {
  startDate: "event_starting_date", dateCopy: "event_date",
  city: "event_city", attachments: "event_attachments",
};

// Digital-vouchers column names (from the three voucher tables' schema).
const V = {
  provider: { title: "Title", service: "Service", amount: "amount", total: "total vouchers provided", remaining: "remaining vouchers" },
  type: { title: "Title", service: "Service", amount: "amount", total: "total vouchers provided" },
  digital: { title: "Title", date: "vocuher_date" }, // note source typo "vocuher_date"
};
const VOUCHER_PROVIDER_SEARCH = ["Title", "Service"];

// tech_adoption column names (scalar id links; note source typo "compnay_id").
const TA = {
  companyName: "Company_Name", userId: "user_id", companyId: "compnay_id",
  expertId: "expert_id", beneficiaryName: "beneficiary_name_en",
};
const COMPANY_SEARCH_TEXT_FIELDS = ["company_name_en", "company_name_ar"];

// Incubation import settings (keep in sync with ../config.js incubationImport).
const INC_STATUS = { approved: "approved", registered: "registered" };
const INCUBATION_START_DATE_FIELD = "incubation_start_date";
const COMPANY_USER_ID_FIELD = "user_id"; // company_profile column set to the created user's Id
// Title hints only needed if a table has >1 link to the same target table.
const INC_HINTS = { companyToUser: "", incubationToCompany: "", incubationToUser: "", companyToIncubation: "" };

// Events search + attendee-import config (keep in sync with ../config.js).
const EVENT_SEARCH_FIELDS = ["event_name_en", "event_name_ar"];
const JUNCTION = {
  userLinkTitle: "user_profiles",
  eventLinkTitle: "events_tables",
  userIdField: "user_id",              // system user_profile Id
  eventNameField: "event_name_en1",    // event name written on the junction row
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

// Proactive pacing: serialize NocoDB calls with a minimum gap so we stay under
// the server's rate limit instead of only reacting to 429s. The gap widens
// automatically whenever a 429 is seen, and slowly relaxes again.
let _minGapMs = Number(process.env.NOCODB_MIN_INTERVAL_MS || 220); // ~4.5 req/s
const _MAX_GAP_MS = 3000;
let _lastReqAt = 0;
let _gateChain = Promise.resolve();
function gate() {
  const p = _gateChain.then(async () => {
    const wait = Math.max(0, _lastReqAt + _minGapMs - Date.now());
    if (wait) await sleep(wait);
    _lastReqAt = Date.now();
  });
  _gateChain = p.catch(() => {});
  return p;
}

// Retries on 429 (rate limit) with backoff, honoring Retry-After when present.
async function noco(pathname, { method = "GET", query, body } = {}, _attempt = 0) {
  const url = new URL(NOCODB_BASE + pathname);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));

  await gate();
  const res = await fetch(url, {
    method,
    headers: { "xc-token": NOCODB_TOKEN, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 429 && _attempt < 8) {
    // widen the global gap so the rest of the import paces itself
    _minGapMs = Math.min(Math.ceil(_minGapMs * 1.6) + 50, _MAX_GAP_MS);
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * 2 ** _attempt, 30000);
    console.warn(`429 from NocoDB — backing off ${waitMs}ms (gap now ${_minGapMs}ms)`);
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

// Resolve the primary-value (display) column title of a table (cached).
const _pvCache = {};
async function primaryValueField(tableId) {
  if (_pvCache[tableId]) return _pvCache[tableId];
  const meta = await noco(`/api/v2/meta/tables/${tableId}`);
  const cols = meta.columns || [];
  const pv = cols.find((c) => c.pv) || cols.find((c) => c.uidt === "SingleLineText") || cols[0];
  const title = pv ? pv.title : "Title";
  _pvCache[tableId] = title;
  return title;
}

// Does a record with this Id exist in the given table? (best-effort; assumes yes
// when the target is unknown or the check fails, so we never block wrongly).
async function relatedRecordExists(targetTableId, id) {
  if (!targetTableId || id == null || String(id).trim() === "") return true;
  try {
    const d = await noco(`/api/v2/tables/${targetTableId}/records`, { query: { where: `(Id,eq,${id})`, limit: 1 } });
    return !!(d.list && d.list.length);
  } catch { return true; }
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

// GET /api/experts?search=  -> { list: [...] } from the configured expert_list.
app.get("/api/experts", async (req, res, next) => {
  try {
    const data = await noco(`/api/v2/tables/${T.expert}/records`, {
      query: { where: likeWhere(EXPERT_SEARCH_FIELDS, req.query.search), limit: 100 },
    });
    res.json({ list: data.list || [] });
  } catch (e) { next(e); }
});

// POST /api/consultations  { fields, userId, expertId }  -> { record, warnings }
app.post("/api/consultations", async (req, res, next) => {
  try {
    const { fields = {}, userId, expertId } = req.body;

    // 1) create the consultation row
    const created = await noco(`/api/v2/tables/${T.consultation}/records`, {
      method: "POST", body: fields,
    });
    const record = Array.isArray(created) ? created[0] : created;
    const consultationId = record.Id ?? record.id;

    // 2) link user + expert. Resolve the link column by its TARGET table (the
    // table we actually picked the record from) instead of by a fixed title —
    // e.g. the consultation's "Expert_ID" title points at a different table than
    // the expert_list, so titles can't be trusted. A missing/invalid related id
    // must NOT throw away the consultation we just created — warn and carry on.
    const warnings = [];
    const safeLink = async (targetTableId, titleHint, relatedId, label) => {
      if (relatedId == null || String(relatedId).trim() === "") return;
      if (!(await relatedRecordExists(targetTableId, relatedId))) {
        warnings.push({ link: label, relatedId, targetTable: targetTableId, reason: "related record not found" });
        console.warn(`consultation link skipped: ${label} #${relatedId} not found in ${targetTableId}`);
        return;
      }
      try {
        const colId = await linkColumnToTable(T.consultation, targetTableId, titleHint);
        await linkRecords(T.consultation, colId, consultationId, relatedId);
      } catch (e) {
        warnings.push({ link: label, relatedId, targetTable: targetTableId, reason: (e.body && e.body.message) || e.message });
        console.warn(`consultation link failed: ${label} #${relatedId} ->`, (e.body && e.body.message) || e.message);
      }
    };
    await safeLink(T.userProfile, LINK_USER_FIELD_TITLE, userId, "user");
    await safeLink(T.expert, LINK_EXPERT_FIELD_TITLE, expertId, "expert");

    res.json({ record, warnings });
  } catch (e) { next(e); }
});

// POST /api/consultations/bulk/preview  { rows:[{en_full_name,Email,phone_number,national_id}] }
// Dry-run: for each beneficiary, will we link an existing user or create one?
app.post("/api/consultations/bulk/preview", async (req, res, next) => {
  try {
    const { rows = [] } = req.body;
    const maps = await buildAttendeeMaps(rows); // batched reads
    const plans = rows.map((row, i) => {
      const hasIdentity = row.en_full_name || row.national_id || row.Email || row.phone_number;
      if (!hasIdentity) return { index: i, action: "invalid" };
      const user = matchAttendee(maps, row);
      return { index: i, action: user ? "link-existing" : "create", matchedName: user ? (user.en_full_name || user.full_name || null) : null };
    });
    const totals = plans.reduce((a, p) => { a[p.action] = (a[p.action] || 0) + 1; return a; }, {});
    res.json({ totals, rows: plans });
  } catch (e) { next(e); }
});

// POST /api/consultations/bulk/commit  { expertId, sharedFields, rows:[{user, topic}] }
// One consultation per row: shared fields + generated topic, linked to the user
// (match-else-create) and the single expert.
app.post("/api/consultations/bulk/commit", async (req, res, next) => {
  try {
    const { expertId, sharedFields = {}, rows = [] } = req.body;
    const userRows = rows.map((r) => r.user || {});
    const maps = await buildAttendeeMaps(userRows); // batched reads up front
    // resolve link columns once (by target table, robust to mistitled columns)
    let userCol = null, expertCol = null;
    try { userCol = await linkColumnToTable(T.consultation, T.userProfile); } catch (e) { console.warn("bulk cons: no user link col", e.message); }
    try { expertCol = await linkColumnToTable(T.consultation, T.expert); } catch (e) { console.warn("bulk cons: no expert link col", e.message); }
    const result = { created: 0, createdUsers: 0, linkedExisting: 0, invalid: 0, failed: [] };
    for (let i = 0; i < rows.length; i++) {
      const u = rows[i].user || {};
      const topic = rows[i].topic;
      try {
        const hasIdentity = u.en_full_name || u.national_id || u.Email || u.phone_number;
        if (!hasIdentity) { result.invalid++; continue; }
        let user = matchAttendee(maps, u);
        if (!user) {
          user = await createUserProfile(userFieldsForCreate(u));
          if (u.national_id) (maps.national_id = maps.national_id || new Map()).set(String(u.national_id), user);
          if (u.phone_number) (maps.phone_number = maps.phone_number || new Map()).set(String(u.phone_number), user);
          if (u.Email) (maps.Email = maps.Email || new Map()).set(String(u.Email), user);
          result.createdUsers++;
        } else { result.linkedExisting++; }

        const fields = Object.assign({}, sharedFields);
        if (topic) fields.consultation_topic = topic;
        const bname = user.en_full_name || user.full_name || u.en_full_name;
        if (bname && !fields.beneficiary_name) fields.beneficiary_name = bname;

        const created = await createRecord(T.consultation, fields);
        const cid = recId(created);
        if (userCol) { try { await linkRecords(T.consultation, userCol, cid, recId(user)); } catch (e) { console.warn(`bulk cons user link ${cid}:`, e.message); } }
        if (expertCol && expertId != null) { try { await linkRecords(T.consultation, expertCol, cid, expertId); } catch (e) { console.warn(`bulk cons expert link ${cid}:`, e.message); } }
        result.created++;
      } catch (e) {
        result.failed.push({ index: i, reason: e.message });
      }
    }
    res.json(result);
  } catch (e) { next(e); }
});

// ============================================================================
// EVENTS + ATTENDEE CSV IMPORT
// ============================================================================
const EVENT_ATTENDEES_LINK_TITLE = "events_registration_and_attendees_tables";
const WRITABLE_USER_FIELDS = ["en_full_name", "phone_number", "national_id", "Email", "gender", "region_of_residence", "user_type"];

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

// Best-effort set of SYSTEM user ids already registered for this event (dedup).
async function fetchEventAttendeeUserIds(eventId) {
  const ids = new Set();
  try {
    const colId = await columnId(T.events, EVENT_ATTENDEES_LINK_TITLE);
    const data = await noco(`/api/v2/tables/${T.events}/links/${colId}/records/${eventId}`, { query: { limit: 1000 } });
    const list = Array.isArray(data) ? data : (data.list || []);
    list.forEach((r) => { if (r[JUNCTION.userIdField] != null) ids.add(String(r[JUNCTION.userIdField])); });
  } catch (e) {
    console.warn("fetchEventAttendeeUserIds failed (proceeding without existing dedup):", e.message);
  }
  return ids;
}

// Event display name (en preferred, ar fallback) — written on the junction row.
async function eventDisplayName(eventId) {
  try {
    const d = await noco(`/api/v2/tables/${T.events}/records`, { query: { where: `(Id,eq,${eventId})`, limit: 1 } });
    const e = d.list && d.list[0];
    return e ? (e.event_name_en || e.event_name_ar || "") : "";
  } catch { return ""; }
}

// Create a junction row: system user_id + event name + attendance, then link both.
async function linkAttendee(eventId, user, row, eventName) {
  const created = await noco(`/api/v2/tables/${T.attendees}/records`, {
    method: "POST",
    body: {
      [JUNCTION.userIdField]: recId(user),
      [JUNCTION.eventNameField]: eventName || "",
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

// GET /api/regions?search=  -> { list:[{id,name}] } for the holding-region link
app.get("/api/regions", async (req, res, next) => {
  try {
    const nameField = await primaryValueField(T.regions);
    const where = likeWhere([nameField], req.query.search);
    const data = await noco(`/api/v2/tables/${T.regions}/records`, { query: { where, limit: 50 } });
    const list = (data.list || []).map((r) => ({ id: recId(r), name: r[nameField] }));
    res.json({ list });
  } catch (e) { next(e); }
});

// POST /api/upload  { filename, mimetype, dataBase64 }  -> { attachment:[...] }
// Proxies a file to NocoDB storage so it can be attached to a record.
app.post("/api/upload", async (req, res, next) => {
  try {
    const { filename = "upload", mimetype = "application/octet-stream", dataBase64 } = req.body || {};
    if (!dataBase64) return res.status(400).json({ error: "dataBase64 required" });
    const buffer = Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ""), "base64");
    const fd = new FormData();
    fd.append("file", new Blob([buffer], { type: mimetype }), filename);
    const r = await fetch(NOCODB_BASE + "/api/v2/storage/upload", {
      method: "POST", headers: { "xc-token": NOCODB_TOKEN }, body: fd,
    });
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) return res.status(r.status).json({ error: "upload failed", details: data });
    res.json({ attachment: Array.isArray(data) ? data : [data] });
  } catch (e) { next(e); }
});

// POST /api/events  { fields, regionId, regionName, attachment } (or raw fields) -> { record }
// Copies start date -> event_date and region name -> event_city; links the region.
app.post("/api/events", async (req, res, next) => {
  try {
    const body = req.body || {};
    const fields = body.fields ? { ...body.fields } : { ...body };
    const { regionId, regionName, attachment } = body;

    if (fields[EVENT_FIELDS.startDate] && !fields[EVENT_FIELDS.dateCopy])
      fields[EVENT_FIELDS.dateCopy] = fields[EVENT_FIELDS.startDate];
    if (regionName && !fields[EVENT_FIELDS.city]) fields[EVENT_FIELDS.city] = regionName;
    if (attachment && attachment.length) fields[EVENT_FIELDS.attachments] = attachment;

    const created = await createRecord(T.events, fields);
    const eventId = recId(created);

    if (regionId != null) {
      try {
        const colId = await linkColumnToTable(T.events, T.regions);
        await linkRecords(T.events, colId, eventId, regionId);
      } catch (e) { console.warn("region link failed:", e.message); }
    }
    res.json({ record: created });
  } catch (e) { next(e); }
});

// POST /api/attendees/preview  { eventId, rows:[normalizedRow] }  -> dry-run plan
app.post("/api/attendees/preview", async (req, res, next) => {
  try {
    const { eventId, rows = [] } = req.body;
    const seenProfile = await fetchEventAttendeeUserIds(eventId); // system ids already in the event
    const maps = await buildAttendeeMaps(rows); // batched reads, no per-row calls
    const plans = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let action, matchedUserId = null;
      if (row.__valid === false) {
        action = "invalid";
      } else {
        const user = matchAttendee(maps, row);
        matchedUserId = user ? recId(user) : null;
        if (matchedUserId != null && seenProfile.has(String(matchedUserId))) {
          action = "skip-duplicate"; // already registered for this event (or earlier in file)
        } else {
          action = matchedUserId != null ? "link" : "create";
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
    const seenProfile = await fetchEventAttendeeUserIds(eventId); // system ids already in the event
    const eventName = await eventDisplayName(eventId);
    const maps = await buildAttendeeMaps(rows); // batched reads up front
    const result = { createdUsers: 0, linked: 0, skippedDuplicates: 0, invalid: 0, failed: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (row.__valid === false) { result.invalid++; continue; }
        let user = matchAttendee(maps, row);
        if (!user) {
          user = await createUserProfile(userFieldsForCreate(row));
          // seed match maps so later rows with the same identity resolve to this user
          if (row.national_id) (maps.national_id = maps.national_id || new Map()).set(String(row.national_id), user);
          if (row.phone_number) (maps.phone_number = maps.phone_number || new Map()).set(String(row.phone_number), user);
          if (row.Email) (maps.Email = maps.Email || new Map()).set(String(row.Email), user);
          result.createdUsers++;
        }
        const pid = String(recId(user));
        if (seenProfile.has(pid)) { result.skippedDuplicates++; continue; }
        await linkAttendee(eventId, user, row, eventName);
        result.linked++;
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

// Per-import cache: the same applicant/company often repeats across rows, so
// look them up once. Also lets a create seed the cache, preventing duplicates
// (and extra requests) for later rows with the same identity.
const pairsKey = (tableId, pairs) =>
  tableId + "|" + (pairs || []).map(([c, v]) => `${c}=${String(v).trim()}`).join("&");

async function findByPairsCached(tableId, pairs, cache) {
  const key = pairsKey(tableId, pairs);
  if (cache.has(key)) return cache.get(key);
  const rec = await findByPairs(tableId, pairs);
  cache.set(key, rec);
  return rec;
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

// Bulk-fetch existing records matching any of `values` in `col`, in chunks,
// returning Map(String(value) -> record). ONE request per chunk instead of one
// per row — essential for rate-limited NocoDB instances.
async function bulkFindByColumn(tableId, col, values, chunkSize = 80) {
  const map = new Map();
  const uniq = [...new Set((values || []).filter((v) => v != null && String(v).trim() !== "").map(String))];
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const where = `(${col},in,${chunk.map((v) => v.replace(/[(),]/g, "")).join(",")})`;
    const data = await noco(`/api/v2/tables/${tableId}/records`, { query: { where, limit: chunk.length } });
    (data.list || []).forEach((rec) => {
      const key = rec[col] != null ? String(rec[col]) : "";
      if (key && !map.has(key)) map.set(key, rec);
    });
  }
  return map;
}

// Build per-column lookup maps for every row's match pairs (user + company),
// with a handful of bulk queries total.
async function buildMatchMaps(rows) {
  const userByCol = {}, compByCol = {};
  rows.forEach((r) => {
    ((r.match && r.match.user) || []).forEach(([c, v]) => (userByCol[c] = userByCol[c] || []).push(v));
    ((r.match && r.match.company) || []).forEach(([c, v]) => (compByCol[c] = compByCol[c] || []).push(v));
  });
  const userMaps = {}, compMaps = {};
  for (const [c, vals] of Object.entries(userByCol)) userMaps[c] = await bulkFindByColumn(T.userProfile, c, vals);
  for (const [c, vals] of Object.entries(compByCol)) compMaps[c] = await bulkFindByColumn(T.companyProfile, c, vals);
  return { userMaps, compMaps };
}

function matchInMaps(maps, pairs) {
  for (const [c, v] of pairs || []) {
    const m = maps[c];
    if (m && m.has(String(v))) return m.get(String(v));
  }
  return null;
}
function addToMaps(maps, pairs, rec) {
  (pairs || []).forEach(([c, v]) => {
    if (v == null || String(v).trim() === "") return;
    (maps[c] = maps[c] || new Map()).set(String(v), rec);
  });
}

// Attendee (events) batched lookups: build user maps for the columns used to
// match attendees, then resolve each row in memory (national_id -> phone -> email).
async function buildAttendeeMaps(rows) {
  const cols = { national_id: [], phone_number: [], Email: [] };
  rows.forEach((r) => {
    if (r.national_id) cols.national_id.push(r.national_id);
    if (r.phone_number) cols.phone_number.push(r.phone_number);
    if (r.Email) cols.Email.push(r.Email);
  });
  const maps = {};
  for (const [c, vals] of Object.entries(cols)) maps[c] = await bulkFindByColumn(T.userProfile, c, vals);
  return maps;
}
function matchAttendee(maps, row) {
  return (row.national_id && maps.national_id.get(String(row.national_id)))
    || (row.phone_number && maps.phone_number.get(String(row.phone_number)))
    || (row.Email && maps.Email.get(String(row.Email))) || null;
}

// POST /api/incubation/preview  { rows:[normalizedRow] }  -> dry-run plan
app.post("/api/incubation/preview", async (req, res, next) => {
  try {
    const { rows = [] } = req.body;
    const { userMaps, compMaps } = await buildMatchMaps(rows); // few bulk queries, no per-row calls
    const plans = rows.map((row, i) => {
      const base = incubation.planRow(row, { status: INC_STATUS });
      let userAction = null, companyAction = null;
      if (base.process) {
        userAction = matchInMaps(userMaps, row.match && row.match.user) ? "link-existing" : "create";
        companyAction = matchInMaps(compMaps, row.match && row.match.company) ? "reuse-existing" : "create";
      }
      return { index: i, status: row.status, action: base.action, incubation: base.incubation, userAction, companyAction, messages: base.messages };
    });
    res.json({ totals: incubation.summarize(plans), rows: plans });
  } catch (e) { next(e); }
});

// POST /api/incubation/commit  { rows:[normalizedRow(+startDate)] }  -> summary
app.post("/api/incubation/commit", async (req, res, next) => {
  try {
    const { rows = [] } = req.body;
    const result = { createdUsers: 0, createdCompanies: 0, linked: 0, incubated: 0, skipped: 0, invalid: 0, failed: [] };
    const { userMaps, compMaps } = await buildMatchMaps(rows); // batched reads up front
    const incubatedCompanies = new Set(); // companies incubated during this run
    const linkedPairs = new Set();        // company:user pairs already linked this run
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const base = incubation.planRow(row, { status: INC_STATUS });
        if (base.action === "skip-rejected") { result.skipped++; continue; }
        if (base.action === "invalid") { result.invalid++; continue; }

        // find-or-create user (match via prefetched maps; seed maps on create)
        const uPairs = (row.match && row.match.user) || [];
        let user = matchInMaps(userMaps, uPairs);
        if (!user) {
          user = await createRecord(T.userProfile, row.user || {});
          addToMaps(userMaps, uPairs, user); // later duplicate rows reuse it
          result.createdUsers++;
        }

        // find-or-create company (inject the user's Id on create; reuse never overwrites)
        const cPairs = (row.match && row.match.company) || [];
        let company = matchInMaps(compMaps, cPairs);
        if (!company) {
          const companyFields = Object.assign({}, row.company || {});
          companyFields[COMPANY_USER_ID_FIELD] = recId(user);
          company = await createRecord(T.companyProfile, companyFields);
          addToMaps(compMaps, cPairs, company);
          result.createdCompanies++;
        }

        // link company <-> user (once per pair per run)
        const pairId = `${recId(company)}:${recId(user)}`;
        if (!linkedPairs.has(pairId)) {
          const cuCol = await linkColumnToTable(T.companyProfile, T.userProfile, INC_HINTS.companyToUser);
          await linkRecords(T.companyProfile, cuCol, recId(company), recId(user));
          linkedPairs.add(pairId);
          result.linked++;
        }

        // incubation (approved only), idempotent per company (and within this run)
        const companyId = recId(company);
        if (base.incubation && !incubatedCompanies.has(String(companyId)) && !(await companyAlreadyIncubated(companyId))) {
          incubatedCompanies.add(String(companyId));
          const fields = Object.assign({}, row.incubation || {});
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

// ============================================================================
// TECH ADOPTION
// ============================================================================

// Company search where: like across name fields, plus eq on cr_number when digits.
function buildCompanyWhere(q) {
  if (!q) return undefined;
  const esc = String(q).replace(/[()]/g, "");
  const clauses = COMPANY_SEARCH_TEXT_FIELDS.map((f) => `(${f},like,%${esc}%)`);
  if (/^\d+$/.test(esc)) clauses.push(`(cr_number,eq,${esc})`);
  return clauses.join("~or");
}

// GET /api/companies?search=  -> { list } (company_profile picker)
app.get("/api/companies", async (req, res, next) => {
  try {
    const data = await noco(`/api/v2/tables/${T.companyProfile}/records`, {
      query: { where: buildCompanyWhere(req.query.search), limit: 25 },
    });
    res.json({ list: data.list || [] });
  } catch (e) { next(e); }
});

// Resolve beneficiary_name_en from a user id (best-effort).
async function ownerName(userId) {
  if (!userId) return "";
  try {
    const d = await noco(`/api/v2/tables/${T.userProfile}/records`, { query: { where: `(Id,eq,${userId})`, limit: 1 } });
    const u = d.list && d.list[0];
    return u ? (u.en_full_name || u.full_name || "") : "";
  } catch { return ""; }
}

// POST /api/tech-adoption  { company, expertId, fields }  -> { record }
// Stores company/user/expert IDs in the scalar link columns.
app.post("/api/tech-adoption", async (req, res, next) => {
  try {
    const { company, expertId, fields = {} } = req.body;
    const rec = { ...fields };
    if (company) {
      rec[TA.companyName] = company.company_name_en || company.company_name_ar || "";
      rec[TA.companyId] = recId(company);
      const uid = company.user_id;
      if (uid != null && String(uid).trim() !== "") {
        rec[TA.userId] = uid;
        const name = await ownerName(uid);
        if (name) rec[TA.beneficiaryName] = name;
      }
    }
    if (expertId != null) rec[TA.expertId] = expertId;
    const record = await createRecord(T.techAdoption, rec);
    res.json({ record });
  } catch (e) { next(e); }
});

// POST /api/tech-adoption/preview  { rows:[{match,session,__hasIdentity}] }  -> dry-run
app.post("/api/tech-adoption/preview", async (req, res, next) => {
  try {
    const { rows = [] } = req.body;
    const { userMaps, compMaps } = await buildMatchMaps(rows); // batched reads
    const totals = { create: 0, skipped: 0 };
    const plans = rows.map((row, i) => {
      const company = matchInMaps(compMaps, row.match && row.match.company);
      if (!company) { totals.skipped++; return { index: i, action: "skip-no-company", messages: ["company not found"] }; }
      const user = matchInMaps(userMaps, row.match && row.match.user);
      totals.create++;
      return { index: i, action: "create-session", companyName: company.company_name_en || company.company_name_ar || "", userMatched: !!user };
    });
    res.json({ totals, rows: plans });
  } catch (e) { next(e); }
});

// POST /api/tech-adoption/commit  { rows }  -> summary
app.post("/api/tech-adoption/commit", async (req, res, next) => {
  try {
    const { rows = [] } = req.body;
    const { userMaps, compMaps } = await buildMatchMaps(rows);
    const result = { created: 0, skipped: 0, failed: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const company = matchInMaps(compMaps, row.match && row.match.company);
        if (!company) { result.skipped++; continue; } // tech adoption needs an existing company
        const user = matchInMaps(userMaps, row.match && row.match.user);
        const rec = Object.assign({}, row.session || {});
        rec[TA.companyName] = company.company_name_en || company.company_name_ar || "";
        rec[TA.companyId] = recId(company);
        const uid = user ? recId(user) : company.user_id;
        if (uid != null && String(uid).trim() !== "") {
          rec[TA.userId] = uid;
          const name = user ? (user.en_full_name || user.full_name || "") : await ownerName(uid);
          if (name) rec[TA.beneficiaryName] = name;
        }
        await createRecord(T.techAdoption, rec);
        result.created++;
      } catch (e) {
        result.failed.push({ index: i, reason: e.message });
      }
    }
    res.json(result);
  } catch (e) { next(e); }
});

// ============================================================================
// DIGITAL VOUCHERS
// ============================================================================

// POST /api/companies  (create a company_profile row when search finds none)
app.post("/api/companies", async (req, res, next) => {
  try {
    const record = await createRecord(T.companyProfile, req.body || {});
    res.json({ record });
  } catch (e) { next(e); }
});

// GET /api/vouchers/providers?search=  -> voucher cards (provider + its linked type)
app.get("/api/vouchers/providers", async (req, res, next) => {
  try {
    const where = likeWhere(VOUCHER_PROVIDER_SEARCH, req.query.search);
    const data = await noco(`/api/v2/tables/${T.voucherProvider}/records`, { query: { where, limit: 100 } });
    const providers = data.list || [];
    let typeColId = null;
    try { typeColId = await linkColumnToTable(T.voucherProvider, T.voucherType); } catch { /* not linked */ }
    const list = [];
    for (const p of providers) {
      let type = null;
      if (typeColId) {
        try {
          const ld = await noco(`/api/v2/tables/${T.voucherProvider}/links/${typeColId}/records/${recId(p)}`, { query: { limit: 1 } });
          const tt = (Array.isArray(ld) ? ld : (ld.list || []))[0];
          if (tt) type = { id: recId(tt), title: tt[V.type.title], amount: tt[V.type.amount] };
        } catch { /* leave type null */ }
      }
      list.push({
        id: recId(p),
        title: p[V.provider.title],
        service: p[V.provider.service],
        amount: p[V.provider.amount],
        total: p[V.provider.total],
        remaining: p[V.provider.remaining],
        type,
      });
    }
    res.json({ list });
  } catch (e) { next(e); }
});

// POST /api/vouchers/catalog  { provider:{...}, type:{...} }  -> create both + link them
app.post("/api/vouchers/catalog", async (req, res, next) => {
  try {
    const { provider = {}, type = {} } = req.body;
    const providerRec = await createRecord(T.voucherProvider, provider);
    const typeRec = await createRecord(T.voucherType, type);
    // best-effort: link provider <-> type if a link column exists
    try {
      const colId = await linkColumnToTable(T.voucherProvider, T.voucherType);
      await linkRecords(T.voucherProvider, colId, recId(providerRec), recId(typeRec));
    } catch { /* not linkable — leave unlinked */ }
    res.json({
      card: {
        id: recId(providerRec),
        title: providerRec[V.provider.title],
        service: providerRec[V.provider.service],
        amount: providerRec[V.provider.amount],
        total: providerRec[V.provider.total],
        remaining: providerRec[V.provider.remaining],
        type: { id: recId(typeRec), title: typeRec[V.type.title], amount: typeRec[V.type.amount] },
      },
    });
  } catch (e) { next(e); }
});

// POST /api/digital-vouchers  { companyId, providerId, typeId, expertId, date, title }
// Creates the assignment row and links company / provider / type / expert.
app.post("/api/digital-vouchers", async (req, res, next) => {
  try {
    const { companyId, providerId, typeId, expertId, date, title } = req.body;
    const rec = {};
    if (title) rec[V.digital.title] = title;
    if (date) rec[V.digital.date] = date;
    const created = await createRecord(T.digitalVouchers, rec);
    const id = recId(created);
    const link = async (targetTable, relatedId) => {
      if (relatedId == null) return;
      try {
        const colId = await linkColumnToTable(T.digitalVouchers, targetTable);
        await linkRecords(T.digitalVouchers, colId, id, relatedId);
      } catch (e) { console.warn(`voucher link ${targetTable} failed: ${e.message}`); }
    };
    await link(T.companyProfile, companyId);
    await link(T.voucherProvider, providerId);
    await link(T.voucherType, typeId);
    await link(T.expert, expertId);
    res.json({ record: created });
  } catch (e) { next(e); }
});

// ---- Static frontend (built Vite SPA) + error handler ----------------------
const DIST = path.join(__dirname, "..", "web", "dist");
app.use(express.static(DIST, {
  setHeaders(res, filePath) {
    // Hashed assets (…/assets/index-xxxx.js) never change -> cache forever.
    // index.html MUST always revalidate, otherwise a rebuild's new bundle is
    // never picked up and users keep seeing the old app.
    if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
    else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  },
}));

// SPA fallback: serve index.html for client-side routes (anything not /api/*).
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(DIST, "index.html"), (e) => e && next(e));
});

app.use((err, _req, res, _next) => {
  console.error(err.message, err.body || "");
  res.status(err.status || 500).json({ error: err.message, details: err.body });
});

app.listen(PORT, () => console.log(`Consultation site running on http://localhost:${PORT}`));
