import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { TextInput, Card, Stack, Group, Text, Button, Collapse, Loader } from "@mantine/core";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { apiGet, apiPost } from "../api/client.js";
import { DynamicForm, validateRequired } from "./DynamicForm.jsx";
import { useUiStore } from "../stores/uiStore";

const recId = (r) => r && (r.Id ?? r.id ?? r.ID);

// Reusable "search an existing record, optionally create a new one" control.
export function SearchSelect({
  value, onSelect, onClear, searchPath, display, selectedLabel,
  placeholder, noResultsText, createFields, createPath, addLabel, newTitle,
}) {
  const t = useUiStore((s) => s.t);
  const [term, setTerm] = useState("");
  const [debounced] = useDebouncedValue(term, 300);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});

  const q = useQuery({
    queryKey: [searchPath, debounced],
    queryFn: () => apiGet(`${searchPath}?search=${encodeURIComponent(debounced)}`),
    enabled: debounced.trim().length >= 2,
  });
  const create = useMutation({
    mutationFn: (fields) => apiPost(createPath, fields),
    onSuccess: ({ record }) => { onSelect(record); setShowAdd(false); },
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });

  const results = q.data?.list || [];

  const submitAdd = () => {
    const errs = validateRequired(createFields, form, t("required"));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const fields = {};
    Object.entries(form).forEach(([k, v]) => { if (String(v).trim()) fields[k] = v; });
    create.mutate(fields);
  };

  if (value) {
    return (
      <Card padding="lg">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Text c="dimmed">{selectedLabel}</Text>
            <Text fw={600}>{value[display.primary] || value[display.secondary] || `#${recId(value)}`}</Text>
          </Group>
          <Button variant="subtle" onClick={onClear}>{t("change")}</Button>
        </Group>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <TextInput
        leftSection={<IconSearch size={16} stroke={1.6} />}
        placeholder={placeholder}
        value={term}
        onChange={(e) => setTerm(e.currentTarget.value)}
        rightSection={q.isFetching ? <Loader size={16} /> : null}
      />
      <Stack gap="xs">
        {results.map((r) => (
          <Card key={recId(r)} padding="sm" withBorder style={{ cursor: "pointer" }} onClick={() => onSelect(r)}>
            <Text fw={600}>{r[display.primary]}</Text>
            <Text size="sm" c="dimmed">
              {r[display.secondary]}{display.tertiary && r[display.tertiary] ? ` · ${r[display.tertiary]}` : ""}
            </Text>
          </Card>
        ))}
        {debounced.trim().length >= 2 && !q.isFetching && results.length === 0 && (
          <Text c="dimmed" size="sm">{noResultsText}</Text>
        )}
      </Stack>

      {createFields && (
        <div>
          <Button variant="light" leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => setShowAdd((o) => !o)}>
            {addLabel}
          </Button>
          <Collapse in={showAdd}>
            <Card mt="sm" padding="lg">
              <Text fw={600} mb="sm">{newTitle}</Text>
              <DynamicForm fields={createFields} values={form} errors={errors} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} />
              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={() => setShowAdd(false)}>{t("cancel")}</Button>
                <Button loading={create.isPending} onClick={submitAdd}>{t("save")}</Button>
              </Group>
            </Card>
          </Collapse>
        </div>
      )}
    </Stack>
  );
}
