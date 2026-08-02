import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import {
  Stack, TextInput, Textarea, Select, FileInput, Card, Group, Button, Text, Loader,
} from "@mantine/core";
import { IconSearch, IconPhoto } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { apiGet, apiPost } from "../../api/client.js";
import { CONFIG } from "../../lib/config.js";
import { fieldLabel } from "../../components/DynamicForm.jsx";
import { useUiStore } from "../../stores/uiStore";

const EV = CONFIG.events;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}

// Inline region picker backed by /api/regions -> { id, name }.
function RegionSelect({ value, onChange }) {
  const t = useUiStore((s) => s.t);
  const [term, setTerm] = useState("");
  const [debounced] = useDebouncedValue(term, 300);
  const q = useQuery({
    queryKey: [EV.regionsPath, debounced],
    queryFn: () => apiGet(`${EV.regionsPath}?search=${encodeURIComponent(debounced)}`),
    enabled: debounced.trim().length >= 1,
  });
  const results = q.data?.list || [];

  if (value) {
    return (
      <Group justify="space-between">
        <Text fw={600}>{value.name}</Text>
        <Button variant="subtle" size="xs" onClick={() => onChange(null)}>{t("change")}</Button>
      </Group>
    );
  }
  return (
    <Stack gap="xs">
      <TextInput
        leftSection={<IconSearch size={16} stroke={1.6} />}
        placeholder={t("searchRegion")}
        value={term}
        onChange={(e) => setTerm(e.currentTarget.value)}
        rightSection={q.isFetching ? <Loader size={16} /> : null}
      />
      {results.map((r) => (
        <Card key={r.id} padding="xs" withBorder style={{ cursor: "pointer" }} onClick={() => onChange(r)}>
          <Text size="sm">{r.name}</Text>
        </Card>
      ))}
      {debounced.trim().length >= 1 && !q.isFetching && results.length === 0 && (
        <Text c="dimmed" size="sm">{t("noRegions")}</Text>
      )}
    </Stack>
  );
}

export function EventForm({ onCreated, onCancel }) {
  const t = useUiStore((s) => s.t);
  const lang = useUiStore((s) => s.lang);
  const [values, setValues] = useState({});
  const [region, setRegion] = useState(null);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      let attachment;
      if (file) {
        const dataBase64 = await fileToBase64(file);
        const up = await apiPost("/api/upload", { filename: file.name, mimetype: file.type, dataBase64 });
        attachment = up.attachment;
      }
      const fields = {};
      EV.addEventFields.forEach((f) => {
        if (f.type === "region" || f.type === "file") return;
        const v = values[f.key];
        if (v != null && String(v).trim() !== "") fields[f.key] = v;
      });
      const { record } = await apiPost("/api/events", {
        fields, regionId: region?.id, regionName: region?.name, attachment,
      });
      return record;
    },
    onSuccess: (record) => onCreated(record),
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });

  const validate = () => {
    const errs = {};
    const selType = values.event_type;
    EV.addEventFields.forEach((f) => {
      if (f.type === "region" || f.type === "file") return;
      const empty = !String(values[f.key] ?? "").trim();
      const conditionallyRequired = f.requiredForTypes && f.requiredForTypes.includes(selType);
      if ((f.required || conditionallyRequired) && empty) errs[f.key] = t("required");
    });
    return errs;
  };

  const submit = () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    create.mutate();
  };

  const optionsFor = (f) =>
    (EV[f.optionsKey] || []).map((o) => ({ value: o.value, label: lang === "ar" ? o.labelAr || o.value : o.labelEn || o.value }));

  return (
    <Stack gap="sm">
      {EV.addEventFields.map((f) => {
        const label = fieldLabel(f, lang);
        const err = errors[f.key];
        if (f.type === "region") {
          return (
            <div key={f.key}>
              <Text size="sm" fw={500} mb={4}>{label}</Text>
              <RegionSelect value={region} onChange={setRegion} />
            </div>
          );
        }
        if (f.type === "file") {
          return (
            <FileInput key={f.key} label={label} placeholder={t("uploadImage")} accept="image/*"
              leftSection={<IconPhoto size={16} stroke={1.6} />} value={file} onChange={setFile} clearable />
          );
        }
        if (f.type === "textarea") {
          return (
            <Textarea key={f.key} label={label} withAsterisk={f.required} autosize minRows={2}
              value={values[f.key] || ""} error={err} onChange={(e) => set(f.key, e.currentTarget.value)} />
          );
        }
        if (f.type === "select") {
          const required = f.required;
          return (
            <Select key={f.key} label={label} withAsterisk={required} data={optionsFor(f)} clearable searchable
              value={values[f.key] || null} error={err} onChange={(v) => set(f.key, v || "")} />
          );
        }
        const isEndDate = f.key === "event_ending_date";
        const condReq = isEndDate && (f.requiredForTypes || []).includes(values.event_type);
        return (
          <TextInput key={f.key} label={label} withAsterisk={f.required || condReq}
            type={f.type === "date" ? "date" : "text"}
            value={values[f.key] || ""} error={err} onChange={(e) => set(f.key, e.currentTarget.value)} />
        );
      })}

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onCancel}>{t("cancel")}</Button>
        <Button loading={create.isPending} onClick={submit}>{t("save")}</Button>
      </Group>
    </Stack>
  );
}
