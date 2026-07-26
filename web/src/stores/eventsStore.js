import { create } from "zustand";
import { CONFIG } from "../lib/config.js";
import { autoMap, normalizeRow } from "../lib/csv.js";

const AI = CONFIG.attendeeImport;
const initial = { event: null, fileName: "", headers: [], rows: [], mapping: {}, normalized: [], report: null };

export const useEventsStore = create((set, get) => ({
  ...initial,
  setEvent: (event) => set({ event }),
  setParsed: ({ headers, rows, fileName }) =>
    set({ headers, rows, fileName, mapping: autoMap(headers, AI.headerMap) }),
  setMapping: (header, key) => set((s) => ({ mapping: { ...s.mapping, [header]: key } })),
  buildNormalized: () => {
    const { rows, mapping } = get();
    const normalized = rows.map((r) => normalizeRow(r, mapping, AI));
    set({ normalized });
    return normalized;
  },
  setReport: (report) => set({ report }),
  reset: () => set({ ...initial }),
}));
