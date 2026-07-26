import { useState } from "react";
import { Stepper } from "@mantine/core";
import { PageHeader } from "../../components/PageHeader.jsx";
import { useUiStore } from "../../stores/uiStore";
import { useIncubationStore } from "../../stores/incubationStore";
import { UploadStep } from "./UploadStep.jsx";
import { ReviewStep } from "./ReviewStep.jsx";

export function IncubationPage() {
  const t = useUiStore((s) => s.t);
  const [step, setStep] = useState(0);
  const hasRows = useIncubationStore((s) => s.rawRows.length > 0);

  return (
    <>
      <PageHeader title={t("incubation")} subtitle={t("incSubtitle")} />
      <Stepper active={step} onStepClick={setStep} mb="xl" size="sm">
        <Stepper.Step label={t("stepUpload")} allowStepSelect={step > 0} />
        <Stepper.Step label={t("stepReview")} allowStepSelect={hasRows} />
      </Stepper>

      {step === 0 ? (
        <UploadStep onNext={() => setStep(1)} />
      ) : (
        <ReviewStep onBack={() => setStep(0)} />
      )}
    </>
  );
}
