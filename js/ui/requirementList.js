/**
 * Tender Package Builder - Requirement List UI Component
 * Features: Drag & Drop targeting, Fallback dropdown matching,
 * Live status chips, Inline expiry date validation, and Problem filtering.
 */

import { store } from '../state.js';
import { t, titleOf } from '../i18n.js';
import { computeStatus, isBlockingStatus, STATUS_CODES } from '../status.js';
import { executeMatch } from '../matching.js';
import { showToast } from './toast.js';
import { formatBytes } from '../files.js';

/**
 * Status icon SVGs
 */
function getStatusIcon(status) {
  switch (status) {
    case STATUS_CODES.OK:
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    case STATUS_CODES.MISSING:
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    case STATUS_CODES.EXPIRY_NEEDED:
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    case STATUS_CODES.EXPIRED:
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    default:
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`;
  }
}

/**
 * Render Requirement List
 * @param {HTMLElement} container 
 * @param {object} state 
 */
export function renderRequirementList(container, state) {
  const { lang, requirements, files, matches, expiry, filter, tender } = state;

  // Filter requirements
  const filtered = requirements.filter(req => {
    const status = computeStatus(req, state);
    if (filter === 'problems') {
      return isBlockingStatus(status);
    }
    if (filter === 'ready') {
      return status === STATUS_CODES.OK;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
        <p style="font-weight: 600;">No document requirements match the selected filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(req => {
    const status = computeStatus(req, state);
    const matchedFileId = matches[req.id];
    const matchedFile = files.find(f => f.id === matchedFileId);
    const reqExpiryDate = expiry[req.id] || '';
    const localizedTitle = titleOf(req, lang);
    const statusLabel = t(`status_${status}`, lang);

    // Build Expiry Block if matched and has_expiry
    let expiryHtml = '';
    if (matchedFile && req.has_expiry) {
      let expiryMessage = '';
      let expiryBoxClass = '';

      if (!reqExpiryDate) {
        expiryBoxClass = 'has-warning';
        expiryMessage = `<span class="expiry-msg warn">${t('expiry_hint_needed', lang)}</span>`;
      } else if (tender.deadline && reqExpiryDate < tender.deadline) {
        expiryBoxClass = 'has-error';
        expiryMessage = `<span class="expiry-msg err">${t('expiry_msg_expired', lang, { date: reqExpiryDate, deadline: tender.deadline })}</span>`;
      } else {
        expiryMessage = `<span class="expiry-msg ok">${t('expiry_msg_valid', lang, { date: reqExpiryDate, deadline: tender.deadline })}</span>`;
      }

      expiryHtml = `
        <div class="expiry-control-box ${expiryBoxClass}">
          <label class="expiry-label" for="expiry-input-${req.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>${t('expiry_label', lang)}</span>
          </label>
          <input 
            type="date" 
            id="expiry-input-${req.id}" 
            class="expiry-input" 
            value="${reqExpiryDate}" 
            data-req-id="${req.id}"
            title="Format: YYYY-MM-DD"
          />
          ${expiryMessage}
        </div>
      `;
    }

    // Build Matched vs Dropdown View
    let matchSectionHtml = '';
    if (matchedFile) {
      const pageStr = matchedFile.pages === 1 
        ? t('page_singular', lang) 
        : t('pages_count', lang, { n: matchedFile.pages });

      matchSectionHtml = `
        <div class="req-matched-box">
          <div class="matched-file-info">
            <div class="file-icon-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <div class="matched-file-name" title="${matchedFile.name}">${matchedFile.name}</div>
              <div class="matched-file-meta">
                <span>${pageStr}</span>
                <span>•</span>
                <span>${formatBytes(matchedFile.bytes)}</span>
              </div>
            </div>
          </div>
          <div class="matched-actions">
            <button class="btn-ghost btn-unmatch" data-req-id="${req.id}" title="${t('unmatch_btn', lang)}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              <span>${t('unmatch_btn', lang)}</span>
            </button>
          </div>
        </div>
        ${expiryHtml}
      `;
    } else {
      // Fallback Dropdown Selection
      const availableOptions = files.map(f => {
        const isMatchedToOther = Object.entries(matches).some(([rId, fId]) => fId === f.id && rId !== req.id);
        const disabledAttr = (f.error || f.isDuplicate) ? 'disabled' : '';
        const note = f.isDuplicate ? ` (${t('file_duplicate_of', lang, { name: f.duplicateOf })})` : isMatchedToOther ? ' (In Use)' : '';
        return `<option value="${f.id}" ${disabledAttr}>${f.name}${note}</option>`;
      }).join('');

      matchSectionHtml = `
        <div class="req-matching-controls">
          <div class="match-select-wrapper">
            <select class="match-select" data-req-id="${req.id}" aria-label="Select file for ${localizedTitle}">
              <option value="">${t('select_file_placeholder', lang)}</option>
              ${availableOptions}
            </select>
          </div>
        </div>
      `;
    }

    return `
      <div 
        class="requirement-row" 
        id="reqRow-${req.id}" 
        data-req-id="${req.id}"
        tabindex="0"
      >
        <div class="req-header-line">
          <div class="req-main-info">
            <div class="req-order-chip">${req.order}</div>
            <div class="req-titles-group">
              <div class="req-title-wrapper">
                <span class="req-title">${localizedTitle}</span>
                ${req.mandatory 
                  ? `<span class="req-mandatory-pill">${t('mandatory_tag', lang)}</span>` 
                  : `<span class="req-optional-pill">${t('optional_tag', lang)}</span>`
                }
              </div>
              ${req.description ? `<p class="req-desc">${req.description}</p>` : ''}
            </div>
          </div>

          <div class="status-chip" data-status="${status}" title="Status: ${statusLabel}">
            ${getStatusIcon(status)}
            <span>${statusLabel}</span>
          </div>
        </div>

        ${matchSectionHtml}
      </div>
    `;
  }).join('');

  // ---------------- Attach Event Listeners ----------------

  // 1. Dropdown Select Handlers
  container.querySelectorAll('.match-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const reqId = e.target.getAttribute('data-req-id');
      const fileId = e.target.value;
      const res = executeMatch(reqId, fileId);
      if (!res.success) {
        showToast(res.reason, 'error');
      } else if (fileId) {
        const f = state.files.find(item => item.id === fileId);
        showToast(t('toast_matched', lang, { file: f ? f.name : fileId, req: titleOf(state.requirements.find(r => r.id === reqId), lang) }), 'success');
      }
    });
  });

  // 2. Unmatch Button Handlers
  container.querySelectorAll('.btn-unmatch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const reqId = btn.getAttribute('data-req-id');
      const req = state.requirements.find(r => r.id === reqId);
      store.unmatchReq(reqId);
      showToast(t('toast_unmatched', lang, { file: '', req: titleOf(req, lang) }), 'info');
    });
  });

  // 3. Expiry Input Handlers
  container.querySelectorAll('.expiry-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const reqId = input.getAttribute('data-req-id');
      store.setExpiryDate(reqId, e.target.value);
    });
  });

  // 4. Drag & Drop Targets on Requirement Rows
  container.querySelectorAll('.requirement-row').forEach(row => {
    const reqId = row.getAttribute('data-req-id');

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      row.classList.add('drag-over');
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const fileId = e.dataTransfer.getData('text/plain');
      if (fileId) {
        const res = executeMatch(reqId, fileId);
        if (!res.success) {
          showToast(res.reason, 'error');
        } else {
          const f = state.files.find(item => item.id === fileId);
          showToast(t('toast_matched', lang, { file: f ? f.name : fileId, req: titleOf(state.requirements.find(r => r.id === reqId), lang) }), 'success');
        }
      }
    });
  });
}
