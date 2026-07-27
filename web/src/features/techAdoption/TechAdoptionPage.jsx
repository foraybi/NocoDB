import { PageHeader } from "../../components/PageHeader.jsx";
import { ComingSoon } from "../../components/ComingSoon.jsx";
import { useUiStore } from "../../stores/uiStore";

export function TechAdoptionPage() {
  const t = useUiStore((s) => s.t);
  return (
    <>
      <PageHeader title={t("techAdoption")} subtitle={t("techAdoptionSubtitle")} />
      <ComingSoon label={t("comingSoon")} />
    </>
  );
}
