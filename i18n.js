/* i18n.js — bilingual strings (Arabic + English) and direction handling. */
const I18N = {
  ar: {
    appTitle: "حجز استشارة",
    stepUser: "المستفيد",
    stepConsultation: "الاستشارة",
    stepExpert: "المستشار",
    stepReview: "المراجعة",
    findUserTitle: "ابحث عن المستفيد",
    findUserHint: "ابحث بالاسم أو البريد أو الجوال. إذا لم يوجد، يمكنك إنشاء ملف جديد.",
    searchPlaceholder: "ابحث عن مستفيد...",
    noUserFound: "لا يوجد مستفيد مطابق.",
    createUser: "إنشاء ملف مستفيد جديد",
    newUserTitle: "ملف مستفيد جديد",
    cancel: "إلغاء",
    saveContinue: "حفظ ومتابعة",
    selectedUser: "المستفيد المحدد:",
    change: "تغيير",
    consultationTitle: "تفاصيل الاستشارة",
    chooseExpertTitle: "اختر المستشار",
    expertSearchPlaceholder: "ابحث عن مستشار...",
    reviewTitle: "مراجعة وإرسال",
    back: "رجوع",
    next: "التالي",
    submit: "إرسال الاستشارة",
    required: "هذا الحقل مطلوب",
    searching: "جارٍ البحث...",
    loading: "جارٍ التحميل...",
    noExperts: "لا يوجد مستشارون مطابقون.",
    selectExpertFirst: "الرجاء اختيار مستشار.",
    selectUserFirst: "الرجاء اختيار أو إنشاء مستفيد.",
    userCreated: "تم إنشاء ملف المستفيد.",
    submitting: "جارٍ الإرسال...",
    submitSuccess: "تم إرسال الاستشارة بنجاح.",
    submitError: "تعذّر الإرسال. حاول مرة أخرى.",
    reviewUser: "المستفيد",
    reviewConsultation: "الاستشارة",
    reviewExpert: "المستشار",
    genericError: "حدث خطأ. حاول مرة أخرى.",
  },
  en: {
    appTitle: "Book a Consultation",
    stepUser: "Beneficiary",
    stepConsultation: "Consultation",
    stepExpert: "Consultant",
    stepReview: "Review",
    findUserTitle: "Find the beneficiary",
    findUserHint: "Search by name, email or phone. If none exists, you can create a new profile.",
    searchPlaceholder: "Search for a beneficiary...",
    noUserFound: "No matching beneficiary.",
    createUser: "Create a new beneficiary profile",
    newUserTitle: "New beneficiary profile",
    cancel: "Cancel",
    saveContinue: "Save & continue",
    selectedUser: "Selected beneficiary:",
    change: "Change",
    consultationTitle: "Consultation details",
    chooseExpertTitle: "Choose a consultant",
    expertSearchPlaceholder: "Search for a consultant...",
    reviewTitle: "Review & submit",
    back: "Back",
    next: "Next",
    submit: "Submit consultation",
    required: "This field is required",
    searching: "Searching...",
    loading: "Loading...",
    noExperts: "No matching consultants.",
    selectExpertFirst: "Please select a consultant.",
    selectUserFirst: "Please select or create a beneficiary.",
    userCreated: "Beneficiary profile created.",
    submitting: "Submitting...",
    submitSuccess: "Consultation submitted successfully.",
    submitError: "Submission failed. Please try again.",
    reviewUser: "Beneficiary",
    reviewConsultation: "Consultation",
    reviewExpert: "Consultant",
    genericError: "Something went wrong. Please try again.",
  },
};

const i18nState = { lang: "ar" };

function t(key) {
  return (I18N[i18nState.lang] && I18N[i18nState.lang][key]) || key;
}

function applyLanguage(lang) {
  i18nState.lang = lang;
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
  });
  const toggle = document.getElementById("langToggle");
  if (toggle) toggle.textContent = lang === "ar" ? "English" : "العربية";

  document.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
}

// pick a label from a config field object based on current language
function fieldLabel(field) {
  return i18nState.lang === "ar" ? field.labelAr || field.labelEn : field.labelEn || field.labelAr;
}

window.t = t;
window.applyLanguage = applyLanguage;
window.fieldLabel = fieldLabel;
window.i18nState = i18nState;
