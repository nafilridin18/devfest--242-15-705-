/**
 * Tender Package Builder - Requirements Schema Parser & Validator
 * Validates requirements.json, sorts items by 'order' (Task 4.1)
 */

export const CANONICAL_TENDER_DATA = {
  tender: {
    id: "T-2026-0417",
    title: "Procurement of IT Infrastructure & Cloud Datacenter Services",
    entity: "Ministry of Digital Transformation",
    bidder: "Apex Tech Solutions Ltd.",
    deadline: "2026-10-20"
  },
  requirements: [
    {
      id: "req-1",
      order: 1,
      title_en: "Trade License",
      title_bn: "ট্রেড লাইসেন্স",
      mandatory: true,
      has_expiry: true,
      description: "Valid Trade License for current fiscal year"
    },
    {
      id: "req-2",
      order: 2,
      title_en: "TIN Certificate",
      title_bn: "টিআইএন সার্টিফিকেট",
      mandatory: true,
      has_expiry: false,
      description: "Tax Identification Number certificate issued by NBR"
    },
    {
      id: "req-3",
      order: 3,
      title_en: "VAT Registration / BIN",
      title_bn: "ভ্যাট নিবন্ধন / বিআইএন",
      mandatory: true,
      has_expiry: false,
      description: "Business Identification Number (BIN) registration"
    },
    {
      id: "req-4",
      order: 4,
      title_en: "Tax Clearance Certificate",
      title_bn: "আয়কর পরিশোধ সনদ",
      mandatory: true,
      has_expiry: true,
      description: "Income tax clearance valid until or past tender deadline"
    },
    {
      id: "req-5",
      order: 5,
      title_en: "Bank Solvency Certificate",
      title_bn: "ব্যাংক সচ্ছলতা সনদ",
      mandatory: true,
      has_expiry: true,
      description: "Bank solvency certificate issued within last 30 days"
    },
    {
      id: "req-6",
      order: 6,
      title_en: "ISO 9001 Certification",
      title_bn: "আইএসও ৯০০১ সনদ",
      mandatory: false,
      has_expiry: true,
      description: "Quality management certification (optional evaluation points)"
    },
    {
      id: "req-7",
      order: 7,
      title_en: "Manufacturer Authorization Form (MAF)",
      title_bn: "প্রস্তুতকারক অনুমোদনের সনদ (MAF)",
      mandatory: true,
      has_expiry: false,
      description: "Direct OEM authorization letter for hardware components"
    },
    {
      id: "req-8",
      order: 8,
      title_en: "Audited Financial Statements (Last 3 Years)",
      title_bn: "নিরীক্ষিত আর্থিক বিবরণী (বিগত ৩ বছর)",
      mandatory: true,
      has_expiry: false,
      description: "Signed audit reports by chartered accountants"
    },
    {
      id: "req-9",
      order: 9,
      title_en: "Similar Contract Experience",
      title_bn: "অনুরূপ কাজের অভিজ্ঞতা সনদ",
      mandatory: false,
      has_expiry: false,
      description: "Completion certificates of similar contracts in past 5 years"
    }
  ]
};

/**
 * Validates and normalizes requirements JSON data
 * @param {any} rawData 
 * @returns {{ valid: boolean, error?: string, tender?: object, requirements?: Array<object> }}
 */
export function validateRequirementsData(rawData) {
  if (!rawData || typeof rawData !== 'object') {
    return { valid: false, error: "Invalid JSON structure. Root must be an object." };
  }

  // Tender metadata
  const tender = rawData.tender || {};
  const tId = String(tender.tender_id || tender.id || '').trim();
  const tDeadline = String(tender.submission_deadline || tender.deadline || '').trim();
  const tTitle = String(tender.title || tender.tender_title || 'Untitled Tender').trim();
  const tEntity = String(tender.procuring_entity || tender.entity || 'Procuring Entity').trim();
  const tBidder = String(tender.bidder || tender.bidder_name || 'Bidder Organization').trim();

  if (!tId || !tDeadline) {
    return { valid: false, error: "Missing required tender fields: 'tender_id' and 'submission_deadline' are mandatory." };
  }

  const normalizedTender = {
    id: tId,
    tender_id: tId,
    title: tTitle,
    entity: tEntity,
    procuring_entity: tEntity,
    bidder: tBidder,
    deadline: tDeadline,
    submission_deadline: tDeadline
  };

  // Requirements array
  const rawReqs = rawData.requirements;
  if (!Array.isArray(rawReqs) || rawReqs.length === 0) {
    return { valid: false, error: "Requirements must be a non-empty array of document specifications." };
  }

  const normalizedReqs = rawReqs.map((r, index) => {
    return {
      id: String(r.id || `req-${index + 1}`).trim(),
      order: Number(r.order !== undefined ? r.order : index + 1),
      title_en: String(r.title_en || r.title || `Document ${index + 1}`).trim(),
      title_bn: String(r.title_bn || r.title_en || r.title || `দলিল ${index + 1}`).trim(),
      mandatory: Boolean(r.mandatory),
      has_expiry: Boolean(r.has_expiry),
      description: String(r.description || '').trim()
    };
  });

  // Sort by 'order' strictly (Task 4.1)
  normalizedReqs.sort((a, b) => a.order - b.order);

  return {
    valid: true,
    tender: normalizedTender,
    requirements: normalizedReqs
  };
}
