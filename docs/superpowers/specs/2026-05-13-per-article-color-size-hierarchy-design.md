# Final Inspection V3 — Per-Article × Color × Size Hierarchy

**Status:** Design approved 2026-05-13
**Author:** Abdul + Claude
**Replaces:** V2 per-size accordion (Mar 2026)

## Problem

Large OPS orders (many articles × many colors × many sizes) make the V2 form unwieldy. The current flat list of size accordions does not communicate which article or color a given size belongs to, and inspectors lose their place. Submitting one giant report per OPS is also too coarse — merchants want a report per article.

## Goals

1. Visually communicate the Article → Color → Size hierarchy that exists in every OPS.
2. Let inspectors complete and submit one article at a time without losing the broader OPS context.
3. Keep the per-size inspection content identical to V2 (no behavioral change inside a size).
4. Soft-block submission when sizes are missing a PASS/FAIL choice, but never hard-block.
5. Produce a per-article PDF + email on each article submit, and a combined OPS roll-up PDF on demand.

## Non-Goals

- Changing the contents of a single size's inspection panel (quality checks, photos, etc. stay as-is).
- Adding offline-first sync beyond what V2 already does.
- Replacing or augmenting AQL Z1.4-2008 logic — same tables, same fixed AQL 2.5.
- Backward writing to V2 format — V3 is the only write format going forward; V1 and V2 records remain readable.

## High-Level Layout

```
┌────────────────────────────────────────────────┐
│ Header (collapsed by default — tap to expand)  │
│ EHI · OPS-25881 · Williams Sonoma · PO 449218  │
│ 2026-05-13 · Inspector: Abdul · 480 pcs        │
├────────────────────────────────────────────────┤
│ ▼ Article A-101 Caspian   [0/8 sizes done]    │
│   AQL · Lot 240 · Sample 32 · Acc 2 · Rej 3   │
│   ┌──────────────────────────────────────────┐ │
│   │ ▼ Color: Ivory (120)                     │ │
│   │   [4×6 ●] [5×7] [6×9] [8×10]            │ │
│   │   ┌─────── Size 4×6 — V2 panel ───────┐ │ │
│   │   │ Quality · Measure · Pack · Defects │ │ │
│   │   │ Photos · Result PASS/FAIL          │ │ │
│   │   └────────────────────────────────────┘ │ │
│   │ ▶ Color: Charcoal (120)                  │ │
│   └──────────────────────────────────────────┘ │
│   [ Submit Article A-101 → ]                   │
├────────────────────────────────────────────────┤
│ ▶ Article A-204 Dune     [Not started]         │
│ ▶ Article A-308 Reed     [Not started]         │
├────────────────────────────────────────────────┤
│ [ Submit OPS-25881 Summary Report ]            │
└────────────────────────────────────────────────┘
```

### Header behavior

- **Collapsed (default):** Company · OPS · Buyer · PO on line 1, Date · Inspector · Merchant · Total qty on line 2. Tap row to expand.
- **Expanded:** Same fields editable plus design, customer code, email settings access. The header itself does not contain AQL anymore — AQL is per-article (see below).

### Article accordion

- Vertical stack of all articles in the OPS, derived from `orders/data/orders` → `items`.
- Only one article expanded at a time. Tap header to expand; auto-collapses the previous one (with a draft save).
- Header row shows: article name, qty, color count, size count, progress badge (`0/N sizes done` → `N/N done` green when complete → `Submitted` blue once submitted).
- AQL block sits inside each article, pinned at the top of its expanded content. Lot qty defaults to `article.inspectedQty`. Sample size / accept / reject auto-calculate via existing `aqlCalculator.ts`.

### Color sub-accordion

- Always shown, one row per color, even when the article has only 1 color.
- Colors derived from `orders/data/orders` → `items[].color` grouped per article.
- Only one color expanded at a time within an article.

### Size tabs

- Inside an open color, horizontal scrollable tab bar — one tab per size for that color.
- Sizes derived from `orders/data/orders` → `items[].size` for the matching `(articleName, color)` pair.
- Tab state indicators:
  - **Idle:** plain label `5×7`
  - **In progress:** label + amber dot `5×7 ●` (any field touched but no result yet)
  - **Complete:** label + green check `5×7 ✓` (PASS or FAIL chosen)
  - **Failed:** label + red check `5×7 ✗` (FAIL chosen)
- Tab content = unchanged V2 `SizeInspectionPanel` (Quality Checks, Measurement, Labeling, Packaging, Defects, Photos, Result).

### Submit Article button

- Fixed below the open article (sticky on long forms).
- On click:
  1. Compute incomplete sizes (no PASS/FAIL chosen) across all colors in this article.
  2. If incomplete count > 0, show modal: `X sizes pending: [list]. Submit anyway, or go back to finish?`.
  3. On confirm, save the per-article inspection record to Firestore + fire background PDF + email (uses existing save-first pattern).
- After successful save, the article header switches to `Submitted` badge with timestamp. The article can still be re-opened to view/edit (edits trigger a re-submit, like a resend).

### Submit OPS Summary button

- Pinned at the very bottom of the OPS view.
- Disabled until all articles have been submitted at least once.
- On click: generates a combined roll-up PDF (cover sheet + per-article result summary + aggregate AQL) and emails the OPS-level recipients. Re-clickable to re-send.

## Data Model

### V3 Firestore document (new write format)

Collection: `final-inspections` (same as today). Discriminate by `version: 3`.

```typescript
interface InspectionV3 {
  version: 3;
  id: string;
  companyCode: 'EHI' | 'EMPL';
  documentNo: string;
  opsNo: string;
  inspectionDate: string;     // ISO
  inspector: string;

  // Buyer/order metadata (snapshot at create-time)
  buyerCode: string;
  buyerName: string;
  poNumber: string;
  merchant: string;
  designName: string;
  totalOpsQty: number;

  // The hierarchy
  articles: ArticleInspection[];

  // Roll-up state
  rollupSentAt?: string;       // ISO
  rollupPdfUrl?: string;
  rollupEmailStatus?: 'pending' | 'sending' | 'sent' | 'failed';

  createdAt: string;
  updatedAt: string;
}

interface ArticleInspection {
  id: string;                  // crypto.randomUUID()
  articleName: string;
  inspectedQty: number;

  // Per-article AQL
  aql: {
    lotQty: number;
    codeLetter: string;
    effectiveCodeLetter: string;
    calculatedSampleSize: number;
    acceptNumber: number;
    rejectNumber: number;
    rejectedQty: number;
    isAutoResult: boolean;
    resultOverridden: boolean;
  };

  colors: ColorInspection[];

  // Submission state
  submittedAt?: string;
  pdfUrl?: string;
  emailStatus?: 'pending' | 'sending' | 'sent' | 'failed';
  inspectionResult?: 'PASS' | 'FAIL';  // computed: FAIL if any size FAIL
  remarks?: string;
}

interface ColorInspection {
  id: string;
  colorName: string;
  qty: number;
  sizes: SizeInspection[];     // unchanged V2 SizeInspection shape
}
```

`SizeInspection` is reused verbatim from V2 (`src/types/index.ts` line 280). No field changes.

### Backward compatibility

- `isV3Inspection(doc)` checks `version === 3`.
- `isV2Inspection(doc)` checks `version === 2 || sizeInspections` exists.
- V1 and V2 records continue to render in `InspectionList`, generate PDFs via existing V1/V2 paths, and support resend. No write path produces V2 after this ships.

### Draft cutover

- Existing V2 cloud drafts in `final_inspection_drafts` get flagged with a banner: "Old format draft — start a new V3 inspection to continue, or discard."
- No automated migration. V2 drafts can still be opened and resumed once via a hidden URL parameter for the legacy form. After 30 days the flag becomes a hard delete.

## State Management

Extend the existing `InspectionFormContext` (React Context + useReducer):

- Top-level state now holds `articles: ArticleInspection[]` instead of flat `sizeInspections`.
- New action types:
  - `INIT_FROM_OPS` — builds `articles` skeleton from `orders/data/orders` lookup result.
  - `EXPAND_ARTICLE` / `EXPAND_COLOR` / `SELECT_SIZE_TAB` — UI navigation.
  - `UPDATE_SIZE` — same as V2, but addressed by `(articleId, colorId, sizeId)` tuple instead of just `sizeId`.
  - `UPDATE_ARTICLE_AQL` — per-article AQL field updates.
  - `SUBMIT_ARTICLE` / `MARK_ARTICLE_SUBMITTED` — fires save flow, then transitions state.
- A derived selector `getIncompleteSizes(articleId)` returns sizes missing `inspectionResult`, used by the submit prompt.

## Components

```
FinalInspectionForm                    (orchestrator, slimmer)
├── Header                              (collapsible summary)
├── OpsLookup                           (unchanged, fills metadata + builds article skeleton)
├── ArticleAccordionList                NEW
│   └── ArticleAccordion                NEW
│       ├── ArticleAqlBlock             NEW (factored from old global AQL section)
│       ├── ColorAccordionList          NEW
│       │   └── ColorAccordion          NEW
│       │       ├── SizeTabBar          NEW (horizontal tabs with status dots)
│       │       └── SizeInspectionPanel UNCHANGED (V2 component)
│       └── SubmitArticleButton         NEW
│           └── PendingSizesPromptModal NEW
└── SubmitOpsRollupButton               NEW
    └── RollupEmailRecipientsDialog     NEW
```

Components marked UNCHANGED keep their current files and props. New components live in `src/components/` and follow the existing naming convention.

## Submit Flow Details

### Per-article submit

1. User clicks **Submit Article A-101**.
2. `getIncompleteSizes(articleId)` runs. If non-empty, modal: `2 sizes pending: 6×9, 8×10. Submit anyway?` — Cancel | Submit anyway.
3. On confirm, dispatch `SUBMIT_ARTICLE`.
4. The article subset of the inspection document is saved to Firestore immediately (save-first pattern from V2). The full `InspectionV3` doc is upserted with this article's slot now containing `submittedAt`.
5. Background photo upload starts for any photo files not yet uploaded for this article's sizes.
6. After uploads finish, `generateArticlePdf(article)` runs and the email is sent. `emailStatus` transitions `pending → sending → sent | failed` (existing infrastructure).
7. UI: green toast `Article A-101 submitted`. Article header collapses to "Submitted · 2026-05-13" badge. Next article auto-expands if there's a clear next-uncompleted one (optional UX nicety).

### OPS roll-up submit

1. `Submit OPS-25881 Summary Report` button enabled only when every article in `articles` has `submittedAt`.
2. On click, opens `RollupEmailRecipientsDialog` (pre-filled with email settings + auto-CC merchants, just like per-article).
3. On confirm, `generateRollupPdf(inspection)` runs:
   - Cover sheet: OPS, buyer, dates, overall pass/fail.
   - Article summary table: each article row with PASS/FAIL, defect count, photo count, link to per-article PDF in Firebase Storage.
   - Combined defect chart, aggregate AQL summary (sum of accepted/rejected).
4. Email is sent. `rollupSentAt`, `rollupPdfUrl`, `rollupEmailStatus` saved on the document.
5. Re-clicking sends again with the latest data.

## PDF Changes

- **`generateArticlePdf(article, inspection)`** — NEW. Reuses existing per-size rendering code from V2 `pdfGenerator.ts`. Cover page lists article header, AQL, color/size matrix. Then renders each size's section as today.
- **`generateRollupPdf(inspection)`** — NEW. Roll-up cover + summary table only — does not duplicate the full size detail (those live in the per-article PDFs which are linked).
- **`generateV2Pdf(inspection)`** — UNCHANGED. Still used for V1/V2 record resend from `InspectionList`.

## Email Changes

- Per-article emails use new subject pattern: `Final Inspection: [BUYER] / [OPS] / [ARTICLE] - [PASS/FAIL]`.
- Roll-up email: `Final Inspection Summary: [BUYER] / [OPS] - [overall PASS/FAIL]`.
- Both use the same HTML bordered-table template, with sections trimmed appropriately (roll-up = summary table + aggregate AQL only).
- Merchant auto-CC continues to fire from buyer code lookup.

## Tab Overflow

If an article × color has many sizes (>5 tabs visible), the tab bar scrolls horizontally with a subtle gradient on the right edge to indicate more sizes. On phones the bar is touch-swipeable. No wrapping to multiple rows — keeps the form predictable.

## Failure Modes & Edge Cases

- **OPS has no articles loaded** (e.g., OPS record exists but `items` is empty): show a message in place of the article accordion: `No articles found for this OPS. Add articles in the Orders app first.`
- **Article has no sizes for a color** (data inconsistency): show a row `No sizes for this color — skip or add custom size`. Allow adding a custom size in-form (reuses the V2 size selector). Custom sizes get saved on the inspection document but are not pushed back to `orders/data/orders`.
- **OPS data is updated mid-inspection** (e.g., merchant adds an article): refreshing the inspection prompts: `OPS data changed — N new article(s). Add them to this inspection?`.
- **Submit Article fails halfway** (e.g., photos uploaded but email failed): the article record is still marked submitted in Firestore with `emailStatus: failed`. Resend works the same as V2 via the InspectionList row.

## Migration & Rollout

- Single hard cutover. The next deploy after merge replaces V2 form with V3 form. Inspection list keeps reading V1, V2, V3 documents.
- One round of regression test on representative OPSes (1-article single-color, multi-article multi-color, big-size order with >10 sizes).
- Roll-back plan: if V3 form breaks in production, revert the form-component import in `FinalInspectionForm.tsx` to V2's. V1/V2 record reading is untouched, so history view stays functional.

## Open Questions

None — all major decisions confirmed during brainstorming session 2026-05-13. Implementation plan to be written next via the writing-plans skill.
