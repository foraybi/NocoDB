import { PageHeader } from "../../components/PageHeader.jsx";
import { ComingSoon } from "../../components/ComingSoon.jsx";
import { useUiStore } from "../../stores/uiStore";

export function IncubationPage() {
  const t = useUiStore((s) => s.t);
  return (
    <>
      <PageHeader title={t("incubation")} />
      <ComingSoon label={t("comingSoon")} />
    </>
  );
}
