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

## Firebase Storage Paths
- **`final-inspection-images/`** - Inspection photos
- **`final-inspection-reports/`** - Generated PDF reports (for email links)

---

## Form Sections

### 1. Company & Document Selection
- **Company Dropdown:** EHI or EMPL
- **Document Number:** Auto-generated (EHI/IP/01 or EMPL/IP/01)

### 2. OPS Lookup & Article Selection (NEW)
Main entry point for the form:
- **OPS Number:** Searchable dropdown with all OPS orders
- **Auto-fills on OPS selection:**
  - Customer Name & Code (read-only)
  - Customer PO (editable)
  - Merchant
  - EMPL Design No. (from first article)
  - Total Order Qty
- **Article Selection:**
  - Shows all articles from selected OPS
  - Checkbox to select/deselect articles
  - Inspected Qty input per article
  - Selection summary with totals
- **Additional Details:**
  - EMPL Design No. (auto-filled, editable)
  - Color Name
  - Product Sizes (cm/feet toggle, clickable chips)
  - Merchant (dropdown with add)

### 3. Inspection Details
- Inspection Date
- QC Inspector Name (dropdown with add)

### 4. Order Information
- Customer Name & Code (auto-filled from OPS or manual)
- Customer PO No. (editable)

### 5. Images Section (NEW)
- **Stacked Images of Packed Goods** - Single photo upload
- **Packed Consumer Pieces** - Multiple photos with labeled dropdowns:
  - Consumer Label, Care Label, SKU Sticker, UPC Barcode, Packaging Front/Back
  - Custom labels can be added
- **Unit Load** - Toggle checkbox, when enabled:
  - Multiple photos with labeled dropdowns
  - Unit Load Label, Pallet Marking, Outer Carton, Stretch Wrap
  - Custom labels can be added

### 6. Quantities & Sampling (AQL Z1.4-2008)
- Total Order Qty, Inspected Lot Qty
- AQL Level: Fixed at 2.5 (company standard for final inspections)
- **AQL Auto-Calculation Panel:**
  - Code Letter (auto-calculated from lot size)
  - Sample Size (auto-filled from Z1.4 table)
  - Accept/Reject thresholds
  - Arrow handling when sample size changes
- Sample Size (editable), Accepted Qty, Rejected Qty
- **Auto PASS/FAIL determination** based on rejected qty vs reject threshold
- Inspector override capability for auto-determined results

### 7. Product Quality Checks
- Approved Sample Available (Yes/No)
- Material/Fibre Content (dropdown)
- **List-view layout** with pill-style OK/NOT OK/NA buttons + camera icon on every row
- All quality checks (including Labeling, Packaging, Additional) rendered as list rows
- Photo upload available on ALL checks (not just NOT OK)
- Checks: Motif/Design, Backing (with notes), Binding & Edges, Hand Feel, Embossing/Carving, Workmanship, Product Quality Weight
- Text fields: Tuft Density, Pile Height, Product Weight, Size Tolerance, Finishing %, Packed %

### 8. Labeling & Marking
All OK/NOT OK checks:
- Label Placement, Side Marking, Outer Marking, Inner Pack
- Care Labels, SKU Stickers, UPC Barcodes

### 9. Packaging
- Carton Ply, Carton Drop Test (OK/NOT OK)
- Packing Type (Assorted/Solid)
- Gross Weight, Net Weight
- Carton/Bale Numbering (OK/NOT OK)
- Pcs per Carton/Bale, Pcs per Polybag
- Carton Measurements (L × W × H)

### 10. Defect Tracking
- DPCI/SKU/Style Number, Style Description
- Defects table: Code, Major Count, Minor Count, Description

### 11. Photo Documentation
**Standard Photos:**
- Approved Sample Photo, ID Photo

**Red Seal Photos (5 types):**
- Red Seal - Front
- Red Seal - Back
- Close-up with Red Seal
- Front Photo with Red Seal
- Back Photo with Red Seal

**Other Photos:**
- Label Photo, Moisture Photo
- Size Front Photo, Size Side Photo
- Inspected Samples Photo, Metal Checking Photo
- Other Photos (multiple)

### 12. Results
- QC Inspector Remarks (text area)
- Inspection Result (PASS/FAIL)

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
- **Camera AND gallery upload supported** (no forced camera-only on mobile)

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
- **Subject:** `Final Inspection Report - [BUYER CODE] - PASS/FAIL`
- HTML email with inspection summary (shows buyer code, not name)
- **PDF attachment** included
- **Download link** as backup (PDF uploaded to Firebase Storage)
- **Auto-CC merchants** linked with buyer code (primary + assistant)
- Email settings stored in Firestore (synced across all devices)

### Draft System
- Auto-save every 30 seconds
- Manual save button
- Draft restoration on page load

### PWA (Progressive Web App)
- **Installable** on mobile and desktop
- **Offline support** with service worker caching
- **App icon** with green checkmark branding
- Standalone mode (no browser UI)
- **Prompt-based updates** (user chooses when to update, prevents data loss)
- Keep-alive mechanism prevents OS from killing PWA during long inspections

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

## QC Inspectors
- Mahfooz Khan, Faizan, Gulab (+ custom)

## Merchants
- Haider, Jozey, Shagun, Shahbaz, Sumant, Zahid (+ custom)

---

## Key Files
```
src/
├── components/
│   ├── FinalInspectionForm.tsx  # Main form (~3000 lines)
│   ├── InspectionList.tsx       # History view
│   ├── Header.tsx               # Navigation
│   └── EmailSettings.tsx        # Email config
├── lib/
│   ├── firebase.ts              # Firebase config + OPS lookup
│   ├── pdfGenerator.ts          # PDF generation with AQL details
│   ├── emailSettingsService.ts  # Email settings
│   ├── aqlTables.ts             # Z1.4-2008 lookup tables
│   └── aqlCalculator.ts         # AQL calculation utilities
└── types/
    └── index.ts                 # TypeScript types & constants
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
