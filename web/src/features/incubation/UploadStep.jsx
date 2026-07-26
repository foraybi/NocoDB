import { useState } from "react";
import { Card, Group, Text, Button, Stack, ThemeIcon, Badge } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconFileSpreadsheet, IconUpload, IconX, IconArrowRight } from "@tabler/icons-react";
import { useUiStore } from "../../stores/uiStore";
import { useIncubationStore } from "../../stores/incubationStore";
import { readImportFile } from "../../lib/importExport.js";

export function UploadStep({ onNext }) {
  const t = useUiStore((s) => s.t);
  const loadParsed = useIncubationStore((s) => s.loadParsed);
  const rawRows = useIncubationStore((s) => s.rawRows);
  const fileName = useIncubationStore((s) => s.fileName);
  const issues = useIncubationStore((s) => s.issues);
  const [error, setError] = useState("");

  const handleDrop = async (files) => {
    setError("");
    try {
      const parsed = await readImportFile(files[0]);
      loadParsed({ ...parsed, fileName: files[0].name });
    } catch (e) {
      console.error(e);
      setError(t("csvParseError"));
    }
  };

  const adjusted = issues.filter((i) => i.action === "adjusted").length;
  const dropped = issues.filter((i) => i.action === "dropped").length;

  return (
    <Stack gap="lg">
      <Card padding="xl">
        <Dropzone
          onDrop={handleDrop}
          accept={[
            "text/csv", ".csv",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx", ".xls",
          ]}
          maxFiles={1}
          multiple={false}
        >
          <Group justify="center" gap="xl" mih={160} style={{ pointerEvents: "none" }}>
            <Dropzone.Accept>
              <ThemeIcon size={56} radius="xl" variant="light"><IconUpload size={30} stroke={1.5} /></ThemeIcon>
            </Dropzone.Accept>
            <Dropzone.Reject>
              <ThemeIcon size={56} radius="xl" color="red" variant="light"><IconX size={30} stroke={1.5} /></ThemeIcon>
            </Dropzone.Reject>
            <Dropzone.Idle>
              <ThemeIcon size={56} radius="xl" variant="light"><IconFileSpreadsheet size={30} stroke={1.5} /></ThemeIcon>
            </Dropzone.Idle>
            <div>
              <Text size="lg" fw={600}>{t("dropFile")}</Text>
              <Text size="sm" c="dimmed" mt={6}>{t("dropHint")}</Text>
            </div>
          </Group>
        </Dropzone>
      </Card>

      {error && <Text c="red" size="sm">{error}</Text>}

      {rawRows.length > 0 && (
        <Card padding="lg">
          <Group justify="space-between" wrap="wrap">
            <Group gap="sm">
              <IconFileSpreadsheet size={20} stroke={1.6} />
              <Text fw={600}>{fileName}</Text>
              <Badge variant="light">{t("rowsParsed")} {rawRows.length}</Badge>
              {adjusted > 0 && <Badge color="yellow" variant="light">{adjusted} {t("fieldsAdjusted")}</Badge>}
              {dropped > 0 && <Badge color="red" variant="light">{dropped} {t("fieldsDropped")}</Badge>}
            </Group>
            <Button rightSection={<IconArrowRight size={16} stroke={1.8} />} onClick={onNext}>
              {t("next")}
            </Button>
          </Group>
        </Card>
      )}
    </Stack>
  );
}
