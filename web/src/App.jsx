import { useEffect } from "react";
import { MantineProvider, DirectionProvider, useDirection } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { theme } from "./theme";
import { useUiStore, dirFor } from "./stores/uiStore";
import { AppLayout } from "./components/AppLayout.jsx";
import { AppSpotlight } from "./components/AppSpotlight.jsx";
import { OverviewPage } from "./features/overview/OverviewPage.jsx";
import { ConsultationsPage } from "./features/consultations/ConsultationsPage.jsx";
import { EventsPage } from "./features/events/EventsPage.jsx";
import { IncubationPage } from "./features/incubation/IncubationPage.jsx";
import { TechAdoptionPage } from "./features/techAdoption/TechAdoptionPage.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    // The Express proxy already paces/retries against NocoDB's rate limit, so
    // the client should not pile on aggressive retries.
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

// Keep <html> lang/dir/color-scheme in sync with the store.
function HtmlSync({ lang, dir, colorScheme }) {
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("lang", lang);
    el.setAttribute("dir", dir);
    el.style.colorScheme = colorScheme;
  }, [lang, dir, colorScheme]);
  return null;
}

// Propagate direction changes into Mantine's DirectionProvider at runtime.
function DirSync({ dir }) {
  const { setDirection } = useDirection();
  useEffect(() => { setDirection(dir); }, [dir, setDirection]);
  return null;
}

export default function App() {
  const lang = useUiStore((s) => s.lang);
  const colorScheme = useUiStore((s) => s.colorScheme);
  const dir = dirFor(lang);

  return (
    <QueryClientProvider client={queryClient}>
      <DirectionProvider initialDirection={dir} detectDirection={false}>
        <MantineProvider theme={theme} forceColorScheme={colorScheme}>
          <HtmlSync lang={lang} dir={dir} colorScheme={colorScheme} />
          <DirSync dir={dir} />
          <Notifications position={dir === "rtl" ? "bottom-left" : "bottom-right"} />
          <BrowserRouter>
            <AppSpotlight />
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/overview" replace />} />
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/consultations" element={<ConsultationsPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/incubation" element={<IncubationPage />} />
                <Route path="/tech-adoption" element={<TechAdoptionPage />} />
                <Route path="*" element={<Navigate to="/overview" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </MantineProvider>
      </DirectionProvider>
    </QueryClientProvider>
  );
}
