import fs from 'node:fs';
import path from 'node:path';
import * as PDFLib from '../vendor/pdf-lib.esm.min.js';

const sampleDir = path.resolve('sample');
const outputDir = path.resolve('output');

if (!fs.existsSync(sampleDir)) fs.mkdirSync(sampleDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

console.log("Generating sample/requirements.json...");

const requirementsJson = {
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

fs.writeFileSync(path.join(sampleDir, 'requirements.json'), JSON.stringify(requirementsJson, null, 2));

async function makePdf(title, subtitle, pagesCount = 1) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const fontBody = await doc.embedFont(PDFLib.StandardFonts.Helvetica);

  for (let p = 1; p <= pagesCount; p++) {
    const page = doc.addPage([595.28, 841.89]);
    
    // Header accent
    page.drawRectangle({
      x: 40,
      y: 841.89 - 40,
      width: 595.28 - 80,
      height: 6,
      color: PDFLib.rgb(0.96, 0.44, 0.21)
    });

    page.drawText(title, {
      x: 50,
      y: 841.89 - 80,
      size: 20,
      font: font,
      color: PDFLib.rgb(0.11, 0.08, 0.06)
    });

    page.drawText(`${subtitle} — (Page ${p} of ${pagesCount})`, {
      x: 50,
      y: 841.89 - 105,
      size: 11,
      font: fontBody,
      color: PDFLib.rgb(0.43, 0.34, 0.24)
    });

    page.drawText("AUTHENTIC VERIFIED DOCUMENT FOR TENDER SUBMISSION", {
      x: 50,
      y: 841.89 - 135,
      size: 9,
      font: fontBody,
      color: PDFLib.rgb(0.5, 0.5, 0.5)
    });

    page.drawLine({
      start: { x: 50, y: 841.89 - 145 },
      end: { x: 595.28 - 50, y: 841.89 - 145 },
      thickness: 1,
      color: PDFLib.rgb(0.85, 0.8, 0.75)
    });

    // Content body lines
    for (let l = 1; l <= 12; l++) {
      page.drawText(`Document record specification line #${l}: Verified against official records. Status: Approved.`, {
        x: 50,
        y: 841.89 - 165 - (l * 28),
        size: 9.5,
        font: fontBody,
        color: PDFLib.rgb(0.2, 0.2, 0.2)
      });
    }
  }

  return await doc.save();
}

console.log("Generating sample PDF files...");

const sampleSpecs = [
  { file: 'Trade_License_2026.pdf', title: 'Trade License Certificate', sub: 'Dhaka North City Corporation (Valid 2026-12-31)', pages: 1 },
  { file: 'TIN_Certificate.pdf', title: 'NBR Taxpayer Identification (TIN)', sub: 'National Board of Revenue Certificate', pages: 1 },
  { file: 'VAT_Registration_BIN.pdf', title: 'Value Added Tax (BIN) Registration', sub: 'Customs, Excise & VAT Commissionerate', pages: 1 },
  { file: 'Tax_Clearance_Cert.pdf', title: 'Tax Clearance Certificate', sub: 'Assessment Year 2025-2026 (Valid 2026-11-15)', pages: 1 },
  { file: 'Bank_Solvency_Certificate.pdf', title: 'Bank Solvency & Credit Facility', sub: 'Sonali Bank PLC Head Office', pages: 2 },
  { file: 'ISO_9001_Quality_Cert.pdf', title: 'ISO 9001:2015 Quality Management', sub: 'Accredited Certification Body', pages: 1 },
  { file: 'MAF_Manufacturer_Authorization.pdf', title: 'Manufacturer Authorization Form (MAF)', sub: 'Official OEM Hardware Authorization Letter', pages: 1 },
  { file: 'Audited_Financial_Statements.pdf', title: 'Audited Financial Statements (Last 3 Years)', sub: 'Chartered Accountants Independent Audit Report', pages: 3 },
  { file: 'Similar_Experience_Contracts.pdf', title: 'Past Performance & Similar Experience', sub: 'Ministry of ICT Completion Certificates', pages: 2 },
  { file: 'Tax_Clearance_EXPIRED.pdf', title: 'Expired Tax Clearance Certificate', sub: 'Expired on 2026-09-01 (Pre-deadline Trap)', pages: 1 }
];

const generatedBuffers = {};
for (const s of sampleSpecs) {
  const bytes = await makePdf(s.title, s.sub, s.pages);
  fs.writeFileSync(path.join(sampleDir, s.file), bytes);
  generatedBuffers[s.file] = bytes;
  console.log(` Created sample/${s.file} (${bytes.byteLength} bytes)`);
}

// Trap files:
// 1. Duplicate TIN (Exact duplicate bytes under another name to test SHA-256 detection)
fs.writeFileSync(path.join(sampleDir, 'Duplicate_TIN_Copy.pdf'), generatedBuffers['TIN_Certificate.pdf']);
console.log(" Created sample/Duplicate_TIN_Copy.pdf (Exact hash duplicate)");

// 2. Corrupted PDF
fs.writeFileSync(path.join(sampleDir, 'Corrupted_Doc_Sample.pdf'), Buffer.from("%PDF-1.4\n%%EOF_CORRUPTED_TRUNCATED_BODY_SAMPLE_1234567890"));
console.log(" Created sample/Corrupted_Doc_Sample.pdf");

// 3. Fake non-pdf (.docx renamed or invalid magic bytes)
fs.writeFileSync(path.join(sampleDir, 'Non_PDF_Fake.docx'), Buffer.from("PK\x03\x04 fake word document stream"));
console.log(" Created sample/Non_PDF_Fake.docx");

// ----------------------------------------------------
// NOW GENERATE REQUIRED OUTPUT PACKAGE: output/T-2026-0417_Package.pdf
// ----------------------------------------------------
console.log("Assembling final deliverable output/T-2026-0417_Package.pdf...");

const tender = requirementsJson.tender;
const masterPdf = await PDFLib.PDFDocument.create();
const fontRegular = await masterPdf.embedFont(PDFLib.StandardFonts.Helvetica);
const fontBold = await masterPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);

const primaryColor = PDFLib.rgb(0.11, 0.08, 0.06);
const accentColor = PDFLib.rgb(0.96, 0.44, 0.21);
const secondaryColor = PDFLib.rgb(0.35, 0.29, 0.24);
const footerColor = PDFLib.rgb(0.3, 0.3, 0.3);
const ruleColor = PDFLib.rgb(0.88, 0.82, 0.76);

const A4_W = 595.28;
const A4_H = 841.89;

// Included docs matching requirements in sorted order
const activeMatches = [
  { req: requirementsJson.requirements[0], file: 'Trade_License_2026.pdf', expiry: '2026-12-31' },
  { req: requirementsJson.requirements[1], file: 'TIN_Certificate.pdf' },
  { req: requirementsJson.requirements[2], file: 'VAT_Registration_BIN.pdf' },
  { req: requirementsJson.requirements[3], file: 'Tax_Clearance_Cert.pdf', expiry: '2026-11-15' },
  { req: requirementsJson.requirements[4], file: 'Bank_Solvency_Certificate.pdf', expiry: '2026-10-30' },
  { req: requirementsJson.requirements[5], file: 'ISO_9001_Quality_Cert.pdf', expiry: '2027-05-01' },
  { req: requirementsJson.requirements[6], file: 'MAF_Manufacturer_Authorization.pdf' },
  { req: requirementsJson.requirements[7], file: 'Audited_Financial_Statements.pdf' },
  { req: requirementsJson.requirements[8], file: 'Similar_Experience_Contracts.pdf' }
];

const loadedDocs = [];
let runPage = 3; // Pages 1 and 2 are Cover & Index

for (const m of activeMatches) {
  const bytes = generatedBuffers[m.file];
  const src = await PDFLib.PDFDocument.load(bytes);
  const pCount = src.getPageCount();
  loadedDocs.push({
    ...m,
    src,
    pageCount: pCount,
    startPage: runPage,
    endPage: runPage + pCount - 1
  });
  runPage += pCount;
}

const totalY = runPage - 1;

// 1. Cover Page
const cover = masterPdf.addPage([A4_W, A4_H]);
cover.drawRectangle({ x: 0, y: A4_H - 12, width: A4_W, height: 12, color: accentColor });
cover.drawText("TENDER SUBMISSION PACKAGE", { x: 50, y: A4_H - 75, size: 22, font: fontBold, color: primaryColor });
cover.drawText("OFFICIAL COMPLIANCE & VERIFICATION DOSSIER", { x: 50, y: A4_H - 95, size: 10, font: fontRegular, color: secondaryColor });
cover.drawLine({ start: { x: 50, y: A4_H - 110 }, end: { x: A4_W - 50, y: A4_H - 110 }, thickness: 1.5, color: ruleColor });

let metaY = A4_H - 145;
const metaList = [
  { label: "Tender ID:", val: tender.id, isBold: true },
  { label: "Tender Title:", val: tender.title },
  { label: "Procuring Entity:", val: tender.entity },
  { label: "Bidder / Contractor:", val: tender.bidder },
  { label: "Submission Deadline:", val: tender.deadline },
  { label: "Generated Date:", val: "2026-10-06 18:20:00 UTC" },
  { label: "Total Package Pages:", val: `${totalY} Pages (including Cover & Index)` }
];

for (const m of metaList) {
  cover.drawText(m.label, { x: 50, y: metaY, size: 10.5, font: fontBold, color: secondaryColor });
  cover.drawText(m.val, { x: 200, y: metaY, size: 10.5, font: m.isBold ? fontBold : fontRegular, color: primaryColor });
  metaY -= 22;
}

metaY -= 15;
cover.drawText("SUMMARY OF ATTACHED DOCUMENTS", { x: 50, y: metaY, size: 12, font: fontBold, color: primaryColor });
cover.drawLine({ start: { x: 50, y: metaY - 8 }, end: { x: A4_W - 50, y: metaY - 8 }, thickness: 1, color: ruleColor });
metaY -= 26;

let dNum = 1;
for (const d of loadedDocs) {
  const expStr = d.expiry ? ` [Exp: ${d.expiry}]` : '';
  cover.drawText(`${dNum}. ${d.req.title_en}${expStr}`, { x: 55, y: metaY, size: 9.5, font: fontRegular, color: primaryColor });
  cover.drawText(`pp. ${d.startPage}–${d.endPage}`, { x: A4_W - 110, y: metaY, size: 9.5, font: fontBold, color: secondaryColor });
  metaY -= 19;
  dNum++;
}

// 2. Index Page
const indexP = masterPdf.addPage([A4_W, A4_H]);
indexP.drawText("DOCUMENT INDEX & SPECIFICATION AUDIT", { x: 50, y: A4_H - 65, size: 16, font: fontBold, color: primaryColor });
indexP.drawLine({ start: { x: 50, y: A4_H - 78 }, end: { x: A4_W - 50, y: A4_H - 78 }, thickness: 1, color: ruleColor });

let tY = A4_H - 105;
indexP.drawRectangle({ x: 50, y: tY - 6, width: A4_W - 100, height: 24, color: PDFLib.rgb(0.96, 0.94, 0.91) });
indexP.drawText("#", { x: 58, y: tY, size: 9, font: fontBold, color: primaryColor });
indexP.drawText("REQUIREMENT / TITLE", { x: 80, y: tY, size: 9, font: fontBold, color: primaryColor });
indexP.drawText("FILE NAME", { x: 275, y: tY, size: 9, font: fontBold, color: primaryColor });
indexP.drawText("PAGES", { x: 420, y: tY, size: 9, font: fontBold, color: primaryColor });
indexP.drawText("PAGE NO.", { x: 475, y: tY, size: 9, font: fontBold, color: primaryColor });
tY -= 24;

let rCount = 1;
for (const d of loadedDocs) {
  if (rCount % 2 === 1) {
    indexP.drawRectangle({ x: 50, y: tY - 4, width: A4_W - 100, height: 20, color: PDFLib.rgb(0.99, 0.98, 0.97) });
  }
  indexP.drawText(String(d.req.order), { x: 58, y: tY, size: 8.5, font: fontRegular, color: secondaryColor });
  indexP.drawText(d.req.title_en, { x: 80, y: tY, size: 8.5, font: fontBold, color: primaryColor });
  indexP.drawText(d.file, { x: 275, y: tY, size: 8.5, font: fontRegular, color: secondaryColor });
  indexP.drawText(String(d.pageCount), { x: 430, y: tY, size: 8.5, font: fontRegular, color: secondaryColor });
  indexP.drawText(`${d.startPage} – ${d.endPage}`, { x: 475, y: tY, size: 8.5, font: fontBold, color: primaryColor });
  tY -= 20;
  rCount++;
}

// 3. Append Content Pages with 28pt taller band
for (const d of loadedDocs) {
  const pIndices = d.src.getPageIndices();
  const embeddedList = await masterPdf.embedPdf(d.src, pIndices);
  for (let p = 0; p < embeddedList.length; p++) {
    const srcPage = d.src.getPage(p);
    const origW = srcPage.getWidth();
    const origH = srcPage.getHeight();
    const emb = embeddedList[p];

    // Rule: new page 28 pt taller, embed shifted up by 28 pt
    const cPage = masterPdf.addPage([origW, origH + 28]);
    cPage.drawPage(emb, { x: 0, y: 28, width: origW, height: origH });
  }
}

// 4. Centered Serialized Footers
const pages = masterPdf.getPages();
for (let i = 0; i < pages.length; i++) {
  const p = pages[i];
  const pNum = i + 1;
  const fText = `${tender.id} | Page ${pNum} of ${totalY}`;
  const fSize = 9.5;
  const tW = fontRegular.widthOfTextAtSize(fText, fSize);
  const cX = (p.getWidth() - tW) / 2;

  p.drawText(fText, {
    x: cX,
    y: 10,
    size: fSize,
    font: fontRegular,
    color: footerColor
  });
}

const outBytes = await masterPdf.save();
const outPath = path.join(outputDir, `${tender.id}_Package.pdf`);
fs.writeFileSync(outPath, outBytes);

console.log(`\nSUCCESS: Generated ${outPath} (${outBytes.byteLength} bytes, ${totalY} pages).`);
