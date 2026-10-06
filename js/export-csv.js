/**
 * Tender Package Builder - CSV Verification Checklist Export (Bonus)
 * Generates downloadable RFC 4180 compliant CSV audit checklist.
 */

import { computeStatus } from './status.js';

/**
 * Escapes a cell for CSV formatting
 */
function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exports verification checklist as a downloadable CSV file
 * @param {object} state 
 */
export function exportChecklistCsv(state) {
  const { tender, requirements, matches, expiry, files } = state;

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
    "Document Expiry Date",
    "Tender Deadline",
    "Compliance Audit Note"
  ];

  const rows = requirements.map(req => {
    const status = computeStatus(req, state);
    const matchedFileId = matches[req.id];
    const file = files.find(f => f.id === matchedFileId);
    const expDate = expiry[req.id] || '';

    let note = "Compliant";
    if (status === 'MISSING') note = "NON-COMPLIANT: Mandatory document missing";
    else if (status === 'EXPIRY_NEEDED') note = "NON-COMPLIANT: Expiry date not recorded";
    else if (status === 'EXPIRED') note = `NON-COMPLIANT: Expired (${expDate} < ${tender.deadline})`;
    else if (status === 'NOT_PROVIDED') note = "Optional document omitted";

    return [
      req.order,
      req.id,
      req.title_en,
      req.title_bn,
      req.mandatory ? "YES" : "NO",
      req.has_expiry ? "YES" : "NO",
      status,
      file ? file.name : "None",
      file ? file.pages : 0,
      file ? file.bytes : 0,
      expDate || "N/A",
      tender.deadline || "N/A",
      note
    ].map(escapeCsv).join(',');
  });

  const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tenderId = (tender.id || "Tender").replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `${tenderId}_Compliance_Checklist.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}
