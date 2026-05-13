# Eastern Mills Final Inspection App

## Overview
Final Inspection QC form application for Eastern Home Industries (EHI) and Eastern Mills Pvt Ltd (EMPL). Used by QC inspectors to document product inspections with comprehensive quality checks, photos, and defect tracking.

## Tech Stack
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS
- **Database:** Firebase Firestore
- **Storage:** Firebase Storage (photos + PDF reports)
- **Hosting:** Netlify
- **PDF Generation:** jsPDF
- **PWA:** vite-plugin-pwa (installable, offline support)

## URLs
- **Production:** https://em-final-inspection.netlify.app
- **GitHub:** https://github.com/aansari275/em-final-inspection.git
- **Netlify Site ID:** 294f76b7-f82e-4544-932d-0e0145d4ad67

## Firebase Collections
- **`final-inspections`** - Saved inspection reports
- **`buyers`** - Shared customer/buyer directory (read)
- **`orders/data/orders`** - OPS orders for lookup (read)
- **`empl_design_name`** - Shared design names (read/write)
- **`settings/final_inspection_email`** - Email recipient settings (synced across devices)
- **`final_inspection_drafts`** - Cloud-saved form drafts (accessible from any device)

## Firebase Storage Paths
- **`final-inspection-images/`** - Inspection photos
- **`final-inspection-reports/`** - Generated PDF reports (for email links)

---

## Planned V3 — Per-Article × Color × Size Hierarchy (Design 2026-05-13)

V2 ships flat per-size accordions per OPS. **V3 replaces V2** with a three-level hierarchy:
**Article → Color → Size (tabs)**, with per-article AQL, per-article PDF/email submission, and an on-demand combined OPS roll-up.

- Design spec: [`docs/superpowers/specs/2026-05-13-per-article-color-size-hierarchy-design.md`](docs/superpowers/specs/2026-05-13-per-article-color-size-hierarchy-design.md)
- Status: **design approved, implementation pending** (writing-plans skill next)
- Hard cutover, no toggle. V1/V2 records remain readable via existing PDF paths.
- New write format: `version: 3` on `final-inspections` documents. Shape: `articles[] → colors[] → sizes[]`, where each `SizeInspection` is identical to V2.
- Submit-Article warning fires only when `inspectionResult` (PASS/FAIL) is missing on a size — never hard-blocks.
- Submit-OPS-Summary button enabled once every article has been submitted at least once.

---

## Form Architecture (V2 — Per-Size Inspections, Mar 2026)

### Global Sections (filled once)
1. **Company Selection** — EHI or EMPL, auto-sets document number
2. **OPS Lookup** — Searchable dropdown, auto-fills customer/PO/merchant/design/qty
3. **Article Selection** — Checkboxes from OPS articles, inspected qty per article
4. **Inspection Details** — Date, QC Inspector
5. **Order Information** — Customer name/code, PO, merchant, design, color
6. **AQL Sampling** (global) — Lot qty, AQL level, sample size, accepted/rejected, auto PASS/FAIL

### Per-Size Sections (accordion, one per size)
Each size gets its own complete inspection panel in an accordion UI:
- **Size Selector** — cm/feet toggle, standard size chips, custom sizes
- **Quality Checks** — 20 OK/NOT OK/NA fields with photo evidence per row
- **Measurement Details** — Tuft density, pile height, weight, tolerance, finishing %, packed %
- **Labeling & Marking** — Label placement, side/outer marking, inner pack, care labels, SKU, UPC
- **Packaging** — Carton ply, drop test, packing type, weights, dimensions, pcs per carton
- **Defect Tracking** — DPCI/SKU/Style, defects table (code, major, minor, description)
- **Photos** — Stacked goods, consumer pieces, unit load, 12 standard photos, 5 construction photos, other photos
- **Result** — QC remarks + PASS/FAIL per size

### Accordion UI
- One size expanded at a time
- Collapsed header shows: size name, PASS/FAIL badge, photo count, defect count
- "Add One More Size" button at bottom (prominent green)
- Each new size starts blank

### Overall Result
- FAIL if ANY size fails, PASS if all pass
- Shown below the size accordion as "Final Result"

---

## Key Features

### OPS Integration
- Searchable dropdown with all OPS orders from `orders/data/orders`
- Flexible OPS number format matching (OPS-25881, EM-25-747, etc.)
- Auto-fills: Customer, PO, Merchant, Design, Total Qty
- Article selection with inspected quantity tracking

### Photo System
- NOT OK fields can capture photo evidence
- Labeled photos for Consumer Pieces and Unit Load
- Custom labels saved to localStorage
- All photos uploaded to Firebase Storage
- **Camera/Gallery popover** — single camera icon, tap shows popover with "Take Photo" (opens device camera via `capture="environment"`) and "Choose from Gallery" (standard file picker)
- Reusable `PhotoInputButtons` component used across all 7 photo upload areas
- `NotOkPhotoUpload` component also uses the same popover pattern for inline quality check photos

### PDF Export
- Professional bordered-table layout (Excel-style with cell borders)
- Inspected Articles table (when available)
- **4-column photo grid** with all images cropped to consistent 4:3 landscape frames
- All photos uniform size regardless of original orientation (no portrait/landscape mix)
- Photo labels show actual field values (e.g., "Net Weight: 3.5 kgs", "Pile Height: 12mm")
- **Continuous flow** — no blank page gaps between data sections and photos
- Photos start on same page if room available, new pages only when needed
- Color-coded OK/NOT OK/NA status
- AQL Z1.4-2008 calculation details included

### Email Reports
- **Sender:** "Eastern Quality" <abdulansari@easternmills.com>
- **Subject:** `Final Inspection: [BUYER CODE] / [OPS NO] - [DESIGN] [PASS/FAIL]`
- **Rich HTML email** with professional bordered-table layout matching PDF style:
  - Order Information (date, doc no, inspector, merchant, customer, PO, OPS, design, color, sizes)
  - Inspected Articles table with totals
  - AQL Sampling & Quantities (code letter, accept/reject thresholds, Z1.4-2008 reference)
  - Product Quality Checks — all 9 checks with color-coded OK/NOT OK/NA
  - Measurement Details (tuft density, pile height, weight, tolerance, finishing %, packed %)
  - Labeling & Marking — 10 checks in 2-column layout with status colors
  - Packaging (carton ply, drop test, weights, dimensions, pcs per carton)
  - Defect Tracking table (codes, descriptions, major/minor counts, totals)
  - QC Inspector Remarks
  - Photo Documentation — 2-column grid with labeled images
- **Both email templates updated** (new submission in FinalInspectionForm + resend in InspectionList)
- **PDF attachment** included
- **Download link** as backup (PDF uploaded to Firebase Storage, resend uses link)
- **Auto-CC merchants** linked with buyer code (primary + assistant)
- Email settings stored in Firestore (synced across all devices)

### Draft System
- Auto-save every 30 seconds (localStorage + Firestore)
- Manual save button
- **Cloud drafts** saved to Firestore (`final_inspection_drafts` collection)
- Drafts accessible from any device with the same login
- "Cloud Drafts" panel to browse, resume, and delete saved drafts
- Draft restoration on page load (local first, cloud as fallback)
- On successful submission, cloud draft is automatically deleted

### V2 Document Format (Per-Size, Mar 2026)
- **Version detection:** `isV2Inspection()` checks `version === 2` or `sizeInspections` array exists
- **Global fields:** company, documentNo, date, inspector, customer, OPS, design, color, merchant, AQL
- **Per-size:** `sizeInspections: SizeInspection[]` — each has quality checks, packaging, defects, photos, result
- **Rollup:** `productSizes` (joined), `inspectionResult` (FAIL if any size fails)
- **Upload tracking:** `photoUploadStatus`, `totalPhotoCount`, `uploadedPhotoCount`
- **Backward compat:** V1 documents render and resend without changes
- **State management:** React Context + useReducer replaces ~40 useState hooks
- **Component decomposition:** Monolith split into 15+ focused components

### Save-First Photo Upload (Mar 2026)
- Firestore document saved IMMEDIATELY with all text data + empty photo URLs
- Photos upload in background after form resets (user sees instant success)
- Storage path: `final-inspection-images/{docId}/{sizeId}/{photoType}_{filename}`
- Batch size: 8 photos at a time with `Promise.allSettled`
- Firestore updated per-size as uploads complete
- Handles 200-500+ images across many sizes
- Email generated only after all uploads complete

### Submit Reliability (Redesigned Feb 2026)
**Problem:** Image-heavy inspections (20+ photos) failed because PDF generation re-downloaded all images within a 90s timeout.

**Solution: Save Instantly + Background Email**
- **Instant save:** Inspection saved to Firestore immediately after photo upload → success toast + form reset
- **Background email:** PDF generation + email fires independently (no timeout cap)
- **Smart thumbnails:** >30 images → 400px thumbnails (vs 1600px full-res), keeping PDF under 20MB
- **Auto-retry:** 3 attempts with 10s delay between failures
- **`emailStatus` tracked in Firestore:** `pending` → `sending` → `sent` | `failed`
- **`beforeunload` guard:** Warns user if closing browser while email is sending
- **Progress indicator:** "Processing image 15 of 47..." shown in blue banner
- **Resend from list:** Failed emails show badge in InspectionList, existing resend button updates status
- Image compression timeout (15s) — aggressive fallback (800px, 40% quality) if normal compression hangs on mobile
- Photo upload timeout (60s per photo) with per-image retry (2 retries, 2s delay)
- Photo upload batch size: 8 (up from 5) with `Promise.allSettled` so one failed image does not block the rest
- PDF image batch size: 10 with `Promise.allSettled` so one broken image does not crash PDF generation
- **Email payload protection:** PDF attachment stripped if >5MB, total payload capped at 6MB. Server-side also strips attachments >10MB. Email sends as HTML-only if PDF too large.
- Background email IIFE wrapped with `.catch()` to handle unhandled rejections gracefully

### Git Push Note
- Repo `.git` is ~678MB. `git push` often fails with `mmap failed` / `pack-objects died of signal 10` due to memory constraints.
- **Workaround:** Push files via GitHub Git Data API (create blobs → tree → commit → update ref) instead of `git push`. See commit `0bae366` for example.

### PWA (Progressive Web App)
- **Installable** on mobile and desktop
- **Offline support** with service worker caching
- **App icon** with green checkmark branding
- Standalone mode (no browser UI)
- **Prompt-based updates** (user chooses when to update, prevents data loss)
- Keep-alive mechanism prevents OS from killing PWA during long inspections
- **navigationPreload: false** — disabled because it conflicts with precache-first SPA strategy, causing "preloadResponse cancelled" errors and intermittent page stalls (fixed Feb 2026)

### AQL Z1.4-2008 Auto-Calculation
Implements ANSI/ASQ Z1.4-2008 standard for acceptance sampling:
- **Fixed AQL:** 2.5 (company standard, no dropdown selection needed)
- **Default Level:** General Inspection Level II
- **Auto-calculates on lot size entry:**
  - Code letter from lot size ranges
  - Sample size from Z1.4 tables (capped at lot size for small lots)
  - Accept/Reject thresholds for AQL 2.5
- **Arrow handling:** Automatically uses larger sample when needed
- **100% inspection rule:** When sample size exceeds lot size, caps at lot size
- **Auto PASS/FAIL:** Determines result based on rejected qty
- **Inspector override:** Can manually override auto-determined result
- **Saved fields:** codeLetter, calculatedSampleSize, acceptNumber, rejectNumber, effectiveCodeLetter, isAutoResult, resultOverridden

**Verification Examples (AQL 2.5, Level II):**
| Lot Size | Code | Arrow → | Eff. Code | Sample | Accept | Reject |
|----------|------|---------|-----------|--------|--------|--------|
| 2 | A | A→E | E | 2 | 0 | 1 |
| 8 | A | A→E | E | 2 | 0 | 1 |
| 10 | B | B→E | E | 3 | 0 | 1 |
| 50 | D | D→E | E | 8 | 0 | 1 |
| 100 | F | - | F | 20 | 1 | 2 |
| 200 | G | - | G | 32 | 2 | 3 |
| 500 | H | - | H | 50 | 3 | 4 |

**CRITICAL AQL RULES - DO NOT CHANGE:**
1. **E at AQL 2.5 = Accept 0, Reject 1** (NOT arrow down)
2. **Sample size comes from ORIGINAL code letter**, NOT the effective code letter after arrows
3. Arrows only change Accept/Reject thresholds, NOT sample size

### Inspection List Features
- **Image thumbnails** displayed in grid (not text links)
- **Preview modal** with full report and Photos Gallery section
- **Re-send email** functionality with merchant auto-CC
- Download PDF directly from list

### Merchant Auto-Email
When inspection is submitted:
1. Fetches primary & assistant merchant emails from `buyers` collection
2. Auto-adds merchant emails to recipient list
3. Sends inspection report to all recipients (manual + auto-added)

---

## Defect Codes
| Code | Description |
|------|-------------|
| D01 | Color Variation |
| D02 | Size Deviation |
| D03 | Weaving Defect |
| D04 | Missing Tuft |
| D05 | Stain/Spot |
| D06 | Backing Issue |
| D07 | Edge/Binding Defect |
| D08 | Pattern Mismatch |
| D09 | Pile Height Variation |
| D10 | Fringe Issue |
| D11 | Label Error |
| D12 | Packaging Damage |
| D13 | Metal Detected |
| D14 | Moisture Issue |
| D15 | Other |

## Authentication (Mar 2026)
- **Google OAuth** via Firebase Auth (replaced password123 login)
- Firebase Auth SDK imported in `firebase.ts`, Google provider configured
- `onAuthStateChanged` manages session state in `App.tsx`
- Login screen shows "Sign in with Google" button
- Sign Out button in header
- No domain restriction (any Google account can sign in)
- Firebase API key: `AIzaSyBSnzCBh-nhQs2nNuPpV_xpRp29FyUyHuc` (easternmillscom project)

## Photo Validation (Mar 2026)
- **Submit warning:** If inspector submits with 0 photos, a confirmation dialog warns them
- **Photo counter:** Live count near submit button shows how many photos are attached (red if 0, green otherwise)
- **Console logging:** Photo upload results logged for debugging (`[Final Inspection] Photo upload complete: X/Y uploaded, Z failed`)
- **Root cause of missing photos (Feb-Mar 2026):** Inspector Arjun was submitting without taking photos. Code was working correctly. Photos from other inspectors (Shivam Dubey) had 10-24 images per report.
- **Netlify secrets scan:** Firebase API key (`AIza...`) must be added to `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` env var to prevent build failures (Firebase API keys are public, not secrets)

## QC Inspectors
- Mahfooz Khan, Faizan, Gulab, Arjun, Shivam Dubey (+ custom)

## Merchants
- Haider, Jozey, Shagun, Shahbaz, Sumant, Zahid (+ custom)

---

## Key Files
```
src/
├── context/
│   └── InspectionFormContext.tsx # React Context + useReducer (replaces 40 useState hooks)
├── components/
│   ├── FinalInspectionForm.tsx  # Orchestrator (~2200 lines, delegates to sub-components)
│   ├── SizeInspectionList.tsx   # Accordion container + "Add One More Size" button
│   ├── SizeInspectionPanel.tsx  # One size's complete inspection (accordion item)
│   ├── SizeSelector.tsx         # cm/feet toggle + size chips for one size
│   ├── QualityChecksSection.tsx # 20 OK/NOT OK/NA fields with photo evidence
│   ├── PackagingSection.tsx     # Carton/packaging fields per size
│   ├── DefectsSection.tsx       # Defect tracking table per size
│   ├── PhotosSection.tsx        # All photo categories per size
│   ├── ResultSection.tsx        # Remarks + PASS/FAIL per size
│   ├── shared/
│   │   ├── PhotoInputButtons.tsx   # Camera popover (Take Photo / Gallery)
│   │   ├── NotOkPhotoUpload.tsx    # Inline photo for quality check rows
│   │   └── DropdownWithAdd.tsx     # Select dropdown with "Add new" option
│   ├── InspectionList.tsx       # History view (handles V1 + V2 documents)
│   ├── Header.tsx               # Navigation
│   └── EmailSettings.tsx        # Email config
├── lib/
│   ├── firebase.ts              # Firebase config + OPS lookup
│   ├── pdfGenerator.ts          # PDF generation (V1 flat + V2 per-size)
│   ├── photoUploader.ts         # Background photo upload (save-first pattern)
│   ├── imageUtils.ts            # Image compression + timeout helpers
│   ├── emailSettingsService.ts  # Email settings
│   ├── draftPersistence.ts      # localStorage + IndexedDB drafts
│   ├── aqlTables.ts             # Z1.4-2008 lookup tables
│   └── aqlCalculator.ts         # AQL calculation utilities
└── types/
    └── index.ts                 # TypeScript types (V1, V2, SizeInspection, helpers)
```

## Local Development
```bash
# For basic development (no email)
npm run dev

# For full functionality including email
netlify dev
```
**Note:** Email functions only work with `netlify dev` or on production.

## Deployment
```bash
npm run build
netlify deploy --prod --dir=dist
```

## Firebase Storage CORS
CORS configured for image loading in PDFs:
```bash
gsutil cors set cors.json gs://easternmillscom.firebasestorage.app
```

## Environment Variables (Netlify)
- `GMAIL_USER` - Gmail address for sending emails
- `GMAIL_APP_PASSWORD` - Gmail app password
