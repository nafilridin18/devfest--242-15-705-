/**
 * Tender Package Builder - i18n Internationalization Engine
 * Full English & Bengali (Bangla) bidirectional dictionary
 */

export const DICTIONARY = {
  en: {
    app_title: "Tender Package Builder",
    app_subtitle: "Compliant Assembly & Serialization System",
    badge_gp: "e-GP Compliant",
    theme_light: "Light",
    theme_dark: "Dark",
    try_sample: "Try Sample Pack",
    load_custom_json: "Load Tender JSON",
    step_1_label: "Step 1",
    step_1_title: "Tender Spec",
    step_2_label: "Step 2",
    step_2_title: "Upload & Match",
    step_3_label: "Step 3",
    step_3_title: "Validate & Build",

    tender_id: "Tender ID",
    tender_title: "Tender Title",
    tender_entity: "Procuring Entity",
    tender_bidder: "Bidder / Contractor",
    submission_deadline: "Submission Deadline",
    ready_counter: "{ready} of {total} ready",

    requirements_list_title: "Document Requirements",
    auto_match_btn: "Auto-Match",
    undo_btn: "Undo",
    filter_all: "All Documents",
    filter_problems: "Show Problems Only",
    filter_ready: "Ready Only",

    mandatory_tag: "Mandatory",
    optional_tag: "Optional",
    select_file_placeholder: "-- Select or Drop Matched File --",
    unmatch_btn: "Unmatch",
    matched_doc: "Matched:",
    pages_count: "{n} pages",
    page_singular: "1 page",

    expiry_label: "Document Expiry Date:",
    expiry_hint_needed: "Please specify document expiry date",
    expiry_msg_expired: "Expires {date}, before tender deadline {deadline}",
    expiry_msg_valid: "Valid until {date} (Passes deadline {deadline})",

    file_tray_title: "Uploaded Files Pool",
    clear_all_files: "Clear Pool",
    dropzone_title: "Drag & drop PDF files here",
    dropzone_hint: "or click to browse from device (PDF only, max 50 MB total)",
    file_duplicate_of: "Duplicate of {name}",
    file_error_corrupt: "Cannot read PDF (Corrupted / Password-protected)",
    file_error_not_pdf: "Invalid format (Must be PDF with %PDF- header)",

    blocker_title: "Generate is disabled because:",
    blocker_missing: "{doc} is Mandatory and Missing",
    blocker_expired: "{doc} is Expired (before deadline)",
    blocker_expiry_needed: "{doc} requires an Expiry Date",
    blocker_duplicate: "{doc} is matched to a duplicate file",

    export_csv_btn: "Export Checklist CSV",
    generate_package_btn: "Generate Package PDF",
    generating_pdf: "Assembling Final PDF Package...",

    status_OK: "Ready",
    status_MISSING: "Missing",
    status_EXPIRY_NEEDED: "Expiry Needed",
    status_EXPIRED: "Expired",
    status_NOT_PROVIDED: "Not Provided (Optional)",

    toast_sample_loaded: "Sample Tender Pack loaded successfully!",
    toast_matched: "Matched '{file}' to '{req}'",
    toast_unmatched: "Unmatched '{file}' from '{req}'",
    toast_duplicate_blocked: "Cannot match: '{file}' is a content duplicate of '{original}'",
    toast_corrupt_blocked: "Cannot match: file could not be read as a valid PDF",
    toast_auto_matched: "Auto-matched {count} documents by filename!",
    toast_no_auto_match: "No additional matching filename patterns found.",
    toast_pdf_success: "Package PDF generated successfully! ({size} MB, {pages} pages)",
    toast_csv_exported: "Verification checklist CSV downloaded.",
    toast_undo: "Last match action reverted."
  },
  bn: {
    app_title: "টেন্ডার প্যাকেজ বিল্ডার",
    app_subtitle: "নিয়মনিষ্ঠ দরপত্র সংকলন ও পেজ নম্বর প্রস্তুতকারক",
    badge_gp: "ই-জিপি স্ট্যান্ডার্ড",
    theme_light: "লাইট",
    theme_dark: "ডার্ক",
    try_sample: "নমুনা প্যাক লোড করুন",
    load_custom_json: "কাস্টম টেন্ডার JSON",
    step_1_label: "ধাপ ১",
    step_1_title: "টেন্ডার বিবরণ",
    step_2_label: "ধাপ ২",
    step_2_title: "আপলোড ও মিলকরণ",
    step_3_label: "ধাপ ৩",
    step_3_title: "যাচাই ও তৈরি",

    tender_id: "টেন্ডার আইডি",
    tender_title: "দরপত্রের শিরোনাম",
    tender_entity: "ক্রয়কারী সংস্থা",
    tender_bidder: "দরপত্রদাতা / ঠিকাদার",
    submission_deadline: "জমা দেওয়ার শেষ তারিখ",
    ready_counter: "{total} টির মধ্যে {ready} টি প্রস্তুত",

    requirements_list_title: "প্রয়োজনীয় দলিলের তালিকা",
    auto_match_btn: "স্বয়ংক্রিয় ম্যাচ",
    undo_btn: "পূর্বাবস্থা (Undo)",
    filter_all: "সকল দলিল",
    filter_problems: "সমস্যাগুলো দেখুন",
    filter_ready: "প্রস্তুত দলিল",

    mandatory_tag: "বাধ্যতামূলক",
    optional_tag: "ঐচ্ছিক",
    select_file_placeholder: "-- মিলযুক্ত ফাইল নির্বাচন করুন বা টেনে আনুন --",
    unmatch_btn: "বাতিল",
    matched_doc: "যুক্ত:",
    pages_count: "{n} পাতা",
    page_singular: "১ পাতা",

    expiry_label: "সনদের মেয়াদ উত্তীর্ণের তারিখ:",
    expiry_hint_needed: "অনুগ্রহ করে সনদের মেয়াদ উল্লেখ করুন",
    expiry_msg_expired: "মেয়াদ {date}, যা দরপত্র জমা শেষ তারিখ {deadline} এর পূর্বেই শেষ",
    expiry_msg_valid: "মেয়াদ {date} পর্যন্ত বৈধ (শেষ তারিখ {deadline} পূরণ করে)",

    file_tray_title: "আপলোডকৃত ফাইলের তালিকা",
    clear_all_files: "তালিকা খালি করুন",
    dropzone_title: "এখানে PDF ফাইল টেনে আনুন",
    dropzone_hint: "অথবা ব্রাউজ করে নির্বাচন করুন (শুধু PDF, সর্বোচ্চ ৫০ মেগাবাইট)",
    file_duplicate_of: "{name} এর ডুপ্লিকেট কপি",
    file_error_corrupt: "PDF পড়া যাচ্ছে না (নষ্ট অথবা পাসওয়ার্ড সুরক্ষিত)",
    file_error_not_pdf: "ভুল ফরম্যাট (%PDF- হেডার আবশ্যক)",

    blocker_title: "প্যাকেজ তৈরি নিষ্ক্রিয় কারণ:",
    blocker_missing: "{doc} বাধ্যতামূলক কিন্তু সংযুক্ত করা হয়নি",
    blocker_expired: "{doc} এর মেয়াদ উত্তীর্ণ হয়ে গেছে",
    blocker_expiry_needed: "{doc} এর মেয়াদ তারিখ নির্ধারণ করা প্রয়োজন",
    blocker_duplicate: "{doc} এ একটি নকল/ডুপ্লিকেট ফাইল সংযুক্ত রয়েছে",

    export_csv_btn: "চেকলিস্ট CSV ডাউনলোড",
    generate_package_btn: "প্যাকেজ PDF তৈরি করুন",
    generating_pdf: "চূড়ান্ত প্যাকেজ তৈরি হচ্ছে...",

    status_OK: "প্রস্তুত",
    status_MISSING: "অনুপস্থিত",
    status_EXPIRY_NEEDED: "মেয়াদ দিন",
    status_EXPIRED: "মেয়াদোত্তীর্ণ",
    status_NOT_PROVIDED: "সংযুক্ত নয় (ঐচ্ছিক)",

    toast_sample_loaded: "নমুনা টেন্ডার প্যাক সফলভাবে লোড হয়েছে!",
    toast_matched: "'{req}' এর সাথে '{file}' যুক্ত করা হয়েছে",
    toast_unmatched: "'{req}' থেকে ফাইল বাতিল করা হয়েছে",
    toast_duplicate_blocked: "ম্যাচ করা সম্ভব নয়: '{file}' ফাইলটি '{original}' এর একই বিষয়বস্তু",
    toast_corrupt_blocked: "ম্যাচ করা সম্ভব নয়: ফাইলটি বৈধ PDF নয়",
    toast_auto_matched: "নামের মিল অনুসারে {count} টি দলিল যুক্ত করা হয়েছে!",
    toast_no_auto_match: "নতুন কোনো মিলযুক্ত ফাইল খুঁজে পাওয়া যায়নি।",
    toast_pdf_success: "প্যাকেজ PDF সফলভাবে তৈরি ও ডাউনলোড হয়েছে! ({size} MB, {pages} পাতা)",
    toast_csv_exported: "যাচাইকরণ চেকলিস্ট CSV ডাউনলোড সম্পন্ন হয়েছে।",
    toast_undo: "পূর্ববর্তী কার্যক্রম সফলভাবে বাতিল করা হয়েছে।"
  }
};

/**
 * Translate a key with optional dynamic template interpolations
 * @param {string} key 
 * @param {string} lang 
 * @param {Record<string, any>} [vars] 
 * @returns {string}
 */
export function t(key, lang = 'en', vars = {}) {
  const dict = DICTIONARY[lang] || DICTIONARY.en;
  let text = dict[key] || DICTIONARY.en[key] || key;
  for (const [vKey, vVal] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${vKey}\\}`, 'g'), String(vVal));
  }
  return text;
}

/**
 * Returns localized title of requirement (4.9: title_bn / title_en)
 * @param {object} req 
 * @param {string} lang 
 * @returns {string}
 */
export function titleOf(req, lang = 'en') {
  if (!req) return '';
  if (lang === 'bn' && req.title_bn) {
    return req.title_bn;
  }
  return req.title_en || req.title || req.id;
}
