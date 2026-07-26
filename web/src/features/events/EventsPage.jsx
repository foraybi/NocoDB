import { PageHeader } from "../../components/PageHeader.jsx";
import { ComingSoon } from "../../components/ComingSoon.jsx";
import { useUiStore } from "../../stores/uiStore";

export function EventsPage() {
  const t = useUiStore((s) => s.t);
  return (
    <>
      <PageHeader title={t("events")} />
      <ComingSoon label={t("comingSoon")} />
    </>
  );
}
