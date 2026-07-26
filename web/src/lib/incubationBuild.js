/* incubationBuild.js (ESM) — pure builder that turns raw CSV rows into the three
 * insert payloads (user_profile, company_profile, incubated_startups) + match
 * pairs. Ported verbatim from the legacy UMD module. */
import * as CSVKit from "./csv.js";

// Build one normalized row (3 payloads + match info) from a raw CSV row.
export function buildRow(row, IMP, today) {
  const F = IMP.fields, C = IMP.csv;
  const val = (col) => CSVKit.clean(row[col]);

  const mobile = val(C.mobile);
  const mobileDigits = mobile ? CSVKit.digits(mobile) : "";

  // ---- user_profile ----
  const user = CSVKit.mapFields(row, IMP.userFieldMap);
  if (mobileDigits) user[F.userPhone] = mobileDigits; // digits only for the Number column
  user[F.userRegistrationDate] = today;
  user[F.userProgram] = IMP.programValue;
  const g = val(C.gender);
  if (IMP.genderMap[g]) user[F.userGender] = IMP.genderMap[g];
  const nat = val(C.nationalId), res = val(C.residency), pas = val(C.passport);
  if (nat) user[F.userIdType] = IMP.idTypeValues.national;
  else if (res) user[F.userIdType] = IMP.idTypeValues.residency;
  else if (pas) user[F.userIdType] = IMP.idTypeValues.passport;
  const ut = val(C.userType);
  if (IMP.userTypeMap[ut]) user[F.userType] = IMP.userTypeMap[ut];

  // ---- company_profile ----
  const company = CSVKit.mapFields(row, IMP.companyFieldMap);
  company[F.companyRegistrationDate] = today;
  const cr = val(C.crNumber); if (cr) company[F.companyUnifiedNumber] = cr;
  const mail = val(C.mail); if (mail) company[F.companyEmail] = mail;
  const industry = val(C.companyIndustry); if (industry) company[F.companyBusinessIndustry] = industry;
  const tech = val(C.technologies); if (tech) company[F.companyTechnologyUsed] = tech;
  // company[F.companyUserId] injected server-side (created user's Id)

  // ---- incubated_startups ----
  const inc = {};
  const cName = val(C.companyNameAr) || val(C.companyNameEn); if (cName) inc[F.incCompanyName] = cName;
  const desc = val(C.briefAr) || val(C.briefEn); if (desc) inc[F.incDescription] = desc;
  if (mail) inc[F.incEmail] = mail;
  if (mobileDigits) inc[F.incPhone] = mobileDigits;
  const uName = val(C.name) || val(C.nameEn); if (uName) inc[F.incName] = uName;
  inc[F.incAddDate] = today;
  if (industry) inc[F.incSector] = industry;
  if (tech) inc[F.incTechUsed] = tech;
  const team = val(C.teamSize); if (team) inc[F.incTeamSize] = team;
  const introLink = val(C.companyProfile); if (introLink) inc[F.incIntroLink] = introLink;

  // Match pairs: numeric-target columns must be digits only (NocoDB Number cols).
  const pair = (k) => {
    const v = val(k.csv);
    return [k.col, k.numeric ? CSVKit.digits(v) : v];
  };
  const userPairs = IMP.userMatchKeys.map(pair).filter(([, v]) => v !== "");
  const companyPairs = IMP.companyMatchKeys.map(pair).filter(([, v]) => v !== "");
  const hasIdentity = !!(user.full_name || user.en_full_name || userPairs.length);

  return {
    status: val(IMP.statusColumn),
    user, company, incubation: inc,
    match: { user: userPairs, company: companyPairs },
    __hasIdentity: hasIdentity,
  };
}

export function buildRows(rawRows, IMP, today) {
  return rawRows.map((r) => buildRow(r, IMP, today));
}
