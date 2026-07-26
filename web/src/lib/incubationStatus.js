/* Effective-status logic shared by the store and the review UI. */
export const NORM = (s) => String(s == null ? "" : s).trim().toLowerCase();

export function effect(status, IMP) {
  const s = NORM(status), S = IMP.status;
  if (s === NORM(S.approved)) return { processed: true, incubate: true };
  if (s === NORM(S.registered)) return { processed: true, incubate: false };
  return { processed: false, incubate: false }; // rejected / blank / unknown
}

export function isSelectable(normalized, plan, IMP) {
  return plan.action !== "invalid" && effect(normalized[plan.index].status, IMP).processed;
}
