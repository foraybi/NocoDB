import { SimpleGrid, Card, Group, ThemeIcon, Text, Button, Stack } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader.jsx";
import { useUiStore } from "../../stores/uiStore";
import { NAV } from "../../components/nav";

export function OverviewPage() {
  const t = useUiStore((s) => s.t);
  const navigate = useNavigate();
  const tools = NAV.filter((n) => n.key !== "overview");
  const goLabel = { consultations: "goConsultations", events: "goEvents", incubation: "goIncubation", techAdoption: "goTechAdoption", vouchers: "goVouchers" };

  return (
    <>
      <PageHeader title={t("overviewTitle")} subtitle={t("overviewLead")} />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card key={tool.key} padding="xl">
              <Stack gap="md">
                <Group justify="space-between">
                  <ThemeIcon size={44} radius="md" variant="light">
                    <Icon size={24} stroke={1.6} />
                  </ThemeIcon>
                </Group>
                <div>
                  <Text fw={600} size="lg">{t(tool.labelKey)}</Text>
                  <Text c="dimmed" size="sm" mt={4}>{t("comingSoon")}</Text>
                </div>
                <Button
                  variant="light"
                  rightSection={<IconArrowRight size={16} stroke={1.8} />}
                  onClick={() => navigate(tool.path)}
                >
                  {t(goLabel[tool.key])}
                </Button>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </>
  );
}
