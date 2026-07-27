import { useMemo, useState } from "react";
import { Card, Group, Text, Button, Stack, ThemeIcon, Badge, Table, Pagination, SimpleGrid } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconFileSpreadsheet, IconUpload, IconX, IconArrowRight, IconArrowLeft, IconCircleCheck } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useUiStore } from "../../stores/uiStore";
import { CONFIG } from "../../lib/config.js";
import { readImportFile } from "../../lib/importExport.js";
import { buildRows } from "../../lib/techAdoptionBuild.js";
import { apiPost } from "../../api/client.js";

const TA = CONFIG.techAdoption;
const PAGE = 10;

export function BulkImport() {
  const t = useUiStore((s) => s.t);
  const lang = useUiStore((s) => s.lang);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);      // built payload rows
  const [preview, setPreview] = useState(null); // { totals, rows:[plan] }
  const [report, setReport] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const previewMut = useMutation({
    mutationFn: (built) => apiPost("/api/tech-adoption/preview", { rows: built }),
    onSuccess: (data) => setPreview(data),
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });
  const commitMut = useMutation({
    mutationFn: () => apiPost("/api/tech-adoption/commit", { rows }),
    onSuccess: (data) => { setReport(data); notifications.show({ color: "green", message: t("importDone") }); },
    onError: () => notifications.show({ color: "red", message: t("importError") }),
  });

  const handleDrop = async (files) => {
    setError(""); setPreview(null); setReport(null); setPage(1);
    try {
      const parsed = await readImportFile(files[0]);
      const built = buildRows(parsed.rawRows, TA);
      setFileName(files[0].name);
      setRows(built);
      previewMut.mutate(built);
    } catch (e) {
      console.error(e);
      setError(t("csvParseError"));
    }
  };

  const reset = () => { setFileName(""); setRows([]); setPreview(null); setReport(null); setPage(1); setError(""); };

  if (report) {
    const tiles = [
      { label: t("repSessions"), value: report.created, color: "teal" },
      { label: t("taNoCompanyRows"), value: report.skipped, color: "gray" },
      { label: t("repFailed"), value: report.failed?.length || 0, color: "red" },
    ];
    return (
      <Card padding="xl">
        <Stack gap="lg">
          <Group gap="sm"><IconCircleCheck size={28} color="var(--mantine-color-teal-6)" /><Text fw={600} size="lg">{t("importDone")}</Text></Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            {tiles.map((tile) => (
              <div key={tile.label}>
                <Text ff="monospace" fw={700} fz={28} c={tile.color}>{tile.value}</Text>
                <Text size="sm" c="dimmed">{tile.label}</Text>
              </div>
            ))}
          </SimpleGrid>
          <Group><Button variant="light" onClick={reset}>{t("taBulk")}</Button></Group>
        </Stack>
      </Card>
    );
  }

  const plans = preview?.rows || [];
  const pageRows = plans.slice((page - 1) * PAGE, page * PAGE);
  const totalPages = Math.ceil(plans.length / PAGE) || 1;

  return (
    <Stack gap="lg">
      <Card padding="xl">
        <Dropzone
          onDrop={handleDrop}
          accept={["text/csv", ".csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx", ".xls"]}
          maxFiles={1} multiple={false} loading={previewMut.isPending}
        >
          <Group justify="center" gap="xl" mih={160} style={{ pointerEvents: "none" }}>
            <Dropzone.Accept><ThemeIcon size={56} radius="xl" variant="light"><IconUpload size={30} stroke={1.5} /></ThemeIcon></Dropzone.Accept>
            <Dropzone.Reject><ThemeIcon size={56} radius="xl" color="red" variant="light"><IconX size={30} stroke={1.5} /></ThemeIcon></Dropzone.Reject>
            <Dropzone.Idle><ThemeIcon size={56} radius="xl" variant="light"><IconFileSpreadsheet size={30} stroke={1.5} /></ThemeIcon></Dropzone.Idle>
            <div>
              <Text size="lg" fw={600}>{t("dropFile")}</Text>
              <Text size="sm" c="dimmed" mt={6}>{t("taBulkHint")}</Text>
            </div>
          </Group>
        </Dropzone>
      </Card>

      {error && <Text c="red" size="sm">{error}</Text>}

      {preview && (
        <Card padding="lg">
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <Group gap="sm">
                <IconFileSpreadsheet size={20} stroke={1.6} />
                <Text fw={600}>{fileName}</Text>
                <Badge variant="light">{t("rowsParsed")} {rows.length}</Badge>
                <Badge color="teal" variant="light">{preview.totals.create} {t("taWillCreate")}</Badge>
                {preview.totals.skipped > 0 && <Badge color="gray" variant="light">{preview.totals.skipped} {t("taNoCompanyRows")}</Badge>}
              </Group>
            </Group>

            <Table.ScrollContainer minWidth={640}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={48}>#</Table.Th>
                    <Table.Th>{t("taCompanyCol")}</Table.Th>
                    <Table.Th>{t("taBeneficiaryCol")}</Table.Th>
                    {TA.formFields.map((f) => (
                      <Table.Th key={f.key}>{lang === "ar" ? f.labelAr : f.labelEn}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pageRows.map((plan) => {
                    const row = rows[plan.index];
                    const ok = plan.action === "create-session";
                    return (
                      <Table.Tr key={plan.index} style={ok ? undefined : { opacity: 0.55 }}>
                        <Table.Td ff="monospace">{plan.index + 1}</Table.Td>
                        <Table.Td>
                          {ok
                            ? <Text size="sm">{plan.companyName}</Text>
                            : <Badge color="gray" variant="light" size="sm">{t("taNoCompanyCell")}</Badge>}
                        </Table.Td>
                        <Table.Td>
                          {ok && <Badge color={plan.userMatched ? "teal" : "gray"} variant="light" size="sm">{plan.userMatched ? t("taMatched") : t("taFromOwner")}</Badge>}
                        </Table.Td>
                        {TA.formFields.map((f) => (
                          <Table.Td key={f.key}><Text size="sm" c="dimmed">{row.session?.[f.key] || "—"}</Text></Table.Td>
                        ))}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {totalPages > 1 && <Group justify="center"><Pagination total={totalPages} value={page} onChange={setPage} size="sm" /></Group>}

            <Group justify="space-between">
              <Button variant="subtle" leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={reset}>{t("back")}</Button>
              <Button leftSection={<IconArrowRight size={16} stroke={1.8} />} loading={commitMut.isPending}
                disabled={preview.totals.create === 0} onClick={() => commitMut.mutate()}>
                {t("confirmImport")}
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
