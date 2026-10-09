/**
 * Tender Package Builder - Single Source of Truth Reactive State Store
 * Features: Subscriptions, Snapshots, and Infinite/Configurable Undo Stack
 */

const DEFAULT_STATE = {
  lang: 'en',
  theme: 'light',
  filter: 'all', // 'all' | 'problems' | 'ready'
  tender: {
    id: "T-2026-0417",
    title: "Procurement of IT Equipment and Data Center Infrastructure",
    entity: "Ministry of Digital Transformation",
    bidder: "Apex Tech Solutions Ltd.",
    deadline: "2026-10-20"
  },
  requirements: [],
  files: [], // Array of { id, name, pages, hash, bytes, arrayBuffer, pdfDoc?, error?, isDuplicate?, duplicateOf? }
  matches: {}, // 1:1 mapping: { [reqId]: fileId }
  expiry: {},  // { [reqId]: 'YYYY-MM-DD' }
  isGenerating: false,
  backendStatus: { connected: false, version: null }
};

class StateStore {
  constructor() {
    this._state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this._fileBuffers = new Map(); // Keep large ArrayBuffers outside pure JSON clones
    this._listeners = new Set();
    this._undoStack = [];
    this._maxUndo = 30;
  }

  getState() {
    return this._state;
  }

  getFileBuffer(fileId) {
    return this._fileBuffers.get(fileId);
  }

  setFileBuffer(fileId, buffer) {
    this._fileBuffers.set(fileId, buffer);
  }

  removeFileBuffer(fileId) {
    this._fileBuffers.delete(fileId);
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  notify() {
    for (const listener of this._listeners) {
      try {
        listener(this._state);
      } catch (err) {
        console.error("State listener notification error:", err);
      }
    }
  }

  /**
   * Push current matching/expiry state into undo stack before mutating
   */
  _pushUndoSnapshot() {
    const snapshot = {
      matches: { ...this._state.matches },
      expiry: { ...this._state.expiry }
    };
    this._undoStack.push(snapshot);
    if (this._undoStack.length > this._maxUndo) {
      this._undoStack.shift();
    }
  }

  canUndo() {
    return this._undoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return false;
    const prev = this._undoStack.pop();
    this._state.matches = { ...prev.matches };
    this._state.expiry = { ...prev.expiry };
    this.notify();
    return true;
  }

  setState(partial, recordUndo = false) {
    if (recordUndo) {
      this._pushUndoSnapshot();
    }
    this._state = {
      ...this._state,
      ...partial
    };
    this.notify();
  }

  setLanguage(lang) {
    if (this._state.lang === lang) return;
    this._state.lang = lang;
    document.documentElement.lang = lang;
    document.body.setAttribute('lang', lang);
    this.notify();
  }

  setTheme(theme) {
    this._state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this.notify();
  }

  setFilter(filter) {
    this._state.filter = filter;
    this.notify();
  }

  setTenderData(tender, requirements) {
    // Sort requirements by 'order' as per requirement 4.1
    const sorted = [...requirements].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    this._state.tender = { ...tender };
    this._state.requirements = sorted;
    this._undoStack = [];
    this.notify();
  }

  addFiles(newFiles) {
    // Merge new files into pool
    const existing = [...this._state.files];
    for (const nf of newFiles) {
      const idx = existing.findIndex(f => f.id === nf.id || (f.hash && f.hash === nf.hash && f.name === nf.name));
      if (idx >= 0) {
        existing[idx] = nf;
      } else {
        existing.push(nf);
      }
    }
    this._state.files = existing;
    this.notify();
  }

  removeFile(fileId) {
    this._pushUndoSnapshot();
    // 1. Remove from matches if currently matched
    const matches = { ...this._state.matches };
    for (const [rId, fId] of Object.entries(matches)) {
      if (fId === fileId) {
        delete matches[rId];
      }
    }
    this._state.matches = matches;

    // 2. Remove from files array
    this._state.files = this._state.files.filter(f => f.id !== fileId);
    this.removeFileBuffer(fileId);
    this.notify();
  }

  clearFiles() {
    this._pushUndoSnapshot();
    this._state.files = [];
    this._state.matches = {};
    this._state.expiry = {};
    this._fileBuffers.clear();
    this.notify();
  }

  matchFile(reqId, fileId) {
    this._pushUndoSnapshot();
    const matches = { ...this._state.matches };

    // 1:1 rule: A file can only be matched to ONE requirement.
    // If this file was previously matched to another req, remove that match.
    for (const [rId, fId] of Object.entries(matches)) {
      if (fId === fileId && rId !== reqId) {
        delete matches[rId];
      }
    }

    if (fileId) {
      matches[reqId] = fileId;
    } else {
      delete matches[reqId];
    }

    this._state.matches = matches;
    this.notify();
  }

  unmatchReq(reqId) {
    if (!this._state.matches[reqId]) return;
    this._pushUndoSnapshot();
    const matches = { ...this._state.matches };
    delete matches[reqId];
    this._state.matches = matches;
    this.notify();
  }

  setExpiryDate(reqId, dateStr) {
    this._pushUndoSnapshot();
    const expiry = { ...this._state.expiry };
    if (dateStr) {
      expiry[reqId] = dateStr.trim();
    } else {
      delete expiry[reqId];
    }
    this._state.expiry = expiry;
    this.notify();
  }
}

export const store = new StateStore();
