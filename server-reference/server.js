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
async function noco(pathname, { method = "GET", query, body } = {}) {
  const url = new URL(NOCODB_BASE + pathname);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, {
    method,
    headers: { "xc-token": NOCODB_TOKEN, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
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

// ---- Resolve link column ids by title (cached) -----------------------------
const _colIdCache = {};
async function linkColumnId(title) {
  if (_colIdCache[title]) return _colIdCache[title];
  const meta = await noco(`/api/v2/meta/tables/${T.consultation}`);
  const col = (meta.columns || []).find((c) => c.title === title);
  if (!col) throw new Error(`Link column "${title}" not found on consultation table`);
  _colIdCache[title] = col.id;
  return col.id;
}

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
      const colId = await linkColumnId(LINK_USER_FIELD_TITLE);
      await linkRecords(consultationId, colId, userId);
    }
    // 3) link the expert
    if (expertId != null) {
      const colId = await linkColumnId(LINK_EXPERT_FIELD_TITLE);
      await linkRecords(consultationId, colId, expertId);
    }

    res.json({ record });
  } catch (e) { next(e); }
});

// Link one related record into a Link column of a consultation row.
function linkRecords(consultationId, linkColumnId, relatedId) {
  return noco(
    `/api/v2/tables/${T.consultation}/links/${linkColumnId}/records/${consultationId}`,
    { method: "POST", body: [{ Id: relatedId }] }
  );
}

// ---- Static frontend + error handler ---------------------------------------
app.use(express.static(path.join(__dirname, "..")));

app.use((err, _req, res, _next) => {
  console.error(err.message, err.body || "");
  res.status(err.status || 500).json({ error: err.message, details: err.body });
});

app.listen(PORT, () => console.log(`Consultation site running on http://localhost:${PORT}`));
