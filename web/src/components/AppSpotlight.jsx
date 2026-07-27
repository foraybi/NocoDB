import { useEffect } from "react";
import { Spotlight } from "@mantine/spotlight";
import { IconLanguage, IconContrast, IconSearch } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "../stores/uiStore";
import { NAV } from "./nav";

// "g then c/e/i/o" sequence shortcuts for switching tools (skipped while typing).
function useNavSequence(navigate) {
  useEffect(() => {
    let armed = false, timer;
    const onKey = (e) => {
      const el = e.target;
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!armed && e.key.toLowerCase() === "g") {
        armed = true; clearTimeout(timer); timer = setTimeout(() => (armed = false), 800); return;
      }
      if (armed) {
        armed = false; clearTimeout(timer);
        const map = { o: "/overview", c: "/consultations", e: "/events", i: "/incubation", t: "/tech-adoption", v: "/vouchers" };
        const path = map[e.key.toLowerCase()];
        if (path) { e.preventDefault(); navigate(path); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(timer); };
  }, [navigate]);
}

export function AppSpotlight() {
  const navigate = useNavigate();
  const t = useUiStore((s) => s.t);
  const toggleLang = useUiStore((s) => s.toggleLang);
  const toggleColorScheme = useUiStore((s) => s.toggleColorScheme);
  useNavSequence(navigate);

  const actions = [
    ...NAV.map((n) => {
      const Icon = n.icon;
      return { id: n.key, label: t(n.labelKey), leftSection: <Icon size={18} stroke={1.6} />, onClick: () => navigate(n.path) };
    }),
    { id: "toggle-lang", label: t("language"), leftSection: <IconLanguage size={18} stroke={1.6} />, onClick: toggleLang },
    { id: "toggle-theme", label: t("theme"), leftSection: <IconContrast size={18} stroke={1.6} />, onClick: toggleColorScheme },
  ];

  return (
    <Spotlight
      actions={actions}
      shortcut="mod + K"
      nothingFound={t("search")}
      highlightQuery
      searchProps={{ leftSection: <IconSearch size={18} stroke={1.6} />, placeholder: t("search") }}
    />
  );
}
