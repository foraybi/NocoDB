import { useState } from "react";
import { Stepper, Stack, Group, Button, Card, Text, Divider, SimpleGrid } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { IconArrowLeft, IconArrowRight, IconSend, IconCircleCheck } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { PageHeader } from "../../components/PageHeader.jsx";
import { SearchSelect } from "../../components/SearchSelect.jsx";
import { DynamicForm, validateRequired, fieldLabel } from "../../components/DynamicForm.jsx";
import { useUiStore } from "../../stores/uiStore";
import { useConsultationsStore } from "../../stores/consultationsStore";
import { CONFIG } from "../../lib/config.js";
import { apiPost } from "../../api/client.js";

const C = CONFIG.consultation;
const UP = CONFIG.userProfile;
const EX = CONFIG.expert;
const recId = (r) => r && (r.Id ?? r.id ?? r.ID);

export function ConsultationsPage() {
  const t = useUiStore((s) => s.t);
  const lang = useUiStore((s) => s.lang);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const { user, form, expert, submitted, setUser, setForm, setFormField, setExpert, setSubmitted, reset } = useConsultationsStore();

  const submit = useMutation({
    mutationFn: (body) => apiPost("/api/consultations", body),
    onSuccess: (res) => {
      setSubmitted(true);
      notifications.show({ color: "green", message: t("submitted") });
      (res?.warnings || []).forEach((w) =>
        notifications.show({ color: "yellow", autoClose: false,
          message: `${t("linkWarning")} (${w.link} #${w.relatedId})` }));
    },
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });

  const goForm = () => { if (!user) return notifications.show({ color: "red", message: t("selectUserFirst") }); setStep(1); };
  const goExpert = () => {
    const errs = validateRequired(C.formFields, form, t("required"));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStep(2);
  };
  const goReview = () => { if (!expert) return notifications.show({ color: "red", message: t("selectExpertFirst") }); setStep(3); };

  const doSubmit = () => {
    const fields = { ...form };
    Object.entries(C.autoFillFromUser || {}).forEach(([consKey, userKey]) => {
      if (user[userKey]) fields[consKey] = user[userKey];
    });
    submit.mutate({ fields, userId: recId(user), expertId: recId(expert) });
  };

  if (submitted) {
    return (
      <>
        <PageHeader title={t("consultations")} subtitle={t("consSubtitle")} />
        <Card padding="xl">
          <Stack align="center" gap="sm" py="lg">
            <IconCircleCheck size={48} color="var(--mantine-color-teal-6)" />
            <Text fw={600}>{t("submitted")}</Text>
            <Button mt="sm" onClick={() => { reset(); setStep(0); }}>{t("consultations")}</Button>
          </Stack>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("consultations")} subtitle={t("consSubtitle")} />
      <Stepper active={step} onStepClick={setStep} mb="xl" size="sm">
        <Stepper.Step label={t("consStepUser")} />
        <Stepper.Step label={t("consStepForm")} allowStepSelect={!!user} />
        <Stepper.Step label={t("consStepExpert")} allowStepSelect={!!user} />
        <Stepper.Step label={t("consStepReview")} allowStepSelect={!!user && !!expert} />
      </Stepper>

      {step === 0 && (
        <Stack>
          <SearchSelect
            value={user} onSelect={setUser} onClear={() => setUser(null)}
            searchPath="/api/users" display={UP.display} selectedLabel={t("selectedUser")}
            placeholder={t("searchUser")} noResultsText={t("noUser")}
            createFields={UP.createFields} createPath="/api/users" addLabel={t("createUser")} newTitle={t("newUser")}
          />
          {user && <Group justify="flex-end"><Button rightSection={<IconArrowRight size={16} stroke={1.8} />} onClick={goForm}>{t("next")}</Button></Group>}
        </Stack>
      )}

      {step === 1 && (
        <Stack>
          <Card padding="lg"><DynamicForm fields={C.formFields} values={form} errors={errors} onChange={setFormField} /></Card>
          <Group justify="space-between">
            <Button variant="default" leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={() => setStep(0)}>{t("back")}</Button>
            <Button rightSection={<IconArrowRight size={16} stroke={1.8} />} onClick={goExpert}>{t("next")}</Button>
          </Group>
        </Stack>
      )}

      {step === 2 && (
        <Stack>
          <SearchSelect
            value={expert} onSelect={setExpert} onClear={() => setExpert(null)}
            searchPath="/api/experts" display={EX.display} selectedLabel={t("reviewExpert")}
            placeholder={t("searchExpert")} noResultsText={t("noExperts")}
          />
          <Group justify="space-between">
            <Button variant="default" leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={() => setStep(1)}>{t("back")}</Button>
            {expert && <Button rightSection={<IconArrowRight size={16} stroke={1.8} />} onClick={goReview}>{t("next")}</Button>}
          </Group>
        </Stack>
      )}

      {step === 3 && (
        <Stack>
          <Card padding="lg">
            <Section title={t("reviewUser")} rows={[[UP.display.primary, user?.[UP.display.primary]], [UP.display.secondary, user?.[UP.display.secondary]]]} />
            <Divider my="sm" />
            <Section title={t("reviewConsultation")} rows={C.formFields.map((f) => [fieldLabel(f, lang), form[f.key]])} />
            <Divider my="sm" />
            <Section title={t("reviewExpert")} rows={[[EX.display.primary, expert?.[EX.display.primary]], [EX.display.secondary, expert?.[EX.display.secondary]]]} />
          </Card>
          <Group justify="space-between">
            <Button variant="default" leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={() => setStep(2)}>{t("back")}</Button>
            <Button leftSection={<IconSend size={16} stroke={1.8} />} loading={submit.isPending} onClick={doSubmit}>{t("submit")}</Button>
          </Group>
        </Stack>
      )}
    </>
  );
}

function Section({ title, rows }) {
  return (
    <div>
      <Text fw={600} c="brand.6" mb={6}>{title}</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={4}>
        {rows.filter(([, v]) => v != null && v !== "").map(([k, v]) => (
          <Group key={k} gap="xs" justify="space-between">
            <Text size="sm" c="dimmed">{k}</Text>
            <Text size="sm" fw={500} ta="end">{String(v)}</Text>
          </Group>
        ))}
      </SimpleGrid>
    </div>
  );
}
