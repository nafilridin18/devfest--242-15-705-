/**
 * Tender Package Builder - Main Application Bootstrapper
 * Coordinates state, UI rendering, drag-and-drop file pipeline,
 * sample pack creation, and package PDF generation.
 */

import { store } from './state.js';
import { t } from './i18n.js';
import { CANONICAL_TENDER_DATA, validateRequirementsData } from './requirements.js';
import { processSingleFile, validateBatchLimits, formatBytes } from './files.js';
import { autoMatchFiles } from './matching.js';
import { computeStatus, isBlockingStatus, STATUS_CODES } from './status.js';
import { buildTenderPackage, downloadPdfBlob } from './package.js';
import { exportChecklistCsv } from './export-csv.js';
import { savePersistedState, loadPersistedState } from './persist.js';

// UI Components
import { renderHeader } from './ui/header.js';
import { renderRequirementList } from './ui/requirementList.js';
import { renderFileTray } from './ui/fileTray.js';
import { renderBlockerPanel, getBlockersList } from './ui/blockerPanel.js';
import { showToast } from './ui/toast.js';

// DOM Element References
const appHeader = document.getElementById('appHeader');
const requirementListContainer = document.getElementById('requirementListContainer');
const trayFilesList = document.getElementById('trayFilesList');
const blockerPanelMount = document.getElementById('blockerPanelMount');

const metaTenderId = document.getElementById('metaTenderId');
const metaTenderTitle = document.getElementById('metaTenderTitle');
const metaTenderEntity = document.getElementById('metaTenderEntity');
const metaTenderBidder = document.getElementById('metaTenderBidder');
const metaTenderDeadline = document.getElementById('metaTenderDeadline');
const progressMeterFill = document.getElementById('progressMeterFill');
const progressSummaryText = document.getElementById('progressSummaryText');

const reqCountBadge = document.getElementById('reqCountBadge');
const fileCountBadge = document.getElementById('fileCountBadge');

const uploadDropzone = document.getElementById('uploadDropzone');
const pdfFileInput = document.getElementById('pdfFileInput');
const jsonFileInput = document.getElementById('jsonFileInput');

const btnAutoMatch = document.getElementById('btnAutoMatch');
const btnUndo = document.getElementById('btnUndo');
const btnClearFiles = document.getElementById('btnClearFiles');
const btnExportCsv = document.getElementById('btnExportCsv');
const btnLoadCustomJson = document.getElementById('btnLoadCustomJson');
const btnGeneratePackage = document.getElementById('btnGeneratePackage');

const filterChips = document.querySelectorAll('.filter-chip');

/**
 * Main Render Loop
 * Synchronizes the entire DOM tree with current reactive state
 */
function render(state) {
  const { lang, tender, requirements, files, matches, filter } = state;

  // 1. Render Header
  renderHeader(appHeader, state, {
    onSampleClick: () => loadSamplePack()
  });

  // 2. Update Tender Metadata Strip
  if (metaTenderId) metaTenderId.textContent = tender.id || 'N/A';
  if (metaTenderTitle) metaTenderTitle.textContent = tender.title || 'N/A';
  if (metaTenderEntity) metaTenderEntity.textContent = tender.entity || 'N/A';
  if (metaTenderBidder) metaTenderBidder.textContent = tender.bidder || 'N/A';
  if (metaTenderDeadline) metaTenderDeadline.textContent = tender.deadline || 'N/A';

  // 3. Update Progress Counters
  const totalReqs = requirements.length;
  const readyReqs = requirements.filter(r => computeStatus(r, state) === STATUS_CODES.OK).length;
  const pct = totalReqs > 0 ? Math.round((readyReqs / totalReqs) * 100) : 0;

  if (progressMeterFill) progressMeterFill.style.width = `${pct}%`;
  if (progressSummaryText) {
    progressSummaryText.textContent = t('ready_counter', lang, { ready: readyReqs, total: totalReqs });
  }

  // 4. Badges
  if (reqCountBadge) reqCountBadge.textContent = totalReqs;
  if (fileCountBadge) fileCountBadge.textContent = files.length;

  // 5. Render Core UI Components
  renderRequirementList(requirementListContainer, state);
  renderFileTray(trayFilesList, state);
  renderBlockerPanel(blockerPanelMount, state);

  // 6. Update Filter Tab Active States
  filterChips.forEach(chip => {
    const f = chip.getAttribute('data-filter');
    if (f === filter) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  // 7. Update Undo Button
  if (btnUndo) {
    btnUndo.disabled = !store.canUndo();
  }

  // 8. Update Generate Button (Task 4.7)
  const blockers = getBlockersList(state);
  const matchedCount = Object.keys(matches).length;
  const canGenerate = blockers.length === 0 && matchedCount > 0 && !state.isGenerating;

  if (btnGeneratePackage) {
    btnGeneratePackage.disabled = !canGenerate;
    if (state.isGenerating) {
      btnGeneratePackage.innerHTML = `
        <svg class="spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
        <span>${t('generating_pdf', lang)}</span>
      `;
    } else {
      btnGeneratePackage.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <span>${t('generate_package_btn', lang)}</span>
      `;
    }
  }

  // 9. Persist preferences
  savePersistedState(state);
}

/**
 * Handle File Upload Pipeline
 */
async function handleFilesUpload(fileList) {
  const filesArray = Array.from(fileList || []);
  if (filesArray.length === 0) return;

  const state = store.getState();
  const limitCheck = validateBatchLimits(filesArray, state.files);
  if (!limitCheck.valid) {
    showToast(limitCheck.error, 'error');
    return;
  }

  const processedMeta = [];
  for (const file of filesArray) {
    const { fileMeta, buffer } = await processSingleFile(file, [...state.files, ...processedMeta]);
    store.setFileBuffer(fileMeta.id, buffer);
    processedMeta.push(fileMeta);
  }

  store.addFiles(processedMeta);
  showToast(`Added ${processedMeta.length} file(s) to pool.`, 'success');
}

/**
 * Creates and loads sample PDFs directly from /sample pack for instant execution
 */
async function loadSamplePack() {
  showToast("Loading Sample Tender Pack...", "info", 1500);

  try {
    // 1. Fetch requirements
    const reqRes = await fetch('sample/requirements.json');
    if (reqRes.ok) {
      const data = await reqRes.json();
      store.setTenderData(data.tender, data.requirements);
    } else {
      store.setTenderData(CANONICAL_TENDER_DATA.tender, CANONICAL_TENDER_DATA.requirements);
    }

    store.clearFiles();

    // 2. Fetch sample PDF documents
    const sampleFiles = [
      { name: "Trade_License_2026.pdf", reqId: "req-1", expiry: "2026-12-31" },
      { name: "TIN_Certificate.pdf", reqId: "req-2" },
      { name: "VAT_Registration_BIN.pdf", reqId: "req-3" },
      { name: "Tax_Clearance_Cert.pdf", reqId: "req-4", expiry: "2026-11-15" },
      { name: "Bank_Solvency_Certificate.pdf", reqId: "req-5", expiry: "2026-10-30" },
      { name: "ISO_9001_Quality_Cert.pdf", reqId: "req-6", expiry: "2027-05-01" },
      { name: "MAF_Manufacturer_Authorization.pdf", reqId: "req-7" },
      { name: "Audited_Financial_Statements.pdf", reqId: "req-8" },
      { name: "Similar_Experience_Contracts.pdf", reqId: "req-9" }
    ];

    const processedFiles = [];
    for (const sf of sampleFiles) {
      try {
        const fRes = await fetch('sample/' + sf.name);
        const blob = await fRes.blob();
        const mockFile = new File([blob], sf.name, { type: 'application/pdf' });
        const { fileMeta, buffer } = await processSingleFile(mockFile, processedFiles);
        store.setFileBuffer(fileMeta.id, buffer);
        processedFiles.push({ ...fileMeta, targetReqId: sf.reqId, defaultExpiry: sf.expiry });
      } catch (err) {
        console.warn("Could not load sample file:", sf.name, err);
      }
    }

    store.addFiles(processedFiles);

    // 3. Match and wire up
    for (const pf of processedFiles) {
      if (pf.targetReqId) {
        store.matchFile(pf.targetReqId, pf.id);
        if (pf.defaultExpiry) {
          store.setExpiryDate(pf.targetReqId, pf.defaultExpiry);
        }
      }
    }

    showToast(t('toast_sample_loaded', store.getState().lang), 'success');
  } catch (err) {
    console.error("Error loading sample pack:", err);
  }
}

/**
 * Bootstraps the application on DOMContentLoaded
 */
function initApp() {
  // 1. Load default canonical tender
  store.setTenderData(CANONICAL_TENDER_DATA.tender, CANONICAL_TENDER_DATA.requirements);

  // 2. Load persisted settings or URL query parameters
  const params = new URLSearchParams(window.location.search);
  const persisted = loadPersistedState();

  const initialLang = params.get('lang') || (persisted && persisted.lang) || 'en';
  const initialTheme = params.get('theme') || (persisted && persisted.theme) || 'light';
  const initialFilter = params.get('filter') || (persisted && persisted.filter) || 'all';

  store.setLanguage(initialLang);
  store.setTheme(initialTheme);
  store.setFilter(initialFilter);

  // 3. Subscribe render loop to store
  store.subscribe(render);

  // 4. Initial Render
  render(store.getState());

  // Check if sample pack is requested via URL
  if (params.get('sample') === 'true' || params.get('sample') === '1') {
    setTimeout(() => {
      loadSamplePack();
    }, 150);
  }

  // ---------------- DOM Event Bindings ----------------

  // Upload Dropzone Click
  if (uploadDropzone && pdfFileInput) {
    uploadDropzone.addEventListener('click', () => pdfFileInput.click());
    uploadDropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pdfFileInput.click();
      }
    });

    uploadDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadDropzone.classList.add('drag-active');
    });

    uploadDropzone.addEventListener('dragleave', () => {
      uploadDropzone.classList.remove('drag-active');
    });

    uploadDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadDropzone.classList.remove('drag-active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesUpload(e.dataTransfer.files);
      }
    });

    pdfFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFilesUpload(e.target.files);
        e.target.value = ''; // Reset input for re-selection
      }
    });
  }

  // Clear files pool
  if (btnClearFiles) {
    btnClearFiles.addEventListener('click', () => {
      if (confirm("Are you sure you want to clear all uploaded files?")) {
        store.clearFiles();
      }
    });
  }

  // Auto-Match Action
  if (btnAutoMatch) {
    btnAutoMatch.addEventListener('click', () => {
      const res = autoMatchFiles();
      const state = store.getState();
      if (res.count > 0) {
        showToast(t('toast_auto_matched', state.lang, { count: res.count }), 'success');
      } else {
        showToast(t('toast_no_auto_match', state.lang), 'info');
      }
    });
  }

  // Undo Action
  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      const ok = store.undo();
      if (ok) {
        showToast(t('toast_undo', store.getState().lang), 'info');
      }
    });
  }

  // Keyboard shortcut for Undo (Ctrl+Z / Cmd+Z)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (store.canUndo()) {
        e.preventDefault();
        store.undo();
        showToast(t('toast_undo', store.getState().lang), 'info');
      }
    }
  });

  // Filter Chips Click
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const f = chip.getAttribute('data-filter');
      store.setFilter(f);
    });
  });

  // Export CSV Checklist
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      exportChecklistCsv(store.getState());
      showToast(t('toast_csv_exported', store.getState().lang), 'success');
    });
  }

  // Custom JSON Upload
  if (btnLoadCustomJson && jsonFileInput) {
    btnLoadCustomJson.addEventListener('click', () => jsonFileInput.click());

    jsonFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const validated = validateRequirementsData(json);

        if (!validated.valid) {
          showToast(validated.error, 'error');
        } else {
          store.setTenderData(validated.tender, validated.requirements);
          showToast("Custom tender requirements loaded successfully!", 'success');
        }
      } catch (err) {
        showToast("Failed to parse JSON file: " + err.message, 'error');
      }
      e.target.value = '';
    });
  }

  // Generate Package PDF
  if (btnGeneratePackage) {
    btnGeneratePackage.addEventListener('click', async () => {
      store.setState({ isGenerating: true });
      try {
        const result = await buildTenderPackage();
        downloadPdfBlob(result.blob, result.filename);
        const mb = (result.bytes.byteLength / (1024 * 1024)).toFixed(2);
        showToast(t('toast_pdf_success', store.getState().lang, { size: mb, pages: result.totalPages }), 'success', 5000);
      } catch (err) {
        console.error("PDF Assembly Error:", err);
        showToast("Error generating package: " + err.message, 'error');
      } finally {
        store.setState({ isGenerating: false });
      }
    });
  }
}

// Boot application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
