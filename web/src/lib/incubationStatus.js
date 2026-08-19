/* Effective-status logic shared by the store and the review UI. */
export const NORM = (s) => String(s == null ? "" : s).trim().toLowerCase();

// "registered" and "new" behave identically: create user + company, no
// incubation record. Kept as a set so more aliases can be added in one place.
export function isRegisteredLike(status, IMP) {
  const s = NORM(status), S = IMP.status;
  return s === NORM(S.registered) || (S.new && s === NORM(S.new));
}

export function effect(status, IMP) {
  const s = NORM(status), S = IMP.status;
  if (s === NORM(S.approved)) return { processed: true, incubate: true };
  if (isRegisteredLike(status, IMP)) return { processed: true, incubate: false };
  return { processed: false, incubate: false }; // rejected / blank / unknown
}

export function isSelectable(normalized, plan, IMP) {
  return plan.action !== "invalid" && effect(normalized[plan.index].status, IMP).processed;
}
