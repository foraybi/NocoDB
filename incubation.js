/* incubation.js — incubation applicants CSV import wizard.
 * Parses the Drupal webform export, builds normalized user/company rows,
 * previews via the backend, then commits. Approved rows get a start date.
 */
(function () {
  "use strict";
  const cfg = window.CONFIG;
  const IMP = cfg.incubationImport;

  const state = { step: 1, csv: null, normalized: [], plans: [], startDates: {}, issues: [], page: 0 };
  const PAGE_SIZE = 10;
  const todayISO = () => new Date().toISOString().slice(0, 10);

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

  // Build the normalized rows (three insert payloads) via the shared builder.
  const buildNormalized = (rawRows, today) => window.IncubationBuild.buildRows(rawRows, IMP, today);

  // ---- Step 1: upload (CSV or XLSX) -----------------------------------------
  function initUpload() {
    $("#csvFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      $("#csvFileName").textContent = file.name;
      const isExcel = /\.xlsx?$/i.test(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const rows = isExcel ? parseXlsx(reader.result) : CSVKit.parseCSV(reader.result).rows;
          state.csv = { rows };
          state.page = 0; // new file -> back to the first page
          state.normalized = buildNormalized(rows, todayISO());
          state.normalized.forEach((r) => { r._origStatus = r.status; }); // status editability
          // Local validation BEFORE any NocoDB call: auto-corrects safe values,
          // drops unusable ones, and reports what needs the user's attention.
          state.issues = ImportValidate.validateRows(state.normalized, IMP.validate);
          const adjusted = state.issues.filter((i) => i.action === "adjusted").length;
          const dropped = state.issues.filter((i) => i.action === "dropped").length;
          $("#csvParseInfo").innerHTML =
            `${t("rowsParsed")} ${rows.length}` +
            (state.issues.length ? ` — <strong>${adjusted}</strong> ${t("fieldsAdjusted")}, <strong>${dropped}</strong> ${t("fieldsDropped")}` : "");
        } catch (err) {
          console.error(err); state.csv = null;
          $("#csvParseInfo").innerHTML = `<span class="error-text">${t("csvParseError")}</span>`;
        }
      };
      if (isExcel) reader.readAsArrayBuffer(file);
      else reader.readAsText(file, "utf-8"); // UTF-8 for Arabic values
    });
  }

  // Parse the first sheet of an xlsx/xls into header-keyed row objects (strings).
  function parseXlsx(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  }

  // ---- Step 2: preview -------------------------------------------------------
  async function runPreview() {
    $("#previewTotals").innerHTML = `<div class="muted">${t("previewing")}</div>`;
    $("#previewArea").innerHTML = "";
    hide($("#importReport"));
    try {
      const data = await apiPost("/api/incubation/preview", { rows: payloadRows(state.normalized) });
      state.plans = data.rows;
      renderTotals(data.totals);
      renderPreviewTable(data.rows);
    } catch (err) {
      console.error(err);
      $("#previewTotals").innerHTML = `<div class="error-text">${t("genericError")}</div>`;
    }
  }

  // rows sent to the backend (drop nothing extra; incubation + match travel with them).
  function payloadRows(rows) {
    return rows.map((r) => ({ status: r.status, user: r.user, company: r.company, incubation: r.incubation, match: r.match, __hasIdentity: r.__hasIdentity }));
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

  // Column groups: which fields go to which table (union of keys across rows).
  function collectCols(rows, pick) {
    const set = new Set();
    rows.forEach((p) => Object.keys(pick(state.normalized[p.index]) || {}).forEach((k) => set.add(k)));
    return Array.from(set);
  }
  const truncate = (s, n = 60) => (s.length > n ? s.slice(0, n) + "…" : s);

  // Effective status -> what happens. Status may be edited in the preview.
  const NORM = (s) => String(s == null ? "" : s).trim().toLowerCase();
  function effect(status) {
    const s = NORM(status), S = IMP.status;
    if (s === NORM(S.approved)) return { processed: true, incubate: true };
    if (s === NORM(S.registered)) return { processed: true, incubate: false };
    return { processed: false, incubate: false };
  }

  // Full "table view": columns are  # | status | action | incubation date | <fields...>
  // Rows are paginated (PAGE_SIZE per page); columns are derived from ALL rows
  // so the layout stays stable as you page through.
  function renderPreviewTable(plans) {
    const F = IMP.fields;
    const userCols = collectCols(plans, (r) => r.user);
    const companyCols = collectCols(plans, (r) => r.company);
    if (!companyCols.includes(F.companyUserId)) companyCols.push(F.companyUserId); // server-side (auto)
    const incCols = collectCols(plans, (r) => r.incubation);

    const pageCount = Math.max(1, Math.ceil(plans.length / PAGE_SIZE));
    if (state.page > pageCount - 1) state.page = pageCount - 1;
    if (state.page < 0) state.page = 0;
    const start = state.page * PAGE_SIZE;
    const pagePlans = plans.slice(start, start + PAGE_SIZE);

    const groupHead =
      `<tr class="grp">` +
      `<th colspan="4" class="grp-meta">—</th>` +
      `<th colspan="${userCols.length}" class="grp-user">user_profile</th>` +
      `<th colspan="${companyCols.length}" class="grp-company">company_profile</th>` +
      `<th colspan="${incCols.length}" class="grp-inc">incubated_startups</th>` +
      `</tr>`;
    const fieldHead =
      `<tr>` +
      `<th>#</th><th>${t("colStatus")}</th><th>${t("colAction")}</th><th>${t("startDateLabel")}</th>` +
      userCols.map((c) => `<th>${escapeHtml(c)}</th>`).join("") +
      companyCols.map((c) => `<th>${escapeHtml(c)}</th>`).join("") +
      incCols.map((c) => `<th>${escapeHtml(c)}</th>`).join("") +
      `</tr>`;

    // issue lookup: rowIndex -> payloadKey -> field
    const issueAt = (rowIdx, key, field) =>
      state.issues.find((i) => i.row === rowIdx && i.key === key && i.field === field);

    // A flagged field renders as an editable input so the user can adjust it.
    const cell = (obj, col, auto, rowIdx, key) => {
      if (col === F.companyUserId && auto) return `<td class="auto">(auto)</td>`;
      const iss = issueAt(rowIdx, key, col);
      const v = obj && obj[col] != null ? String(obj[col]) : "";
      if (iss) {
        const tip = `${iss.action}: ${iss.reason}\noriginal: ${iss.raw}`;
        return `<td class="issue ${iss.action}"><input class="fix-input" data-row="${rowIdx}" data-key="${escapeHtml(key)}" ` +
          `data-field="${escapeHtml(col)}" value="${escapeHtml(v)}" title="${escapeHtml(tip)}" /></td>`;
      }
      return `<td title="${escapeHtml(v)}">${escapeHtml(truncate(v))}</td>`;
    };

    const statusValues = [IMP.status.approved, IMP.status.registered, "rejected"];
    function statusControl(p) {
      const n = state.normalized[p.index];
      // editable only when the ORIGINAL status is "registered"
      if (NORM(n._origStatus) !== NORM(IMP.status.registered)) {
        return `<td>${escapeHtml(n.status || "")}</td>`;
      }
      const opts = statusValues.map((v) =>
        `<option value="${escapeHtml(v)}"${NORM(v) === NORM(n.status) ? " selected" : ""}>${escapeHtml(v)}</option>`).join("");
      return `<td><select class="status-sel" data-row="${p.index}">${opts}</select></td>`;
    }

    const rowsHtml = pagePlans.map((p) => {
      const n = state.normalized[p.index];
      const eff = effect(n.status);
      const invalid = p.action === "invalid";
      const actionText = invalid ? "invalid"
        : (eff.processed
          ? (eff.incubate ? `${p.userAction}/${p.companyAction}+inc` : `${p.userAction}/${p.companyAction}`)
          : "skip");

      let dateCell = `<td class="auto">—</td>`;
      if (eff.incubate && !invalid) {
        state.startDates[p.index] = state.startDates[p.index] || todayISO();
        dateCell = `<td><input type="date" data-row="${p.index}" value="${state.startDates[p.index]}" class="inc-date" /></td>`;
      }

      const active = eff.processed && !invalid;
      const uCells = userCols.map((c) => active ? cell(n.user, c, false, p.index, "user") : `<td></td>`).join("");
      const cCells = companyCols.map((c) => active ? cell(n.company, c, c === F.companyUserId, p.index, "company") : `<td></td>`).join("");
      const iCells = incCols.map((c) => (eff.incubate && !invalid) ? cell(n.incubation, c, false, p.index, "incubation") : `<td></td>`).join("");

      return `<tr class="${active ? "" : "skip"}">` +
        `<td>${p.index + 1}</td>` + statusControl(p) + `<td>${escapeHtml(actionText)}</td>` + dateCell +
        uCells + cCells + iCells + `</tr>`;
    }).join("");

    const area = $("#previewArea");
    const pager = renderPager(plans.length, pageCount, start, pagePlans.length);
    area.innerHTML = issuesPanel() + pager +
      `<div class="table-scroll"><table class="grid-table"><thead>${groupHead}${fieldHead}</thead><tbody>${rowsHtml}</tbody></table></div>` +
      pager;

    $$(".pg-btn", area).forEach((b) =>
      b.addEventListener("click", () => {
        const to = b.dataset.go;
        if (to === "prev") state.page--;
        else if (to === "next") state.page++;
        else state.page = Number(to);
        renderPreviewTable(state.plans);
        area.scrollIntoView({ block: "nearest" });
      }));

    $$(".inc-date", area).forEach((inp) =>
      inp.addEventListener("change", () => { state.startDates[Number(inp.dataset.row)] = inp.value; }));

    // Editing a flagged field updates the payload and clears/keeps the flag.
    $$(".fix-input", area).forEach((inp) =>
      inp.addEventListener("change", () => {
        const idx = Number(inp.dataset.row), key = inp.dataset.key, field = inp.dataset.field;
        const v = inp.value.trim();
        if (v === "") delete state.normalized[idx][key][field];
        else state.normalized[idx][key][field] = v;
        // re-validate just this row, replacing its issues
        state.issues = state.issues.filter((i) => i.row !== idx);
        state.issues = state.issues.concat(
          ImportValidate.validateRow(state.normalized[idx], IMP.validate, idx));
        renderPreviewTable(state.plans);
      }));
    $$(".status-sel", area).forEach((sel) =>
      sel.addEventListener("change", () => {
        state.normalized[Number(sel.dataset.row)].status = sel.value;
        renderTotals(recomputeTotals());
        renderPreviewTable(state.plans); // re-render to reflect new action/date/fields
      }));
  }

  // Pager: ‹ prev | 1 2 3 … | next ›  + "showing a–b of N"
  function renderPager(total, pageCount, start, shown) {
    if (total === 0) return "";
    const cur = state.page;
    // window of page numbers around the current page
    const nums = [];
    const from = Math.max(0, Math.min(cur - 2, pageCount - 5));
    const to = Math.min(pageCount, Math.max(5, cur + 3));
    for (let i = from; i < to; i++) nums.push(i);

    const btn = (go, label, disabled, active) =>
      `<button class="pg-btn${active ? " active" : ""}" data-go="${go}"${disabled ? " disabled" : ""}>${label}</button>`;

    return `<div class="pager">` +
      btn("prev", "‹ " + escapeHtml(t("pagerPrev")), cur === 0) +
      nums.map((i) => btn(String(i), String(i + 1), false, i === cur)).join("") +
      btn("next", escapeHtml(t("pagerNext")) + " ›", cur >= pageCount - 1) +
      `<span class="muted pg-info">${escapeHtml(t("showing"))} ${start + 1}–${start + shown} ` +
      `${escapeHtml(t("of"))} ${total} · ${escapeHtml(t("page"))} ${cur + 1}/${pageCount}</span>` +
      `</div>`;
  }

  // Summary of everything local validation changed/dropped, grouped by field.
  function issuesPanel() {
    if (!state.issues.length) {
      return `<div class="issues-panel ok">${escapeHtml(t("noIssues"))}</div>`;
    }
    const byField = {};
    state.issues.forEach((i) => {
      const k = `${i.table}.${i.field}|${i.action}|${i.reason || ""}`;
      (byField[k] = byField[k] || { ...i, count: 0, sample: i.raw }).count++;
    });
    const items = Object.values(byField)
      .sort((a, b) => b.count - a.count)
      .map((i) =>
        `<li><span class="badge ${i.action}">${escapeHtml(i.action)}</span> ` +
        `<code>${escapeHtml(i.table)}.${escapeHtml(i.field)}</code> — ${escapeHtml(i.reason || "")} ` +
        `<span class="muted">(${i.count}× e.g. "${escapeHtml(truncate(i.sample, 30))}")</span></li>`)
      .join("");
    return `<div class="issues-panel"><strong>${escapeHtml(t("needsAdjust"))}</strong>` +
      `<ul>${items}</ul><div class="muted">${escapeHtml(t("issuesHint"))}</div></div>`;
  }

  // Recompute the totals tiles from the (possibly edited) effective statuses.
  function recomputeTotals() {
    const totals = { approved: 0, registered: 0, skipped: 0, invalid: 0 };
    state.plans.forEach((p) => {
      if (p.action === "invalid") { totals.invalid++; return; }
      const eff = effect(state.normalized[p.index].status);
      if (eff.incubate) totals.approved++;
      else if (eff.processed) totals.registered++;
      else totals.skipped++;
    });
    return totals;
  }

  async function runCommit() {
    $("#confirmBtn").disabled = true;
    toast(t("importing"));
    try {
      const rows = payloadRows(state.normalized).map((r, i) => {
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
