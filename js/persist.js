/**
 * Tender Package Builder - LocalStorage Persistence (Bonus)
 * Safely persists user preferences (language, theme, expiry inputs).
 */

const STORAGE_KEY = 'tpb_user_state_v1';

export function savePersistedState(state) {
  try {
    const payload = {
      lang: state.lang,
      theme: state.theme,
      filter: state.filter,
      expiry: state.expiry
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Gracefully handle private browsing or storage quota errors
  }
}

export function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}
