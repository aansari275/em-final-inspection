# Eastern Mills Final Inspection App

## Overview
Final Inspection QC form application for Eastern Home Industries (EHI) and Eastern Mills Pvt Ltd (EMPL). Used by QC inspectors to document product inspections with comprehensive quality checks, photos, and defect tracking.

## Tech Stack
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS
- **Database:** Firebase Firestore
- **Hosting:** Netlify
- **PDF Generation:** jsPDF with html2canvas

## URLs
- **Production:** https://em-final-inspection.netlify.app
- **GitHub:** https://github.com/aansari275/em-final-inspection.git
- **Netlify Site ID:** 294f76b7-f82e-4544-932d-0e0145d4ad67

## Form Sections

### 1. Company & Document
- **Company Dropdown:** EHI or EMPL
- **Document Number:** Auto-generated (EHI/IP/01 or EMPL/IP/01)
- Company names:
  - EHI = Eastern Home Industries
  - EMPL = Eastern Mills Pvt Ltd

### 2. Basic Information
- Inspection Date, QC Inspector Name (dropdown)
- Customer Name & Code
- Customer PO No, OPS No
- Buyer Design Name, EMPL Design No
- Color Name, Product Sizes
- Merchant (dropdown)

### 3. Quantities & Sampling
- Total Order Qty, Inspected Lot Qty
- AQL Level (0.65, 1.0, 1.5, 2.5, 4.0, 6.5)
- Sample Size, Accepted Qty, Rejected Qty

### 4. Product Quality Checks
- Approved Sample Available (Yes/No)
- Material/Fibre Content (dropdown)
- OK/NOT OK checks:
  - Motif/Design Check
  - Backing (with notes field)
  - Binding & Edges
  - Hand Feel
  - Embossing/Carving
  - Workmanship
  - Product Quality Weight
- Text fields: Tuft Density, Pile Height, Product Weight, Size Tolerance, Finishing %, Packed %

### 5. Labeling & Marking
All OK/NOT OK checks:
- Label Placement
- Side Marking
- Outer Marking
- Inner Pack
- Care Labels
- SKU Stickers
- UPC Barcodes

### 6. Packaging
- Carton Ply (text)
- Carton Drop Test (OK/NOT OK)
- Packing Type (Assorted/Solid)
- Gross Weight, Net Weight
- Carton/Bale Numbering (OK/NOT OK)
- Pcs per Carton/Bale, Pcs per Polybag
- Carton Measurements (L × W × H)

### 7. Defect Tracking
- DPCI/SKU/Style Number
- Style Description
- Defects table with:
  - Defect Code (D01-D15)
  - Major Count
  - Minor Count
  - Description

### 8. Photo Documentation
Required photos (12 types):
1. Approved Sample Photo
2. ID Photo
3. Red Seal Front Photo
4. Red Seal Side Photo
5. Back Photo
6. Label Photo
7. Moisture Photo
8. Size Front Photo
9. Size Side Photo
10. Inspected Samples Photo
11. Metal Checking Photo
12. Other Photos (multiple)

### 9. Results
- QC Inspector Remarks (text area)
- Inspection Result (PASS/FAIL)

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

## Features
- **PDF Export:** Generate detailed PDF reports with all sections
- **Email Reports:** Send inspection reports via email (Netlify Functions)
- **Offline Storage:** LocalStorage backup for inspections
- **Firestore Sync:** Real-time sync to Firebase
- **Photo Upload:** Capture/upload photos directly in form
- **Inspection History:** View, search, and filter past inspections

## QC Inspectors
- Mahfooz Khan
- Faizan
- Gulab

## Merchants
- Haider
- Jozey
- Shagun
- Shahbaz
- Sumant
- Zahid

## Key Files
```
src/
├── components/
│   ├── FinalInspectionForm.tsx  # Main form (1400+ lines)
│   ├── InspectionList.tsx       # History view
│   ├── Header.tsx               # Navigation
│   └── EmailSettings.tsx        # Email config
├── lib/
│   ├── firebase.ts              # Firebase config
│   └── pdfGenerator.ts          # PDF generation
└── types/
    └── index.ts                 # TypeScript types & constants
```

## Deployment
```bash
npm run build
netlify deploy --prod --dir=dist
```
