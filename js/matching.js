/**
 * Tender Package Builder - Matching Rules & Smart Auto-Match Engine
 * Enforces 1:1 matching, duplicate blocking, corrupted file blocking,
 * and intelligent filename keyword heuristic matching.
 */

import { store } from './state.js';

/**
 * Validates whether a file is legally eligible to be matched
 * @param {object} file 
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canMatchFile(file) {
  if (!file) {
    return { allowed: false, reason: "File does not exist." };
  }
  if (file.error) {
    return { allowed: false, reason: "Corrupted or non-PDF files cannot be matched." };
  }
  if (file.isDuplicate) {
    return {
      allowed: false,
      reason: `Matching blocked: Duplicate content of '${file.duplicateOf || 'another document'}'.`
    };
  }
  return { allowed: true };
}

/**
 * Attempts to match a file to a requirement
 * @param {string} reqId 
 * @param {string} fileId 
 * @returns {{ success: boolean, reason?: string }}
 */
export function executeMatch(reqId, fileId) {
  const state = store.getState();
  if (!fileId) {
    store.unmatchReq(reqId);
    return { success: true };
  }

  const file = state.files.find(f => f.id === fileId);
  const check = canMatchFile(file);
  if (!check.allowed) {
    return { success: false, reason: check.reason };
  }

  store.matchFile(reqId, fileId);
  return { success: true };
}

/**
 * Normalize a string for fuzzy matching (lowercase, alphanumeric only)
 */
function cleanString(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

/**
 * Checks similarity score between a filename and requirement title/description/keywords
 */
function calculateMatchScore(fileName, req) {
  const fNorm = cleanString(fileName);
  const titleNorm = cleanString(req.title_en);
  const titleBnNorm = cleanString(req.title_bn);

  // Direct substring or exact match
  if (fNorm === titleNorm || titleNorm.includes(fNorm) || fNorm.includes(titleNorm)) {
    return 100;
  }

  // Domain Keyword Matching for Tenders
  const keywordsMap = [
    { keys: ['trade', 'license'], match: /trade.*license|license/i },
    { keys: ['tin', 'tax id'], match: /\btin\b/i },
    { keys: ['vat', 'bin'], match: /\bvat\b|\bbin\b/i },
    { keys: ['tax clearance', 'tax payment'], match: /tax.*clearance/i },
    { keys: ['solvency', 'bank'], match: /solvency|bank/i },
    { keys: ['iso', '9001'], match: /iso|9001/i },
    { keys: ['maf', 'manufacturer', 'authorization'], match: /maf|manufacturer|authorization/i },
    { keys: ['audit', 'financial', 'statement'], match: /audit|financial/i },
    { keys: ['experience', 'similar', 'contract', 'performance'], match: /experience|contract|performance/i }
  ];

  for (const km of keywordsMap) {
    const reqMatches = km.keys.some(k => titleNorm.includes(k));
    if (reqMatches && km.match.test(fileName)) {
      return 85;
    }
  }

  // Token overlap
  const fTokens = fNorm.split(/\s+/).filter(Boolean);
  const rTokens = titleNorm.split(/\s+/).filter(Boolean);
  let overlaps = 0;
  for (const ft of fTokens) {
    if (rTokens.includes(ft)) overlaps++;
  }

  if (overlaps > 0) {
    return overlaps * 25;
  }

  return 0;
}

/**
 * Smart Auto-Match by filename (Bonus Task)
 * Matches uploaded files to empty requirements based on heuristic scoring
 * @returns {{ count: number, matchedPairs: Array<{ reqId: string, fileId: string, reqTitle: string, fileName: string }> }}
 */
export function autoMatchFiles() {
  const state = store.getState();
  const requirements = state.requirements;
  const files = state.files.filter(f => !f.error && !f.isDuplicate);
  const currentMatches = state.matches;

  // Unmatched files and requirements
  const matchedFileIds = new Set(Object.values(currentMatches));
  const availableFiles = files.filter(f => !matchedFileIds.has(f.id));
  const emptyReqs = requirements.filter(r => !currentMatches[r.id]);

  const matchesToApply = [];

  for (const req of emptyReqs) {
    let bestScore = 0;
    let bestFile = null;

    for (const file of availableFiles) {
      // If file already chosen in this auto-match pass, skip
      if (matchesToApply.some(m => m.fileId === file.id)) continue;

      const score = calculateMatchScore(file.name, req);
      if (score > bestScore && score >= 50) {
        bestScore = score;
        bestFile = file;
      }
    }

    if (bestFile) {
      matchesToApply.push({
        reqId: req.id,
        fileId: bestFile.id,
        reqTitle: req.title_en,
        fileName: bestFile.name
      });
    }
  }

  // Apply all valid matches
  if (matchesToApply.length > 0) {
    for (const pair of matchesToApply) {
      store.matchFile(pair.reqId, pair.fileId);
    }
  }

  return {
    count: matchesToApply.length,
    matchedPairs: matchesToApply
  };
}
