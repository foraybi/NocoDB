import { TextInput, Textarea, Select, Stack } from "@mantine/core";
import { useUiStore } from "../stores/uiStore";

export function fieldLabel(f, lang) {
  return lang === "ar" ? f.labelAr || f.labelEn : f.labelEn || f.labelAr;
}

// Renders a config-driven form (config.js createFields / formFields / addEventFields).
export function DynamicForm({ fields, values, errors = {}, onChange }) {
  const lang = useUiStore((s) => s.lang);
  return (
    <Stack gap="sm">
      {fields.map((f) => {
        const label = fieldLabel(f, lang);
        const val = values[f.key] ?? "";
        const err = errors[f.key];
        if (f.type === "textarea") {
          return (
            <Textarea key={f.key} label={label} withAsterisk={f.required} autosize minRows={3}
              value={val} error={err} onChange={(e) => onChange(f.key, e.currentTarget.value)} />
          );
        }
        if (f.type === "select") {
          const data = (f.options || []).map((o) => ({ value: o.value, label: lang === "ar" ? o.labelAr || o.value : o.labelEn || o.value }));
          return (
            <Select key={f.key} label={label} withAsterisk={f.required} data={data} clearable searchable
              value={val || null} error={err} onChange={(v) => onChange(f.key, v || "")} />
          );
        }
        const type = f.type === "tel" ? "tel" : f.type === "email" ? "email" : f.type === "date" ? "date" : f.type === "number" ? "number" : "text";
        return (
          <TextInput key={f.key} label={label} withAsterisk={f.required} type={type}
            value={val} error={err} onChange={(e) => onChange(f.key, e.currentTarget.value)} />
        );
      })}
    </Stack>
  );
}

// Validate required fields; returns { key: message } (empty when valid).
export function validateRequired(fields, values, requiredMsg) {
  const errs = {};
  fields.forEach((f) => {
    if (f.required && !String(values[f.key] ?? "").trim()) errs[f.key] = requiredMsg;
  });
  return errs;
}
