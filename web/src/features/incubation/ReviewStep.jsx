import { useEffect, useMemo, useRef } from "react";
import {
  Card, Group, Text, Button, Stack, Table, Checkbox, Select, TextInput, Badge,
  Alert, SimpleGrid, Skeleton, Pagination, Code, Divider,
} from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { IconAlertTriangle, IconCircleCheck, IconDownload, IconArrowLeft, IconUpload } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useUiStore } from "../../stores/uiStore";
import { useIncubationStore } from "../../stores/incubationStore";
import { CONFIG } from "../../lib/config.js";
import { effect, NORM, isSelectable } from "../../lib/incubationStatus.js";
import { downloadEdited } from "../../lib/importExport.js";
import { apiPost } from "../../api/client.js";

const IMP = CONFIG.incubationImport;
const F = IMP.fields;
const PAGE_SIZE = 10;
const todayISO = () => new Date().toISOString().slice(0, 10);
const truncate = (s, n = 48) => (s.length > n ? s.slice(0, n) + "…" : s);

const payloadRow = (n) => ({ status: n.status, user: n.user, company: n.company, incubation: n.incubation, match: n.match, __hasIdentity: n.__hasIdentity });

export function ReviewStep({ onBack }) {
  const t = useUiStore((s) => s.t);
  const st = useIncubationStore();
  const { normalized, plans, issues, selected, startDates, search, page, report } = st;
  const didPreview = useRef(false);

  const preview = useMutation({
    mutationFn: () => apiPost("/api/incubation/preview", { rows: normalized.map(payloadRow) }),
    onSuccess: (data) => st.setPlans(data.rows),
    onError: () => notifications.show({ color: "red", message: t("genericError") }),
  });

  const commit = useMutation({
    mutationFn: (rows) => apiPost("/api/incubation/commit", { rows }),
    onSuccess: (rep) => { st.setReport(rep); notifications.show({ color: "green", message: t("importDone") }); },
    onError: () => notifications.show({ color: "red", message: t("importError") }),
  });

  useEffect(() => {
    if (!didPreview.current && normalized.length) { didPreview.current = true; preview.mutate(); }
  }, [normalized.length]); // eslint-disable-line

  // --- column groups (from all rows so layout is stable) ---
  const { userCols, companyCols, incCols } = useMemo(() => {
    const u = new Set(), c = new Set(), i = new Set();
    plans.forEach((p) => {
      const n = normalized[p.index];
      Object.keys(n.user || {}).forEach((k) => u.add(k));
      Object.keys(n.company || {}).forEach((k) => c.add(k));
      Object.keys(n.incubation || {}).forEach((k) => i.add(k));
    });
    const companyCols = Array.from(c);
    if (!companyCols.includes(F.companyUserId)) companyCols.push(F.companyUserId);
    return { userCols: Array.from(u), companyCols, incCols: Array.from(i) };
  }, [plans, normalized]);

  // --- search filter + pagination ---
  const filtered = useMemo(() => {
    const q = NORM(search);
    if (!q) return plans;
    return plans.filter((p) => {
      const n = normalized[p.index];
      const parts = [String(p.index + 1), n.status];
      [n.user, n.company].forEach((o) => o && Object.values(o).forEach((v) => parts.push(String(v))));
      return NORM(parts.join(" ")).includes(q);
    });
  }, [plans, normalized, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagePlans = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // --- totals from effective status ---
  const totals = useMemo(() => {
    const tot = { approved: 0, registered: 0, skipped: 0, invalid: 0 };
    plans.forEach((p) => {
      if (p.action === "invalid") return tot.invalid++;
      const e = effect(normalized[p.index].status, IMP);
      if (e.incubate) tot.approved++; else if (e.processed) tot.registered++; else tot.skipped++;
    });
    return tot;
  }, [plans, normalized]);

  const selectableCount = useMemo(() => plans.filter((p) => isSelectable(normalized, p, IMP)).length, [plans, normalized]);
  const selFiltered = filtered.filter((p) => isSelectable(normalized, p, IMP));
  const allSelected = selFiltered.length > 0 && selFiltered.every((p) => selected.has(p.index));
  const someSelected = !allSelected && selFiltered.some((p) => selected.has(p.index));

  const issueAt = (rowIdx, key, field) => issues.find((i) => i.row === rowIdx && i.key === key && i.field === field);

  const runCommit = () => {
    const chosen = plans.filter((p) => isSelectable(normalized, p, IMP) && selected.has(p.index));
    if (!chosen.length) { notifications.show({ color: "red", message: t("selectSomething") }); return; }
    const rows = chosen.map((p) => {
      const r = payloadRow(normalized[p.index]);
      if (effect(r.status, IMP).incubate) r.startDate = startDates[p.index] || todayISO();
      return r;
    });
    commit.mutate(rows);
  };

  if (preview.isPending) {
    return <Stack gap="md">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={40} radius="sm" />)}</Stack>;
  }

  const cell = (n, cols, key, canEdit, showData, rowIdx) =>
    cols.map((col) => {
      if (col === F.companyUserId) return <Table.Td key={col}><Text c="dimmed" fs="italic" size="xs">(auto)</Text></Table.Td>;
      if (!showData) return <Table.Td key={col} />;
      const v = n[key] && n[key][col] != null ? String(n[key][col]) : "";
      const iss = issueAt(rowIdx, key, col);
      if (iss && canEdit) {
        return (
          <Table.Td key={col}>
            <TextInput
              size="xs" defaultValue={v} error={iss.action === "dropped"}
              title={`${iss.action}: ${iss.reason}\noriginal: ${iss.raw}`}
              onBlur={(e) => st.fixField(rowIdx, key, col, e.currentTarget.value.trim())}
              styles={{ input: { minWidth: 130 } }}
            />
          </Table.Td>
        );
      }
      return <Table.Td key={col}><Text size="xs" title={v} lineClamp={1}>{truncate(v)}</Text></Table.Td>;
    });

  return (
    <Stack gap="lg">
      {/* totals */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Tile label={t("tApproved")} value={totals.approved} color="brand" />
        <Tile label={t("tRegistered")} value={totals.registered} color="blue" />
        <Tile label={t("tSkipped")} value={totals.skipped} color="orange" />
        <Tile label={t("tInvalid")} value={totals.invalid} color="red" />
      </SimpleGrid>

      {/* field-review message (ABOVE the search + selection toolbar) */}
      <IssuesPanel issues={issues} t={t} />

      {/* search + selection toolbar */}
      <Group justify="space-between" wrap="wrap" gap="sm">
        <TextInput
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => st.setSearch(e.currentTarget.value)}
          style={{ flex: 1, minWidth: 240 }}
        />
        <Group gap="md">
          <Checkbox
            label={t("selectAll")}
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(e) => st.setSelectedBulk(selFiltered.map((p) => p.index), e.currentTarget.checked)}
          />
          <Text size="sm" c="dimmed">{selected.size} / {selectableCount} {t("selectedCount")}</Text>
        </Group>
      </Group>

      {/* table */}
      {filtered.length === 0 ? (
        <Card><Text ta="center" c="dimmed" py="lg">{t("noMatch")}</Text></Card>
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover withTableBorder stickyHeader verticalSpacing={6} fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th colSpan={5} ta="center" style={{ opacity: 0.6 }}>—</Table.Th>
                <Table.Th colSpan={userCols.length} c="brand.6">user_profile</Table.Th>
                <Table.Th colSpan={companyCols.length} c="teal.7">company_profile</Table.Th>
                <Table.Th colSpan={incCols.length} c="orange.7">incubated_startups</Table.Th>
              </Table.Tr>
              <Table.Tr>
                <Table.Th w={36} />
                <Table.Th w={40}>#</Table.Th>
                <Table.Th>{t("colStatus")}</Table.Th>
                <Table.Th>{t("colAction")}</Table.Th>
                <Table.Th>{t("startDateLabel")}</Table.Th>
                {userCols.map((c) => <Table.Th key={c}>{c}</Table.Th>)}
                {companyCols.map((c) => <Table.Th key={c}>{c}</Table.Th>)}
                {incCols.map((c) => <Table.Th key={c}>{c}</Table.Th>)}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pagePlans.map((p) => {
                const n = normalized[p.index];
                const e = effect(n.status, IMP);
                const invalid = p.action === "invalid";
                const canEdit = e.processed && !invalid;
                const showData = !invalid;
                const editableStatus = NORM(n._origStatus) === NORM(IMP.status.registered);
                const actionText = invalid ? "invalid" : e.processed ? (e.incubate ? `${p.userAction}/${p.companyAction}+inc` : `${p.userAction}/${p.companyAction}`) : "skip";
                const sel = isSelectable(normalized, p, IMP);

                return (
                  <Table.Tr key={p.index} style={{ opacity: canEdit ? 1 : 0.6 }}>
                    <Table.Td>
                      <Checkbox size="xs" disabled={!sel} checked={sel && selected.has(p.index)}
                        onChange={(ev) => st.toggleRow(p.index, ev.currentTarget.checked)} />
                    </Table.Td>
                    <Table.Td className="mono">{p.index + 1}</Table.Td>
                    <Table.Td>
                      {editableStatus ? (
                        <Select size="xs" w={130} allowDeselect={false} value={NORM(n.status)}
                          data={[
                            { value: IMP.status.approved, label: IMP.status.approved },
                            { value: IMP.status.registered, label: IMP.status.registered },
                            { value: "rejected", label: "rejected" },
                          ]}
                          onChange={(v) => v && st.setStatus(p.index, v)} />
                      ) : <Text size="xs">{n.status}</Text>}
                    </Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{actionText}</Text></Table.Td>
                    <Table.Td>
                      {e.incubate && !invalid ? (
                        <TextInput size="xs" type="date" w={140} value={startDates[p.index] || todayISO()}
                          onChange={(ev) => st.setStartDate(p.index, ev.currentTarget.value)} />
                      ) : <Text c="dimmed" size="xs">—</Text>}
                    </Table.Td>
                    {cell(n, userCols, "user", canEdit, showData, p.index)}
                    {cell(n, companyCols, "company", canEdit, showData, p.index)}
                    {cell(n, incCols, "incubation", canEdit && e.incubate, e.incubate && !invalid, p.index)}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {filtered.length > PAGE_SIZE && (
        <Group justify="center">
          <Pagination total={pageCount} value={safePage + 1} onChange={(pp) => st.setPage(pp - 1)} />
        </Group>
      )}

      {/* actions */}
      <Group justify="space-between">
        <Button variant="default" leftSection={<IconArrowLeft size={16} stroke={1.8} />} onClick={onBack}>{t("back")}</Button>
        <Button leftSection={<IconUpload size={16} stroke={1.8} />} loading={commit.isPending} onClick={runCommit}>
          {t("confirmImport")}
        </Button>
      </Group>

      {/* report + download */}
      {report && (
        <Card padding="lg">
          <Group gap="xs" mb="sm"><IconCircleCheck size={20} color="var(--mantine-color-teal-6)" /><Text fw={600}>{t("importDone")}</Text></Group>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mb="md">
            <Stat k={t("repUsers")} v={report.createdUsers} />
            <Stat k={t("repCompanies")} v={report.createdCompanies} />
            <Stat k={t("repLinked")} v={report.linked} />
            <Stat k={t("repIncubated")} v={report.incubated} />
            <Stat k={t("repSkipped")} v={report.skipped} />
            <Stat k={t("repInvalid")} v={report.invalid} />
            <Stat k={t("repFailed")} v={(report.failed || []).length} />
          </SimpleGrid>
          <Divider mb="md" />
          <Group>
            <Text size="sm" c="dimmed" style={{ marginInlineEnd: "auto" }}>{t("downloadHint")}</Text>
            <Button variant="light" leftSection={<IconDownload size={16} stroke={1.8} />}
              onClick={() => downloadEdited("csv", st.headers, st.rawRows, normalized)}>{t("downloadCsv")}</Button>
            <Button variant="light" leftSection={<IconDownload size={16} stroke={1.8} />}
              onClick={() => downloadEdited("xlsx", st.headers, st.rawRows, normalized)}>{t("downloadExcel")}</Button>
          </Group>
        </Card>
      )}
    </Stack>
  );
}

function Tile({ label, value, color }) {
  return (
    <Card padding="md">
      <Text className="mono" fw={800} fz={26} c={`${color}.6`}>{value}</Text>
      <Text size="xs" c="dimmed">{label}</Text>
    </Card>
  );
}

function Stat({ k, v }) {
  return (
    <Group justify="space-between" gap="xs">
      <Text size="sm" c="dimmed">{k}</Text>
      <Text className="mono" fw={600}>{v}</Text>
    </Group>
  );
}

function IssuesPanel({ issues, t }) {
  if (!issues.length) {
    return <Alert color="teal" variant="light" icon={<IconCircleCheck size={18} />}>{t("noIssues")}</Alert>;
  }
  const byField = {};
  issues.forEach((i) => {
    const key = `${i.table}.${i.field}|${i.action}|${i.reason || ""}`;
    (byField[key] = byField[key] || { ...i, count: 0 }).count++;
  });
  const items = Object.values(byField).sort((a, b) => b.count - a.count);
  return (
    <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />} title={t("needsAdjust")}>
      <Stack gap={4} mt={4}>
        {items.map((i, idx) => (
          <Group key={idx} gap="xs" wrap="nowrap">
            <Badge size="xs" color={i.action === "dropped" ? "red" : "yellow"} variant="light">{i.action}</Badge>
            <Code>{i.table}.{i.field}</Code>
            <Text size="xs" c="dimmed">— {i.reason} ({i.count}× e.g. "{truncate(String(i.raw), 24)}")</Text>
          </Group>
        ))}
        <Text size="xs" c="dimmed" mt={4}>{t("issuesHint")}</Text>
      </Stack>
    </Alert>
  );
}
