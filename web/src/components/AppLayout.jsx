import { AppShell, Group, Text, NavLink, ActionIcon, Tooltip, Kbd, Box, ScrollArea, Burger } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { spotlight } from "@mantine/spotlight";
import { IconSun, IconMoon, IconLanguage, IconSearch } from "@tabler/icons-react";
import { NavLink as RouterNavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUiStore } from "../stores/uiStore";
import { NAV } from "./nav";

export function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false);
  const lang = useUiStore((s) => s.lang);
  const colorScheme = useUiStore((s) => s.colorScheme);
  const navCollapsed = useUiStore((s) => s.navCollapsed);
  const toggleNav = useUiStore((s) => s.toggleNav);
  const toggleLang = useUiStore((s) => s.toggleLang);
  const toggleColorScheme = useUiStore((s) => s.toggleColorScheme);
  const t = useUiStore((s) => s.t);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 264, breakpoint: "sm", collapsed: { mobile: !mobileOpened, desktop: navCollapsed } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            {/* mobile: open/close drawer; desktop: collapse/expand sidebar */}
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" aria-label={t("toggleNav")} />
            <Burger opened={!navCollapsed} onClick={toggleNav} visibleFrom="sm" size="sm" aria-label={t("toggleNav")} />
            <Text fw={800} size="lg" c="brand.6">مُنشآت</Text>
            <Text fw={600} size="sm" c="dimmed" visibleFrom="xs">{t("appName")}</Text>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <Tooltip label={`${t("commandHint")} (Ctrl+K)`}>
              <ActionIcon variant="default" size="lg" aria-label={t("commandHint")} onClick={spotlight.open}>
                <IconSearch size={18} stroke={1.6} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("language")}>
              <ActionIcon variant="default" size="lg" aria-label={t("language")} onClick={toggleLang}>
                <IconLanguage size={18} stroke={1.6} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={colorScheme === "dark" ? t("lightMode") : t("darkMode")}>
              <ActionIcon variant="default" size="lg" aria-label={t("theme")} onClick={toggleColorScheme}>
                {colorScheme === "dark" ? <IconSun size={18} stroke={1.6} /> : <IconMoon size={18} stroke={1.6} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <ScrollArea style={{ height: "100%" }}>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.key}
                component={RouterNavLink}
                to={item.path}
                label={t(item.labelKey)}
                leftSection={<Icon size={19} stroke={1.6} />}
                rightSection={<Kbd size="xs">{item.shortcut}</Kbd>}
                active={active}
                variant="light"
                onClick={() => mobileOpened && toggleMobile()}
                mb={4}
              />
            );
          })}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box maw={1400} mx="auto">
          <Outlet context={{ navigate }} />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
