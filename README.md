# 📋 Tender Package Builder

> **DevFest 2026 Contest Submission — Official Repository**  
> An enterprise-grade, compliant tender dossier compiler and verification system designed for Bangladesh e-GP and public procurement standards. Built with pure **Vanilla JavaScript (ES Modules)** on the frontend and a **Zero-External-Dependency Node.js Backend Engine**, 100% offline vendored PDF engines, and full cryptographic validation.

---

## 🎨 Design System & Theme
Built with an executive, modern aesthetic adhering strictly to the requested contest palette:
- **Warm Peach** (`#F46F36`, `#FA9564`, `#FFEFE6`): Primary accents, active progress badges, and interactive highlights.
- **Espresso Brown** (`#6D563D`, `#3E2F20`, `#1C150F`): Deep typography, card borders, and grounded structural elements.
- **Obsidian Black & Slate** (`#0F0C09`, `#18130E`): High-contrast Dark Mode surfaces.
- **Porcelain White & Cream** (`#FFFFFF`, `#FAF7F2`): Clean, paper-like Light Mode surfaces.
- **Bilingual Interface**: Instant toggle between **English** and **বাংলা (Bengali)** with typographic optimization via Noto Sans Bengali.
- **Dual Themes**: Instant switch between **Light Mode** and **Dark Mode** with full persistence in `localStorage`.
- **Engine Status Indicators**: Live connectivity badge detecting whether the application is running via **🟢 Backend: Online (Port 3000)** or **⚡ Engine: Client (Offline Standalone)**.

---

## 📸 Screenshots Showcase

| 1. Default Validation Dashboard (Light Mode) | 2. Dark Mode Dashboard (Peach, Brown & Obsidian) |
|:---:|:---:|
| ![Default Status Screen](screenshots/status_screen.png) | ![Dark Mode Dashboard](screenshots/dark_mode.png) |

| 3. Full Bengali (বাংলা) Localization | 4. Generated Compliant PDF Cover & Table of Contents |
|:---:|:---:|
| ![Bangla Mode](screenshots/bangla_mode.png) | ![Generated PDF Cover](screenshots/generated_pdf.png) |

| 5. Ready-to-Generate State (Zero Blockers) | 6. Direct Double-Click (`file:///`) Offline Execution |
|:---:|:---:|
| ![Ready Screen](screenshots/ready_screen.png) | ![File Protocol Standalone Execution](screenshots/file_protocol_test.png) |

---

## ⚙️ Enterprise Backend Architecture

The backend is built with native **Node.js (ES Modules)**, requiring **zero npm external runtime dependencies**. It provides an enterprise REST API designed for high-throughput batch validation and automated PDF package compilation for public procurement workflows.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Tender Package Builder Backend                       │
│                         (Node.js v20+)                                 │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐        ┌──────────────────┐
│   HTTP Router    │       │ Compliance Engine│        │  PDF Compiler    │
│  (server.mjs &   │──────▶│ (tender-engine.  │───────▶│ (Cover + TOC +   │
│   routes.mjs)    │       │       mjs)       │        │  +28pt Band +    │
│                  │       │                  │        │  Serial Footers) │
└──────────────────┘       └──────────────────┘        └──────────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐        ┌──────────────────┐
│ 11 REST API      │       │ SHA-256 Dups,    │        │ output/          │
│ Endpoints        │       │ Lexico Dates,    │        │ <ID>_Package.pdf │
│ (/api/*)         │       │ Magic Bytes      │        │ & CSV Checklist  │
└──────────────────┘       └──────────────────┘        └──────────────────┘
```

### Backend REST API Specification

| Method | Endpoint | Description | Request Body | Response Payload |
|---|---|---|---|---|
| `GET` | `/api/health` | Server health check, uptime, memory & version | None | `{ status: "ok", version: "2.0.0", uptimeSeconds, memoryUsageMb }` |
| `GET` | `/api/requirements` | Fetch active/canonical requirements specification | None | `{ valid: true, tender: {...}, requirements: [...] }` |
| `POST` | `/api/requirements` | Validate and normalize custom requirements JSON | `{ tender: {...}, requirements: [...] }` | Normalized & sorted requirements |
| `POST` | `/api/validate` | Full compliance & blocker audit | `{ tender, requirements, files, matches, expiry }` | `{ valid, blockers: [...], computedStatuses, stats }` |
| `POST` | `/api/upload` | Process file batch, magic bytes & SHA-256 duplicates | `{ files: [{ name, data }], existingFiles: [...] }` | `{ count, files: [{ id, name, hash, pages, isDuplicate }] }` |
| `POST` | `/api/generate` | Compile compliant package PDF & save to `output/` | Full dossier state with file buffers | `{ success: true, filename, totalPages, bytesLength, downloadUrl }` |
| `GET` | `/api/packages` | List all compiled packages in `output/` | None | `{ packages: [{ filename, sizeBytes, createdAt, downloadUrl }] }` |
| `GET` | `/api/download/:filename` | Stream compiled PDF package | None | Binary `application/pdf` with `Content-Disposition` |
| `POST` | `/api/export-csv` | Generate RFC-4180 compliance audit CSV | Full dossier state | Text stream `text/csv; charset=utf-8` with UTF-8 BOM |
| `GET` | `/api/sample` | Sample pack manifest and documents list | None | `{ requirements, files: [...] }` |
| `POST` | `/api/verify-testpack` | Execute automated judge verification suite | None | `{ success: true, totalTests: 5, passedCount: 5, results }` |

---

## 🚀 Key Features & Contest Specification Checklist

| Section | Requirement | Status | Implementation Details |
|---|---|:---:|---|
| **4.1** | **JSON Loading & Sorting** | ✅ Complete | Loads `requirements.json`, normalizes both `tender_id` / `id` and `deadline` / `submission_deadline`, and sorts all requirements strictly by ascending `order`. |
| **4.2** | **Multi-Upload & Validation** | ✅ Complete | Multi-PDF file selector and drag-and-drop tray, live page count extraction, file size formatting, rejection of non-PDFs and corrupted files, removal support. |
| **4.3** | **1:1 Document Matching** | ✅ Complete | Drag & Drop files onto requirement target slots with fallback dropdown matching. Strictly enforces 1 file ↔ 1 document. Full Undo stack (`Ctrl+Z`). |
| **4.4** | **Inline Expiry Date Input** | ✅ Complete | Dynamically appears *only* when a file is matched to a requirement with `has_expiry: true`. Lexicographical `YYYY-MM-DD` comparison against deadline. |
| **4.5** | **Live Status Evaluation** | ✅ Complete | Pure deterministic function `computeStatus(req, state)` evaluating `OK`, `MISSING`, `EXPIRY_NEEDED`, `EXPIRED`, `NOT_PROVIDED`. 10/10 automated unit tests pass. |
| **4.6** | **SHA-256 Duplicate Detection** | ✅ Complete | Computes cryptographic SHA-256 hashes of all file byte buffers via `crypto.subtle` (frontend) and `node:crypto` (backend). Identifies mutual duplicates regardless of renaming, shows duplicate badges, and blocks duplicate matching. |
| **4.7** | **Interactive Blocker Panel** | ✅ Complete | Explicitly details every reason why "Generate Package" is disabled. Clicking any blocker smoothly scrolls and flashes the offending requirement row. |
| **4.8** | **Package PDF Assembly** | ✅ Complete | Assembles an official A4 Cover Page with all 7 metadata items, Document Index table, and appends matched document pages with vertical bottom-band expansion (+28 pt) so serialized footers never overlap content. |
| **4.9** | **Full English / Bengali (EN/BN)** | ✅ Complete | Live i18n engine supporting `title_bn` / `title_en` for requirement titles, status chips, blocker reasons, headers, and toasts. |
| **Backend** | **Enterprise REST API** | ✅ Complete | 11 production REST API endpoints in `server.mjs`, supporting server-side compilation, automatic persistence in `output/`, and live streaming downloads. |
| **Bonus** | **CSV Checklist Export** | ✅ Complete | One-click export of an RFC-4180 compliant compliance verification audit checklist CSV with UTF-8 BOM (available both client-side and via `POST /api/export-csv`). |
| **Bonus** | **LocalStorage Persistence** | ✅ Complete | Automatically saves and restores theme preferences, language selection, and user inputs across sessions. |
| **Bonus** | **Smart Auto-Match** | ✅ Complete | Intelligent heuristic and fuzzy matching engine pairing files (e.g. `Trade_License.pdf` → `Trade License`) in 1 click. |
| **Bonus** | **Sample Pack Loader** | ✅ Complete | Built-in "Try Sample Pack" button loading realistic mock tender specifications and PDFs in 1 second. |

---

## 🛡️ Edge Cases & Trap Handling Matrix

| Trap / Edge Case | How the Application Handles It |
|---|---|
| **Same content, different names** | SHA-256 hash computed via `crypto.subtle.digest('SHA-256', bytes)` on frontend and `node:crypto` on backend. Identifies identical payloads regardless of filename. Tags file with `Duplicate of X` badge and prevents matching to prevent duplicate filing errors. |
| **Non-PDF files (`.docx`, `.jpg`, `.txt`)** | Validates both file extension and authentic `%PDF-` magic header bytes (`0x25, 0x50, 0x44, 0x46, 0x2D`). Disguised files are immediately rejected with descriptive toast alerts. |
| **Corrupted or truncated PDF** | Caught via `try/catch` in `PDFDocument.load()`. Bad files are marked as `Cannot read PDF (Corrupted)` and prevented from matching. |
| **Password-protected PDF** | PDF-Lib throws an encrypted document error during load. Tagged as `Password-protected` with a lock indicator and prevented from matching. |
| **Expired document vs. Deadline** | Lexicographical date comparison (`YYYY-MM-DD` strings) prevents timezone offset or leap year bugs. Dates strictly before deadline (`expiry < deadline`) evaluate to `EXPIRED` (blocking). |
| **Expires exactly on deadline day** | Exact match (`expiry === deadline`) evaluates to valid (`OK`). |
| **Optional document with no file** | Evaluated as `NOT_PROVIDED` and does not block package generation. |
| **Footer text overlap (Section 7)** | Every content page is embedded into a newly created page that is **28 pt taller** than the original (`origHeight + 28`), with the original page shifted up by 28 pt (`y: 28`). The serialized footer is drawn at `y: 10`. **Original margins and bottom-edge text are never occluded.** |
| **Mixed orientations & sizes** | Dynamic per-page canvas expansion preserves landscape or portrait dimensions while ensuring uniform footer placement. |
| **Volume limit guard rails** | Enforces maximum limits of 30 files and 50 MB total package size both in browser and on server. |

---

## 🧪 Testing & Verification Guide

### 1. Automated Backend REST API Test Suite (29 Tests)
Run the comprehensive backend integration test suite testing all 11 endpoints, compilation, validation, traps, and headers:

```bash
npm test
```
*or directly:*
```bash
node tests/backend-api.test.mjs
```

**Results:**
```
========================================================
   Running Tender Package Builder Backend Test Suite   
========================================================

  ✅ PASS: 1. GET /api/health returns 200 OK 
  ✅ PASS: 1. Health payload has status: "ok" 
  ✅ PASS: 1. Health payload contains version 2.0.0 
  ✅ PASS: 2. GET /api/requirements returns 200 OK 
  ✅ PASS: 2. Requirements are sorted ascending by order 
  ✅ PASS: 2. Tender metadata normalized (Tender ID present) 
  ✅ PASS: 3. POST /api/requirements rejects malformed JSON with 400 
  ✅ PASS: 3. POST /api/requirements accepts and sorts custom list 
  ✅ PASS: 4. POST /api/validate on valid state returns valid: true 
  ✅ PASS: 4. computeStatus on r1 exact deadline day evaluates to OK 
  ✅ PASS: 4. computeStatus on r3 optional omitted evaluates to NOT_PROVIDED 
  ✅ PASS: 4. Pre-deadline date triggers EXPIRED status and blocks 
  ✅ PASS: 5. POST /api/upload processes files successfully 
  ✅ PASS: 5. First uploaded file is not duplicate 
  ✅ PASS: 5. Second identical byte file is marked isDuplicate: true 
  ✅ PASS: 5. SHA-256 hashes are verified identical 
  ✅ PASS: 6. POST /api/generate returns 200 OK 
  ✅ PASS: 6. Generated package response has success: true 
  ✅ PASS: 6. Total pages math is correct (1 Cover + 1 Trade + 1 TIN = 3 pages) 
  ✅ PASS: 7. GET /api/packages lists output directory packages 
  ✅ PASS: 7. Newly generated package exists in list 
  ✅ PASS: 8. GET /api/download/:filename returns 200 application/pdf 
  ✅ PASS: 8. Downloaded file starts with %PDF- magic bytes 
  ✅ PASS: 9. POST /api/export-csv returns text/csv 
  ✅ PASS: 9. CSV starts with UTF-8 BOM 
  ✅ PASS: 9. CSV contains header columns and compliant note 
  ✅ PASS: 10. GET /api/sample returns sample manifest and file list 
  ✅ PASS: 11. POST /api/verify-testpack returns success: true 
  ✅ PASS: 11. All 5 judge testpack verification rules passed 

--------------------------------------------------------
Backend Test Summary: 29 / 29 tests passed (100%)
--------------------------------------------------------
```

### 2. Unit Testing `status.js` (10 Status Rules)
The status engine includes a deterministic 10-test automated suite:
```bash
npm run test:unit
```

All 10 tests execute cleanly and verify:
1. Mandatory missing → `MISSING`
2. Optional omitted → `NOT_PROVIDED`
3. Optional with expiry omitted → `NOT_PROVIDED`
4. Matched without expiry → `OK`
5. Matched needing expiry date → `EXPIRY_NEEDED`
6. Pre-deadline date (`2026-10-19 < 2026-10-20`) → `EXPIRED`
7. Exact deadline date (`2026-10-20 === 2026-10-20`) → `OK`
8. Post-deadline date (`2026-12-31 > 2026-10-20`) → `OK`
9. Optional matched with expired date → `EXPIRED`
10. Matched with corrupted file → `MISSING`

### 3. Judge Verification Testpack (`testpack/`)
Generate or regenerate the official judge verification testpack:

```bash
npm run test:judge
```
*or:*
```bash
node scripts/make_testpack.mjs
```

This creates the following test files inside `testpack/`:
- `requirements.json`: Out-of-order requirements (`R04`, `R01`, `R06`, `R02`, `R05`, `R03`) with both mandatory and optional items.
- `trade_license.pdf`: 2 pages, contains red "BOTTOM EDGE TEXT" at `y = 40`.
- `tin.pdf`: 1 page, contains red "BOTTOM EDGE TEXT" at `y = 40`.
- `vat.pdf`: 1 page, contains red "BOTTOM EDGE TEXT" at `y = 40`.
- `solvency.pdf`: 3 pages, contains red "BOTTOM EDGE TEXT" at `y = 40`.
- `experience.pdf`: 2 pages (Optional requirement `R05`).
- `tech_proposal.pdf`: 4 pages, contains red "BOTTOM EDGE TEXT" at `y = 40`.
- `landscape_doc.pdf`: 1 landscape A4 page (tests mixed orientation).
- `vat_COPY_final_v2.pdf`: Exact SHA-256 byte duplicate of `vat.pdf` under a different name.
- `notes.txt`: Plain text file (tests non-PDF file rejection).
- `fake.pdf`: Text file disguised with a `.pdf` extension (tests magic header check).
- `corrupted.pdf`: Truncated byte stream (tests corrupt PDF rejection).
- `locked.pdf`: Password-protected PDF stream (tests encryption detection).

#### Verification Checklist for Judge Testpack:
1. **Sorted Order**: Load `testpack/requirements.json`. Verify the app displays documents in order: `R01` (Trade License), `R02` (TIN), `R03` (VAT), `R04` (Bank Solvency), `R05` (Experience), `R06` (Technical Proposal).
2. **Page Count Math**:
   - Matching mandatory documents (`trade_license`: 2p, `tin`: 1p, `vat`: 1p, `solvency`: 3p, `tech_proposal`: 4p) with optional `experience` omitted gives:
     $$\text{Total Pages} = 1 \text{ (Cover/TOC)} + 2 + 1 + 1 + 3 + 4 = 12 \text{ pages}$$
   - Serialized footers correctly read: `T-2026-0417 | Page 1 of 12` through `T-2026-0417 | Page 12 of 12`.
3. **Footer Overlap Test**: Inspect the bottom 40 pt of `trade_license.pdf` or `solvency.pdf`. The red border and `BOTTOM EDGE TEXT` are completely intact and untouched because the canvas was expanded upward by 28 pt.
4. **Duplicate Trap Test**: Drag `vat_COPY_final_v2.pdf` into the file tray. The badge `Duplicate of vat.pdf` immediately appears, and dropping it onto a requirement is rejected.
5. **Non-PDF & Corrupt Traps**: Upload `notes.txt`, `fake.pdf`, and `corrupted.pdf`. Each is caught and rejected with descriptive warnings.

---

## ⚡ Running Locally

### Option 1: Full Enterprise Backend + REST API (Recommended)
Run the server using either npm or the Windows batch launcher:
```bash
npm start
```
*or:*
```bash
node server.mjs
```
Then visit:
```
http://localhost:3000/
```

### Option 2: 1-Click Windows Launcher
Double-click `Start-App.bat`. This automatically starts the local Node.js server on port 3000 and opens your default browser.

### Option 3: Direct Double-Click (`file:///`) Standalone Offline Execution
Simply open `index.html` directly in Google Chrome, Microsoft Edge, or Mozilla Firefox.

> **Universal Dual Engine**: The application includes `js/bundle.js` so it functions fully and without security restrictions even when launched directly from the local file system (`file:///` protocol) without needing any web server.

### URL Query Shortcuts (for Testing & Demos)
- **Auto-load Sample Pack**: `http://localhost:3000/?sample=1`
- **Dark Mode**: `http://localhost:3000/?theme=dark`
- **Bangla Language**: `http://localhost:3000/?lang=bn`
- **Dark Mode + Sample + Bangla**: `http://localhost:3000/?sample=1&theme=dark&lang=bn`

---

## 📄 Final Deliverable Package PDF

The canonical assembled deliverable package is available in:
```
output/T-2026-0417_Package.pdf
```
- **Total Pages**: 14 pages
- **Cover Page (Page 1)**: All 7 required tender metadata items (Tender ID, Tender Title, Procuring Entity, Bidder, Submission Deadline, Generation Timestamp, Total Page Count) and embedded Document Index Table.
- **Content Pages (Pages 2–14)**: 13 attached document pages from the 9 matched tender documents, shifted up by 28 pt on an expanded canvas to ensure the serialized footer `T-2026-0417 | Page X of 14` never overlaps document text.

---

## 📁 Repository Structure

```
├── index.html                  # Accessible, semantic UI shell
├── preview.html                # PDF cover page preview utility
├── Start-App.bat               # 1-click Windows launcher for local server
├── server.mjs                  # Enterprise Node.js server with REST API & static serving
├── package.json                # Project scripts, metadata, zero external runtime deps
├── server/
│   ├── tender-engine.mjs       # Pure validation, SHA-256, status & PDF compilation engine
│   └── routes.mjs              # 11 REST API endpoint dispatchers (/api/*)
├── tests/
│   └── backend-api.test.mjs    # Automated 29-test backend integration suite
├── css/
│   ├── tokens.css              # Peach, warm brown, black, white design tokens
│   └── app.css                 # Layout, glassmorphism, responsive grid & animations
├── js/
│   ├── main.js                 # Application bootstrapper and event wiring
│   ├── bundle.js               # Standalone runtime bundle (supports direct file:/// opening)
│   ├── state.js                # Single source of truth reactive store + undo stack
│   ├── i18n.js                 # Bilingual EN/BN dictionary & title localization
│   ├── requirements.js         # Schema normalization & order-based sorter
│   ├── files.js                # Magic bytes check, SHA-256, page count & thumbnails
│   ├── matching.js             # 1:1 rules, duplicate prevention & heuristic auto-matcher
│   ├── status.js               # Pure computeStatus() engine + unit test suite
│   ├── package.js              # PDF compiler (A4 cover, TOC, 28pt band, footers)
│   ├── persist.js              # LocalStorage save/restore
│   ├── export-csv.js           # RFC-4180 CSV compliance checklist export
│   └── ui/
│       ├── header.js           # Header, language toggle, theme switch, 3-step tracker, API badge
│       ├── requirementList.js  # Requirement rows, drag-and-drop targets, expiry inputs
│       ├── fileTray.js         # File cards pool, draggable items, duplicate badges
│       ├── blockerPanel.js     # Reasons why Generate is disabled with scroll links
│       └── toast.js            # Toast notification system
├── vendor/
│   ├── pdf-lib.min.js          # Vendored PDF-Lib library (offline)
│   ├── pdf-lib.esm.min.js      # Vendored PDF-Lib ES Module
│   ├── pdf.min.mjs             # Vendored PDF.js engine
│   └── pdf.worker.min.mjs      # Vendored PDF.js web worker
├── sample/
│   ├── requirements.json       # Realistic tender specification
│   ├── Trade_License_2026.pdf
│   ├── TIN_Certificate.pdf
│   ├── VAT_Registration_BIN.pdf
│   ├── Tax_Clearance_Cert.pdf
│   ├── Bank_Solvency_Certificate.pdf
│   ├── ISO_9001_Quality_Cert.pdf
│   ├── MAF_Manufacturer_Authorization.pdf
│   ├── Audited_Financial_Statements.pdf
│   ├── Similar_Experience_Contracts.pdf
│   ├── Duplicate_TIN_Copy.pdf  (SHA-256 duplicate trap test)
│   ├── Tax_Clearance_EXPIRED.pdf (Pre-deadline expiry trap test)
│   ├── Corrupted_Doc_Sample.pdf (Corrupted PDF trap test)
│   └── Non_PDF_Fake.docx       (Magic bytes non-PDF trap test)
├── testpack/                   # Official Judge Verification Testpack
│   ├── requirements.json       # Shuffled order test specification
│   ├── trade_license.pdf       # 2 pages with BOTTOM EDGE TEXT
│   ├── tin.pdf                 # 1 page with BOTTOM EDGE TEXT
│   ├── vat.pdf                 # 1 page with BOTTOM EDGE TEXT
│   ├── solvency.pdf            # 3 pages with BOTTOM EDGE TEXT
│   ├── experience.pdf          # 2 pages (Optional requirement)
│   ├── tech_proposal.pdf       # 4 pages with BOTTOM EDGE TEXT
│   ├── landscape_doc.pdf       # 1 page Landscape A4
│   ├── vat_COPY_final_v2.pdf   # Exact byte duplicate trap
│   ├── notes.txt               # Plain text trap
│   ├── fake.pdf                # Header mismatch trap
│   ├── corrupted.pdf           # Truncated bytes trap
│   └── locked.pdf              # Password-protected trap
├── output/
│   └── T-2026-0417_Package.pdf # Pre-assembled 14-page compliant deliverable
├── screenshots/                # Showcase captures
│   ├── status_screen.png       # Light mode dashboard
│   ├── dark_mode.png           # Dark mode dashboard
│   ├── bangla_mode.png         # Bengali localization
│   ├── generated_pdf.png       # Generated PDF cover & TOC
│   ├── ready_screen.png        # Ready state with all blockers cleared
│   └── file_protocol_test.png  # Direct file:/// protocol execution
└── scripts/
    ├── build-bundle.mjs               # Standalone browser bundle builder
    ├── generate-sample-and-output.mjs # Sample pack & output generator script
    └── make_testpack.mjs              # Judge verification testpack generator
```

---

## 🏆 Key Achievements Summary
- ✅ **Complete Enterprise Backend**: Full Node.js REST API with 11 endpoints, pure status evaluation, and zero external runtime dependencies.
- ✅ **Automated Test Coverage**: 29/29 backend tests passing (`npm test`), plus 10/10 unit tests (`npm run test:unit`) and 5 judge testpack verification rules.
- ✅ **Dual-Mode Universal Execution**: Runs both on `http://localhost:3000/` with server compilation & persistence and directly via `file:///` double-click.
- ✅ **Zero External Network Dependencies**: 100% offline compliant, all libraries vendored.
- ✅ **Pure Vanilla JS Architecture**: Clean ES Modules and zero mandatory build step for client execution.
- ✅ **Rock-Solid Trap Handling**: Cryptographic SHA-256 duplicate detection, magic bytes validation, corrupted/password-protected file handling.
- ✅ **Strict Specification Compliance**: Table of contents, deterministic status calculation, 28 pt bottom-band footer protection, and full English/বাংলা support.