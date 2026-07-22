/* incubation.js — incubation applicants CSV import wizard.
 * Parses the Drupal webform export, builds normalized user/company rows,
 * previews via the backend, then commits. Approved rows get a start date.
 */
(function () {
  "use strict";
  const cfg = window.CONFIG;
  const IMP = cfg.incubationImport;

  const state = { step: 1, csv: null, normalized: [], plans: [], startDates: {} };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const show = (el) => el && el.classList.remove("hidden");
  const hide = (el) => el && el.classList.add("hidden");
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  let toastTimer;
  function toast(msg, kind = "info") {
    const el = $("#toast");
    el.textContent = msg; el.className = `toast ${kind}`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add("hidden"), 3500);
  }

  const base = cfg.API_BASE || "";
  async function apiPost(p, body) {
    const r = await fetch(base + p, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`POST ${p} -> ${r.status}`);
    return r.json();
  }

  // Build the normalized rows the backend expects.
  function buildNormalized(rawRows) {
    return rawRows.map((row) => {
      const user = CSVKit.mapFields(row, IMP.userFieldMap);
      const company = CSVKit.mapFields(row, IMP.companyFieldMap);
      const status = CSVKit.clean(row[IMP.statusColumn]);

      const userPairs = IMP.userMatchKeys
        .map((k) => [k.col, CSVKit.clean(row[k.csv])])
        .filter(([, v]) => v !== "");
      const companyPairs = IMP.companyMatchKeys
        .map((k) => [k.col, CSVKit.clean(row[k.csv])])
        .filter(([, v]) => v !== "");

      const hasIdentity = !!(user.full_name || user.en_full_name || userPairs.length);
      const companyName = company[IMP.companyDisplay.primary] || company[IMP.companyDisplay.secondary] || "";
      const userName = user.full_name || user.en_full_name || "";

      return {
        status,
        user, company,
        match: { user: userPairs, company: companyPairs },
        __hasIdentity: hasIdentity,
        _display: { user: userName, company: companyName },
      };
    });
  }

  // ---- Step 1: upload --------------------------------------------------------
  function initUpload() {
    $("#csvFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      $("#csvFileName").textContent = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          state.csv = CSVKit.parseCSV(reader.result);
          state.normalized = buildNormalized(state.csv.rows);
          $("#csvParseInfo").textContent = `${t("rowsParsed")} ${state.csv.rows.length}`;
        } catch (err) {
          console.error(err); state.csv = null;
          $("#csvParseInfo").innerHTML = `<span class="error-text">${t("csvParseError")}</span>`;
        }
      };
      reader.readAsText(file, "utf-8"); // UTF-8 for Arabic values
    });
  }

  // ---- Step 2: preview -------------------------------------------------------
  const todayISO = () => new Date().toISOString().slice(0, 10);

  async function runPreview() {
    $("#previewTotals").innerHTML = `<div class="muted">${t("previewing")}</div>`;
    $("#previewTableBody").innerHTML = "";
    hide($("#importReport"));
    try {
      const data = await apiPost("/api/incubation/preview", { rows: stripDisplay(state.normalized) });
      state.plans = data.rows;
      renderTotals(data.totals);
      renderTable(data.rows);
    } catch (err) {
      console.error(err);
      $("#previewTotals").innerHTML = `<div class="error-text">${t("genericError")}</div>`;
    }
  }

  function stripDisplay(rows) {
    return rows.map((r) => ({ status: r.status, user: r.user, company: r.company, match: r.match, __hasIdentity: r.__hasIdentity }));
  }

  function tile(label, value, kind) {
    return `<div class="tile ${kind}"><span class="tile-num">${value}</span><span class="tile-label">${escapeHtml(label)}</span></div>`;
  }
  function renderTotals(x) {
    $("#previewTotals").innerHTML =
      tile(t("tApproved"), x.approved, "good") +
      tile(t("tRegistered"), x.registered, "info") +
      tile(t("tSkipped"), x.skipped, "warn") +
      tile(t("tInvalid"), x.invalid, "bad");
  }

  function renderTable(rows) {
    const body = $("#previewTableBody");
    body.innerHTML = "";
    rows.forEach((p) => {
      const disp = state.normalized[p.index]._display;
      const tr = document.createElement("tr");
      const actionText = p.action === "user-company-incubation"
        ? `${p.userAction || ""} / ${p.companyAction || ""} + ${t("repIncubated")}`
        : (p.action === "user-company"
          ? `${p.userAction || ""} / ${p.companyAction || ""}`
          : escapeHtml(p.action));

      let dateCell = "";
      if (p.incubation) {
        state.startDates[p.index] = state.startDates[p.index] || todayISO();
        dateCell = `<input type="date" data-row="${p.index}" value="${state.startDates[p.index]}" class="inc-date" />`;
      } else {
        dateCell = `<span class="muted">—</span>`;
      }

      tr.innerHTML =
        `<td>${p.index + 1}</td>` +
        `<td>${escapeHtml(p.status || "")}</td>` +
        `<td>${escapeHtml(disp.user)}</td>` +
        `<td>${escapeHtml(disp.company)}</td>` +
        `<td>${actionText}</td>` +
        `<td>${dateCell}</td>`;
      if (p.action === "skip-rejected" || p.action === "invalid") tr.style.opacity = "0.55";
      body.appendChild(tr);
    });
    $$(".inc-date", body).forEach((inp) => {
      inp.addEventListener("change", () => { state.startDates[Number(inp.dataset.row)] = inp.value; });
    });
  }

  async function runCommit() {
    $("#confirmBtn").disabled = true;
    toast(t("importing"));
    try {
      const rows = stripDisplay(state.normalized).map((r, i) => {
        if (state.startDates[i]) r.startDate = state.startDates[i];
        return r;
      });
      const rep = await apiPost("/api/incubation/commit", { rows });
      const el = $("#importReport");
      el.innerHTML = `<div class="rv-section"><h3>${t("importDone")}</h3>
        <div class="rv-row"><span class="rv-key">${t("repUsers")}</span><span class="rv-val">${rep.createdUsers}</span></div>
        <div class="rv-row"><span class="rv-key">${t("repCompanies")}</span><span class="rv-val">${rep.createdCompanies}</span></div>
        <div class="rv-row"><span class="rv-key">${t("repLinked")}</span><span class="rv-val">${rep.linked}</span></div>
        <div class="rv-row"><span class="rv-key">${t("repIncubated")}</span><span class="rv-val">${rep.incubated}</span></div>
        <div class="rv-row"><span class="rv-key">${t("repSkipped")}</span><span class="rv-val">${rep.skipped}</span></div>
        <div class="rv-row"><span class="rv-key">${t("repInvalid")}</span><span class="rv-val">${rep.invalid}</span></div>
        <div class="rv-row"><span class="rv-key">${t("repFailed")}</span><span class="rv-val">${(rep.failed || []).length}</span></div></div>`;
      show(el);
      toast(t("importDone"), "success");
    } catch (err) { console.error(err); toast(t("submitError"), "error"); }
    finally { $("#confirmBtn").disabled = false; }
  }

  // ---- wizard nav ------------------------------------------------------------
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
    $("#nextBtn").hidden = n === 2;
    $("#confirmBtn").hidden = n !== 2;
    if (n === 2) runPreview();
  }
  function canLeave(n) {
    if (n === 1 && (!state.csv || !state.csv.rows.length)) { toast(t("uploadFirst"), "error"); return false; }
    return true;
  }

  function boot() {
    applyLanguage("ar");
    $("#langToggle").addEventListener("click", () => applyLanguage(i18nState.lang === "ar" ? "en" : "ar"));
    initUpload();
    $("#nextBtn").addEventListener("click", () => { if (canLeave(state.step)) gotoStep(2); });
    $("#backBtn").addEventListener("click", () => gotoStep(1));
    $("#confirmBtn").addEventListener("click", runCommit);
    gotoStep(1);
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
