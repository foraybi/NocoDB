import { create } from "zustand";

const initial = { user: null, form: {}, expert: null, submitted: false };

export const useConsultationsStore = create((set) => ({
  ...initial,
  setUser: (user) => set({ user }),
  setForm: (form) => set({ form }),
  setFormField: (key, value) => set((s) => ({ form: { ...s.form, [key]: value } })),
  setExpert: (expert) => set({ expert }),
  setSubmitted: (submitted) => set({ submitted }),
  reset: () => set({ ...initial }),
}));
