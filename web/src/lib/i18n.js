/* i18n strings (Arabic + English). Phase 2 will merge in the full string set
 * from the legacy i18n.js; this seed covers the dashboard shell. */
export const STRINGS = {
  ar: {
    appName: "منصّة مركز الابتكار",
    overview: "الرئيسية",
    consultations: "الاستشارات",
    events: "الفعاليات",
    incubation: "الاحتضان",
    language: "English",
    theme: "المظهر",
    search: "بحث",
    commandHint: "الأوامر",
    overviewTitle: "لوحة التحكم",
    overviewLead: "اختر أداة من القائمة الجانبية للبدء.",
    goConsultations: "فتح الاستشارات",
    goEvents: "فتح الفعاليات",
    goIncubation: "فتح الاحتضان",
    comingSoon: "قيد الإنشاء ضمن اللوحة الجديدة.",
    shortcuts: "اختصارات لوحة المفاتيح",
    lightMode: "الوضع الفاتح",
    darkMode: "الوضع الداكن",
  },
  en: {
    appName: "Innovation Center Platform",
    overview: "Overview",
    consultations: "Consultations",
    events: "Events",
    incubation: "Incubation",
    language: "العربية",
    theme: "Theme",
    search: "Search",
    commandHint: "Commands",
    overviewTitle: "Dashboard",
    overviewLead: "Pick a tool from the sidebar to get started.",
    goConsultations: "Open Consultations",
    goEvents: "Open Events",
    goIncubation: "Open Incubation",
    comingSoon: "Being rebuilt in the new dashboard.",
    shortcuts: "Keyboard shortcuts",
    lightMode: "Light mode",
    darkMode: "Dark mode",
  },
};

export function translate(lang, key) {
  return (STRINGS[lang] && STRINGS[lang][key]) || (STRINGS.en && STRINGS.en[key]) || key;
}
