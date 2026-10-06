/**
 * Tender Package Builder - File Tray UI Component
 * Features: Draggable cards, SHA-256 duplicate warning badges,
 * page counts, PDF thumbnails, and remove actions.
 */

import { store } from '../state.js';
import { t, titleOf } from '../i18n.js';
import { formatBytes } from '../files.js';

/**
 * Render Uploaded Files Pool Tray
 * @param {HTMLElement} container 
 * @param {object} state 
 */
export function renderFileTray(container, state) {
  const { lang, files, matches, requirements } = state;

  if (files.length === 0) {
    container.innerHTML = `
      <div style="padding: 2.25rem 1.5rem; text-align: center; color: var(--text-muted);">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 0.5rem; opacity: 0.6;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p style="font-size: 0.85rem; font-weight: 600;">No files uploaded yet.</p>
        <p style="font-size: 0.78rem; opacity: 0.8;">Upload PDF documents or click "Try Sample Pack".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = files.map(file => {
    // Check if matched
    const matchedEntry = Object.entries(matches).find(([rId, fId]) => fId === file.id);
    let matchedTitle = null;
    if (matchedEntry) {
      const req = requirements.find(r => r.id === matchedEntry[0]);
      matchedTitle = titleOf(req, lang);
    }

    const pageStr = file.pages === 1 
      ? t('page_singular', lang) 
      : t('pages_count', lang, { n: file.pages });

    const isDraggable = !file.error && !file.isDuplicate;

    return `
      <div 
        class="file-card-item ${file.error ? 'has-error' : ''}" 
        id="fileCard-${file.id}"
        data-file-id="${file.id}"
        draggable="${isDraggable}"
        title="${isDraggable ? 'Drag onto a requirement row to match' : (file.error || file.duplicateOf ? 'Cannot be matched' : '')}"
      >
        <div class="file-card-left">
          <div class="file-thumbnail">
            ${file.thumbnail 
              ? `<img src="${file.thumbnail}" alt="Page 1 Preview" style="width: 100%; height: 100%; object-fit: cover;" />`
              : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
            }
          </div>

          <div class="file-details">
            <span class="file-name-text" title="${file.name}">${file.name}</span>
            <div class="file-meta-row">
              ${file.pages > 0 ? `<span class="badge-tag badge-pages">${pageStr}</span>` : ''}
              <span style="font-size: 0.75rem; color: var(--text-muted);">${formatBytes(file.bytes)}</span>

              ${matchedTitle 
                ? `<span class="badge-tag badge-matched" title="Matched to ${matchedTitle}">✓ ${matchedTitle}</span>` 
                : ''}

              ${file.isDuplicate 
                ? `<span class="badge-tag badge-duplicate" title="Duplicate of ${file.duplicateOf}">⚠ ${t('file_duplicate_of', lang, { name: file.duplicateOf })}</span>` 
                : ''}

              ${file.error 
                ? `<span class="badge-tag badge-error" title="${file.errorMessage || file.error}">✖ ${file.error === 'NOT_PDF' ? t('file_error_not_pdf', lang) : t('file_error_corrupt', lang)}</span>` 
                : ''}
            </div>
          </div>
        </div>

        <button 
          class="btn-ghost btn-remove-file" 
          data-file-id="${file.id}" 
          title="Remove file"
          aria-label="Remove ${file.name}"
          style="padding: 0.35rem; color: var(--text-muted);"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
  }).join('');

  // ---------------- Attach Event Listeners ----------------

  // 1. Dragstart / Dragend on file cards
  container.querySelectorAll('.file-card-item').forEach(card => {
    const fileId = card.getAttribute('data-file-id');
    const isDraggable = card.getAttribute('draggable') === 'true';

    if (isDraggable) {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', fileId);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('is-dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
      });
    }
  });

  // 2. Remove File Button
  container.querySelectorAll('.btn-remove-file').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileId = btn.getAttribute('data-file-id');
      store.removeFile(fileId);
    });
  });
}
