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
};

window.CONFIG = CONFIG;
