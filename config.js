/* =============================================================================
 * config.js — Single source of truth for the FRONTEND.
 *
 * The frontend NEVER talks to NocoDB directly and NEVER holds the API token.
 * It calls YOUR backend (API_BASE below), which adds the `xc-token` header and
 * forwards to https://ic-nocodb.monshaat.gov.sa.
 *
 * Field names below are mapped from your real schema (user_profile,
 * ic_consultation, experts_list).
 *
 * NOTE on SingleSelect fields: option lists are only partially known from the
 * sample records (marked "// TODO complete options"). They are optional, so a
 * submission still works if left blank. Fill in the full option lists when you
 * have them so staff can pick every valid value.
 * ===========================================================================*/

const CONFIG = {
  // Base URL of YOUR backend proxy. "" = same-origin (backend serves this site).
  API_BASE: "",

  TABLES: {
    userProfile: "mlr66su3m4ef4bs",
    consultation: "mlvt0see64vuztv",
    expert: "mb0s0zf680dx712",
    events: "mzcq4lgx8vxs7oo",
    attendees: "mdusjzr5zes3rmm", // events_registration_and_attendees_table (junction)
    companyProfile: "msbt5wtpnrij5as",
    incubation: "msmze54dz2aeihh", // incubated_startups
  },

  // ---------------------------------------------------------------------------
  // USER PROFILE (user_profile)
  // ---------------------------------------------------------------------------
  userProfile: {
    // Text fields searched with `like`. The backend ALSO matches phone_number
    // and national_id exactly when the query is all digits.
    searchFields: ["en_full_name", "full_name", "Email"],

    display: {
      primary: "en_full_name",  // main name shown in results
      secondary: "Email",
      tertiary: "phone_number",
    },

    // "Create new beneficiary" form (shown when no match is found).
    createFields: [
      { key: "en_full_name", type: "text",   required: true,  labelEn: "Full name",        labelAr: "الاسم الكامل" },
      { key: "full_name",    type: "text",   required: false, labelEn: "Full name (Arabic)", labelAr: "الاسم بالعربية" },
      { key: "phone_number", type: "tel",    required: true,  labelEn: "Phone",            labelAr: "رقم الجوال" },
      { key: "Email",        type: "email",  required: false, labelEn: "Email",            labelAr: "البريد الإلكتروني" },
      { key: "national_id",  type: "number", required: false, labelEn: "National ID",      labelAr: "رقم الهوية" },
      { key: "gender",       type: "select", required: false, labelEn: "Gender",           labelAr: "الجنس",
        options: [
          { value: "Male",   labelEn: "Male",   labelAr: "ذكر" },
          { value: "Female", labelEn: "Female", labelAr: "أنثى" },
        ] },
      // Other available columns you can add here: en_first_name, en_father_name,
      // en_family_name, nationality, region_of_residence, user_type,
      // registration_date, birthdate, Program, Division ...
    ],
  },

  // ---------------------------------------------------------------------------
  // EXPERT (experts_list)
  // ---------------------------------------------------------------------------
  expert: {
    searchFields: ["expert_name_ar", "expert_name_en", "email", "phone_number"],
    display: {
      primary: "expert_name_ar",
      secondary: "expert_name_en",
    },
  },

  // ---------------------------------------------------------------------------
  // CONSULTATION (ic_consultation)
  // ---------------------------------------------------------------------------
  consultation: {
    // Fields the staff member fills in.
    formFields: [
      { key: "consultation_topic",  type: "text",     required: true,  labelEn: "Consultation topic", labelAr: "موضوع الاستشارة" },
      { key: "project_name",        type: "text",     required: false, labelEn: "Project name",       labelAr: "اسم المشروع" },
      { key: "consultation_date",   type: "date",     required: true,  labelEn: "Consultation date",  labelAr: "تاريخ الاستشارة" },
      { key: "Consultation_duration", type: "number", required: false, labelEn: "Duration (hours)",   labelAr: "المدة (ساعات)" },

      { key: "consultation_type",   type: "select",   required: false, labelEn: "Type",               labelAr: "نوع الاستشارة",
        options: [ { value: "استشارة", labelEn: "Consultation", labelAr: "استشارة" } ] }, // TODO complete options
      { key: "consultation_delivery", type: "select", required: false, labelEn: "Delivery",           labelAr: "طريقة التقديم",
        options: [ { value: "person-in", labelEn: "In person", labelAr: "حضوري" } ] }, // TODO complete options
      { key: "consultation_source", type: "select",   required: false, labelEn: "Source",             labelAr: "مصدر الاستشارة",
        options: [ { value: "walk-in", labelEn: "Walk-in", labelAr: "زيارة مباشرة" } ] }, // TODO complete options
      { key: "consultation_center", type: "select",   required: false, labelEn: "Center",             labelAr: "المركز",
        options: [ { value: "مركز الابتكار الرياض", labelEn: "Riyadh Innovation Center", labelAr: "مركز الابتكار الرياض" } ] }, // TODO complete options
      { key: "MVP opportunity",     type: "select",   required: false, labelEn: "MVP opportunity",    labelAr: "فرصة نموذج أولي",
        options: [
          { value: "نعم", labelEn: "Yes", labelAr: "نعم" },
          { value: "لا",  labelEn: "No",  labelAr: "لا" },
        ] },
      { key: "Status",              type: "select",   required: false, labelEn: "Status",             labelAr: "الحالة",
        options: [ { value: "completed", labelEn: "Completed", labelAr: "مكتملة" } ] }, // TODO complete options

      { key: "Company Name",        type: "text",     required: false, labelEn: "Company name",       labelAr: "اسم المنشأة" },
      { key: "Actions_and_comments", type: "textarea", required: false, labelEn: "Actions & comments", labelAr: "الإجراءات والملاحظات" },
    ],

    // Regular (non-link) fields to auto-fill from the selected user profile.
    // key = consultation column, value = user_profile column to copy from.
    autoFillFromUser: {
      "beneficiary_name": "en_full_name",
      // "user_id": "Id",   // uncomment if you want the profile Id copied here
    },

    // Link columns are resolved BY TITLE in the backend (see server.js), so no
    // column ids needed here. These titles come from your ic_consultation schema.
    links: {
      userFieldTitle: "User Profile", // LinkToRecord -> user_profile
      expertFieldTitle: "Expert_ID",  // LinkToRecord -> experts_list
    },
  },

  // ---------------------------------------------------------------------------
  // EVENTS (events_table) — for the workshop attendee-import feature.
  // ---------------------------------------------------------------------------
  events: {
    searchFields: ["event_name_en", "event_name_ar"],
    display: {
      primary: "event_name_en",
      secondary: "event_name_ar",
      tertiary: "event_starting_date",
    },
    // "Add event" form (shown when the event is not found).
    addEventFields: [
      { key: "event_name_en",       type: "text",   required: true,  labelEn: "Event name (EN)", labelAr: "اسم الفعالية (إنجليزي)" },
      { key: "event_name_ar",       type: "text",   required: false, labelEn: "Event name (AR)", labelAr: "اسم الفعالية (عربي)" },
      { key: "event_starting_date", type: "date",   required: false, labelEn: "Start date",      labelAr: "تاريخ البداية" },
      { key: "event_ending_date",   type: "date",   required: false, labelEn: "End date",        labelAr: "تاريخ النهاية" },
      { key: "event_venue",         type: "text",   required: false, labelEn: "Venue",           labelAr: "المكان" },
      { key: "event_presenter_name", type: "text",  required: false, labelEn: "Presenter",       labelAr: "المقدّم" },
      { key: "event_type",          type: "select", required: false, labelEn: "Type",            labelAr: "النوع",
        options: [] }, // TODO complete event_type options
      { key: "event_city",          type: "select", required: false, labelEn: "City",            labelAr: "المدينة",
        options: [ { value: "Riyadh", labelEn: "Riyadh", labelAr: "الرياض" } ] }, // TODO complete
      { key: "event_delivery_type", type: "select", required: false, labelEn: "Delivery",        labelAr: "طريقة التقديم",
        options: [] }, // TODO complete event_delivery_type options
    ],
  },

  // ---------------------------------------------------------------------------
  // ATTENDEE CSV IMPORT
  // ---------------------------------------------------------------------------
  attendeeImport: {
    // Arabic CSV header -> canonical key. Whitespace is trimmed before matching.
    // Canonical keys prefixed with "__" are not user_profile columns.
    headerMap: {
      "الاسم الأول / الاسم الأخير": "en_full_name",
      "الاسم الأول / الأخير": "en_full_name",
      "الاسم": "en_full_name",
      "الهاتف المحمول": "phone_number",
      "الجوال": "phone_number",
      "الهوية الوطنية": "national_id",
      "رقم الهوية": "national_id",
      "عنوان البريد الإلكتروني": "Email",
      "البريد الإلكتروني": "Email",
      "الجنس": "gender",
      "المدينة": "region_of_residence",
      "حالة الحضور": "__attendance",
      // Columns without a confirmed user_profile target are ignored for now:
      "المستوى التعليمي": "__ignore",
      "التصنيف": "__ignore",
      "مستوى اللغة الإنجليزية": "__ignore",
      "حالة التوظيف": "__ignore",
    },
    // user_profile columns we are allowed to write on create (others are dropped).
    writableUserFields: ["en_full_name", "phone_number", "national_id", "Email", "gender", "region_of_residence"],
    genderMap: { "ذكر": "Male", "أنثى": "Female", "male": "Male", "female": "Female" },
    cityMap: { "الرياض": "Riyadh", "جدة": "Jeddah", "الخرج": "Al Kharj" },
    attendanceTruthy: ["1", "نعم", "true", "yes", "y"],

    // Junction (events_registration_and_attendees_table) field titles.
    junction: {
      userLinkTitle: "user_profiles",       // Link -> user_profile
      eventLinkTitle: "events_tables",      // Link -> events_table
      userIdField: "user_id",               // Text (set to national_id)
      attendanceField: "event_attendance_status", // Checkbox
    },
    // Link on events_table that points to the junction (for listing existing attendees).
    eventAttendeesLinkTitle: "events_registration_and_attendees_tables",
  },

  // ---------------------------------------------------------------------------
  // INCUBATION APPLICANTS CSV IMPORT
  // Drupal webform export -> user_profile + company_profile (+ incubation for approved).
  // ---------------------------------------------------------------------------
  incubationImport: {
    // CSV column -> user_profile column (clean fields only; coded/UUID deferred).
    userFieldMap: {
      name: "full_name",
      name_en: "en_full_name",
      mobile: "phone_number",
      mail: "Email",
      national_id_number: "national_id",
      passport_number: "passport_id",
      dob: "birthdate",
      // Deferred (coded/UUID): gender, user_type, nationalities, country, city
    },
    // User match keys, in priority order (first non-empty CSV value that finds a row wins).
    // `numeric: true` -> value is stripped to digits before filtering (Number columns
    // reject values like "+966 54 115 5254" with ERR_FILTER_VERIFICATION_FAILED).
    userMatchKeys: [
      { csv: "national_id_number", col: "national_id", numeric: true },
      { csv: "residency_number",   col: "national_id", numeric: true }, // iqama
      { csv: "passport_number",    col: "passport_id" },
      { csv: "mail",               col: "Email" },
      { csv: "mobile",             col: "phone_number", numeric: true },
    ],

    // CSV column -> company_profile column (1:1 machine names).
    companyFieldMap: {
      company_name_ar: "company_name_ar",
      company_name_en: "company_name_en",
      business_brief_ar: "business_brief_ar",
      business_brief_en: "business_brief_en",
      cr_number: "cr_number",
      number_of_founding_team: "number_of_founding_team",
      number_of_employees: "number_of_employees",
      number_of_customers: "number_of_customers",
      revenue_till_date_sar: "revenue_till_date_sar",
      registration_date: "registration_date",
      website: "website",
      linkedin: "linkedin",
      x: "x",
      m_ldhy_trgb_fy_thqyqh_mn_khll_tsjylk_fy_brnmj_lhtdn: "m_ldhy_trgb_fy_thqyqh_mn_khll_tsjylk_fy_brnmj_lhtdn",
      mhw_mstwk_lhly_fy_ryd_laaml: "mhw_mstwk_lhly_fy_ryd_laaml",
      hl_trgb_blstfd_mn_mvplab: "hl_trgb_blstfd_mn_mvplab",
      mqr_brnmj_l_htdn_ldhy_trgb_bltqdym_aalyh: "mqr_brnmj_l_htdn_ldhy_trgb_bltqdym_aalyh",
      // Deferred (coded/UUID): company_industry, technologies_table,
      // company_country_base, company_city_base, company_stage, other_technologies_used
    },
    // Company match keys, in priority order.
    companyMatchKeys: [
      { csv: "cr_number",       col: "cr_number", numeric: true },
      { csv: "company_name_en", col: "company_name_en" },
      { csv: "company_name_ar", col: "company_name_ar" },
    ],

    // Local validation run BEFORE any NocoDB call. Values are auto-corrected
    // where safe (numbers stripped to digits, dates normalized) and anything
    // unusable is dropped and reported so you can fix it in the preview.
    // type: number | email | date | url
    validate: {
      user: {
        phone_number: "number", national_id: "number",
        Email: "email", birthdate: "date", registration_date: "date",
      },
      company: {
        cr_number: "number", company_unified_number: "number",
        number_of_founding_team: "number", number_of_employees: "number",
        number_of_customers: "number", revenue_till_date_sar: "number",
        company_email: "email",
        registration_date: "date", company_registration_date: "date",
        website: "url", linkedin: "url", x: "url",
      },
      incubation: {
        Email: "email", "Team Size": "number", Add_date: "date",
      },
    },
    // Display fields for the preview (company identity).
    companyDisplay: { primary: "company_name_ar", secondary: "company_name_en" },

    // --- Derived / computed field names (edit if a NocoDB column title differs) ---
    fields: {
      // user_profile
      userRegistrationDate: "registration_date",
      userGender: "gender",
      userIdType: "id_type",
      userType: "user_type",
      userProgram: "Program",
      userPhone: "phone_number", // digits-only (Number column)
      // company_profile
      companyUserId: "user_id",               // set to the created user's NocoDB Id (server-side)
      companyUnifiedNumber: "company_unified_number", // from cr_number
      companyEmail: "company_email",           // from CSV mail
      companyRegistrationDate: "company_registration_date", // upload date
      companyBusinessIndustry: "business_industry", // from company_industry
      companyTechnologyUsed: "technology_used",     // from technologies_table
      // incubated_startups
      incCompanyName: "Company name",
      incDescription: "Description",
      incEmail: "Email",
      incPhone: "Phone",
      incName: "Name",
      incAddDate: "Add_date",
      incSector: "Sector",
      incTechUsed: "Tech Used",
      incTeamSize: "Team Size",
    },
    // CSV source columns used for derived values.
    csv: {
      gender: "gender",
      userType: "user_type",
      nationalId: "national_id_number",
      residency: "residency_number",
      passport: "passport_number",
      companyIndustry: "company_industry",
      technologies: "technologies_table",
      companyNameAr: "company_name_ar",
      companyNameEn: "company_name_en",
      briefAr: "business_brief_ar",
      briefEn: "business_brief_en",
      teamSize: "number_of_founding_team",
      mail: "mail",
      mobile: "mobile",
      name: "name",
      nameEn: "name_en",
      crNumber: "cr_number",
    },
    programValue: "الاحتضان",
    genderMap: { "1": "Male", "2": "Female" },
    // id_type tag by which id number is present (national -> residency -> passport).
    idTypeValues: { national: "saudi national id", residency: "saudi iqama", passport: "no saudi id or iqama" },
    // CSV user_type (Arabic) -> user_profile user_type tag (from the NocoDB options).
    userTypeMap: {
      "رائد أعمال": "entrepreneur",
      "طالب": "student",
      "موظف": "employee",
      "صاحب منشأة": "business owner",
      "مرشد": "mentor",
      "موجّه": "mentor",
      "موجه": "mentor",
      "مستثمر": "investor",
    },

    statusColumn: "registration_status",
    status: {
      approved: "approved",     // user + company + link + incubation (start date)
      registered: "registered", // user + company + link, no incubation
      // anything else (rejected / blank / unknown) -> skip row entirely
    },

    // incubated_startups column to write the start date into.
    incubationStartDateField: "incubation_start_date",

    // Optional title hints if a table has MORE THAN ONE link to the same target
    // (backend resolves links by related-table id first; these disambiguate).
    linkTitleHints: {
      companyToUser: "",   // company_profile -> user_profile
      incubationToCompany: "", // incubated_startups -> company_profile
      incubationToUser: "",    // incubated_startups -> user_profile
    },
  },
};

window.CONFIG = CONFIG;
