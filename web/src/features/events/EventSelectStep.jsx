import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDebouncedValue } from "@mantine/hooks";
import { TextInput, Card, Stack, Group, Text, Button, Collapse, Loader } from "@mantine/core";
import { IconPlus, IconArrowRight, IconSearch } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { apiGet, apiPost } from "../../api/client.js";
import { CONFIG } from "../../lib/config.js";
import { DynamicForm, validateRequired } from "../../components/DynamicForm.jsx";
import { useUiStore } from "../../stores/uiStore";
import { useEventsStore } from "../../stores/eventsStore";

const EV = CONFIG.events;
const recId = (r) => r && (r.Id ?? r.id ?? r.ID);

export function EventSelectStep({ onNext }) {
  const t = useUiStore((s) => s.t);
  const event = useEventsStore((s) => s.event);
  const setEvent = useEventsStore((s) => s.setEvent);
  const [term, setTerm] = useState("");
  const [debounced] = useDebouncedValue(term, 300);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});

  const q = useQuery({
    queryKey: ["events", debounced],
    queryFn: () => apiGet(`/api/events?search=${encodeURIComponent(debounced)}`),
    enabled: debounced.trim().length >= 2,
  });
  const create = useMutation({
    mutationFn: (fields) => apiPost("/api/events", fields),
    onSuccess: ({ record }) => { setEvent(record); setShowAdd(false); },
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });

  const results = q.data?.list || [];
  const d = EV.display;

  const submitAdd = () => {
    const errs = validateRequired(EV.addEventFields, form, t("required"));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const fields = {};
    Object.entries(form).forEach(([k, v]) => { if (String(v).trim()) fields[k] = v; });
    create.mutate(fields);
  };

  if (event) {
    return (
      <Card padding="lg">
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Text c="dimmed">{t("selectedEvent")}</Text>
            <Text fw={600}>{event[d.primary] || event[d.secondary] || `#${recId(event)}`}</Text>
          </Group>
          <Group>
            <Button variant="subtle" onClick={() => setEvent(null)}>{t("change")}</Button>
            <Button rightSection={<IconArrowRight size={16} stroke={1.8} />} onClick={onNext}>{t("next")}</Button>
          </Group>
        </Group>
      </Card>
    );
  }

  return (
    <Stack gap="lg">
      <TextInput
        leftSection={<IconSearch size={16} stroke={1.6} />}
        placeholder={t("searchEvent")}
        value={term}
        onChange={(e) => setTerm(e.currentTarget.value)}
        rightSection={q.isFetching ? <Loader size={16} /> : null}
      />
      <Stack gap="xs">
        {results.map((r) => (
          <Card key={recId(r)} padding="sm" withBorder style={{ cursor: "pointer" }} onClick={() => setEvent(r)}>
            <Text fw={600}>{r[d.primary]}</Text>
            <Text size="sm" c="dimmed">{r[d.secondary]}{r[d.tertiary] ? ` · ${r[d.tertiary]}` : ""}</Text>
          </Card>
        ))}
        {debounced.trim().length >= 2 && !q.isFetching && results.length === 0 && (
          <Text c="dimmed" size="sm">{t("noEvents")}</Text>
        )}
      </Stack>

      <div>
        <Button variant="light" leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => setShowAdd((o) => !o)}>
          {t("addEvent")}
        </Button>
        <Collapse in={showAdd}>
          <Card mt="sm" padding="lg">
            <Text fw={600} mb="sm">{t("newEvent")}</Text>
            <DynamicForm fields={EV.addEventFields} values={form} errors={errors} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setShowAdd(false)}>{t("cancel")}</Button>
              <Button loading={create.isPending} onClick={submitAdd}>{t("save")}</Button>
            </Group>
          </Card>
        </Collapse>
      </div>
    </Stack>
  );
}
