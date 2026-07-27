import { useState } from "react";
import { Tabs, Stack, Card, Group, Button, Text } from "@mantine/core";
import { IconRocket, IconUpload, IconSend, IconCircleCheck } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { PageHeader } from "../../components/PageHeader.jsx";
import { SearchSelect } from "../../components/SearchSelect.jsx";
import { DynamicForm, validateRequired } from "../../components/DynamicForm.jsx";
import { BulkImport } from "./BulkImport.jsx";
import { useUiStore } from "../../stores/uiStore";
import { CONFIG } from "../../lib/config.js";
import { apiPost } from "../../api/client.js";

const TA = CONFIG.techAdoption;
const recId = (r) => r && (r.Id ?? r.id ?? r.ID);

export function TechAdoptionPage() {
  const t = useUiStore((s) => s.t);
  return (
    <>
      <PageHeader title={t("techAdoption")} subtitle={t("techAdoptionSubtitle")} />
      <Tabs defaultValue="single" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="single" leftSection={<IconRocket size={16} stroke={1.6} />}>{t("taAddSession")}</Tabs.Tab>
          <Tabs.Tab value="bulk" leftSection={<IconUpload size={16} stroke={1.6} />}>{t("taBulk")}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="single"><AddSession /></Tabs.Panel>
        <Tabs.Panel value="bulk"><BulkImport /></Tabs.Panel>
      </Tabs>
    </>
  );
}

function AddSession() {
  const t = useUiStore((s) => s.t);
  const [company, setCompany] = useState(null);
  const [expert, setExpert] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: (body) => apiPost("/api/tech-adoption", body),
    onSuccess: () => { setDone(true); notifications.show({ color: "green", message: t("sessionSaved") }); },
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });

  const doSubmit = () => {
    if (!company) { notifications.show({ color: "red", message: t("selectCompanyFirst") }); return; }
    const errs = validateRequired(TA.formFields, form, t("required"));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const fields = {};
    Object.entries(form).forEach(([k, v]) => { if (String(v).trim()) fields[k] = v; });
    submit.mutate({ company, expertId: recId(expert), fields });
  };

  if (done) {
    return (
      <Card padding="xl">
        <Stack align="center" py="lg" gap="sm">
          <IconCircleCheck size={48} color="var(--mantine-color-teal-6)" />
          <Text fw={600}>{t("sessionSaved")}</Text>
          <Button onClick={() => { setCompany(null); setExpert(null); setForm({}); setErrors({}); setDone(false); }}>
            {t("taAddSession")}
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap="lg">
      <SearchSelect
        value={company} onSelect={setCompany} onClear={() => setCompany(null)}
        searchPath="/api/companies" display={TA.companyDisplay} selectedLabel={t("selectedCompany")}
        placeholder={t("searchCompany")} noResultsText={t("noCompany")}
      />
      <SearchSelect
        value={expert} onSelect={setExpert} onClear={() => setExpert(null)}
        searchPath="/api/experts" display={CONFIG.expert.display} selectedLabel={t("selectedConsultant")}
        placeholder={t("searchExpert")} noResultsText={t("noExperts")}
      />
      <Card padding="lg">
        <DynamicForm fields={TA.formFields} values={form} errors={errors} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} />
      </Card>
      <Group justify="flex-end">
        <Button leftSection={<IconSend size={16} stroke={1.8} />} loading={submit.isPending} onClick={doSubmit}>
          {t("submitSession")}
        </Button>
      </Group>
    </Stack>
  );
}
