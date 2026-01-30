# Eastern Mills Final Inspection App

## Overview
Final Inspection QC form application for Eastern Home Industries (EHI) and Eastern Mills Pvt Ltd (EMPL). Used by QC inspectors to document product inspections with comprehensive quality checks, photos, and defect tracking.

## Tech Stack
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS
- **Database:** Firebase Firestore
- **Storage:** Firebase Storage (photos)
- **Hosting:** Netlify
- **PDF Generation:** jsPDF

## URLs
- **Production:** https://em-final-inspection.netlify.app
- **GitHub:** https://github.com/aansari275/em-final-inspection.git
- **Netlify Site ID:** 294f76b7-f82e-4544-932d-0e0145d4ad67

## Firebase Collections
- **`final_inspections`** - Saved inspection reports
- **`buyers`** - Shared customer/buyer directory (read)
- **`orders/data/orders`** - OPS orders for lookup (read)
- **`empl_design_name`** - Shared design names (read/write)

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

### 6. Quantities & Sampling
- Total Order Qty, Inspected Lot Qty
- AQL Level (0.65, 1.0, 1.5, 2.5, 4.0, 6.5)
- Sample Size, Accepted Qty, Rejected Qty

### 7. Product Quality Checks
- Approved Sample Available (Yes/No)
- Material/Fibre Content (dropdown)
- OK/NOT OK checks with photo capture on NOT OK:
  - Motif/Design Check, Backing (with notes), Binding & Edges
  - Hand Feel, Embossing/Carving, Workmanship, Product Quality Weight
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

### PDF Export
- Professional formatted PDF with all sections
- Inspected Articles table (when available)
- All photos included on separate pages
- Color-coded OK/NOT OK status

### Email Reports
- HTML email with inspection summary
- Inspected Articles table
- Photo attachments
- PDF attachment

### Draft System
- Auto-save every 30 seconds
- Manual save button
- Draft restoration on page load

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
│   ├── FinalInspectionForm.tsx  # Main form (~2800 lines)
│   ├── InspectionList.tsx       # History view
│   ├── Header.tsx               # Navigation
│   └── EmailSettings.tsx        # Email config
├── lib/
│   ├── firebase.ts              # Firebase config + OPS lookup
│   ├── pdfGenerator.ts          # PDF generation
│   └── emailSettingsService.ts  # Email settings
└── types/
    └── index.ts                 # TypeScript types & constants
```

## Deployment
```bash
npm run build
netlify deploy --prod --dir=dist
```

## Environment Variables (Netlify)
- `GMAIL_USER` - Gmail address for sending emails
- `GMAIL_APP_PASSWORD` - Gmail app password
