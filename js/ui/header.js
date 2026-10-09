/**
 * Tender Package Builder - Header Component
 * Handles branding, language toggle, light/dark theme switch,
 * sample loader action, and dynamic 3-step progress visualization.
 */

import { store } from '../state.js';
import { t } from '../i18n.js';
import { computeStatus, isBlockingStatus, STATUS_CODES } from '../status.js';

/**
 * Calculates current active step (1, 2, or 3)
 */
function calculateStepProgress(state) {
  const reqs = state.requirements || [];
  const files = state.files || [];
  const matches = state.matches || {};

  if (reqs.length === 0) {
    return { currentStep: 1, s1Done: false, s2Done: false, s3Done: false };
  }

  const s1Done = true;
  const matchCount = Object.keys(matches).length;
  const s2Done = matchCount > 0 && files.length > 0;

  // Step 3 is completed when zero blocking requirements remain
  const blockers = reqs.filter(r => isBlockingStatus(computeStatus(r, state)));
  const s3Done = s2Done && blockers.length === 0;

  let currentStep = 1;
  if (!s2Done) currentStep = 2;
  else if (!s3Done) currentStep = 2;
  else currentStep = 3;

  return { currentStep, s1Done, s2Done, s3Done };
}

/**
 * Render Header UI
 * @param {HTMLElement} container 
 * @param {object} state 
 * @param {{ onSampleClick: Function }} callbacks 
 */
export function renderHeader(container, state, callbacks = {}) {
  const { lang, theme } = state;
  const { currentStep, s1Done, s2Done, s3Done } = calculateStepProgress(state);

  const sunIcon = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
  const moonIcon = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;

  container.innerHTML = `
    <div class="header-top">
      <div class="brand-wrapper">
        <div class="brand-logo" aria-hidden="true">TPB</div>
        <div class="brand-text">
          <h1>
            <span>${t('app_title', lang)}</span>
            <span class="brand-badge">${t('badge_gp', lang)}</span>
          </h1>
          <p class="brand-subtitle">${t('app_subtitle', lang)}</p>
        </div>
      </div>

      <div class="header-actions">
        <!-- Backend API Status Badge -->
        <div class="backend-badge ${state.backendStatus?.connected ? 'connected' : 'standalone'}" id="backendBadge" title="Backend Server API Status (Port 3000)">
          <span class="backend-dot"></span>
          <span id="backendBadgeText">${state.backendStatus?.connected ? 'Backend: Online' : 'Engine: Client'}</span>
        </div>

        <!-- Sample Pack Quick Load -->
        <button class="btn-secondary" id="btnTrySample" style="border-color: var(--color-peach-300);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>${t('try_sample', lang)}</span>
        </button>

        <!-- Theme Toggle -->
        <button class="btn-icon" id="btnThemeToggle" title="Toggle Light / Dark Mode" aria-label="Toggle Theme">
          ${theme === 'dark' ? sunIcon : moonIcon}
        </button>

        <!-- Language Switcher -->
        <button class="btn-secondary" id="btnLangToggle" title="Switch English / Bangla" aria-label="Switch Language">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
          <strong style="color: var(--color-peach-600);">${lang === 'en' ? 'বাংলা' : 'English'}</strong>
        </button>
      </div>
    </div>

    <!-- 3-Step Interactive Process Bar -->
    <div class="stepper-bar" role="navigation" aria-label="Progress Stepper">
      <div class="step-item ${currentStep === 1 ? 'active' : ''} ${s1Done ? 'completed' : ''}">
        <div class="step-num">${s1Done ? '✓' : '1'}</div>
        <div class="step-info">
          <span class="step-label">${t('step_1_label', lang)}</span>
          <span class="step-title">${t('step_1_title', lang)}</span>
        </div>
      </div>
      <div class="step-item ${currentStep === 2 ? 'active' : ''} ${s2Done ? 'completed' : ''}">
        <div class="step-num">${s2Done ? '✓' : '2'}</div>
        <div class="step-info">
          <span class="step-label">${t('step_2_label', lang)}</span>
          <span class="step-title">${t('step_2_title', lang)}</span>
        </div>
      </div>
      <div class="step-item ${currentStep === 3 ? 'active' : ''} ${s3Done ? 'completed' : ''}">
        <div class="step-num">${s3Done ? '✓' : '3'}</div>
        <div class="step-info">
          <span class="step-label">${t('step_3_label', lang)}</span>
          <span class="step-title">${t('step_3_title', lang)}</span>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  const sampleBtn = container.querySelector('#btnTrySample');
  if (sampleBtn && callbacks.onSampleClick) {
    sampleBtn.addEventListener('click', callbacks.onSampleClick);
  }

  const themeBtn = container.querySelector('#btnThemeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      store.setTheme(nextTheme);
    });
  }

  const langBtn = container.querySelector('#btnLangToggle');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      const nextLang = state.lang === 'en' ? 'bn' : 'en';
      store.setLanguage(nextLang);
    });
  }
}
