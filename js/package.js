/**
 * Tender Package Builder - Final PDF Package Assembly Engine
 * Builds compliant PDF bundle with A4 cover page, two-pass table of contents,
 * 28pt bottom-band content expansion (preventing footer occlusion),
 * and serialized 'ID | Page X of Y' footers across all pages.
 */

import { store } from './state.js';

/**
 * Builds the complete compiled tender package PDF
 * @param {object} [options]
 * @returns {Promise<{ blob: Blob, bytes: Uint8Array, filename: string, totalPages: number }>}
 */
export async function buildTenderPackage(options = {}) {
  const state = store.getState();
  const { tender, requirements, matches, expiry } = state;
  const PDFLib = window.PDFLib;

  if (!PDFLib || !PDFLib.PDFDocument) {
    throw new Error("PDFLib library is not available");
  }

  // 1. Filter and sort requirements that have matched files
  const includedReqs = requirements
    .filter(req => Boolean(matches[req.id]))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  if (includedReqs.length === 0) {
    throw new Error("No matched documents to include in package");
  }

  // 2. Pre-pass: Load each matched PDF document and count pages for exact indexing
  const loadedDocs = [];
  for (const req of includedReqs) {
    const fileId = matches[req.id];
    const fileMeta = state.files.find(f => f.id === fileId);
    const buffer = store.getFileBuffer(fileId);

    if (!buffer) {
      throw new Error(`Buffer missing for matched file: ${fileMeta ? fileMeta.name : fileId}`);
    }

    const srcPdf = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const pageCount = srcPdf.getPageCount();

    loadedDocs.push({
      req,
      fileMeta,
      srcPdf,
      pageCount,
      startPage: 0 // Will compute below
    });
  }

  // 3. Two-pass layout computation
  // Page 1: Cover Page
  // Page 2: Document Index / Table of Contents
  const COVER_PAGES_COUNT = 2;
  let runningPageNumber = COVER_PAGES_COUNT + 1;

  for (const doc of loadedDocs) {
    doc.startPage = runningPageNumber;
    doc.endPage = runningPageNumber + doc.pageCount - 1;
    runningPageNumber += doc.pageCount;
  }

  const totalPagesY = runningPageNumber - 1;

  // 4. Create Master Output PDF
  const masterPdf = await PDFLib.PDFDocument.create();
  const fontRegular = await masterPdf.embedFont(PDFLib.StandardFonts.Helvetica);
  const fontBold = await masterPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);

  const primaryColor = PDFLib.rgb(0.11, 0.08, 0.06);     // Dark Obsidian/Brown
  const accentColor = PDFLib.rgb(0.96, 0.44, 0.21);      // Warm Peach
  const secondaryColor = PDFLib.rgb(0.35, 0.29, 0.24);   // Warm Brown/Muted
  const footerColor = PDFLib.rgb(0.3, 0.3, 0.3);         // Dark Gray
  const ruleColor = PDFLib.rgb(0.88, 0.82, 0.76);        // Subtle Border

  // ----------------------------------------------------
  // PASS A: PAGE 1 - COVER PAGE (A4: 595.28 x 841.89 pt)
  // ----------------------------------------------------
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const coverPage = masterPdf.addPage([A4_WIDTH, A4_HEIGHT]);

  // Decorative header band
  coverPage.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 12,
    width: A4_WIDTH,
    height: 12,
    color: accentColor
  });

  // Title Box
  coverPage.drawText("TENDER SUBMISSION PACKAGE", {
    x: 50,
    y: A4_HEIGHT - 75,
    size: 22,
    font: fontBold,
    color: primaryColor
  });

  coverPage.drawText("OFFICIAL COMPLIANCE & VERIFICATION DOSSIER", {
    x: 50,
    y: A4_HEIGHT - 95,
    size: 10,
    font: fontRegular,
    color: secondaryColor
  });

  // Horizontal Rule
  coverPage.drawLine({
    start: { x: 50, y: A4_HEIGHT - 110 },
    end: { x: A4_WIDTH - 50, y: A4_HEIGHT - 110 },
    thickness: 1.5,
    color: ruleColor
  });

  // Seven Required Meta Items
  let metaY = A4_HEIGHT - 145;
  const lineHeight = 22;

  const metadataRows = [
    { label: "Tender ID:", val: tender.id || "N/A", isBold: true },
    { label: "Tender Title:", val: tender.title || "N/A" },
    { label: "Procuring Entity:", val: tender.entity || "N/A" },
    { label: "Bidder / Contractor:", val: tender.bidder || "N/A" },
    { label: "Submission Deadline:", val: tender.deadline || "N/A" },
    { label: "Generated Date:", val: new Date().toISOString().replace('T', ' ').substr(0, 19) + ' UTC' },
    { label: "Total Package Pages:", val: `${totalPagesY} Pages (including Cover & Index)` }
  ];

  for (const row of metadataRows) {
    coverPage.drawText(row.label, {
      x: 50,
      y: metaY,
      size: 10.5,
      font: fontBold,
      color: secondaryColor
    });

    // Wrap long titles if necessary
    const valText = row.val.length > 55 ? row.val.substring(0, 52) + '...' : row.val;
    coverPage.drawText(valText, {
      x: 200,
      y: metaY,
      size: 10.5,
      font: row.isBold ? fontBold : fontRegular,
      color: primaryColor
    });

    metaY -= lineHeight;
  }

  // Included Documents Summary Section
  metaY -= 15;
  coverPage.drawText("SUMMARY OF ATTACHED DOCUMENTS", {
    x: 50,
    y: metaY,
    size: 12,
    font: fontBold,
    color: primaryColor
  });

  coverPage.drawLine({
    start: { x: 50, y: metaY - 8 },
    end: { x: A4_WIDTH - 50, y: metaY - 8 },
    thickness: 1,
    color: ruleColor
  });

  metaY -= 26;

  let docIndex = 1;
  for (const doc of loadedDocs) {
    const expDate = expiry[doc.req.id];
    const expiryText = expDate ? ` [Exp: ${expDate}]` : '';
    const docLine = `${docIndex}. ${doc.req.title_en}${expiryText}`;
    const pageRange = `pp. ${doc.startPage}–${doc.endPage}`;

    coverPage.drawText(docLine, {
      x: 55,
      y: metaY,
      size: 9.5,
      font: fontRegular,
      color: primaryColor
    });

    coverPage.drawText(pageRange, {
      x: A4_WIDTH - 110,
      y: metaY,
      size: 9.5,
      font: fontBold,
      color: secondaryColor
    });

    metaY -= 19;
    docIndex++;
    if (metaY < 65) break; // Avoid overflowing cover
  }

  // ----------------------------------------------------
  // PASS B: PAGE 2 - TABLE OF CONTENTS / INDEX PAGE (A4)
  // ----------------------------------------------------
  const indexPage = masterPdf.addPage([A4_WIDTH, A4_HEIGHT]);

  indexPage.drawText("DOCUMENT INDEX & SPECIFICATION AUDIT", {
    x: 50,
    y: A4_HEIGHT - 65,
    size: 16,
    font: fontBold,
    color: primaryColor
  });

  indexPage.drawLine({
    start: { x: 50, y: A4_HEIGHT - 78 },
    end: { x: A4_WIDTH - 50, y: A4_HEIGHT - 78 },
    thickness: 1,
    color: ruleColor
  });

  // Index Table Header
  let tableY = A4_HEIGHT - 105;
  indexPage.drawRectangle({
    x: 50,
    y: tableY - 6,
    width: A4_WIDTH - 100,
    height: 24,
    color: PDFLib.rgb(0.96, 0.94, 0.91)
  });

  indexPage.drawText("#", { x: 58, y: tableY, size: 9, font: fontBold, color: primaryColor });
  indexPage.drawText("REQUIREMENT / TITLE", { x: 80, y: tableY, size: 9, font: fontBold, color: primaryColor });
  indexPage.drawText("FILE NAME", { x: 275, y: tableY, size: 9, font: fontBold, color: primaryColor });
  indexPage.drawText("PAGES", { x: 420, y: tableY, size: 9, font: fontBold, color: primaryColor });
  indexPage.drawText("PAGE NO.", { x: 475, y: tableY, size: 9, font: fontBold, color: primaryColor });

  tableY -= 24;

  let rowIdx = 1;
  for (const doc of loadedDocs) {
    const isOdd = rowIdx % 2 === 1;
    if (isOdd) {
      indexPage.drawRectangle({
        x: 50,
        y: tableY - 4,
        width: A4_WIDTH - 100,
        height: 20,
        color: PDFLib.rgb(0.99, 0.98, 0.97)
      });
    }

    indexPage.drawText(String(doc.req.order || rowIdx), { x: 58, y: tableY, size: 8.5, font: fontRegular, color: secondaryColor });
    
    const rTitle = doc.req.title_en.length > 32 ? doc.req.title_en.substr(0, 30) + '..' : doc.req.title_en;
    indexPage.drawText(rTitle, { x: 80, y: tableY, size: 8.5, font: fontBold, color: primaryColor });

    const fName = doc.fileMeta.name.length > 24 ? doc.fileMeta.name.substr(0, 22) + '..' : doc.fileMeta.name;
    indexPage.drawText(fName, { x: 275, y: tableY, size: 8.5, font: fontRegular, color: secondaryColor });

    indexPage.drawText(String(doc.pageCount), { x: 430, y: tableY, size: 8.5, font: fontRegular, color: secondaryColor });
    indexPage.drawText(`${doc.startPage} – ${doc.endPage}`, { x: 475, y: tableY, size: 8.5, font: fontBold, color: primaryColor });

    tableY -= 20;
    rowIdx++;
  }

  // ----------------------------------------------------
  // PASS C: APPEND ALL CONTENT PAGES WITH 28 PT BOTTOM BAND
  // ----------------------------------------------------
  for (const doc of loadedDocs) {
    // Embed all pages of source PDF
    const pageIndices = doc.srcPdf.getPageIndices();
    const embeddedPages = await masterPdf.embedPdf(doc.srcPdf, pageIndices);

    for (let p = 0; p < embeddedPages.length; p++) {
      const srcPage = doc.srcPdf.getPage(p);
      const origWidth = srcPage.getWidth();
      const origHeight = srcPage.getHeight();
      const embedded = embeddedPages[p];

      // RULE 3: "make a new page that is 28 pt taller and embed the original page into it, shifted up"
      const newPageWidth = origWidth;
      const newPageHeight = origHeight + 28;

      const contentPage = masterPdf.addPage([newPageWidth, newPageHeight]);

      // Draw embedded original page shifted up by 28 pt
      contentPage.drawPage(embedded, {
        x: 0,
        y: 28,
        width: origWidth,
        height: origHeight
      });
    }
  }

  // ----------------------------------------------------
  // PASS D: DRAW SERIALIZED FOOTER 'ID | Page X of Y' ON EVERY PAGE
  // ----------------------------------------------------
  const allMasterPages = masterPdf.getPages();
  const tenderIdStr = tender.id || "TENDER";

  for (let idx = 0; idx < allMasterPages.length; idx++) {
    const pageNum = idx + 1;
    const page = allMasterPages[idx];
    const pWidth = page.getWidth();

    const footerText = `${tenderIdStr} | Page ${pageNum} of ${totalPagesY}`;
    const fontSize = 9.5;
    const textWidth = fontRegular.widthOfTextAtSize(footerText, fontSize);
    const centerX = (pWidth - textWidth) / 2;

    // Draw footer at y = 10 (well within the reserved 28 pt band)
    page.drawText(footerText, {
      x: centerX,
      y: 10,
      size: fontSize,
      font: fontRegular,
      color: footerColor
    });
  }

  // 5. Serialize PDF Bytes
  const pdfBytes = await masterPdf.save();
  const cleanId = (tender.id || "Tender").replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanId}_Package.pdf`;
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  return {
    blob,
    bytes: pdfBytes,
    filename,
    totalPages: totalPagesY
  };
}

/**
 * Triggers browser download of generated PDF
 * @param {Blob} blob 
 * @param {string} filename 
 */
export function downloadPdfBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}
