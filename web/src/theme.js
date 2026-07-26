import { createTheme } from "@mantine/core";

// Design-taste principles expressed as a Mantine theme:
// neutral base + ONE flat brand accent (desaturated Monshaat plum, no glows),
// premium sans (Geist / IBM Plex Sans Arabic), mono for numbers/IDs.
const brand = [
  "#f7eef8",
  "#e7d6ea",
  "#d0aad6",
  "#b97dc1",
  "#a557af",
  "#9942a3", // 5
  "#8a2f95", // 6 — primary
  "#75277f", // 7
  "#611f68", // 8
  "#4d1852", // 9
];

export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: { light: 6, dark: 5 },
  colors: { brand },
  white: "#ffffff",
  black: "#18181b", // zinc-950, never pure black
  defaultRadius: "md",
  fontFamily:
    '"Geist Variable", "IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", sans-serif',
  fontFamilyMonospace:
    '"Geist Mono Variable", ui-monospace, "JetBrains Mono", monospace',
  headings: {
    fontFamily:
      '"Geist Variable", "IBM Plex Sans Arabic", system-ui, sans-serif',
    fontWeight: "600",
  },
  components: {
    Button: { defaultProps: { fw: 600 } },
    Card: { defaultProps: { withBorder: true, shadow: "none", radius: "lg" } },
    Table: { defaultProps: { highlightOnHover: true, verticalSpacing: "sm" } },
  },
});
