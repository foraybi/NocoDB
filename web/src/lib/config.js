/* config.js (ESM) — single source of truth for the frontend field mappings.
 * Ported verbatim from the legacy vanilla config; only the export changed. */
export const CONFIG = {
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

  // ---- USER PROFILE ----
  userProfile: {
    searchFields: ["en_full_name", "full_name", "Email"],
    display: { primary: "en_full_name", secondary: "Email", tertiary: "phone_number" },
    createFields: [
      { key: "en_full_name", type: "text", required: true, labelEn: "Full name", labelAr: "الاسم الكامل" },
      { key: "full_name", type: "text", required: false, labelEn: "Full name (Arabic)", labelAr: "الاسم بالعربية" },
      { key: "phone_number", type: "tel", required: true, labelEn: "Phone", labelAr: "رقم الجوال" },
      { key: "Email", type: "email", required: false, labelEn: "Email", labelAr: "البريد الإلكتروني" },
      { key: "national_id", type: "number", required: false, labelEn: "National ID", labelAr: "رقم الهوية" },
      { key: "gender", type: "select", required: false, labelEn: "Gender", labelAr: "الجنس",
        options: [
          { value: "Male", labelEn: "Male", labelAr: "ذكر" },
          { value: "Female", labelEn: "Female", labelAr: "أنثى" },
        ] },
    ],
  },

  // ---- EXPERT ----
  expert: {
    searchFields: ["expert_name_ar", "expert_name_en", "email", "phone_number"],
    display: { primary: "expert_name_ar", secondary: "expert_name_en" },
  },

  // ---- CONSULTATION ----
  consultation: {
    formFields: [
      { key: "consultation_topic", type: "text", required: true, labelEn: "Consultation topic", labelAr: "موضوع الاستشارة" },
      { key: "project_name", type: "text", required: false, labelEn: "Project name", labelAr: "اسم المشروع" },
      { key: "consultation_date", type: "date", required: true, labelEn: "Consultation date", labelAr: "تاريخ الاستشارة" },
      { key: "Consultation_duration", type: "number", required: false, labelEn: "Duration (hours)", labelAr: "المدة (ساعات)" },
      { key: "consultation_type", type: "select", required: false, labelEn: "Type", labelAr: "نوع الاستشارة",
        options: [{ value: "استشارة", labelEn: "Consultation", labelAr: "استشارة" }] },
      { key: "consultation_delivery", type: "select", required: false, labelEn: "Delivery", labelAr: "طريقة التقديم",
        options: [{ value: "person-in", labelEn: "In person", labelAr: "حضوري" }] },
      { key: "consultation_source", type: "select", required: false, labelEn: "Source", labelAr: "مصدر الاستشارة",
        options: [{ value: "walk-in", labelEn: "Walk-in", labelAr: "زيارة مباشرة" }] },
      { key: "consultation_center", type: "select", required: false, labelEn: "Center", labelAr: "المركز",
        options: [{ value: "مركز الابتكار الرياض", labelEn: "Riyadh Innovation Center", labelAr: "مركز الابتكار الرياض" }] },
      { key: "MVP opportunity", type: "select", required: false, labelEn: "MVP opportunity", labelAr: "فرصة نموذج أولي",
        options: [
          { value: "نعم", labelEn: "Yes", labelAr: "نعم" },
          { value: "لا", labelEn: "No", labelAr: "لا" },
        ] },
      { key: "Status", type: "select", required: false, labelEn: "Status", labelAr: "الحالة",
        options: [{ value: "completed", labelEn: "Completed", labelAr: "مكتملة" }] },
      { key: "Company Name", type: "text", required: false, labelEn: "Company name", labelAr: "اسم المنشأة" },
      { key: "Actions_and_comments", type: "textarea", required: false, labelEn: "Actions & comments", labelAr: "الإجراءات والملاحظات" },
    ],
    autoFillFromUser: { beneficiary_name: "en_full_name" },
    links: { userFieldTitle: "User Profile", expertFieldTitle: "Expert_ID" },
  },

  // ---- EVENTS ----
  events: {
    searchFields: ["event_name_en", "event_name_ar"],
    display: { primary: "event_name_en", secondary: "event_name_ar", tertiary: "event_starting_date" },
    addEventFields: [
      { key: "event_name_en", type: "text", required: true, labelEn: "Event name (EN)", labelAr: "اسم الفعالية (إنجليزي)" },
      { key: "event_name_ar", type: "text", required: false, labelEn: "Event name (AR)", labelAr: "اسم الفعالية (عربي)" },
      { key: "event_starting_date", type: "date", required: false, labelEn: "Start date", labelAr: "تاريخ البداية" },
      { key: "event_ending_date", type: "date", required: false, labelEn: "End date", labelAr: "تاريخ النهاية" },
      { key: "event_venue", type: "text", required: false, labelEn: "Venue", labelAr: "المكان" },
      { key: "event_presenter_name", type: "text", required: false, labelEn: "Presenter", labelAr: "المقدّم" },
      { key: "event_type", type: "select", required: false, labelEn: "Type", labelAr: "النوع", options: [] },
      { key: "event_city", type: "select", required: false, labelEn: "City", labelAr: "المدينة",
        options: [{ value: "Riyadh", labelEn: "Riyadh", labelAr: "الرياض" }] },
      { key: "event_delivery_type", type: "select", required: false, labelEn: "Delivery", labelAr: "طريقة التقديم", options: [] },
    ],
  },

  // ---- ATTENDEE CSV IMPORT ----
  attendeeImport: {
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
      "المستوى التعليمي": "__ignore",
      "التصنيف": "__ignore",
      "مستوى اللغة الإنجليزية": "__ignore",
      "حالة التوظيف": "__ignore",
    },
    writableUserFields: ["en_full_name", "phone_number", "national_id", "Email", "gender", "region_of_residence"],
    genderMap: { "ذكر": "Male", "أنثى": "Female", male: "Male", female: "Female" },
    cityMap: { "الرياض": "Riyadh", "جدة": "Jeddah", "الخرج": "Al Kharj" },
    attendanceTruthy: ["1", "نعم", "true", "yes", "y"],
    junction: {
      userLinkTitle: "user_profiles",
      eventLinkTitle: "events_tables",
      userIdField: "user_id",
      attendanceField: "event_attendance_status",
    },
    eventAttendeesLinkTitle: "events_registration_and_attendees_tables",
  },

  // ---- INCUBATION APPLICANTS CSV IMPORT ----
  incubationImport: {
    userFieldMap: {
      name: "full_name",
      name_en: "en_full_name",
      mobile: "phone_number",
      mail: "Email",
      national_id_number: "national_id",
      passport_number: "passport_id",
      dob: "birthdate",
    },
    userMatchKeys: [
      { csv: "national_id_number", col: "national_id", numeric: true },
      { csv: "residency_number", col: "national_id", numeric: true },
      { csv: "passport_number", col: "passport_id" },
      { csv: "mail", col: "Email" },
      { csv: "mobile", col: "phone_number", numeric: true },
    ],
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
    },
    companyMatchKeys: [
      { csv: "cr_number", col: "cr_number", numeric: true },
      { csv: "company_name_en", col: "company_name_en" },
      { csv: "company_name_ar", col: "company_name_ar" },
    ],
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
      incubation: { Email: "email", "Team Size": "number", Add_date: "date", "Intro Link": "url" },
    },
    companyDisplay: { primary: "company_name_ar", secondary: "company_name_en" },
    fields: {
      userRegistrationDate: "registration_date",
      userGender: "gender",
      userIdType: "id_type",
      userType: "user_type",
      userProgram: "Program",
      userPhone: "phone_number",
      companyUserId: "user_id",
      companyUnifiedNumber: "company_unified_number",
      companyEmail: "company_email",
      companyRegistrationDate: "company_registration_date",
      companyBusinessIndustry: "business_industry",
      companyTechnologyUsed: "technology_used",
      incCompanyName: "Company name",
      incDescription: "Description",
      incEmail: "Email",
      incPhone: "Phone",
      incName: "Name",
      incAddDate: "Add_date",
      incSector: "Sector",
      incTechUsed: "Tech Used",
      incTeamSize: "Team Size",
      incIntroLink: "Intro Link",
    },
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
      companyProfile: "company_profile",
    },
    programValue: "الاحتضان",
    genderMap: { "1": "Male", "2": "Female" },
    idTypeValues: { national: "saudi national id", residency: "saudi iqama", passport: "no saudi id or iqama" },
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
    status: { approved: "approved", registered: "registered" },
    incubationStartDateField: "incubation_start_date",
    linkTitleHints: { companyToUser: "", incubationToCompany: "", incubationToUser: "" },
  },

  // ---- TECH ADOPTION (tech_adoption mm7wmx8m3jsovrj) ----
  // Links are stored as IDs in scalar columns (user_id / compnay_id / expert_id).
  techAdoption: {
    // Session fields staff fill (single form) and CSV columns (bulk import).
    formFields: [
      { key: "project_name", type: "text", required: false, labelEn: "Project name", labelAr: "اسم المشروع" },
      { key: "tech_adoption_date", type: "date", required: true, labelEn: "Session date", labelAr: "تاريخ الجلسة" },
      { key: "tech_adoption_description", type: "textarea", required: false, labelEn: "Description", labelAr: "الوصف" },
      { key: "tech_adoption_impact", type: "textarea", required: false, labelEn: "Impact", labelAr: "الأثر" },
    ],
    // tech_adoption column names (note the source typo "compnay_id").
    fields: {
      companyName: "Company_Name",
      userId: "user_id",
      companyId: "compnay_id",
      expertId: "expert_id",
      beneficiaryName: "beneficiary_name_en",
    },
    // Company picker display (company_profile).
    companyDisplay: { primary: "company_name_ar", secondary: "company_name_en", tertiary: "cr_number" },
    // company_profile column holding the owner user's Id (set during incubation import).
    companyOwnerIdField: "user_id",
    validate: { session: { tech_adoption_date: "date" } },
    // Bulk import: match existing company + user (same keys as incubation).
    bulk: {
      companyMatchKeys: [
        { csv: "cr_number", col: "cr_number", numeric: true },
        { csv: "company_name_en", col: "company_name_en" },
        { csv: "company_name_ar", col: "company_name_ar" },
      ],
      userMatchKeys: [
        { csv: "national_id_number", col: "national_id", numeric: true },
        { csv: "mail", col: "Email" },
        { csv: "mobile", col: "phone_number", numeric: true },
      ],
    },
  },
};

export default CONFIG;
