/**
 * Generates the official judge verification testpack exactly as specified in the testing guide.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as PDFLib from '../vendor/pdf-lib.esm.min.js';

const testDir = path.resolve('testpack');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

console.log("Generating judge verification testpack in testpack/ ...");

// Test Requirements JSON with shuffled order
const testRequirementsJson = {
  tender: {
    tender_id: "T-2026-0417",
    title: "Supply of IT Equipment",
    procuring_entity: "Example Directorate",
    bidder: "Example Company Ltd.",
    submission_deadline: "2026-10-20"
  },
  requirements: [
    { id: "R04", order: 4, title_en: "Bank Solvency", title_bn: "ব্যাংক সচ্ছলতা", mandatory: true, has_expiry: true },
    { id: "R01", order: 1, title_en: "Trade License", title_bn: "ট্রেড লাইসেন্স", mandatory: true, has_expiry: true },
    { id: "R06", order: 6, title_en: "Technical Proposal", title_bn: "প্রযুক্তিগত প্রস্তাবনা", mandatory: true, has_expiry: false },
    { id: "R02", order: 2, title_en: "TIN Certificate", title_bn: "টিআইএন সার্টিফিকেট", mandatory: true, has_expiry: false },
    { id: "R05", order: 5, title_en: "Experience Certificate", title_bn: "অভিজ্ঞতা সনদ", mandatory: false, has_expiry: false },
    { id: "R03", order: 3, title_en: "VAT Certificate", title_bn: "ভ্যাট সার্টিফিকেট", mandatory: true, has_expiry: true }
  ]
};

fs.writeFileSync(path.join(testDir, 'requirements.json'), JSON.stringify(testRequirementsJson, null, 2));

async function makePdf(name, pages, width = 595.28, height = 841.89) {
  const doc = await PDFLib.PDFDocument.create();
  const fontBold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);

  for (let p = 1; p <= pages; p++) {
    const page = doc.addPage([width, height]);
    
    // Header
    page.drawText(name.toUpperCase(), {
      x: 60,
      y: height - 120,
      size: 32,
      font: fontBold,
      color: PDFLib.rgb(0.1, 0.1, 0.1)
    });

    page.drawText(`own page ${p} of ${pages}`, {
      x: 60,
      y: height - 170,
      size: 20,
      font: font,
      color: PDFLib.rgb(0.3, 0.3, 0.3)
    });

    // Border touches the bottom margin: footer-overlap test
    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderWidth: 1.5,
      borderColor: PDFLib.rgb(0.2, 0.2, 0.2),
      color: undefined
    });

    page.drawText("BOTTOM EDGE TEXT", {
      x: 60,
      y: 40,
      size: 14,
      font: fontBold,
      color: PDFLib.rgb(0.8, 0.2, 0.2)
    });
  }

  const bytes = await doc.save();
  const filePath = path.join(testDir, `${name}.pdf`);
  fs.writeFileSync(filePath, bytes);
  return bytes;
}

// Generate the 6 core test files + 1 landscape
await makePdf("trade_license", 2);
await makePdf("tin", 1);
const vatBytes = await makePdf("vat", 1);
await makePdf("solvency", 3);
await makePdf("experience", 2);
await makePdf("tech_proposal", 4);
await makePdf("landscape_doc", 1, 841.89, 595.28); // Landscape A4

// Duplicate with different name
fs.writeFileSync(path.join(testDir, "vat_COPY_final_v2.pdf"), vatBytes);

// Wrong type
fs.writeFileSync(path.join(testDir, "notes.txt"), "hello");

// Fake PDF (text renamed)
fs.writeFileSync(path.join(testDir, "fake.pdf"), "I am not a pdf");

// Corrupted PDF (truncated)
const tinData = fs.readFileSync(path.join(testDir, "tin.pdf"));
fs.writeFileSync(path.join(testDir, "corrupted.pdf"), tinData.subarray(0, Math.floor(tinData.length / 2)));

// Password-protected PDF
// (Simulate an encrypted PDF using standard encrypted header syntax)
const lockedSample = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
  "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n" +
  "3 0 obj\n<< /Filter /Standard /V 2 /R 3 /O (encrypted) /U (secret) /P -4 >>\nendobj\n" +
  "trailer\n<< /Root 1 0 R /Encrypt 3 0 R >>\n%%EOF"
);
fs.writeFileSync(path.join(testDir, "locked.pdf"), lockedSample);

console.log("Successfully created all test pack files in testpack/ !");
