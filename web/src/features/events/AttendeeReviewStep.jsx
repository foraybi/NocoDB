import { useEffect, useRef } from "react";
import { Card, Group, Text, Button, Stack, SimpleGrid, Skeleton, Alert, Divider } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { IconArrowLeft, IconUpload, IconCircleCheck, IconAlertTriangle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { apiPost } from "../../api/client.js";
import { useUiStore } from "../../stores/uiStore";
import { useEventsStore } from "../../stores/eventsStore";

const recId = (r) => r && (r.Id ?? r.id ?? r.ID);

export function AttendeeReviewStep({ onBack }) {
  const t = useUiStore((s) => s.t);
  const { event, normalized, report, buildNormalized, setReport } = useEventsStore();
  const started = useRef(false);

  const preview = useMutation({
    mutationFn: (rows) => apiPost("/api/attendees/preview", { eventId: recId(event), rows }),
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });
  const commit = useMutation({
    mutationFn: (rows) => apiPost("/api/attendees/commit", { eventId: recId(event), rows }),
    onSuccess: (rep) => { setReport(rep); notifications.show({ color: "green", message: t("importDone") }); },
    onError: () => notifications.show({ color: "red", message: t("importError") }),
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    preview.mutate(buildNormalized());
  }, []); // eslint-disable-line

  if (preview.isPending || !preview.data) {
    return <Stack>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={40} />)}</Stack>;
  }

  const { totals, rows } = preview.data;
  const issues = rows.filter((r) => r.action === "invalid" || r.action === "skip-duplicate");

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Tile label={t("tCreateUsers")} value={totals.create} color="brand" />
        <Tile label={t("tLinkExisting")} value={totals.link} color="blue" />
        <Tile label={t("tDuplicate")} value={totals.skipDuplicate} color="orange" />
        <Tile label={t("tInvalid")} value={totals.invalid} color="red" />
      </SimpleGrid>

      {issues.length > 0 && (
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
          <Stack gap={2}>
            {issues.slice(0, 50).map((r) => (
              <Text key={r.index} size="xs">#{r.index + 1} — {r.action}: {(r.messages || []).join("; ")}</Text>
            ))}
          </Stack>
        </Alert>
      )}

      <Group justify="space-between">
        <Button variant="default" leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={onBack}>{t("back")}</Button>
        <Button leftSection={<IconUpload size={16} stroke={1.8} />} loading={commit.isPending} onClick={() => commit.mutate(normalized)}>
          {t("confirmImport")}
        </Button>
      </Group>

      {report && (
        <Card padding="lg">
          <Group gap="xs" mb="sm"><IconCircleCheck size={20} color="var(--mantine-color-teal-6)" /><Text fw={600}>{t("importDone")}</Text></Group>
          <Divider mb="sm" />
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Stat k={t("repUsers")} v={report.createdUsers} />
            <Stat k={t("repLinked")} v={report.linked} />
            <Stat k={t("repSkipped")} v={report.skippedDuplicates} />
            <Stat k={t("repInvalid")} v={report.invalid} />
            <Stat k={t("repFailed")} v={(report.failed || []).length} />
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}

function Tile({ label, value, color }) {
  return (
    <Card padding="md">
      <Text className="mono" fw={800} fz={26} c={`${color}.6`}>{value}</Text>
      <Text size="xs" c="dimmed">{label}</Text>
    </Card>
  );
}
function Stat({ k, v }) {
  return <Group justify="space-between" gap="xs"><Text size="sm" c="dimmed">{k}</Text><Text className="mono" fw={600}>{v}</Text></Group>;
}
