/**
 * Tender Package Builder - File Processing Engine
 * Handles upload validation, Magic Bytes checking, SHA-256 hashing,
 * PDF page counting, duplicate detection, and thumbnail generation.
 */

import * as pdfjsLib from '../vendor/pdf.min.mjs';

// Configure pdfjs worker if available
if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.mjs';
}

const MAX_TOTAL_FILES = 30;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Convert ArrayBuffer to Hex String
 */
function bufferToHex(buffer) {
  const byteArray = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < byteArray.length; i++) {
    hex += byteArray[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Computes SHA-256 hash of file buffer
 * @param {ArrayBuffer} buffer 
 * @returns {Promise<string>}
 */
export async function computeSHA256(buffer) {
  if (window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    return bufferToHex(hashBuffer);
  }
  // Fallback simple checksum if subtle crypto unavailable
  let hash = 0;
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i++) {
    hash = ((hash << 5) - hash + view[i]) | 0;
  }
  return 'fb-' + Math.abs(hash).toString(16);
}

/**
 * Checks if buffer starts with %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
 * @param {ArrayBuffer} buffer 
 * @returns {boolean}
 */
export function hasPdfMagicHeader(buffer) {
  if (!buffer || buffer.byteLength < 5) return false;
  const bytes = new Uint8Array(buffer, 0, 5);
  // ASCII: '%' = 37 (0x25), 'P' = 80 (0x50), 'D' = 68 (0x44), 'F' = 70 (0x46), '-' = 45 (0x2D)
  return bytes[0] === 0x25 &&
         bytes[1] === 0x50 &&
         bytes[2] === 0x44 &&
         bytes[3] === 0x46 &&
         bytes[4] === 0x2D;
}

/**
 * Format bytes into human-readable string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Renders page 1 thumbnail into a small dataURL
 * @param {ArrayBuffer} buffer 
 * @returns {Promise<string|null>}
 */
export async function generateThumbnail(buffer) {
  try {
    if (!pdfjsLib || !pdfjsLib.getDocument) return null;
    const taskPromise = (async () => {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer.slice(0)),
        isEvalSupported: false,
        useWorkerFetch: false
      });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      const viewport = page.getViewport({ scale: 0.25 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.7);
    })();

    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 800));
    return await Promise.race([taskPromise, timeoutPromise]);
  } catch (err) {
    return null;
  }
}

/**
 * Processes an individual file object
 * @param {File} file 
 * @param {Array<object>} existingFiles 
 * @returns {Promise<{ fileMeta: object, buffer: ArrayBuffer }>}
 */
export async function processSingleFile(file, existingFiles = []) {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const buffer = await file.arrayBuffer();
  const bytes = buffer.byteLength;
  const name = file.name;

  // 1. Check Magic Bytes
  const isMagicPdf = hasPdfMagicHeader(buffer);
  if (!isMagicPdf) {
    return {
      fileMeta: {
        id: fileId,
        name,
        bytes,
        pages: 0,
        hash: null,
        error: "NOT_PDF",
        errorMessage: "Not a valid PDF file (missing %PDF- header)",
        thumbnail: null
      },
      buffer
    };
  }

  // 2. Compute SHA-256
  const hash = await computeSHA256(buffer);

  // 3. Duplicate Content Detection (Task 4.6)
  // Check against existing files already in the state
  const duplicateMatch = existingFiles.find(ef => ef.hash && ef.hash === hash && ef.name !== name);
  const isDuplicate = Boolean(duplicateMatch);
  const duplicateOf = duplicateMatch ? duplicateMatch.name : null;

  if (duplicateMatch) {
    // Both badged "Duplicate", each names the other
    duplicateMatch.isDuplicate = true;
    duplicateMatch.duplicateOf = name;
  }

  // 4. Try parsing PDF and count pages using PDFLib
  let pages = 0;
  let loadError = null;
  let errorMsg = null;
  try {
    const PDFLib = window.PDFLib;
    if (!PDFLib || !PDFLib.PDFDocument) {
      throw new Error("PDFLib library is unavailable");
    }
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: false });
    pages = pdfDoc.getPageCount();
  } catch (err) {
    const errStr = String(err?.message || err).toLowerCase();
    if (errStr.includes('encrypt') || errStr.includes('password')) {
      loadError = "LOCKED";
      errorMsg = "Password-protected";
    } else {
      loadError = "CORRUPTED";
      errorMsg = "Cannot be read";
    }
  }

  // 5. Try thumbnail creation
  let thumbnail = null;
  if (!loadError) {
    thumbnail = await generateThumbnail(buffer);
  }

  return {
    fileMeta: {
      id: fileId,
      name,
      bytes,
      pages,
      hash,
      isDuplicate,
      duplicateOf,
      error: loadError,
      errorMessage: errorMsg,
      thumbnail
    },
    buffer
  };
}

/**
 * Validates batch restrictions (Max 30 files, Max 50 MB)
 * @param {Array<File>} newFiles 
 * @param {Array<object>} existingFiles 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateBatchLimits(newFiles, existingFiles) {
  const totalCount = existingFiles.length + newFiles.length;
  if (totalCount > MAX_TOTAL_FILES) {
    return {
      valid: false,
      error: `Upload exceeds maximum allowed limit of ${MAX_TOTAL_FILES} files (currently ${totalCount}).`
    };
  }

  const existingBytes = existingFiles.reduce((acc, f) => acc + (f.bytes || 0), 0);
  const newBytes = newFiles.reduce((acc, f) => acc + f.size, 0);
  if (existingBytes + newBytes > MAX_TOTAL_BYTES) {
    return {
      valid: false,
      error: `Total package size exceeds 50 MB limit (${formatBytes(existingBytes + newBytes)}).`
    };
  }

  return { valid: true };
}
