/**
 * Tender Package Builder - Blocker Reasons UI Panel
 * Displays explicit reasons why Generate button is disabled (Task 4.7).
 * Each reason is clickable and smoothly scrolls directly to the problematic row.
 */

import { t, titleOf } from '../i18n.js';
import { computeStatus, isBlockingStatus, STATUS_CODES } from '../status.js';

/**
 * Extracts list of blocker items preventing generation
 * @param {object} state 
 * @returns {Array<{ reqId: string, message: string }>}
 */
export function getBlockersList(state) {
  const { lang, requirements, tender } = state;
  const blockers = [];

  for (const req of requirements) {
    const status = computeStatus(req, state);
    if (!isBlockingStatus(status)) continue;

    const docTitle = titleOf(req, lang);

    if (status === STATUS_CODES.MISSING) {
      blockers.push({
        reqId: req.id,
        message: t('blocker_missing', lang, { doc: docTitle })
      });
    } else if (status === STATUS_CODES.EXPIRY_NEEDED) {
      blockers.push({
        reqId: req.id,
        message: t('blocker_expiry_needed', lang, { doc: docTitle })
      });
    } else if (status === STATUS_CODES.EXPIRED) {
      const expDate = state.expiry[req.id] || '';
      blockers.push({
        reqId: req.id,
        message: t('blocker_expired', lang, { doc: docTitle, date: expDate, deadline: tender.deadline })
      });
    }
  }

  return blockers;
}

/**
 * Render Blocker Panel Component
 * @param {HTMLElement} mount 
 * @param {object} state 
 */
export function renderBlockerPanel(mount, state) {
  const { lang } = state;
  const blockers = getBlockersList(state);

  if (blockers.length === 0) {
    mount.innerHTML = '';
    return;
  }

  mount.innerHTML = `
    <div class="blocker-panel" role="alert" aria-live="polite">
      <div class="blocker-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>${t('blocker_title', lang)}</span>
      </div>
      <ul class="blocker-list">
        ${blockers.map(b => `
          <li class="blocker-item" data-target-req="${b.reqId}" title="Click to jump to document">
            <span class="blocker-link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              <span>${b.message}</span>
            </span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;

  // Attach click-to-scroll handlers
  mount.querySelectorAll('.blocker-item').forEach(item => {
    item.addEventListener('click', () => {
      const targetReqId = item.getAttribute('data-target-req');
      const targetEl = document.getElementById(`reqRow-${targetReqId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.style.transition = 'all 0.3s ease';
        targetEl.style.boxShadow = '0 0 0 3px var(--color-peach-500)';
        setTimeout(() => {
          targetEl.style.boxShadow = '';
        }, 1500);
      }
    });
  });
}
