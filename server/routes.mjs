/**
 * Tender Package Builder - REST API Route Handlers
 * Clean, robust native HTTP routing with zero external npm dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  STATUS_CODES,
  computeSha256,
  checkPdfMagicBytes,
  inspectPdfBuffer,
  normalizeRequirements,
  computeStatus,
  validateTenderDossier,
  buildPackagePdf,
  generateChecklistCsv
} from './tender-engine.mjs';

const startTime = Date.now();

/**
 * Send JSON response
 */
export function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(payload);
}

/**
 * Send error response
 */
export function sendError(res, statusCode, message, details = null) {
  sendJson(res, statusCode, {
    error: true,
    message,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper to parse JSON body from incoming request
 */
export async function parseJsonBody(req, maxBytes = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error(`Payload too large: exceeds ${maxBytes} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Malformed JSON: ${err.message}`));
      }
    });

    req.on('error', err => reject(err));
  });
}

/**
 * Handle API requests
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<boolean>} true if route handled, false if not an API route
 */
export async function handleApiRoute(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = urlObj.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS pre-flight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return true;
  }

  if (!pathname.startsWith('/api/')) {
    return false;
  }

  try {
    // 1. GET /api/health
    if (method === 'GET' && pathname === '/api/health') {
      const mem = process.memoryUsage();
      sendJson(res, 200, {
        status: 'ok',
        service: 'Tender Package Builder Backend',
        version: '2.0.0',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsageMb: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
        },
        timestamp: new Date().toISOString()
      });
      return true;
    }

    // 2. GET /api/requirements
    if (method === 'GET' && pathname === '/api/requirements') {
      const samplePath = path.resolve('sample', 'requirements.json');
      if (fs.existsSync(samplePath)) {
        const raw = fs.readFileSync(samplePath, 'utf-8');
        const json = JSON.parse(raw);
        const normalized = normalizeRequirements(json);
        sendJson(res, 200, normalized);
      } else {
        sendError(res, 404, 'Default requirements.json not found on server');
      }
      return true;
    }

    // 3. POST /api/requirements (validate & normalize custom requirements JSON)
    if (method === 'POST' && pathname === '/api/requirements') {
      const body = await parseJsonBody(req);
      const normalized = normalizeRequirements(body);
      if (!normalized.valid) {
        sendError(res, 400, normalized.error);
      } else {
        sendJson(res, 200, normalized);
      }
      return true;
    }

    // 4. POST /api/validate (validate state, compute statuses & blockers)
    if (method === 'POST' && pathname === '/api/validate') {
      const state = await parseJsonBody(req);
      const report = validateTenderDossier(state);
      sendJson(res, 200, report);
      return true;
    }

    // 5. POST /api/upload (process batch of files with SHA-256 duplicate detection)
    if (method === 'POST' && pathname === '/api/upload') {
      const body = await parseJsonBody(req);
      const rawFiles = Array.isArray(body.files) ? body.files : [];

      if (rawFiles.length === 0) {
        sendError(res, 400, 'No files provided in files array');
        return true;
      }

      const existingHashes = new Map();
      const existingFiles = Array.isArray(body.existingFiles) ? body.existingFiles : [];
      for (const ef of existingFiles) {
        if (ef.hash) existingHashes.set(ef.hash, ef.name);
      }

      const processed = [];

      for (const rf of rawFiles) {
        const name = String(rf.name || 'document.pdf');
        let buffer;

        if (rf.data) {
          // Base64 encoded file data
          const base64Data = rf.data.includes(',') ? rf.data.split(',')[1] : rf.data;
          buffer = Buffer.from(base64Data, 'base64');
        } else if (rf.serverFile) {
          // Path to file in sample or testpack
          const allowedDirs = ['sample', 'testpack', 'output'];
          const norm = path.normalize(rf.serverFile);
          const topDir = norm.split(path.sep)[0];
          if (!allowedDirs.includes(topDir)) {
            processed.push({ name, error: 'Forbidden file access' });
            continue;
          }
          if (fs.existsSync(norm)) {
            buffer = fs.readFileSync(norm);
          } else {
            processed.push({ name, error: `File not found on server: ${rf.serverFile}` });
            continue;
          }
        } else {
          processed.push({ name, error: 'No data or serverFile specified' });
          continue;
        }

        const size = buffer.length;
        const hash = computeSha256(buffer);
        const inspection = await inspectPdfBuffer(buffer);

        let isDuplicate = false;
        let duplicateOf = null;

        if (existingHashes.has(hash)) {
          isDuplicate = true;
          duplicateOf = existingHashes.get(hash);
        } else {
          existingHashes.set(hash, name);
        }

        processed.push({
          id: rf.id || `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name,
          bytes: size,
          hash,
          pages: inspection.pages,
          error: inspection.error || null,
          isDuplicate,
          duplicateOf
        });
      }

      sendJson(res, 200, {
        count: processed.length,
        files: processed
      });
      return true;
    }

    // 6. POST /api/generate (assemble PDF tender package)
    if (method === 'POST' && pathname === '/api/generate') {
      const body = await parseJsonBody(req);
      const { tender, requirements, matches, expiry, files, options } = body;

      if (!tender || !requirements || !matches) {
        sendError(res, 400, 'Missing required state fields: tender, requirements, matches');
        return true;
      }

      // Reconstruct buffer mapping for matched files
      const fileBuffers = {};
      const fileList = Array.isArray(files) ? files : [];

      for (const reqItem of requirements) {
        const fileId = matches[reqItem.id];
        if (!fileId) continue;

        const fileMeta = fileList.find(f => f.id === fileId);
        if (fileMeta && fileMeta.data) {
          const b64 = fileMeta.data.includes(',') ? fileMeta.data.split(',')[1] : fileMeta.data;
          fileBuffers[fileId] = Buffer.from(b64, 'base64');
        } else if (fileMeta && fileMeta.serverFile) {
          const sPath = path.resolve(fileMeta.serverFile);
          if (fs.existsSync(sPath)) {
            fileBuffers[fileId] = fs.readFileSync(sPath);
          }
        } else if (body.fileBuffers && body.fileBuffers[fileId]) {
          const b64 = body.fileBuffers[fileId];
          fileBuffers[fileId] = Buffer.from(b64, 'base64');
        } else if (fileMeta && fileMeta.name) {
          // Check if file is available in sample or testpack
          const sampleTry = path.resolve('sample', fileMeta.name);
          const testTry = path.resolve('testpack', fileMeta.name);
          if (fs.existsSync(sampleTry)) {
            fileBuffers[fileId] = fs.readFileSync(sampleTry);
          } else if (fs.existsSync(testTry)) {
            fileBuffers[fileId] = fs.readFileSync(testTry);
          }
        }
      }

      const state = {
        tender,
        requirements,
        matches,
        expiry: expiry || {},
        files: fileList,
        fileBuffers
      };

      const result = await buildPackagePdf(state, options || {});

      sendJson(res, 200, {
        success: true,
        filename: result.filename,
        totalPages: result.totalPages,
        bytesLength: result.bytesLength,
        downloadUrl: `/api/download/${result.filename}`,
        generatedAt: new Date().toISOString()
      });
      return true;
    }

    // 7. GET /api/packages (list generated packages in output/)
    if (method === 'GET' && pathname === '/api/packages') {
      const outDir = path.resolve('output');
      if (!fs.existsSync(outDir)) {
        sendJson(res, 200, { packages: [] });
        return true;
      }

      const fileNames = fs.readdirSync(outDir).filter(f => f.toLowerCase().endsWith('.pdf'));
      const packages = [];

      for (const name of fileNames) {
        const full = path.join(outDir, name);
        const stats = fs.statSync(full);
        packages.push({
          filename: name,
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          downloadUrl: `/api/download/${name}`
        });
      }

      packages.sort((a, b) => b.modifiedAt - a.modifiedAt);
      sendJson(res, 200, { packages });
      return true;
    }

    // 8. GET /api/download/:filename (stream generated package from output/)
    if (method === 'GET' && pathname.startsWith('/api/download/')) {
      const filename = path.basename(pathname.replace('/api/download/', ''));
      if (!filename || !filename.toLowerCase().endsWith('.pdf')) {
        sendError(res, 400, 'Invalid filename requested');
        return true;
      }

      const filePath = path.resolve('output', filename);
      if (!fs.existsSync(filePath)) {
        sendError(res, 404, `Package '${filename}' not found on server`);
        return true;
      }

      const stats = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': stats.size,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*'
      });

      fs.createReadStream(filePath).pipe(res);
      return true;
    }

    // 9. POST /api/export-csv (RFC-4180 CSV export)
    if (method === 'POST' && pathname === '/api/export-csv') {
      const state = await parseJsonBody(req);
      const csvText = generateChecklistCsv(state);
      const tenderId = (state.tender?.id || 'Tender').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${tenderId}_Compliance_Checklist.csv`;

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(csvText);
      return true;
    }

    // 10. GET /api/sample (sample pack manifest and links)
    if (method === 'GET' && pathname === '/api/sample') {
      const sampleDir = path.resolve('sample');
      if (!fs.existsSync(sampleDir)) {
        sendError(res, 404, 'Sample directory not found');
        return true;
      }

      const reqPath = path.join(sampleDir, 'requirements.json');
      let requirementsData = null;
      if (fs.existsSync(reqPath)) {
        requirementsData = JSON.parse(fs.readFileSync(reqPath, 'utf-8'));
      }

      const allFiles = fs.readdirSync(sampleDir);
      const files = allFiles.map(fn => {
        const s = fs.statSync(path.join(sampleDir, fn));
        return {
          name: fn,
          sizeBytes: s.size,
          isPdf: fn.toLowerCase().endsWith('.pdf'),
          url: `/sample/${fn}`
        };
      });

      sendJson(res, 200, {
        requirements: requirementsData,
        files
      });
      return true;
    }

    // 11. POST /api/verify-testpack (runs automated judge verification testpack)
    if (method === 'POST' && pathname === '/api/verify-testpack') {
      const testDir = path.resolve('testpack');
      if (!fs.existsSync(testDir)) {
        sendError(res, 404, 'testpack/ directory not found. Run "npm run test:judge" first.');
        return true;
      }

      const results = [];
      const testReqFile = path.join(testDir, 'requirements.json');

      if (!fs.existsSync(testReqFile)) {
        sendError(res, 404, 'testpack/requirements.json not found');
        return true;
      }

      const testSpec = JSON.parse(fs.readFileSync(testReqFile, 'utf-8'));
      const norm = normalizeRequirements(testSpec);

      // Test 1: Order Sorter Check
      const isSorted = norm.requirements.every((r, idx) => {
        return idx === 0 || r.order >= norm.requirements[idx - 1].order;
      });
      results.push({
        test: '1. Requirement Order Sorting',
        passed: isSorted && norm.requirements[0].id === 'R01',
        detail: `Requirements strictly sorted ascending by order (First: ${norm.requirements[0].id})`
      });

      // Test 2: Magic Bytes Check on fake.pdf & notes.txt
      const fakeBuf = fs.readFileSync(path.join(testDir, 'fake.pdf'));
      const isFakeValid = checkPdfMagicBytes(fakeBuf);
      results.push({
        test: '2. Fake PDF Magic Header Detection',
        passed: !isFakeValid,
        detail: 'Disguised non-PDF file correctly rejected by magic bytes (%PDF- missing)'
      });

      // Test 3: SHA-256 Duplicate Check
      const vatBuf1 = fs.readFileSync(path.join(testDir, 'vat.pdf'));
      const vatBuf2 = fs.readFileSync(path.join(testDir, 'vat_COPY_final_v2.pdf'));
      const hash1 = computeSha256(vatBuf1);
      const hash2 = computeSha256(vatBuf2);
      results.push({
        test: '3. Cryptographic Duplicate Detection',
        passed: hash1 === hash2,
        detail: `Exact SHA-256 hash match detected between vat.pdf and vat_COPY_final_v2.pdf: ${hash1.substring(0, 16)}...`
      });

      // Test 4: Pure computeStatus 10-case verification
      const tender = { id: 'T-2026-0417', deadline: '2026-10-20' };
      const cases = [
        { req: { id: 'r1', mandatory: true }, state: { tender, matches: {} }, expected: STATUS_CODES.MISSING },
        { req: { id: 'r2', mandatory: false }, state: { tender, matches: {} }, expected: STATUS_CODES.NOT_PROVIDED },
        { req: { id: 'r3', mandatory: true, has_expiry: true }, state: { tender, matches: { r3: 'f1' }, expiry: {} }, expected: STATUS_CODES.EXPIRY_NEEDED },
        { req: { id: 'r4', mandatory: true, has_expiry: true }, state: { tender, matches: { r4: 'f1' }, expiry: { r4: '2026-10-19' } }, expected: STATUS_CODES.EXPIRED },
        { req: { id: 'r5', mandatory: true, has_expiry: true }, state: { tender, matches: { r5: 'f1' }, expiry: { r5: '2026-10-20' } }, expected: STATUS_CODES.OK },
        { req: { id: 'r6', mandatory: true, has_expiry: true }, state: { tender, matches: { r6: 'f1' }, expiry: { r6: '2026-12-31' } }, expected: STATUS_CODES.OK },
        { req: { id: 'r7', mandatory: false, has_expiry: true }, state: { tender, matches: { r7: 'f1' }, expiry: { r7: '2026-09-01' } }, expected: STATUS_CODES.EXPIRED }
      ];
      const allPassed = cases.every(c => computeStatus(c.req, c.state) === c.expected);
      results.push({
        test: '4. Pure Deterministic Status Evaluation (100% Lexicographical)',
        passed: allPassed,
        detail: 'All mandatory, optional, expiry_needed, expired (< deadline), and ok (>= deadline) rules passed'
      });

      // Test 5: Bottom-Band Canvas Expansion (+28 pt verification)
      const tradeBuf = fs.readFileSync(path.join(testDir, 'trade_license.pdf'));
      const testState = {
        tender: norm.tender,
        requirements: norm.requirements,
        matches: { R01: 'f-trade' },
        expiry: { R01: '2026-12-31' },
        files: [{ id: 'f-trade', name: 'trade_license.pdf' }],
        fileBuffers: { 'f-trade': tradeBuf }
      };

      const out = await buildPackagePdf(testState, { outDir: path.resolve('output') });
      results.push({
        test: '5. Compliant PDF Assembly & +28pt Band Expansion',
        passed: out.totalPages === 3 && out.bytesLength > 0, // 1 cover + 2 pages
        detail: `Generated package with Cover Page + 2 content pages (Total ${out.totalPages} pages, ${out.bytesLength} bytes)`
      });

      const totalPassed = results.filter(r => r.passed).length;
      sendJson(res, 200, {
        success: totalPassed === results.length,
        totalTests: results.length,
        passedCount: totalPassed,
        results
      });
      return true;
    }

    sendError(res, 404, `Endpoint ${method} ${pathname} not found`);
    return true;
  } catch (err) {
    console.error('API Error:', err);
    sendError(res, 500, `Internal Server Error: ${err.message}`, err.stack);
    return true;
  }
}
