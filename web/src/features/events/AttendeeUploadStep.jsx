import { useState } from "react";
import { Card, Group, Text, Button, Stack, ThemeIcon, Badge, Table, Select } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconFileSpreadsheet, IconArrowRight, IconArrowLeft } from "@tabler/icons-react";
import { useUiStore } from "../../stores/uiStore";
import { useEventsStore } from "../../stores/eventsStore";
import { readImportFile } from "../../lib/importExport.js";

const TARGETS = [
  { value: "__ignore", ar: "تجاهل", en: "Ignore" },
  { value: "en_full_name", ar: "الاسم", en: "Full name" },
  { value: "phone_number", ar: "الجوال", en: "Phone" },
  { value: "national_id", ar: "الهوية", en: "National ID" },
  { value: "Email", ar: "البريد", en: "Email" },
  { value: "gender", ar: "الجنس", en: "Gender" },
  { value: "region_of_residence", ar: "المدينة", en: "City" },
  { value: "__attendance", ar: "حالة الحضور", en: "Attendance" },
];

export function AttendeeUploadStep({ onBack, onNext }) {
  const t = useUiStore((s) => s.t);
  const lang = useUiStore((s) => s.lang);
  const { headers, rows, mapping, fileName, setParsed, setMapping } = useEventsStore();
  const [error, setError] = useState("");

  const handleDrop = async (files) => {
    setError("");
    try {
      const parsed = await readImportFile(files[0]);
      setParsed({ ...parsed, fileName: files[0].name });
    } catch (e) { console.error(e); setError(t("csvParseError")); }
  };

  const options = TARGETS.map((o) => ({ value: o.value, label: lang === "ar" ? o.ar : o.en }));

  return (
    <Stack gap="lg">
      <Card padding="xl">
        <Dropzone onDrop={handleDrop} accept={["text/csv", ".csv", ".xlsx", ".xls"]} maxFiles={1} multiple={false}>
          <Group justify="center" gap="xl" mih={140} style={{ pointerEvents: "none" }}>
            <ThemeIcon size={52} radius="xl" variant="light"><IconFileSpreadsheet size={28} stroke={1.5} /></ThemeIcon>
            <div>
              <Text size="lg" fw={600}>{t("uploadAttendees")}</Text>
              {fileName && <Badge mt={6} variant="light">{fileName} · {rows.length}</Badge>}
            </div>
          </Group>
        </Dropzone>
      </Card>

      {error && <Text c="red" size="sm">{error}</Text>}

      {headers.length > 0 && (
        <Card padding="lg">
          <Text fw={600} mb="sm">{t("mapColumns")}</Text>
          <Table.ScrollContainer minWidth={480}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr><Table.Th>{t("colHeader")}</Table.Th><Table.Th>{t("targetField")}</Table.Th></Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {headers.map((h) => (
                  <Table.Tr key={h}>
                    <Table.Td>{h}</Table.Td>
                    <Table.Td>
                      <Select size="xs" w={200} data={options} allowDeselect={false}
                        value={mapping[h] === "__unmapped" ? "__ignore" : mapping[h]}
                        onChange={(v) => setMapping(h, v)} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <Group justify="space-between">
        <Button variant="default" leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={onBack}>{t("back")}</Button>
        <Button rightSection={<IconArrowRight size={16} stroke={1.8} />} disabled={rows.length === 0} onClick={onNext}>{t("next")}</Button>
      </Group>
    </Stack>
  );
}
