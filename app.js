/* app.js — flow controller, API client, and dynamic form rendering.
 *
 * Talks ONLY to your backend (CONFIG.API_BASE). See README for the contract.
 */
(function () {
  "use strict";

  const cfg = window.CONFIG;

  // ---- Application state -----------------------------------------------------
  const state = {
    step: 1,
    selectedUser: null,      // full user record chosen or created
    consultationData: {},    // values from the consultation form
    selectedExpert: null,    // full expert record chosen
  };

  // ---- Tiny DOM helpers ------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function show(el) { el && el.classList.remove("hidden"); }
  function hide(el) { el && el.classList.add("hidden"); }

  let toastTimer;
  function toast(msg, kind = "info") {
    const el = $("#toast");
    el.textContent = msg;
    el.className = `toast ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3500);
  }

  // ---- API client (calls YOUR backend) --------------------------------------
  const api = {
    base: cfg.API_BASE || "",
    async _get(path) {
      const res = await fetch(this.base + path, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
      return res.json();
    },
    async _post(path, body) {
      const res = await fetch(this.base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
      return res.json();
    },
    // GET /api/users?search=  -> { list: [record, ...] }
    searchUsers(q) { return this._get(`/api/users?search=${encodeURIComponent(q)}`); },
    // POST /api/users {fields} -> created record (with Id)
    createUser(fields) { return this._post(`/api/users`, fields); },
    // GET /api/experts?search= -> { list: [record, ...] }
    searchExperts(q) { return this._get(`/api/experts?search=${encodeURIComponent(q)}`); },
    // POST /api/consultations { fields, userId, expertId } -> created record
    createConsultation(payload) { return this._post(`/api/consultations`, payload); },
  };

  // record id helper — NocoDB primary key is usually "Id"
  const recId = (r) => r.Id ?? r.id ?? r.ID;

  // ---- Dynamic form rendering ------------------------------------------------
  function renderFields(container, fields, values = {}) {
    container.innerHTML = "";
    fields.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const label = document.createElement("label");
      label.textContent = fieldLabel(f) + (f.required ? " *" : "");
      label.setAttribute("for", `f_${f.key}`);

      let input;
      if (f.type === "textarea") {
        input = document.createElement("textarea");
        input.rows = 4;
      } else if (f.type === "select") {
        input = document.createElement("select");
        // blank first option so an optional select can be left unset
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = i18nState.lang === "ar" ? "— اختر —" : "— select —";
        input.appendChild(blank);
        (f.options || []).forEach((opt) => {
          const o = document.createElement("option");
          o.value = typeof opt === "object" ? opt.value : opt;
          o.textContent = typeof opt === "object" ? (fieldLabel(opt) || opt.value) : opt;
          input.appendChild(o);
        });
      } else {
        input = document.createElement("input");
        input.type = f.type || "text";
      }
      input.id = `f_${f.key}`;
      input.name = f.key;
      input.dataset.key = f.key;
      if (f.required) input.required = true;
      if (values[f.key] != null) input.value = values[f.key];

      const err = document.createElement("div");
      err.className = "field-error";

      wrap.append(label, input, err);
      container.appendChild(wrap);
    });
  }

  function collectFields(container) {
    const out = {};
    $$("[data-key]", container).forEach((input) => {
      const v = input.value.trim();
      if (v !== "") out[input.dataset.key] = v;
    });
    return out;
  }

  function validateFields(container, fields) {
    let ok = true;
    fields.forEach((f) => {
      const input = $(`#f_${CSS.escape(f.key)}`, container);
      const errEl = input && input.parentElement.querySelector(".field-error");
      if (!input) return;
      if (f.required && input.value.trim() === "") {
        ok = false;
        input.classList.add("invalid");
        if (errEl) errEl.textContent = t("required");
      } else {
        input.classList.remove("invalid");
        if (errEl) errEl.textContent = "";
      }
    });
    return ok;
  }

  // ---- Step 1: user search + create -----------------------------------------
  let userSearchTimer;
  function initUserSearch() {
    const input = $("#userSearch");
    input.addEventListener("input", () => {
      clearTimeout(userSearchTimer);
      const q = input.value.trim();
      if (q.length < 2) { $("#userResults").innerHTML = ""; hide($("#userSearchEmpty")); return; }
      userSearchTimer = setTimeout(() => runUserSearch(q), 300);
    });

    $("#createUserBtn").addEventListener("click", () => {
      hide($("#userSearchEmpty"));
      renderFields($("#createUserFields"), cfg.userProfile.createFields);
      show($("#createUserForm"));
    });
    $("#cancelCreateUser").addEventListener("click", () => hide($("#createUserForm")));

    $("#createUserForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const container = $("#createUserFields");
      if (!validateFields(container, cfg.userProfile.createFields)) return;
      const fields = collectFields(container);
      try {
        toast(t("submitting"));
        const created = await api.createUser(fields);
        const rec = created.record || created;
        selectUser(rec);
        toast(t("userCreated"), "success");
        hide($("#createUserForm"));
      } catch (err) {
        console.error(err);
        toast(t("submitError"), "error");
      }
    });

    $("#changeUser").addEventListener("click", () => {
      state.selectedUser = null;
      hide($("#selectedUserBanner"));
      $("#userSearch").value = "";
      $("#userResults").innerHTML = "";
      $("#userSearch").focus();
    });
  }

  async function runUserSearch(q) {
    const list = $("#userResults");
    list.innerHTML = `<div class="muted">${t("searching")}</div>`;
    try {
      const data = await api.searchUsers(q);
      const rows = data.list || [];
      list.innerHTML = "";
      if (rows.length === 0) { show($("#userSearchEmpty")); return; }
      hide($("#userSearchEmpty"));
      const d = cfg.userProfile.display;
      rows.forEach((r) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "result-card";
        card.innerHTML = `
          <span class="rc-primary">${escapeHtml(r[d.primary] ?? "")}</span>
          <span class="rc-secondary">${escapeHtml(r[d.secondary] ?? "")}</span>
          <span class="rc-tertiary">${escapeHtml(r[d.tertiary] ?? "")}</span>`;
        card.addEventListener("click", () => selectUser(r));
        list.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      list.innerHTML = `<div class="error-text">${t("genericError")}</div>`;
    }
  }

  function selectUser(rec) {
    state.selectedUser = rec;
    const d = cfg.userProfile.display;
    $("#selectedUserName").textContent = rec[d.primary] ?? `#${recId(rec)}`;
    show($("#selectedUserBanner"));
    $("#userResults").innerHTML = "";
    $("#userSearch").value = "";
  }

  // ---- Step 2: consultation form --------------------------------------------
  function initConsultationForm() {
    renderFields($("#consultationFields"), cfg.consultation.formFields, state.consultationData);
  }

  // ---- Step 3: expert search -------------------------------------------------
  let expertSearchTimer;
  function initExpertSearch() {
    const input = $("#expertSearch");
    input.addEventListener("input", () => {
      clearTimeout(expertSearchTimer);
      const q = input.value.trim();
      expertSearchTimer = setTimeout(() => runExpertSearch(q), 300);
    });
  }

  async function runExpertSearch(q) {
    const list = $("#expertResults");
    list.innerHTML = `<div class="muted">${t("loading")}</div>`;
    try {
      const data = await api.searchExperts(q);
      const rows = data.list || [];
      list.innerHTML = "";
      if (rows.length === 0) { list.innerHTML = `<div class="muted">${t("noExperts")}</div>`; return; }
      const d = cfg.expert.display;
      rows.forEach((r) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "result-card selectable";
        if (state.selectedExpert && recId(state.selectedExpert) === recId(r)) card.classList.add("selected");
        card.innerHTML = `
          <span class="rc-primary">${escapeHtml(r[d.primary] ?? "")}</span>
          <span class="rc-secondary">${escapeHtml(r[d.secondary] ?? "")}</span>`;
        card.addEventListener("click", () => {
          state.selectedExpert = r;
          $$(".result-card", list).forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
        });
        list.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      list.innerHTML = `<div class="error-text">${t("genericError")}</div>`;
    }
  }

  // ---- Step 4: review --------------------------------------------------------
  function renderReview() {
    const el = $("#reviewSummary");
    const ud = cfg.userProfile.display;
    const ed = cfg.expert.display;
    const rows = [];

    rows.push(section(t("reviewUser"), [
      [ud.primary, state.selectedUser?.[ud.primary]],
      [ud.secondary, state.selectedUser?.[ud.secondary]],
      [ud.tertiary, state.selectedUser?.[ud.tertiary]],
    ]));

    rows.push(section(t("reviewConsultation"),
      cfg.consultation.formFields.map((f) => [fieldLabel(f), state.consultationData[f.key]])));

    rows.push(section(t("reviewExpert"), [
      [ed.primary, state.selectedExpert?.[ed.primary]],
      [ed.secondary, state.selectedExpert?.[ed.secondary]],
    ]));

    el.innerHTML = rows.join("");

    function section(title, pairs) {
      const items = pairs
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `<div class="rv-row"><span class="rv-key">${escapeHtml(k)}</span><span class="rv-val">${escapeHtml(String(v))}</span></div>`)
        .join("");
      return `<div class="rv-section"><h3>${escapeHtml(title)}</h3>${items}</div>`;
    }
  }

  // ---- Wizard navigation -----------------------------------------------------
  function gotoStep(n) {
    state.step = n;
    $$(".step-panel").forEach((p) => hide(p));
    show($(`.step-panel[data-panel="${n}"]`));
    $$("#stepper li").forEach((li) => {
      const s = Number(li.dataset.step);
      li.classList.toggle("active", s === n);
      li.classList.toggle("done", s < n);
    });
    $("#backBtn").disabled = n === 1;
    const isLast = n === 4;
    $("#nextBtn").hidden = isLast;
    $("#submitBtn").hidden = !isLast;

    if (n === 2) initConsultationForm();
    if (n === 4) renderReview();
  }

  function canLeaveStep(n) {
    if (n === 1) {
      if (!state.selectedUser) { toast(t("selectUserFirst"), "error"); return false; }
    }
    if (n === 2) {
      const c = $("#consultationFields");
      if (!validateFields(c, cfg.consultation.formFields)) return false;
      state.consultationData = collectFields(c);
    }
    if (n === 3) {
      if (!state.selectedExpert) { toast(t("selectExpertFirst"), "error"); return false; }
    }
    return true;
  }

  async function submitAll() {
    try {
      $("#submitBtn").disabled = true;
      toast(t("submitting"));

      // merge auto-filled fields copied from the selected user profile
      const autoFill = {};
      const map = cfg.consultation.autoFillFromUser || {};
      Object.entries(map).forEach(([consultationKey, userKey]) => {
        const v = state.selectedUser?.[userKey];
        if (v != null && v !== "") autoFill[consultationKey] = v;
      });

      const payload = {
        fields: { ...state.consultationData, ...autoFill },
        userId: recId(state.selectedUser),
        expertId: recId(state.selectedExpert),
      };
      await api.createConsultation(payload);
      toast(t("submitSuccess"), "success");
      setTimeout(resetFlow, 1500);
    } catch (err) {
      console.error(err);
      toast(t("submitError"), "error");
    } finally {
      $("#submitBtn").disabled = false;
    }
  }

  function resetFlow() {
    state.selectedUser = null;
    state.consultationData = {};
    state.selectedExpert = null;
    hide($("#selectedUserBanner"));
    $("#userSearch").value = "";
    $("#userResults").innerHTML = "";
    $("#expertSearch").value = "";
    $("#expertResults").innerHTML = "";
    gotoStep(1);
  }

  // ---- utils -----------------------------------------------------------------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  // ---- boot ------------------------------------------------------------------
  function boot() {
    applyLanguage("ar");
    $("#langToggle").addEventListener("click", () => {
      applyLanguage(i18nState.lang === "ar" ? "en" : "ar");
    });
    // re-render dynamic labels when language changes
    document.addEventListener("languagechange", () => {
      if (state.step === 2) initConsultationForm();
      if (state.step === 4) renderReview();
    });

    initUserSearch();
    initExpertSearch();

    $("#nextBtn").addEventListener("click", () => {
      if (canLeaveStep(state.step)) gotoStep(Math.min(4, state.step + 1));
    });
    $("#backBtn").addEventListener("click", () => gotoStep(Math.max(1, state.step - 1)));
    $("#submitBtn").addEventListener("click", submitAll);

    gotoStep(1);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
