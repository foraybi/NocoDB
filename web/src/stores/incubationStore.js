import { create } from "zustand";
import { CONFIG } from "../lib/config.js";
import { buildRows } from "../lib/incubationBuild.js";
import { validateRows, validateRow } from "../lib/validate.js";
import { isSelectable } from "../lib/incubationStatus.js";

const IMP = CONFIG.incubationImport;
const todayISO = () => new Date().toISOString().slice(0, 10);

const initial = {
  fileName: "", fileType: "csv", headers: [], rawRows: [],
  normalized: [], issues: [], plans: [],
  selected: new Set(), startDates: {}, search: "", page: 0, report: null,
};

export const useIncubationStore = create((set, get) => ({
  ...initial,

  loadParsed: ({ headers, rows, fileType, fileName }) => {
    const normalized = buildRows(rows, IMP, todayISO());
    normalized.forEach((r) => { r._origStatus = r.status; });
    const issues = validateRows(normalized, IMP.validate);
    set({ ...initial, headers, rawRows: rows, fileType, fileName, normalized, issues, selected: new Set() });
  },

  // Store backend preview plans and default-select every selectable row.
  setPlans: (plans) => {
    const { normalized } = get();
    const selected = new Set();
    plans.forEach((p) => { if (isSelectable(normalized, p, IMP)) selected.add(p.index); });
    set({ plans, selected });
  },

  setSearch: (search) => set({ search, page: 0 }),
  setPage: (page) => set({ page }),
  setStartDate: (index, date) => set((s) => ({ startDates: { ...s.startDates, [index]: date } })),

  toggleRow: (index, on) => set((s) => {
    const sel = new Set(s.selected);
    if (on) sel.add(index); else sel.delete(index);
    return { selected: sel };
  }),
  setSelectedBulk: (indices, on) => set((s) => {
    const sel = new Set(s.selected);
    indices.forEach((i) => (on ? sel.add(i) : sel.delete(i)));
    return { selected: sel };
  }),

  setStatus: (index, value) => set((s) => {
    const normalized = s.normalized.slice();
    normalized[index] = { ...normalized[index], status: value };
    const sel = new Set(s.selected);
    const p = s.plans.find((x) => x.index === index);
    if (p && isSelectable(normalized, p, IMP)) sel.add(index); else sel.delete(index);
    return { normalized, selected: sel };
  }),

  fixField: (index, key, field, value) => set((s) => {
    const normalized = s.normalized.slice();
    const row = { ...normalized[index], [key]: { ...normalized[index][key] } };
    if (value === "") delete row[key][field]; else row[key][field] = value;
    normalized[index] = row;
    const issues = s.issues.filter((i) => i.row !== index).concat(validateRow(row, IMP.validate, index));
    return { normalized, issues };
  }),

  setReport: (report) => set({ report }),
  reset: () => set({ ...initial, selected: new Set() }),
}));
