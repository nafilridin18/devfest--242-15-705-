/**
 * Tender Package Builder - Enterprise Backend Engine
 * Zero-external-dependency Node.js engine for validation, cryptographic duplicate detection,
 * compliance evaluation, RFC-4180 CSV export, and compliant PDF package compilation.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as PDFLib from '../vendor/pdf-lib.esm.min.js';

export const STATUS_CODES = {
  OK: 'OK',
  MISSING: 'MISSING',
  EXPIRY_NEEDED: 'EXPIRY_NEEDED',
  EXPIRED: 'EXPIRED',
  NOT_PROVIDED: 'NOT_PROVIDED'
};

export const MAX_FILES_LIMIT = 30;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Computes hexadecimal SHA-256 hash of a buffer
 * @param {Buffer|Uint8Array} buffer
 * @returns {string}
 */
export function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Checks whether buffer starts with official %PDF- magic header (0x25, 0x50, 0x44, 0x46, 0x2D)
 * @param {Buffer|Uint8Array} buffer
 * @returns {boolean}
 */
export function checkPdfMagicBytes(buffer) {
  if (!buffer || buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2D    // -
  );
}

/**
 * Parses and verifies PDF buffer validity, encryption, and page count
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<{ valid: boolean, pages: number, isEncrypted: boolean, error?: string }>}
 */
export async function inspectPdfBuffer(buffer) {
  if (!checkPdfMagicBytes(buffer)) {
    return {
      valid: false,
      pages: 0,
      isEncrypted: false,
      error: 'NOT_PDF: Magic bytes (%PDF-) missing'
    };
  }

  try {
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const isEncrypted = Boolean(pdfDoc.isEncrypted);
    if (isEncrypted) {
      return {
        valid: false,
        pages: 0,
        isEncrypted: true,
        error: 'PASSWORD_PROTECTED: PDF is encrypted'
      };
    }
    const pageCount = pdfDoc.getPageCount();
    return {
      valid: true,
      pages: pageCount,
      isEncrypted: false
    };
  } catch (err) {
    const msg = (err && err.message) || String(err);
    const isEncrypted = msg.toLowerCase().includes('encrypt');
    return {
      valid: false,
      pages: 0,
      isEncrypted,
      error: isEncrypted ? 'PASSWORD_PROTECTED' : `CORRUPTED: ${msg}`
    };
  }
}

/**
 * Normalizes tender specification & sorts requirements by order ascending (Section 4.1)
 * @param {object} data
 * @returns {{ valid: boolean, tender: object, requirements: Array<object>, error?: string }}
 */
export function normalizeRequirements(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, tender: {}, requirements: [], error: 'Invalid JSON payload: expected object' };
  }

  const rawTender = data.tender || {};
  const tender = {
    id: String(rawTender.tender_id || rawTender.id || 'T-2026-0417').trim(),
    title: String(rawTender.title || rawTender.tender_title || 'Tender Package').trim(),
    entity: String(rawTender.procuring_entity || rawTender.entity || 'Procuring Entity').trim(),
    bidder: String(rawTender.bidder || rawTender.contractor || 'Bidder').trim(),
    deadline: String(rawTender.submission_deadline || rawTender.deadline || '2026-10-20').trim()
  };

  const rawReqs = Array.isArray(data.requirements) ? data.requirements : [];
  if (rawReqs.length === 0) {
    return { valid: false, tender, requirements: [], error: 'No requirements defined in payload' };
  }

  const requirements = rawReqs.map((r, idx) => ({
    id: String(r.id || `req-${idx + 1}`).trim(),
    order: Number.isFinite(Number(r.order)) ? Number(r.order) : idx + 1,
    title_en: String(r.title_en || r.title || `Requirement ${idx + 1}`).trim(),
    title_bn: String(r.title_bn || r.title_en || r.title || '').trim(),
    mandatory: Boolean(r.mandatory ?? true),
    has_expiry: Boolean(r.has_expiry ?? false),
    description: String(r.description || '').trim()
  }));

  // Sort ascending strictly by order
  requirements.sort((a, b) => a.order - b.order);

  return { valid: true, tender, requirements };
}

/**
 * Pure deterministic status evaluation function matching Section 4.5
 * @param {object} req - Requirement object
 * @param {object} state - { tender, matches, expiry, files }
 * @returns {string} Status code from STATUS_CODES
 */
export function computeStatus(req, state) {
  if (!req) return STATUS_CODES.NOT_PROVIDED;

  const matches = state?.matches || {};
  const fileId = matches[req.id];

  // 1. If no file matched:
  if (!fileId) {
    return req.mandatory ? STATUS_CODES.MISSING : STATUS_CODES.NOT_PROVIDED;
  }

  // 2. Check if matched file has errors or is duplicate
  const files = state?.files || [];
  const file = files.find(f => f.id === fileId);
  if (file && (file.error || file.isDuplicate)) {
    return STATUS_CODES.MISSING;
  }

  // 3. If requirement requires validity / expiry date:
  if (req.has_expiry) {
    const expMap = state?.expiry || {};
    const expiryDate = (expMap[req.id] || '').trim();

    if (!expiryDate) {
      return STATUS_CODES.EXPIRY_NEEDED;
    }

    const deadline = (state?.tender?.deadline || state?.tender?.submission_deadline || '').trim();

    // Strict lexicographical comparison (YYYY-MM-DD)
    if (deadline && expiryDate < deadline) {
      return STATUS_CODES.EXPIRED;
    }

    return STATUS_CODES.OK;
  }

  return STATUS_CODES.OK;
}

/**
 * Validates whole tender dossier state and compiles detailed blocker list
 * @param {object} state - { tender, requirements, files, matches, expiry }
 * @returns {{ valid: boolean, blockers: Array<object>, computedStatuses: object, stats: object }}
 */
export function validateTenderDossier(state) {
  const requirements = state.requirements || [];
  const files = state.files || [];
  const matches = state.matches || {};
  const expiry = state.expiry || {};
  const deadline = state.tender?.deadline || '';

  const blockers = [];
  const computedStatuses = {};

  // Check batch volume guard rails
  if (files.length > MAX_FILES_LIMIT) {
    blockers.push({
      type: 'LIMIT_EXCEEDED',
      message: `Total files count (${files.length}) exceeds maximum limit of ${MAX_FILES_LIMIT}`
    });
  }

  const totalBytes = files.reduce((acc, f) => acc + (f.bytes || f.size || 0), 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    blockers.push({
      type: 'SIZE_EXCEEDED',
      message: `Total package size (${(totalBytes / (1024 * 1024)).toFixed(1)} MB) exceeds maximum limit of 50 MB`
    });
  }

  // Evaluate each requirement
  let readyCount = 0;
  let missingCount = 0;
  let expiredCount = 0;
  let expiryNeededCount = 0;
  let notProvidedCount = 0;

  for (const req of requirements) {
    const status = computeStatus(req, state);
    computedStatuses[req.id] = status;

    if (status === STATUS_CODES.OK) {
      readyCount++;
    } else if (status === STATUS_CODES.MISSING) {
      missingCount++;
      const matchedFileId = matches[req.id];
      const matchedFile = files.find(f => f.id === matchedFileId);
      if (matchedFile && matchedFile.error) {
        blockers.push({
          reqId: req.id,
          order: req.order,
          title: req.title_en,
          type: 'CORRUPTED_FILE',
          message: `Mandatory document '${req.title_en}' has corrupted file: ${matchedFile.error}`
        });
      } else if (matchedFile && matchedFile.isDuplicate) {
        blockers.push({
          reqId: req.id,
          order: req.order,
          title: req.title_en,
          type: 'DUPLICATE_FILE',
          message: `Mandatory document '${req.title_en}' is matched to duplicate file '${matchedFile.name}'`
        });
      } else {
        blockers.push({
          reqId: req.id,
          order: req.order,
          title: req.title_en,
          type: 'MISSING_FILE',
          message: `Mandatory document '${req.title_en}' (#${req.order}) is not attached`
        });
      }
    } else if (status === STATUS_CODES.EXPIRY_NEEDED) {
      expiryNeededCount++;
      blockers.push({
        reqId: req.id,
        order: req.order,
        title: req.title_en,
        type: 'EXPIRY_NEEDED',
        message: `'${req.title_en}' requires an expiry date input`
      });
    } else if (status === STATUS_CODES.EXPIRED) {
      expiredCount++;
      const exp = expiry[req.id] || '';
      blockers.push({
        reqId: req.id,
        order: req.order,
        title: req.title_en,
        type: 'EXPIRED',
        message: `'${req.title_en}' expired on ${exp} (Deadline: ${deadline})`
      });
    } else if (status === STATUS_CODES.NOT_PROVIDED) {
      notProvidedCount++;
    }
  }

  const matchedCount = Object.keys(matches).length;
  if (matchedCount === 0) {
    blockers.push({
      type: 'NO_MATCHES',
      message: 'No documents have been matched to any tender requirement'
    });
  }

  const valid = blockers.length === 0 && matchedCount > 0;

  return {
    valid,
    blockers,
    computedStatuses,
    stats: {
      totalRequirements: requirements.length,
      readyCount,
      missingCount,
      expiredCount,
      expiryNeededCount,
      notProvidedCount,
      matchedCount,
      totalFiles: files.length,
      totalBytes
    }
  };
}

/**
 * Builds compliant tender package PDF on the backend (Sections 4.8, 7.0)
 * Stitches official A4 cover page, Table of Contents, 28pt bottom-band shifted canvas,
 * and serialized 'ID | Page X of Y' footers at y: 10.
 *
 * @param {object} state - { tender, requirements, matches, expiry, fileBuffers: { [fileId]: Buffer } }
 * @param {object} [options] - { includeIndexPage?: boolean, outDir?: string }
 * @returns {Promise<{ buffer: Buffer, filename: string, totalPages: number, outputPath: string }>}
 */
export async function buildPackagePdf(state, options = {}) {
  const { tender, requirements, matches, expiry, fileBuffers, files } = state;

  if (!tender || !tender.id) {
    throw new Error("Missing tender specification in state");
  }

  // 1. Filter & sort requirements that have matched files
  const includedReqs = (requirements || [])
    .filter(req => Boolean(matches && matches[req.id]))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  if (includedReqs.length === 0) {
    throw new Error("No matched documents provided for package compilation");
  }

  // 2. Pre-pass: Load each matched source PDF and compute page offsets
  const loadedDocs = [];
  for (const req of includedReqs) {
    const fileId = matches[req.id];
    const fileMeta = (files || []).find(f => f.id === fileId) || { id: fileId, name: `${req.id}.pdf` };
    const rawBuffer = fileBuffers && fileBuffers[fileId];

    if (!rawBuffer) {
      throw new Error(`Buffer missing for matched document: ${fileMeta.name} (${fileId})`);
    }

    const srcPdf = await PDFLib.PDFDocument.load(rawBuffer, { ignoreEncryption: true });
    const pageCount = srcPdf.getPageCount();

    loadedDocs.push({
      req,
      fileMeta,
      srcPdf,
      pageCount,
      startPage: 0,
      endPage: 0
    });
  }

  // 3. Compute Two-Pass Page Indices
  // Page 1 is Cover Page (with embedded Document Index summary)
  const includeIndexPage = Boolean(options.includeIndexPage);
  const COVER_PAGES_COUNT = includeIndexPage ? 2 : 1;
  let runningPageNumber = COVER_PAGES_COUNT + 1;

  for (const doc of loadedDocs) {
    doc.startPage = runningPageNumber;
    doc.endPage = runningPageNumber + doc.pageCount - 1;
    runningPageNumber += doc.pageCount;
  }

  const totalPagesY = runningPageNumber - 1;

  // 4. Create Master Assembled PDF
  const masterPdf = await PDFLib.PDFDocument.create();
  const fontRegular = await masterPdf.embedFont(PDFLib.StandardFonts.Helvetica);
  const fontBold = await masterPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);

  const primaryColor = PDFLib.rgb(0.11, 0.08, 0.06);     // Dark Obsidian/Brown
  const accentColor = PDFLib.rgb(0.96, 0.44, 0.21);      // Warm Peach
  const secondaryColor = PDFLib.rgb(0.35, 0.29, 0.24);   // Warm Brown/Muted
  const footerColor = PDFLib.rgb(0.3, 0.3, 0.3);         // Dark Gray
  const ruleColor = PDFLib.rgb(0.88, 0.82, 0.76);        // Subtle Border

  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;

  // --- PASS A: COVER PAGE (A4) ---
  const coverPage = masterPdf.addPage([A4_WIDTH, A4_HEIGHT]);

  // Top header accent band
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

  coverPage.drawLine({
    start: { x: 50, y: A4_HEIGHT - 110 },
    end: { x: A4_WIDTH - 50, y: A4_HEIGHT - 110 },
    thickness: 1.5,
    color: ruleColor
  });

  // Seven Required Tender Metadata Items
  let metaY = A4_HEIGHT - 145;
  const lineHeight = 22;

  const metadataRows = [
    { label: "Tender ID:", val: tender.id || "N/A", isBold: true },
    { label: "Tender Title:", val: tender.title || "N/A" },
    { label: "Procuring Entity:", val: tender.entity || "N/A" },
    { label: "Bidder / Contractor:", val: tender.bidder || "N/A" },
    { label: "Submission Deadline:", val: tender.deadline || "N/A" },
    { label: "Generated Date:", val: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC' },
    { label: "Total Package Pages:", val: `${totalPagesY} Pages (including Cover Page)` }
  ];

  for (const row of metadataRows) {
    coverPage.drawText(row.label, {
      x: 50,
      y: metaY,
      size: 10.5,
      font: fontBold,
      color: secondaryColor
    });

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

  // Summary Table of Attached Documents
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
    const expDate = expiry && expiry[doc.req.id];
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
    if (metaY < 65) break; // Keep inside cover
  }

  // --- PASS B: OPTIONAL EXTENDED INDEX PAGE ---
  if (includeIndexPage) {
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
      if (rowIdx % 2 === 1) {
        indexPage.drawRectangle({
          x: 50,
          y: tableY - 4,
          width: A4_WIDTH - 100,
          height: 20,
          color: PDFLib.rgb(0.99, 0.98, 0.97)
        });
      }

      indexPage.drawText(String(doc.req.order || rowIdx), { x: 58, y: tableY, size: 8.5, font: fontRegular, color: secondaryColor });
      const rTitle = doc.req.title_en.length > 32 ? doc.req.title_en.substring(0, 30) + '..' : doc.req.title_en;
      indexPage.drawText(rTitle, { x: 80, y: tableY, size: 8.5, font: fontBold, color: primaryColor });
      const fName = doc.fileMeta.name.length > 24 ? doc.fileMeta.name.substring(0, 22) + '..' : doc.fileMeta.name;
      indexPage.drawText(fName, { x: 275, y: tableY, size: 8.5, font: fontRegular, color: secondaryColor });
      indexPage.drawText(String(doc.pageCount), { x: 430, y: tableY, size: 8.5, font: fontRegular, color: secondaryColor });
      indexPage.drawText(`${doc.startPage} – ${doc.endPage}`, { x: 475, y: tableY, size: 8.5, font: fontBold, color: primaryColor });

      tableY -= 20;
      rowIdx++;
    }
  }

  // --- PASS C: EMBED ALL CONTENT PAGES (VERTICAL +28 PT EXPANSION) ---
  for (const doc of loadedDocs) {
    const pageIndices = doc.srcPdf.getPageIndices();
    const embeddedPages = await masterPdf.embedPdf(doc.srcPdf, pageIndices);

    for (let p = 0; p < embeddedPages.length; p++) {
      const srcPage = doc.srcPdf.getPage(p);
      const origWidth = srcPage.getWidth();
      const origHeight = srcPage.getHeight();
      const embedded = embeddedPages[p];

      // CRITICAL SPEC REQUIREMENT:
      // "make a new page that is 28 pt taller and embed the original page into it, shifted up"
      const newPageWidth = origWidth;
      const newPageHeight = origHeight + 28;

      const contentPage = masterPdf.addPage([newPageWidth, newPageHeight]);

      contentPage.drawPage(embedded, {
        x: 0,
        y: 28,
        width: origWidth,
        height: origHeight
      });
    }
  }

  // --- PASS D: SERIALIZED FOOTER 'ID | Page X of Y' AT Y: 10 ---
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

    page.drawText(footerText, {
      x: centerX,
      y: 10,
      size: fontSize,
      font: fontRegular,
      color: footerColor
    });
  }

  // 5. Serialize bytes & save output file
  const pdfBytes = await masterPdf.save();
  const nodeBuffer = Buffer.from(pdfBytes);

  const cleanId = (tender.id || "Tender").replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanId}_Package.pdf`;
  const outDir = options.outDir || path.resolve(process.cwd(), 'output');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outputPath = path.join(outDir, filename);
  fs.writeFileSync(outputPath, nodeBuffer);

  return {
    buffer: nodeBuffer,
    bytesLength: nodeBuffer.length,
    filename,
    totalPages: totalPagesY,
    outputPath
  };
}

/**
 * Escapes cell value for RFC-4180 CSV
 */
function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates RFC-4180 CSV Compliance Checklist with UTF-8 BOM
 * @param {object} state - { tender, requirements, matches, expiry, files }
 * @returns {string} UTF-8 BOM CSV text
 */
export function generateChecklistCsv(state) {
  const { tender, requirements = [], matches = {}, expiry = {}, files = [] } = state;

  const headers = [
    "Order",
    "Requirement ID",
    "Requirement Title (EN)",
    "Requirement Title (BN)",
    "Mandatory",
    "Requires Expiry",
    "Status",
    "Matched File Name",
    "File Pages",
    "File Size (Bytes)",
    "SHA-256 Hash",
    "Document Expiry Date",
    "Tender Deadline",
    "Compliance Audit Note"
  ];

  const sortedReqs = [...requirements].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  const rows = sortedReqs.map(req => {
    const status = computeStatus(req, state);
    const matchedFileId = matches[req.id];
    const file = files.find(f => f.id === matchedFileId);
    const expDate = expiry[req.id] || '';

    let note = "Compliant";
    if (status === STATUS_CODES.MISSING) note = "NON-COMPLIANT: Mandatory document missing";
    else if (status === STATUS_CODES.EXPIRY_NEEDED) note = "NON-COMPLIANT: Expiry date not recorded";
    else if (status === STATUS_CODES.EXPIRED) note = `NON-COMPLIANT: Expired (${expDate} < ${tender.deadline || ''})`;
    else if (status === STATUS_CODES.NOT_PROVIDED) note = "Optional document omitted";

    return [
      req.order,
      req.id,
      req.title_en,
      req.title_bn,
      req.mandatory ? "YES" : "NO",
      req.has_expiry ? "YES" : "NO",
      status,
      file ? file.name : "None",
      file ? (file.pages || 0) : 0,
      file ? (file.bytes || file.size || 0) : 0,
      file ? (file.hash || file.sha256 || 'N/A') : 'N/A',
      expDate || "N/A",
      tender.deadline || "N/A",
      note
    ].map(escapeCsv).join(',');
  });

  return "\uFEFF" + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
}
