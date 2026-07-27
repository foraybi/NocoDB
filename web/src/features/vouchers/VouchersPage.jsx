import { useState } from "react";
import {
  Stepper, Stack, Card, Group, Button, Text, SimpleGrid, Badge, ThemeIcon,
  Modal, Divider, Loader, Center,
} from "@mantine/core";
import {
  IconTicket, IconPlus, IconArrowLeft, IconArrowRight, IconCircleCheck, IconSend,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { PageHeader } from "../../components/PageHeader.jsx";
import { SearchSelect } from "../../components/SearchSelect.jsx";
import { DynamicForm, validateRequired } from "../../components/DynamicForm.jsx";
import { useUiStore } from "../../stores/uiStore";
import { CONFIG } from "../../lib/config.js";
import { apiGet, apiPost } from "../../api/client.js";

const VC = CONFIG.vouchers;
const recId = (r) => r && (r.Id ?? r.id ?? r.ID);
const fmt = (n) => {
  if (n == null || n === "") return "—";
  const num = Number(n);
  return Number.isFinite(num) ? num.toLocaleString("en-US") : n;
};

export function VouchersPage() {
  const t = useUiStore((s) => s.t);
  const [active, setActive] = useState(0);
  const [company, setCompany] = useState(null);
  const [voucher, setVoucher] = useState(null);
  const [expert, setExpert] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [done, setDone] = useState(false);
  const qc = useQueryClient();

  const providers = useQuery({
    queryKey: ["/api/vouchers/providers"],
    queryFn: () => apiGet("/api/vouchers/providers"),
    enabled: active >= 1,
  });

  const assign = useMutation({
    mutationFn: (body) => apiPost("/api/digital-vouchers", body),
    onSuccess: () => { setDone(true); notifications.show({ color: "green", message: t("voucherAssigned") }); },
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });

  const pickCompany = (c) => { setCompany(c); setActive(1); };
  const clearCompany = () => { setCompany(null); setVoucher(null); setActive(0); };

  const doAssign = () => {
    if (!voucher) { notifications.show({ color: "red", message: t("selectVoucherFirst") }); return; }
    const errs = validateRequired(VC.assignFields, form, t("required"));
    setErrors(errs);
    if (Object.keys(errs).length) return;
    assign.mutate({
      companyId: recId(company),
      providerId: voucher.id,
      typeId: voucher.type?.id,
      expertId: recId(expert),
      date: form.voucher_date,
      title: form.voucher_name || voucher.title,
    });
  };

  const reset = () => {
    setActive(0); setCompany(null); setVoucher(null); setExpert(null);
    setForm({}); setErrors({}); setDone(false);
  };

  if (done) {
    return (
      <>
        <PageHeader title={t("vouchers")} subtitle={t("vouchersSubtitle")} />
        <Card padding="xl">
          <Stack align="center" py="lg" gap="sm">
            <IconCircleCheck size={48} color="var(--mantine-color-teal-6)" />
            <Text fw={600}>{t("voucherAssigned")}</Text>
            <Button onClick={reset}>{t("assignVoucher")}</Button>
          </Stack>
        </Card>
      </>
    );
  }

  const cards = providers.data?.list || [];

  return (
    <>
      <PageHeader title={t("vouchers")} subtitle={t("vouchersSubtitle")} />

      <Stepper active={active} onStepClick={setActive} mb="xl">
        <Stepper.Step label={t("vStepCompany")} allowStepSelect={false} />
        <Stepper.Step label={t("vStepVoucher")} allowStepSelect={!!company} />
        <Stepper.Step label={t("vStepAssign")} allowStepSelect={!!company && !!voucher} />
      </Stepper>

      {active === 0 && (
        <SearchSelect
          value={company} onSelect={pickCompany} onClear={clearCompany}
          searchPath="/api/companies" display={VC.companyDisplay} selectedLabel={t("selectedCompany")}
          placeholder={t("searchCompany")} noResultsText={t("noCompany")}
          createFields={VC.companyCreateFields} createPath="/api/companies"
          addLabel={t("createCompany")} newTitle={t("newCompany")}
        />
      )}

      {active === 1 && (
        <Stack gap="lg">
          <SearchSelect
            value={company} onSelect={setCompany} onClear={clearCompany}
            searchPath="/api/companies" display={VC.companyDisplay} selectedLabel={t("selectedCompany")}
            placeholder={t("searchCompany")} noResultsText={t("noCompany")}
          />

          <Group justify="space-between">
            <Text fw={600}>{t("chooseVoucher")}</Text>
            <Button variant="light" leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => setAddOpen(true)}>
              {t("addVoucher")}
            </Button>
          </Group>

          {providers.isLoading ? (
            <Center py="xl"><Loader /></Center>
          ) : cards.length === 0 ? (
            <Text c="dimmed" size="sm">{t("noVouchers")}</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {cards.map((c) => (
                <VoucherCard key={c.id} card={c} selected={voucher?.id === c.id} onClick={() => setVoucher(c)} />
              ))}
            </SimpleGrid>
          )}

          <Group justify="space-between">
            <Button variant="subtle" leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={() => setActive(0)}>{t("back")}</Button>
            <Button rightSection={<IconArrowRight size={16} stroke={1.8} />} disabled={!voucher} onClick={() => setActive(2)}>{t("next")}</Button>
          </Group>

          <AddVoucherModal
            opened={addOpen} onClose={() => setAddOpen(false)}
            onCreated={(card) => {
              qc.setQueryData(["/api/vouchers/providers"], (old) => ({ list: [...(old?.list || []), card] }));
              setVoucher(card); setAddOpen(false);
            }}
          />
        </Stack>
      )}

      {active === 2 && (
        <Stack gap="lg">
          {voucher && (
            <Card padding="lg" withBorder>
              <Group justify="space-between" wrap="wrap">
                <Group gap="xs">
                  <Text c="dimmed">{t("selectedVoucher")}</Text>
                  <Text fw={600}>{voucher.title}</Text>
                  {voucher.type?.title && <Badge variant="light">{voucher.type.title}</Badge>}
                </Group>
                <Text ff="monospace" fw={600}>{fmt(voucher.amount)}</Text>
              </Group>
            </Card>
          )}

          <SearchSelect
            value={expert} onSelect={setExpert} onClear={() => setExpert(null)}
            searchPath="/api/experts" display={CONFIG.expert.display} selectedLabel={t("selectedConsultant")}
            placeholder={t("searchExpert")} noResultsText={t("noExperts")}
          />

          <Card padding="lg">
            <DynamicForm fields={VC.assignFields} values={form} errors={errors} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} />
          </Card>

          <Group justify="space-between">
            <Button variant="subtle" leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={() => setActive(1)}>{t("back")}</Button>
            <Button leftSection={<IconSend size={16} stroke={1.8} />} loading={assign.isPending} onClick={doAssign}>{t("assignVoucher")}</Button>
          </Group>
        </Stack>
      )}
    </>
  );
}

function VoucherCard({ card, selected, onClick }) {
  const t = useUiStore((s) => s.t);
  return (
    <Card
      padding="lg" withBorder onClick={onClick}
      style={{ cursor: "pointer", borderColor: selected ? "var(--mantine-color-teal-6)" : undefined, borderWidth: selected ? 2 : 1 }}
    >
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <ThemeIcon size={36} radius="md" variant="light" color={selected ? "teal" : "gray"}>
              <IconTicket size={20} stroke={1.6} />
            </ThemeIcon>
            <div>
              <Text fw={600} lineClamp={1}>{card.title}</Text>
              {card.service && <Text size="xs" c="dimmed" lineClamp={1}>{card.service}</Text>}
            </div>
          </Group>
          {selected && <IconCircleCheck size={20} color="var(--mantine-color-teal-6)" />}
        </Group>

        {card.type?.title && <Badge variant="light" size="sm">{card.type.title}</Badge>}

        <Divider />

        <Group justify="space-between">
          <div>
            <Text size="xs" c="dimmed">{t("voucherAmount")}</Text>
            <Text ff="monospace" fw={600}>{fmt(card.amount)}</Text>
          </div>
          <div style={{ textAlign: "end" }}>
            <Text size="xs" c="dimmed">{t("vouchersInSystem")}</Text>
            <Text ff="monospace" fw={600}>{fmt(card.remaining ?? card.total)}</Text>
          </div>
        </Group>
      </Stack>
    </Card>
  );
}

function AddVoucherModal({ opened, onClose, onCreated }) {
  const t = useUiStore((s) => s.t);
  const [provider, setProvider] = useState({});
  const [type, setType] = useState({});
  const [pErr, setPErr] = useState({});
  const [tErr, setTErr] = useState({});

  const create = useMutation({
    mutationFn: (body) => apiPost("/api/vouchers/catalog", body),
    onSuccess: ({ card }) => { setProvider({}); setType({}); setPErr({}); setTErr({}); onCreated(card); },
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });

  const submit = () => {
    const pe = validateRequired(VC.newProviderFields, provider, t("required"));
    const te = validateRequired(VC.newTypeFields, type, t("required"));
    setPErr(pe); setTErr(te);
    if (Object.keys(pe).length || Object.keys(te).length) return;
    const clean = (obj) => { const o = {}; Object.entries(obj).forEach(([k, v]) => { if (String(v).trim()) o[k] = v; }); return o; };
    create.mutate({ provider: clean(provider), type: clean(type) });
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t("newVoucher")} size="lg">
      <Stack gap="md">
        <div>
          <Text fw={600} mb="xs">{t("providerDetails")}</Text>
          <DynamicForm fields={VC.newProviderFields} values={provider} errors={pErr} onChange={(k, v) => setProvider((f) => ({ ...f, [k]: v }))} />
        </div>
        <Divider />
        <div>
          <Text fw={600} mb="xs">{t("typeDetails")}</Text>
          <DynamicForm fields={VC.newTypeFields} values={type} errors={tErr} onChange={(k, v) => setType((f) => ({ ...f, [k]: v }))} />
        </div>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>{t("cancel")}</Button>
          <Button loading={create.isPending} onClick={submit}>{t("save")}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
