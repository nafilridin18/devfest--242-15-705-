# 📋 Tender Package Builder

> **DevFest 2026 Contest Submission**  
> An enterprise-grade, compliant tender dossier compiler and verification system designed for Bangladesh e-GP and public procurement standards. Built with pure **Vanilla JavaScript (ES Modules)**, zero build step dependencies, and vendored PDF engines.

---

## 🎨 Design System & Theme
Built with an executive, modern aesthetic adhering to the requested color combination:
- **Warm Peach** (`#F46F36`, `#FA9564`, `#FFEFE6`): Primary accents, active progress badges, and interactive highlights.
- **Espresso Brown** (`#6D563D`, `#3E2F20`, `#1C150F`): Deep typography, card borders, and grounded structural elements.
- **Obsidian Black & Slate** (`#0F0C09`, `#18130E`): High-contrast Dark Mode surfaces.
- **Porcelain White & Cream** (`#FFFFFF`, `#FAF7F2`): Clean, paper-like Light Mode surfaces.
- **Bilingual Interface**: Full toggle between **English** and **বাংলা (Bengali)** with typographic optimization via Noto Sans Bengali.
- **Dual Themes**: Instant switch between **Light Mode** and **Dark Mode** with full persistence in `localStorage`.

---

## 📸 Screenshots Showcase

### 1. Default Status & Validation Dashboard (Light Mode)
![Default Status Screen](screenshots/status_screen.png)

### 2. Dark Mode Dashboard (Peach, Brown & Obsidian)
![Dark Mode Dashboard](screenshots/dark_mode.png)

### 3. Full Bengali (বাংলা) Localization
![Bangla Mode](screenshots/bangla_mode.png)

### 4. Generated Compliant PDF Cover (with Serialized Footers & Table of Contents)
![Generated PDF Cover](screenshots/generated_pdf.png)

---

## 🚀 Key Features & Contest Requirements Checklist

| Section | Requirement | Status | Implementation Details |
|---|---|:---:|---|
| **4.1** | **JSON Loading & Sorting** | ✅ Complete | Loads `requirements.json`, extracts 5 tender metadata items, strictly sorts all requirements by `order`. |
| **4.2** | **Multi-Upload & Validation** | ✅ Complete | Multi-PDF upload, live page counts, file size formatting, rejection of non-PDFs and corrupted files, removal support. |
| **4.3** | **1:1 Document Matching** | ✅ Complete | Drag & Drop onto requirement rows with fallback dropdown matching. Enforces strictly 1 file ↔ 1 document. Undo stack (`Ctrl+Z`). |
| **4.4** | **Inline Expiry Date Input** | ✅ Complete | Appears dynamically *only* when a file is matched to a `has_expiry` requirement. Real-time expiry messages. |
| **4.5** | **Live Status Evaluation** | ✅ Complete | Pure deterministic function `computeStatus(req, state)` evaluating `OK`, `MISSING`, `EXPIRY_NEEDED`, `EXPIRED`, `NOT_PROVIDED`. Updates with zero lag. |
| **4.6** | **SHA-256 Duplicate Detection** | ✅ Complete | Hashes file bytes with Web Crypto SHA-256; flags duplicates with warning chips and blocks matching duplicate files. |
| **4.7** | **Interactive Blocker Panel** | ✅ Complete | Explains exactly why "Generate Package" is disabled with clickable items that smoothly scroll and flash the problem row. |
| **4.8** | **Package PDF Assembly** | ✅ Complete | Assembles cover page, index, appended content with 28pt bottom-band expansion, downloads `<tender_id>_Package.pdf`. |
| **4.9** | **Full English / Bengali (EN/BN)** | ✅ Complete | Dynamic i18n engine with `title_bn` / `title_en` support for requirement titles, status chips, blockers, and controls. |
| **Bonus** | **CSV Checklist Export** | ✅ Complete | One-click export of RFC-4180 compliant compliance verification audit checklist CSV with UTF-8 BOM. |
| **Bonus** | **LocalStorage Persistence** | ✅ Complete | Automatically saves theme preference, language selection, and user inputs across page reloads. |
| **Bonus** | **Smart Auto-Match** | ✅ Complete | Keyword and fuzzy scoring engine matching files (e.g. `Trade_License.pdf` → `Trade License`) with one click. |
| **Bonus** | **Sample Pack Loader** | ✅ Complete | Built-in "Try Sample Pack" button that loads realistic mock documents and test traps in 1 second. |

---

## 🛡️ Real-World Trap Handling

| Trap / Edge Case | How the Application Handles It |
|---|---|
| **Same content, different names** | SHA-256 hash computed via `crypto.subtle`. Identifies duplicate payload regardless of file renaming. Marks file with `Duplicate of X` badge and blocks matching to prevent fraudulent or mistaken duplicate submissions. |
| **Non-PDF files (`.docx`, `.jpg`, disguised files)** | Validates both file extension and authentic `%PDF-` magic header bytes (`0x25, 0x50, 0x44, 0x46, 0x2D`). Files without valid headers are rejected. |
| **Corrupted or password-protected PDF** | Handled with `try/catch` in `PDFDocument.load()`. Flags file as `Cannot read PDF (Corrupted / Password-protected)` and prevents matching. |
| **Expired document vs. Deadline** | Lexicographical date comparison (`YYYY-MM-DD` strings) avoids timezone and leap year bugs. Date strictly less than deadline is marked `EXPIRED` (blocking). |
| **Expires exactly on deadline day** | Comparing `YYYY-MM-DD` treats same-day expiry (`expiry === deadline`) as valid (`OK`). |
| **Mixed page sizes & rotated pages** | Content pages are dynamically embedded into newly created pages that are **28 pt taller** than the original (`origHeight + 28`). The original page is shifted up by 28 pt, guaranteeing the bottom footer band **never occludes content**. |
| **Optional document with no file** | Evaluated as `NOT_PROVIDED` and does not block generation. |
| **Large file or batch volume** | Guard rails enforce a maximum of 30 files and 50 MB total package size. |

---

## 📁 Repository Structure

```
├── index.html                  # Main application markup (Accessible & Semantic)
├── preview.html                # PDF cover page rendering preview
├── Start-App.bat               # 1-click Windows launcher for local server
├── server.mjs                  # Zero-dependency static server (Node.js built-in)
├── css/
│   ├── tokens.css              # Peach, warm brown, black, white design tokens
│   └── app.css                 # Layout, glassmorphism, responsive grid & animations
├── js/
│   ├── main.js                 # Application bootstrapper and controller
│   ├── bundle.js               # Standalone runtime bundle (supports direct file:/// opening)
│   ├── state.js                # Single source of truth reactive store + undo stack
│   ├── i18n.js                 # Bilingual EN/BN dictionary & title localization
│   ├── requirements.js         # Schema validation & order-based sorter
│   ├── files.js                # Magic bytes check, SHA-256, page count & thumbnails
│   ├── matching.js             # 1:1 rules, duplicate prevention & heuristic auto-matcher
│   ├── status.js               # Pure computeStatus() engine + unit test suite
│   ├── package.js              # PDF compiler (A4 cover, TOC, 28pt band, footers)
│   ├── persist.js              # LocalStorage save/restore
│   └── export-csv.js           # CSV compliance checklist export
│   └── ui/
│       ├── header.js           # Header, language toggle, theme switch, 3-step tracker
│       ├── requirementList.js  # Requirement rows, drag-and-drop targets, expiry inputs
│       ├── fileTray.js         # File cards pool, draggable items, duplicate badges
│       ├── blockerPanel.js     # Reasons why Generate is disabled with scroll links
│       └── toast.js            # Toast notifications
├── vendor/
│   ├── pdf-lib.min.js          # Vendored PDF-Lib library (offline)
│   ├── pdf-lib.esm.min.js      # Vendored PDF-Lib ES Module
│   ├── pdf.min.mjs             # Vendored PDF.js engine
│   └── pdf.worker.min.mjs      # Vendored PDF.js web worker
├── sample/
│   ├── requirements.json       # Sample tender specification
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
├── output/
│   └── T-2026-0417_Package.pdf # Pre-assembled 15-page compliant tender deliverable
├── screenshots/                # Showcase captures
│   ├── status_screen.png
│   ├── dark_mode.png
│   ├── bangla_mode.png
│   ├── generated_pdf.png
│   └── ready_screen.png
└── scripts/
    └── generate-sample-and-output.mjs # Sample pack & output generator script
```

---

## ⚡ Running Locally

### Option 1: Direct Double-Click (Zero Setup)
Simply open `index.html` in your web browser, or double-click `Start-App.bat`.

### Option 2: Local Static Server
Run the built-in zero-dependency static server:
```bash
node server.mjs
```
Then visit:
```
http://localhost:3000/
```

### URL Query Shortcuts (for Testing & Demos)
- **Auto-load Sample Pack**: `http://localhost:3000/?sample=1`
- **Dark Mode**: `http://localhost:3000/?theme=dark`
- **Bangla Language**: `http://localhost:3000/?lang=bn`
- **Dark Mode + Sample + Bangla**: `http://localhost:3000/?sample=1&theme=dark&lang=bn`

---

## 🧪 Unit Testing `status.js`
The status engine includes an automated 10-test suite verifying all edge cases:
```bash
node -e "import('./js/status.js').then(m => { console.table(m.runStatusUnitTests()); })"
```
All 10 tests execute deterministically and verify:
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

---

## 📄 Final Deliverable Package PDF
The final generated package is available in:
```
output/T-2026-0417_Package.pdf
```
- **Total Pages**: 15 pages
- **Cover Page (Page 1)**: All 7 required items in English with Helvetica typeface.
- **Index Page (Page 2)**: Specification audit with page numbers and document mapping.
- **Content Pages (Pages 3–15)**: Shifted up by 28 pt on an expanded canvas to ensure the serialized footer `T-2026-0417 | Page X of 15` never overlaps document text.