import { create } from "zustand";
import { persist } from "zustand/middleware";
import { translate } from "../lib/i18n";

// Global UI state: language (drives RTL/LTR) + color scheme. Persisted so the
// user's choice survives reloads.
export const useUiStore = create(
  persist(
    (set, get) => ({
      lang: "ar",
      colorScheme: "light",
      navCollapsed: false, // desktop sidebar collapsed?
      previewGroups: { user: true, company: true, incubation: true }, // incubation preview column groups
      toggleLang: () => set((s) => ({ lang: s.lang === "ar" ? "en" : "ar" })),
      setLang: (lang) => set({ lang }),
      toggleColorScheme: () =>
        set((s) => ({ colorScheme: s.colorScheme === "light" ? "dark" : "light" })),
      toggleNav: () => set((s) => ({ navCollapsed: !s.navCollapsed })),
      setPreviewGroups: (previewGroups) => set({ previewGroups }),
      t: (key) => translate(get().lang, key),
    }),
    {
      name: "monshaat-ui",
      partialize: (s) => ({ lang: s.lang, colorScheme: s.colorScheme, navCollapsed: s.navCollapsed, previewGroups: s.previewGroups }),
    }
  )
);

// Direction derives from language.
export const dirFor = (lang) => (lang === "ar" ? "rtl" : "ltr");
