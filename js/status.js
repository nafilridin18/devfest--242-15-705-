/**
 * Tender Package Builder - Pure Status Evaluation Engine
 * Evaluates requirement status against tender deadline and matched file state.
 *
 * SPECIFICATION RULES:
 * if no file matched:
 *    mandatory ? MISSING (blocks) : NOT_PROVIDED (optional, does not block)
 * else if has_expiry:
 *    no date         -> EXPIRY_NEEDED (blocks)
 *    date < deadline -> EXPIRED (blocks)    // compare as YYYY-MM-DD strings
 *    else            -> OK                  // date >= deadline (same day = OK)
 * else -> OK
 *
 * Dates are strictly compared as lexicographical strings ('YYYY-MM-DD')
 * to guarantee zero timezone or leap year conversion skew across platforms.
 */

export const STATUS_CODES = {
  OK: 'OK',
  MISSING: 'MISSING',
  EXPIRY_NEEDED: 'EXPIRY_NEEDED',
  EXPIRED: 'EXPIRED',
  NOT_PROVIDED: 'NOT_PROVIDED'
};

/**
 * Checks if a status code blocks the Generate button
 * @param {string} status 
 * @returns {boolean}
 */
export function isBlockingStatus(status) {
  return status === STATUS_CODES.MISSING ||
         status === STATUS_CODES.EXPIRY_NEEDED ||
         status === STATUS_CODES.EXPIRED;
}

/**
 * Pure function: computeStatus(req, state)
 * @param {object} req - Requirement object { id, mandatory, has_expiry, ... }
 * @param {object} state - Application state { tender, matches, expiry, files }
 * @returns {string} Status code from STATUS_CODES
 */
export function computeStatus(req, state) {
  if (!req) return STATUS_CODES.NOT_PROVIDED;

  const matches = state?.matches || {};
  const fileId = matches[req.id];

  // 1. If no file matched:
  if (!fileId) {
    return req.mandatory ? STATUS_CODES.MISSING : STATUS_CODES.NOT_PROVIDED;
  }

  // Check if matched file is invalid or duplicate
  const files = state?.files || [];
  const file = files.find(f => f.id === fileId);
  if (file && (file.error || file.isDuplicate)) {
    // If matched file itself is corrupted or duplicate, treat as blocking missing/error
    return STATUS_CODES.MISSING;
  }

  // 2. If requirement requires validity / expiry date:
  if (req.has_expiry) {
    const expMap = state?.expiry || {};
    const expiryDate = (expMap[req.id] || '').trim();

    if (!expiryDate) {
      return STATUS_CODES.EXPIRY_NEEDED;
    }

    const deadline = (state?.tender?.deadline || state?.tender?.submission_deadline || '').trim();

    // Strict lexicographical comparison (YYYY-MM-DD)
    // Example: "2026-10-19" < "2026-10-20" -> true (EXPIRED)
    //          "2026-10-20" < "2026-10-20" -> false (OK - same day is OK)
    //          "2026-11-01" < "2026-10-20" -> false (OK)
    if (deadline && expiryDate < deadline) {
      return STATUS_CODES.EXPIRED;
    }

    return STATUS_CODES.OK;
  }

  // 3. File matched and no expiry required:
  return STATUS_CODES.OK;
}

/**
 * Comprehensive Unit Test Suite for computeStatus
 * Can be run in browser console or node to verify compliance with 10 test cases.
 * @returns {Array<{ name: string, passed: boolean, expected: string, actual: string }>}
 */
export function runStatusUnitTests() {
  const tender = { id: 'T-2026-0417', deadline: '2026-10-20' };

  const testCases = [
    {
      name: "1. Mandatory without file -> MISSING",
      req: { id: 'r1', mandatory: true, has_expiry: false },
      state: { tender, matches: {}, expiry: {}, files: [] },
      expected: STATUS_CODES.MISSING
    },
    {
      name: "2. Optional without file -> NOT_PROVIDED",
      req: { id: 'r2', mandatory: false, has_expiry: false },
      state: { tender, matches: {}, expiry: {}, files: [] },
      expected: STATUS_CODES.NOT_PROVIDED
    },
    {
      name: "3. Optional without file but has_expiry true -> NOT_PROVIDED",
      req: { id: 'r3', mandatory: false, has_expiry: true },
      state: { tender, matches: {}, expiry: {}, files: [] },
      expected: STATUS_CODES.NOT_PROVIDED
    },
    {
      name: "4. Matched without expiry requirement -> OK",
      req: { id: 'r4', mandatory: true, has_expiry: false },
      state: { tender, matches: { r4: 'f1' }, expiry: {}, files: [{ id: 'f1' }] },
      expected: STATUS_CODES.OK
    },
    {
      name: "5. Matched with has_expiry true, no date entered -> EXPIRY_NEEDED",
      req: { id: 'r5', mandatory: true, has_expiry: true },
      state: { tender, matches: { r5: 'f1' }, expiry: {}, files: [{ id: 'f1' }] },
      expected: STATUS_CODES.EXPIRY_NEEDED
    },
    {
      name: "6. Matched with date before deadline (2026-10-19 < 2026-10-20) -> EXPIRED",
      req: { id: 'r6', mandatory: true, has_expiry: true },
      state: { tender, matches: { r6: 'f1' }, expiry: { r6: '2026-10-19' }, files: [{ id: 'f1' }] },
      expected: STATUS_CODES.EXPIRED
    },
    {
      name: "7. Matched with date exactly ON deadline (2026-10-20) -> OK (Same day = OK)",
      req: { id: 'r7', mandatory: true, has_expiry: true },
      state: { tender, matches: { r7: 'f1' }, expiry: { r7: '2026-10-20' }, files: [{ id: 'f1' }] },
      expected: STATUS_CODES.OK
    },
    {
      name: "8. Matched with date after deadline (2026-12-31 > 2026-10-20) -> OK",
      req: { id: 'r8', mandatory: true, has_expiry: true },
      state: { tender, matches: { r8: 'f1' }, expiry: { r8: '2026-12-31' }, files: [{ id: 'f1' }] },
      expected: STATUS_CODES.OK
    },
    {
      name: "9. Optional matched with expired date -> EXPIRED (Blocks if provided expired)",
      req: { id: 'r9', mandatory: false, has_expiry: true },
      state: { tender, matches: { r9: 'f1' }, expiry: { r9: '2026-09-01' }, files: [{ id: 'f1' }] },
      expected: STATUS_CODES.EXPIRED
    },
    {
      name: "10. Matched with corrupted file -> MISSING",
      req: { id: 'r10', mandatory: true, has_expiry: false },
      state: { tender, matches: { r10: 'fBad' }, expiry: {}, files: [{ id: 'fBad', error: 'Corrupt' }] },
      expected: STATUS_CODES.MISSING
    }
  ];

  return testCases.map(tc => {
    const actual = computeStatus(tc.req, tc.state);
    const passed = actual === tc.expected;
    return { name: tc.name, passed, expected: tc.expected, actual };
  });
}
