/* events.js — workshop attendee CSV import wizard.
 * Talks only to the backend: /api/events, /api/attendees/preview|commit.
 */
(function () {
  "use strict";
  const cfg = window.CONFIG;
  const imp = cfg.attendeeImport;

  const state = {
    step: 1,
    selectedEvent: null,
    csv: null,          // { headers, rows }
    mapping: null,      // { rawHeader -> canonicalKey }
    normalized: [],     // normalized rows sent to backend
    previewed: false,
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const show = (el) => el && el.classList.remove("hidden");
  const hide = (el) => el && el.classList.add("hidden");
  const recId = (r) => r && (r.Id ?? r.id ?? r.ID);
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let toastTimer;
  function toast(msg, kind = "info") {
    const el = $("#toast");
    el.textContent = msg; el.className = `toast ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3500);
  }

  // ---- API ------------------------------------------------------------------
  const base = cfg.API_BASE || "";
  async function apiGet(p) {
    const r = await fetch(base + p, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`GET ${p} -> ${r.status}`);
    return r.json();
  }
  async function apiPost(p, body) {
    const r = await fetch(base + p, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`POST ${p} -> ${r.status}`);
    return r.json();
  }

  // ---- dynamic form (for "add event") ---------------------------------------
  function renderFields(container, fields) {
    container.innerHTML = "";
    fields.forEach((f) => {
      const wrap = document.createElement("div"); wrap.className = "field";
      const label = document.createElement("label");
      label.textContent = fieldLabel(f) + (f.required ? " *" : "");
      let input;
      if (f.type === "select") {
        input = document.createElement("select");
        const blank = document.createElement("option");
        blank.value = ""; blank.textContent = i18nState.lang === "ar" ? "— اختر —" : "— select —";
        input.appendChild(blank);
        (f.options || []).forEach((opt) => {
          const o = document.createElement("option");
          o.value = opt.value; o.textContent = fieldLabel(opt) || opt.value;
          input.appendChild(o);
        });
      } else {
        input = document.createElement("input"); input.type = f.type || "text";
      }
      input.dataset.key = f.key; if (f.required) input.required = true;
      const err = document.createElement("div"); err.className = "field-error";
      wrap.append(label, input, err); container.appendChild(wrap);
    });
  }
  function collectFields(container) {
    const out = {};
    $$("[data-key]", container).forEach((i) => { const v = i.value.trim(); if (v) out[i.dataset.key] = v; });
    return out;
  }
  function validate(container, fields) {
    let ok = true;
    fields.forEach((f) => {
      const input = $(`[data-key="${CSS.escape(f.key)}"]`, container);
      const err = input && input.parentElement.querySelector(".field-error");
      if (f.required && input && !input.value.trim()) { ok = false; input.classList.add("invalid"); if (err) err.textContent = t("required"); }
      else if (input) { input.classList.remove("invalid"); if (err) err.textContent = ""; }
    });
    return ok;
  }

  // ---- Step 1: event search/select/create -----------------------------------
  let evTimer;
  function initEventStep() {
    $("#eventSearch").addEventListener("input", (e) => {
      clearTimeout(evTimer);
      const q = e.target.value.trim();
      if (q.length < 2) { $("#eventResults").innerHTML = ""; hide($("#eventSearchEmpty")); return; }
      evTimer = setTimeout(() => runEventSearch(q), 300);
    });
    $("#createEventBtn").addEventListener("click", () => {
      hide($("#eventSearchEmpty"));
      renderFields($("#createEventFields"), cfg.events.addEventFields);
      show($("#createEventForm"));
    });
    $("#cancelCreateEvent").addEventListener("click", () => hide($("#createEventForm")));
    $("#createEventForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const c = $("#createEventFields");
      if (!validate(c, cfg.events.addEventFields)) return;
      try {
        toast(t("importing"));
        const { record } = await apiPost("/api/events", collectFields(c));
        selectEvent(record); hide($("#createEventForm"));
      } catch (err) { console.error(err); toast(t("submitError"), "error"); }
    });
    $("#changeEvent").addEventListener("click", () => {
      state.selectedEvent = null; hide($("#selectedEventBanner"));
      $("#eventSearch").value = ""; $("#eventResults").innerHTML = ""; $("#eventSearch").focus();
    });
  }
  async function runEventSearch(q) {
    const list = $("#eventResults");
    list.innerHTML = `<div class="muted">${t("searching")}</div>`;
    try {
      const { list: rows } = await apiGet(`/api/events?search=${encodeURIComponent(q)}`);
      list.innerHTML = "";
      if (!rows.length) { show($("#eventSearchEmpty")); return; }
      hide($("#eventSearchEmpty"));
      const d = cfg.events.display;
      rows.forEach((r) => {
        const card = document.createElement("button");
        card.type = "button"; card.className = "result-card";
        card.innerHTML = `<span class="rc-primary">${escapeHtml(r[d.primary])}</span>
          <span class="rc-secondary">${escapeHtml(r[d.secondary])}</span>
          <span class="rc-tertiary">${escapeHtml(r[d.tertiary])}</span>`;
        card.addEventListener("click", () => selectEvent(r));
        list.appendChild(card);
      });
    } catch (err) { console.error(err); list.innerHTML = `<div class="error-text">${t("genericError")}</div>`; }
  }
  function selectEvent(rec) {
    state.selectedEvent = rec;
    $("#selectedEventName").textContent = rec[cfg.events.display.primary] || `#${recId(rec)}`;
    show($("#selectedEventBanner"));
    $("#eventResults").innerHTML = ""; $("#eventSearch").value = "";
  }

  // ---- Step 2: CSV upload ----------------------------------------------------
  function initUploadStep() {
    $("#csvFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      $("#csvFileName").textContent = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          state.csv = CSVKit.parseCSV(reader.result);
          state.mapping = CSVKit.autoMap(state.csv.headers, imp.headerMap);
          $("#csvParseInfo").textContent = `${t("rowsParsed")} ${state.csv.rows.length}`;
        } catch (err) {
          console.error(err); state.csv = null;
          $("#csvParseInfo").innerHTML = `<span class="error-text">${t("csvParseError")}</span>`;
        }
      };
      reader.readAsText(file, "utf-8");
    });
  }

  // ---- Step 3: column mapping -----------------------------------------------
  const TARGET_OPTIONS = [
    { key: "__ignore", labelEn: "Ignore", labelAr: "تجاهل" },
    { key: "en_full_name", labelEn: "Full name", labelAr: "الاسم" },
    { key: "phone_number", labelEn: "Phone", labelAr: "الجوال" },
    { key: "national_id", labelEn: "National ID", labelAr: "الهوية" },
    { key: "Email", labelEn: "Email", labelAr: "البريد" },
    { key: "gender", labelEn: "Gender", labelAr: "الجنس" },
    { key: "region_of_residence", labelEn: "City", labelAr: "المدينة" },
    { key: "__attendance", labelEn: "Attendance status", labelAr: "حالة الحضور" },
  ];
  function renderMapTable() {
    const body = $("#mapTableBody"); body.innerHTML = "";
    if (!state.csv) return;
    state.csv.headers.forEach((h) => {
      const current = state.mapping[h] === "__unmapped" ? "__ignore" : state.mapping[h];
      const tr = document.createElement("tr");
      const th = document.createElement("td"); th.textContent = h;
      const td = document.createElement("td");
      const sel = document.createElement("select");
      TARGET_OPTIONS.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o.key; opt.textContent = i18nState.lang === "ar" ? o.labelAr : o.labelEn;
        if (o.key === current) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", () => { state.mapping[h] = sel.value; });
      state.mapping[h] = current;
      td.appendChild(sel); tr.append(th, td); body.appendChild(tr);
    });
  }

  // ---- Step 4: preview + confirm --------------------------------------------
  function normalizeAll() {
    state.normalized = state.csv.rows.map((r) => CSVKit.normalizeRow(r, state.mapping, imp));
  }
  async function runPreview() {
    normalizeAll();
    const totals = $("#previewTotals");
    totals.innerHTML = `<div class="muted">${t("previewing")}</div>`;
    $("#previewIssues").innerHTML = "";
    hide($("#importReport"));
    try {
      const data = await apiPost("/api/attendees/preview", {
        eventId: recId(state.selectedEvent), rows: state.normalized,
      });
      renderTotals(data.totals);
      renderIssues(data.rows);
      state.previewed = true;
    } catch (err) { console.error(err); totals.innerHTML = `<div class="error-text">${t("genericError")}</div>`; }
  }
  function tile(label, value, kind) {
    return `<div class="tile ${kind}"><span class="tile-num">${value}</span><span class="tile-label">${escapeHtml(label)}</span></div>`;
  }
  function renderTotals(x) {
    $("#previewTotals").innerHTML =
      tile(t("tCreate"), x.create, "good") +
      tile(t("tLink"), x.link, "info") +
      tile(t("tSkip"), x.skipDuplicate, "warn") +
      tile(t("tInvalid"), x.invalid, "bad");
  }
  function renderIssues(rows) {
    const issues = rows.filter((r) => r.action === "invalid" || r.action === "skip-duplicate");
    const list = $("#previewIssues");
    list.innerHTML = "";
    issues.slice(0, 100).forEach((r) => {
      const div = document.createElement("div");
      div.className = "result-card";
      div.innerHTML = `<span class="rc-primary">#${r.index + 1} — ${escapeHtml(r.action)}</span>
        <span class="rc-secondary">${escapeHtml((r.messages || []).join("; "))}</span>`;
      list.appendChild(div);
    });
  }
  async function runCommit() {
    $("#confirmBtn").disabled = true;
    toast(t("importing"));
    try {
      const r = await apiPost("/api/attendees/commit", {
        eventId: recId(state.selectedEvent), rows: state.normalized,
      });
      const rep = $("#importReport");
      rep.innerHTML = `<div class="rv-section"><h3>${t("importDone")}</h3>
        <div class="rv-row"><span class="rv-key">${t("reportCreated")}</span><span class="rv-val">${r.createdUsers}</span></div>
        <div class="rv-row"><span class="rv-key">${t("reportLinked")}</span><span class="rv-val">${r.linked}</span></div>
        <div class="rv-row"><span class="rv-key">${t("reportSkipped")}</span><span class="rv-val">${r.skippedDuplicates}</span></div>
        <div class="rv-row"><span class="rv-key">${t("reportInvalid")}</span><span class="rv-val">${r.invalid}</span></div>
        <div class="rv-row"><span class="rv-key">${t("reportFailed")}</span><span class="rv-val">${(r.failed || []).length}</span></div></div>`;
      show(rep);
      toast(t("importDone"), "success");
    } catch (err) { console.error(err); toast(t("submitError"), "error"); }
    finally { $("#confirmBtn").disabled = false; }
  }

  // ---- wizard nav -----------------------------------------------------------
  function gotoStep(n) {
    state.step = n;
    $$(".step-panel").forEach(hide);
    show($(`.step-panel[data-panel="${n}"]`));
    $$("#stepper li").forEach((li) => {
      const s = Number(li.dataset.step);
      li.classList.toggle("active", s === n);
      li.classList.toggle("done", s < n);
    });
    $("#backBtn").disabled = n === 1;
    $("#nextBtn").hidden = n === 4;
    $("#confirmBtn").hidden = n !== 4;
    if (n === 3) renderMapTable();
    if (n === 4) runPreview();
  }
  function canLeave(n) {
    if (n === 1 && !state.selectedEvent) { toast(t("selectEventFirst"), "error"); return false; }
    if (n === 2 && (!state.csv || !state.csv.rows.length)) { toast(t("uploadFirst"), "error"); return false; }
    return true;
  }

  function boot() {
    applyLanguage("ar");
    $("#langToggle").addEventListener("click", () => applyLanguage(i18nState.lang === "ar" ? "en" : "ar"));
    document.addEventListener("languagechange", () => { if (state.step === 3) renderMapTable(); });
    initEventStep();
    initUploadStep();
    $("#nextBtn").addEventListener("click", () => { if (canLeave(state.step)) gotoStep(Math.min(4, state.step + 1)); });
    $("#backBtn").addEventListener("click", () => gotoStep(Math.max(1, state.step - 1)));
    $("#confirmBtn").addEventListener("click", runCommit);
    gotoStep(1);
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
