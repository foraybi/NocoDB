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
};

window.CONFIG = CONFIG;
