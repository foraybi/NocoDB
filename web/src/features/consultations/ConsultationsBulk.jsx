import { useState } from "react";
import {
  Card, Stack, Group, Text, Button, Badge, Table, Select, Textarea, ThemeIcon,
  Loader, Center, Pagination, SimpleGrid,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import {
  IconFileSpreadsheet, IconUpload, IconX, IconSend, IconCircleCheck, IconEye,
} from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { SearchSelect } from "../../components/SearchSelect.jsx";
import { DynamicForm } from "../../components/DynamicForm.jsx";
import { useUiStore } from "../../stores/uiStore";
import { CONFIG } from "../../lib/config.js";
import { apiPost } from "../../api/client.js";
import { readImportFile } from "../../lib/importExport.js";
import { normalizeRow, autoMap } from "../../lib/csv.js";

const C = CONFIG.consultation;
const AI = CONFIG.attendeeImport;
const EX = CONFIG.expert;
const recId = (r) => r && (r.Id ?? r.id ?? r.ID);
const PAGE = 10;

// Column mapping targets (same beneficiary shape as the events importer).
const TARGETS = [
  { value: "__ignore", ar: "تجاهل", en: "Ignore" },
  { value: "en_full_name", ar: "الاسم", en: "Full name" },
  { value: "phone_number", ar: "الجوال", en: "Phone" },
  { value: "national_id", ar: "الهوية", en: "National ID" },
  { value: "Email", ar: "البريد", en: "Email" },
  { value: "gender", ar: "الجنس", en: "Gender" },
  { value: "region_of_residence", ar: "المدينة", en: "City" },
];

// Optional shared consultation fields = the normal form minus the generated topic.
const SHARED_FIELDS = C.formFields
  .filter((f) => f.key !== C.bulk.topicField)
  .map((f) => ({ ...f, required: false }));

export function ConsultationsBulk() {
  const t = useUiStore((s) => s.t);
  const lang = useUiStore((s) => s.lang);

  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [expert, setExpert] = useState(null);
  const [template, setTemplate] = useState(lang === "ar" ? C.bulk.templateDefaultAr : C.bulk.templateDefaultEn);
  const [shared, setShared] = useState({});
  const [preview, setPreview] = useState(null);
  const [report, setReport] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const topicFor = (name) => template.split(C.bulk.nameToken).join(name || "");
  const buildRows = () => rawRows.map((r) => normalizeRow(r, mapping, AI));

  const previewMut = useMutation({
    mutationFn: (rows) => apiPost("/api/consultations/bulk/preview", { rows }),
    onSuccess: (data) => { setPreview(data); setPage(1); },
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });
  const commitMut = useMutation({
    mutationFn: () => {
      const norm = buildRows();
      const rows = norm.map((n) => ({ user: n, topic: topicFor(n.en_full_name) }));
      const sharedFields = {};
      Object.entries(shared).forEach(([k, v]) => { if (String(v).trim()) sharedFields[k] = v; });
      return apiPost("/api/consultations/bulk/commit", { expertId: recId(expert), sharedFields, rows });
    },
    onSuccess: (data) => { setReport(data); notifications.show({ color: "green", message: t("importDone") }); },
    onError: () => notifications.show({ color: "red", message: t("importError") }),
  });

  const handleDrop = async (files) => {
    setError(""); setPreview(null); setReport(null);
    try {
      const parsed = await readImportFile(files[0]);
      setFileName(files[0].name);
      setHeaders(parsed.headers);
      setRawRows(parsed.rawRows);
      setMapping(autoMap(parsed.headers, AI.headerMap));
    } catch (e) { console.error(e); setError(t("csvParseError")); }
  };

  const ready = expert && template.trim() && rawRows.length > 0;
  const runPreview = () => {
    if (!ready) { notifications.show({ color: "red", message: t("selectExpertTemplate") }); return; }
    previewMut.mutate(buildRows());
  };

  const reset = () => {
    setFileName(""); setHeaders([]); setRawRows([]); setMapping({});
    setPreview(null); setReport(null); setShared({}); setPage(1);
  };

  const mapOptions = TARGETS.map((o) => ({ value: o.value, label: lang === "ar" ? o.ar : o.en }));

  if (report) {
    const tiles = [
      { label: t("repConsCreated"), value: report.created, color: "teal" },
      { label: t("repUsers"), value: report.createdUsers, color: "blue" },
      { label: t("repInvalid"), value: report.invalid, color: "gray" },
      { label: t("repFailed"), value: report.failed?.length || 0, color: "red" },
    ];
    return (
      <Card padding="xl">
        <Stack gap="lg">
          <Group gap="sm"><IconCircleCheck size={28} color="var(--mantine-color-teal-6)" /><Text fw={600} size="lg">{t("importDone")}</Text></Group>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg">
            {tiles.map((tile) => (
              <div key={tile.label}>
                <Text ff="monospace" fw={700} fz={28} c={tile.color}>{tile.value}</Text>
                <Text size="sm" c="dimmed">{tile.label}</Text>
              </div>
            ))}
          </SimpleGrid>
          <Group><Button variant="light" onClick={reset}>{t("consBulk")}</Button></Group>
        </Stack>
      </Card>
    );
  }

  const plans = preview?.rows || [];
  const norm = preview ? buildRows() : [];
  const pageRows = plans.slice((page - 1) * PAGE, page * PAGE);
  const totalPages = Math.ceil(plans.length / PAGE) || 1;

  return (
    <Stack gap="lg">
      <Text c="dimmed" size="sm">{t("consBulkHint")}</Text>

      <Card padding="xl">
        <Dropzone
          onDrop={handleDrop}
          accept={[
            "text/csv", ".csv",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx",
            "application/vnd.ms-excel", ".xls",
          ]}
          maxFiles={1} multiple={false}
        >
          <Group justify="center" gap="xl" mih={140} style={{ pointerEvents: "none" }}>
            <Dropzone.Accept><ThemeIcon size={52} radius="xl" variant="light"><IconUpload size={28} stroke={1.5} /></ThemeIcon></Dropzone.Accept>
            <Dropzone.Reject><ThemeIcon size={52} radius="xl" color="red" variant="light"><IconX size={28} stroke={1.5} /></ThemeIcon></Dropzone.Reject>
            <Dropzone.Idle><ThemeIcon size={52} radius="xl" variant="light"><IconFileSpreadsheet size={28} stroke={1.5} /></ThemeIcon></Dropzone.Idle>
            <div>
              <Text size="lg" fw={600}>{t("dropFile")}</Text>
              {fileName && <Badge mt={6} variant="light">{fileName} · {rawRows.length}</Badge>}
            </div>
          </Group>
        </Dropzone>
      </Card>

      {error && <Text c="red" size="sm">{error}</Text>}

      {headers.length > 0 && (
        <Card padding="lg">
          <Text fw={600} mb="sm">{t("mapColumns")}</Text>
          <Table.ScrollContainer minWidth={420}>
            <Table verticalSpacing="xs">
              <Table.Thead><Table.Tr><Table.Th>{t("colHeader")}</Table.Th><Table.Th>{t("targetField")}</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {headers.map((h) => (
                  <Table.Tr key={h}>
                    <Table.Td>{h}</Table.Td>
                    <Table.Td>
                      <Select size="xs" w={200} data={mapOptions} allowDeselect={false}
                        value={mapping[h] === "__unmapped" ? "__ignore" : mapping[h]}
                        onChange={(v) => setMapping((m) => ({ ...m, [h]: v }))} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <Card padding="lg">
        <Stack gap="md">
          <Text fw={600}>{t("sharedSettings")}</Text>
          <SearchSelect
            value={expert} onSelect={setExpert} onClear={() => setExpert(null)}
            searchPath="/api/experts" display={EX.display} selectedLabel={t("selectedConsultant")}
            placeholder={t("searchExpert")} noResultsText={t("noExperts")}
          />
          <Textarea label={t("topicTemplate")} description={t("topicTemplateHint")} autosize minRows={2}
            value={template} onChange={(e) => setTemplate(e.currentTarget.value)} />
          <div>
            <Text size="sm" fw={500} mb={6}>{t("sharedFieldsOptional")}</Text>
            <DynamicForm fields={SHARED_FIELDS} values={shared} errors={{}} onChange={(k, v) => setShared((s) => ({ ...s, [k]: v }))} />
          </div>
        </Stack>
      </Card>

      {!preview && (
        <Group justify="flex-end">
          <Button leftSection={<IconEye size={16} stroke={1.8} />} loading={previewMut.isPending} onClick={runPreview}>{t("preview")}</Button>
        </Group>
      )}

      {preview && (
        <Card padding="lg">
          <Stack gap="md">
            <Group gap="sm">
              <Badge variant="light">{t("rowsParsed")} {plans.length}</Badge>
              {preview.totals["link-existing"] > 0 && <Badge color="blue" variant="light">{preview.totals["link-existing"]} {t("tLinkExisting")}</Badge>}
              {preview.totals.create > 0 && <Badge color="teal" variant="light">{preview.totals.create} {t("tCreateUsers")}</Badge>}
              {preview.totals.invalid > 0 && <Badge color="gray" variant="light">{preview.totals.invalid} {t("tInvalid")}</Badge>}
            </Group>

            <Table.ScrollContainer minWidth={720}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={40}>#</Table.Th>
                    <Table.Th>{t("reviewUser")}</Table.Th>
                    <Table.Th>{t("colContact")}</Table.Th>
                    <Table.Th>{t("generatedTopic")}</Table.Th>
                    <Table.Th>{t("colAction")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pageRows.map((plan) => {
                    const n = norm[plan.index] || {};
                    const invalid = plan.action === "invalid";
                    return (
                      <Table.Tr key={plan.index} style={invalid ? { opacity: 0.55 } : undefined}>
                        <Table.Td ff="monospace">{plan.index + 1}</Table.Td>
                        <Table.Td>{n.en_full_name || "—"}</Table.Td>
                        <Table.Td><Text size="sm" c="dimmed">{n.Email || n.phone_number || "—"}</Text></Table.Td>
                        <Table.Td><Text size="sm">{invalid ? "—" : topicFor(n.en_full_name)}</Text></Table.Td>
                        <Table.Td>
                          {invalid
                            ? <Badge color="gray" variant="light" size="sm">{t("tInvalid")}</Badge>
                            : <Badge color={plan.action === "create" ? "teal" : "blue"} variant="light" size="sm">
                                {plan.action === "create" ? t("tCreateUsers") : t("tLinkExisting")}
                              </Badge>}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            {totalPages > 1 && <Group justify="center"><Pagination total={totalPages} value={page} onChange={setPage} size="sm" /></Group>}

            <Group justify="space-between">
              <Button variant="subtle" onClick={() => setPreview(null)}>{t("back")}</Button>
              <Button leftSection={<IconSend size={16} stroke={1.8} />} loading={commitMut.isPending}
                disabled={!((preview.totals.create || 0) + (preview.totals["link-existing"] || 0))}
                onClick={() => commitMut.mutate()}>{t("confirmImport")}</Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
