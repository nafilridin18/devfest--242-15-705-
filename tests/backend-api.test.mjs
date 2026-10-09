/**
 * Automated Test Suite for Tender Package Builder Backend REST API
 * Verifies all 11 endpoints, status calculations, traps, and PDF compiler compliance.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handleApiRoute } from '../server/routes.mjs';
import { computeSha256, checkPdfMagicBytes } from '../server/tender-engine.mjs';

const TEST_PORT = 3199;

// Create test server instance
const testServer = http.createServer(async (req, res) => {
  const handled = await handleApiRoute(req, res);
  if (!handled) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

function request(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqHeaders = { ...headers };
    let postData = null;

    if (body !== null) {
      if (typeof body === 'object') {
        postData = JSON.stringify(body);
        reqHeaders['Content-Type'] = 'application/json';
      } else {
        postData = String(body);
      }
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: pathUrl,
        method,
        headers: reqHeaders
      },
      res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          const text = rawBuffer.toString('utf-8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {}
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: text,
            buffer: rawBuffer,
            json
          });
        });
      }
    );

    req.on('error', err => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('   Running Tender Package Builder Backend Test Suite   ');
  console.log('========================================================\n');

  await new Promise(resolve => testServer.listen(TEST_PORT, resolve));
  let passedCount = 0;
  let totalCount = 0;

  function assert(name, condition, extra = '') {
    totalCount++;
    if (condition) {
      console.log(`  ✅ PASS: ${name} ${extra}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${extra}`);
    }
  }

  try {
    // 1. GET /api/health
    const resHealth = await request('GET', '/api/health');
    assert('1. GET /api/health returns 200 OK', resHealth.statusCode === 200);
    assert('1. Health payload has status: "ok"', resHealth.json?.status === 'ok');
    assert('1. Health payload contains version 2.0.0', resHealth.json?.version === '2.0.0');

    // 2. GET /api/requirements
    const resReqs = await request('GET', '/api/requirements');
    assert('2. GET /api/requirements returns 200 OK', resReqs.statusCode === 200);
    assert('2. Requirements are sorted ascending by order', Array.isArray(resReqs.json?.requirements) && resReqs.json.requirements[0].order === 1);
    assert('2. Tender metadata normalized (Tender ID present)', Boolean(resReqs.json?.tender?.id));

    // 3. POST /api/requirements (Validation of custom requirements)
    const resReqsBad = await request('POST', '/api/requirements', { invalid: true });
    assert('3. POST /api/requirements rejects malformed JSON with 400', resReqsBad.statusCode === 400);

    const resReqsGood = await request('POST', '/api/requirements', {
      tender: { id: 'T-CUSTOM-99', deadline: '2026-12-31' },
      requirements: [
        { id: 'b2', order: 2, title_en: 'Item B' },
        { id: 'a1', order: 1, title_en: 'Item A' }
      ]
    });
    assert('3. POST /api/requirements accepts and sorts custom list', resReqsGood.statusCode === 200 && resReqsGood.json?.requirements[0].id === 'a1');

    // 4. POST /api/validate (State evaluation, blockers, status computation)
    const tenderState = {
      tender: { id: 'T-2026-0417', deadline: '2026-10-20' },
      requirements: [
        { id: 'r1', order: 1, title_en: 'Trade License', mandatory: true, has_expiry: true },
        { id: 'r2', order: 2, title_en: 'TIN Certificate', mandatory: true, has_expiry: false },
        { id: 'r3', order: 3, title_en: 'ISO Quality', mandatory: false, has_expiry: true }
      ],
      files: [
        { id: 'f1', name: 'Trade.pdf', bytes: 1000 },
        { id: 'f2', name: 'TIN.pdf', bytes: 1000 }
      ],
      matches: {
        r1: 'f1',
        r2: 'f2'
      },
      expiry: {
        r1: '2026-10-20' // Exact deadline day -> OK
      }
    };

    const resVal1 = await request('POST', '/api/validate', tenderState);
    assert('4. POST /api/validate on valid state returns valid: true', resVal1.json?.valid === true);
    assert('4. computeStatus on r1 exact deadline day evaluates to OK', resVal1.json?.computedStatuses?.r1 === 'OK');
    assert('4. computeStatus on r3 optional omitted evaluates to NOT_PROVIDED', resVal1.json?.computedStatuses?.r3 === 'NOT_PROVIDED');

    // 4b. Pre-deadline expiry trap: 2026-10-19 < 2026-10-20 -> EXPIRED
    tenderState.expiry.r1 = '2026-10-19';
    const resValExpired = await request('POST', '/api/validate', tenderState);
    assert('4. Pre-deadline date triggers EXPIRED status and blocks', resValExpired.json?.valid === false && resValExpired.json?.computedStatuses?.r1 === 'EXPIRED');

    // Reset r1
    tenderState.expiry.r1 = '2026-12-31';

    // 5. POST /api/upload (magic bytes, page count, sha256 duplicate detection)
    const tinPath = path.resolve('sample', 'TIN_Certificate.pdf');
    const tinBytes = fs.readFileSync(tinPath);
    const tinBase64 = tinBytes.toString('base64');

    const resUpload = await request('POST', '/api/upload', {
      files: [
        { name: 'TIN_Original.pdf', data: tinBase64 },
        { name: 'TIN_Duplicate.pdf', data: tinBase64 }
      ]
    });

    assert('5. POST /api/upload processes files successfully', resUpload.statusCode === 200 && resUpload.json?.count === 2);
    assert('5. First uploaded file is not duplicate', resUpload.json?.files[0]?.isDuplicate === false);
    assert('5. Second identical byte file is marked isDuplicate: true', resUpload.json?.files[1]?.isDuplicate === true);
    assert('5. SHA-256 hashes are verified identical', resUpload.json?.files[0]?.hash === resUpload.json?.files[1]?.hash);

    // 6. POST /api/generate (PDF compiler with +28pt band and serialized footers)
    const tradePath = path.resolve('sample', 'Trade_License_2026.pdf');
    const tradeBytes = fs.readFileSync(tradePath);

    const genState = {
      tender: {
        id: 'T-2026-0417',
        title: 'Backend Test Tender',
        entity: 'Directorate of Tech',
        bidder: 'Apex Solutions',
        deadline: '2026-10-20'
      },
      requirements: [
        { id: 'req-1', order: 1, title_en: 'Trade License', mandatory: true, has_expiry: true },
        { id: 'req-2', order: 2, title_en: 'TIN Certificate', mandatory: true, has_expiry: false }
      ],
      matches: {
        'req-1': 'f-trade',
        'req-2': 'f-tin'
      },
      expiry: {
        'req-1': '2026-12-31'
      },
      files: [
        { id: 'f-trade', name: 'Trade_License_2026.pdf', data: tradeBytes.toString('base64') },
        { id: 'f-tin', name: 'TIN_Certificate.pdf', data: tinBytes.toString('base64') }
      ]
    };

    const resGen = await request('POST', '/api/generate', genState);
    assert('6. POST /api/generate returns 200 OK', resGen.statusCode === 200);
    assert('6. Generated package response has success: true', resGen.json?.success === true);
    assert('6. Total pages math is correct (1 Cover + 1 Trade + 1 TIN = 3 pages)', resGen.json?.totalPages === 3);

    // 7. GET /api/packages
    const resPackages = await request('GET', '/api/packages');
    assert('7. GET /api/packages lists output directory packages', resPackages.statusCode === 200 && Array.isArray(resPackages.json?.packages));
    assert('7. Newly generated package exists in list', resPackages.json?.packages.some(p => p.filename === resGen.json?.filename));

    // 8. GET /api/download/:filename
    const resDownload = await request('GET', `/api/download/${resGen.json?.filename}`);
    assert('8. GET /api/download/:filename returns 200 application/pdf', resDownload.statusCode === 200 && resDownload.headers['content-type'] === 'application/pdf');
    assert('8. Downloaded file starts with %PDF- magic bytes', checkPdfMagicBytes(resDownload.buffer));

    // 9. POST /api/export-csv
    const resCsv = await request('POST', '/api/export-csv', genState);
    assert('9. POST /api/export-csv returns text/csv', resCsv.statusCode === 200 && resCsv.headers['content-type'].includes('text/csv'));
    assert('9. CSV starts with UTF-8 BOM', resCsv.buffer[0] === 0xEF && resCsv.buffer[1] === 0xBB && resCsv.buffer[2] === 0xBF);
    assert('9. CSV contains header columns and compliant note', resCsv.body.includes('Requirement ID') && resCsv.body.includes('Compliant'));

    // 10. GET /api/sample
    const resSample = await request('GET', '/api/sample');
    assert('10. GET /api/sample returns sample manifest and file list', resSample.statusCode === 200 && resSample.json?.files?.length > 0);

    // 11. POST /api/verify-testpack
    const resTestpack = await request('POST', '/api/verify-testpack');
    assert('11. POST /api/verify-testpack returns success: true', resTestpack.statusCode === 200 && resTestpack.json?.success === true);
    assert('11. All 5 judge testpack verification rules passed', resTestpack.json?.passedCount === resTestpack.json?.totalTests);

  } finally {
    testServer.close();
  }

  console.log('\n--------------------------------------------------------');
  console.log(`Backend Test Summary: ${passedCount} / ${totalCount} tests passed (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log('--------------------------------------------------------\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
