import { useState } from "react";
import { Stepper } from "@mantine/core";
import { PageHeader } from "../../components/PageHeader.jsx";
import { useUiStore } from "../../stores/uiStore";
import { useEventsStore } from "../../stores/eventsStore";
import { EventSelectStep } from "./EventSelectStep.jsx";
import { AttendeeUploadStep } from "./AttendeeUploadStep.jsx";
import { AttendeeReviewStep } from "./AttendeeReviewStep.jsx";

export function EventsPage() {
  const t = useUiStore((s) => s.t);
  const [step, setStep] = useState(0);
  const event = useEventsStore((s) => s.event);
  const hasRows = useEventsStore((s) => s.rows.length > 0);

  return (
    <>
      <PageHeader title={t("events")} subtitle={t("evSubtitle")} />
      <Stepper active={step} onStepClick={setStep} mb="xl" size="sm">
        <Stepper.Step label={t("evStepEvent")} />
        <Stepper.Step label={t("evStepUpload")} allowStepSelect={!!event} />
        <Stepper.Step label={t("evStepReview")} allowStepSelect={!!event && hasRows} />
      </Stepper>

      {step === 0 && <EventSelectStep onNext={() => setStep(1)} />}
      {step === 1 && <AttendeeUploadStep onBack={() => setStep(0)} onNext={() => setStep(2)} />}
      {step === 2 && <AttendeeReviewStep onBack={() => setStep(1)} />}
    </>
  );
}
