import {
  IconLayoutDashboard,
  IconMessageCircle2,
  IconCalendarEvent,
  IconBuildingSkyscraper,
  IconRocket,
} from "@tabler/icons-react";

// Single source of truth for navigation — used by the sidebar AND the command
// palette so they never drift.
export const NAV = [
  { key: "overview", path: "/overview", labelKey: "overview", icon: IconLayoutDashboard, shortcut: "g o" },
  { key: "consultations", path: "/consultations", labelKey: "consultations", icon: IconMessageCircle2, shortcut: "g c" },
  { key: "events", path: "/events", labelKey: "events", icon: IconCalendarEvent, shortcut: "g e" },
  { key: "incubation", path: "/incubation", labelKey: "incubation", icon: IconBuildingSkyscraper, shortcut: "g i" },
  { key: "techAdoption", path: "/tech-adoption", labelKey: "techAdoption", icon: IconRocket, shortcut: "g t" },
];
