# Final Inspection V3 — Per-Article × Color × Size Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace V2 flat per-size form with a three-level Article → Color → Size (tabs) hierarchy. Per-article AQL + PDF + email; on-demand combined OPS roll-up. Hard cutover. V1/V2 records remain readable.

**Architecture:** Extend existing `InspectionFormContext` (React Context + useReducer) with a `articles` array replacing flat `sizeInspections`. Reuse `SizeInspectionPanel` unchanged inside each size tab. New components for the article/color/tab navigation shell. New `version: 3` Firestore doc shape on the existing `final-inspections` collection. New per-article and roll-up PDF generators alongside (not replacing) the V2 generator. `InspectionList` reads V1, V2, V3.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind, Firebase Firestore + Storage, jsPDF.

**Spec:** `docs/superpowers/specs/2026-05-13-per-article-color-size-hierarchy-design.md`

---

## File Structure

**New:**
- `src/types/v3.ts` — `InspectionV3`, `ArticleInspection`, `ColorInspection` types + helpers (`isV3Inspection`, `buildArticleSkeletonFromOps`, `getIncompleteSizes`)
- `src/context/InspectionFormContextV3.tsx` — V3 reducer with `articles` state, new actions (INIT_FROM_OPS, EXPAND_ARTICLE, EXPAND_COLOR, SELECT_SIZE_TAB, UPDATE_SIZE_BY_PATH, UPDATE_ARTICLE_AQL, MARK_ARTICLE_SUBMITTED)
- `src/components/v3/ArticleAccordionList.tsx`
- `src/components/v3/ArticleAccordion.tsx`
- `src/components/v3/ArticleAqlBlock.tsx`
- `src/components/v3/ColorAccordion.tsx`
- `src/components/v3/SizeTabBar.tsx`
- `src/components/v3/SubmitArticleButton.tsx`
- `src/components/v3/PendingSizesPromptModal.tsx`
- `src/components/v3/SubmitOpsRollupButton.tsx`
- `src/components/v3/CollapsibleHeader.tsx`
- `src/lib/pdfGeneratorV3.ts` — `generateArticlePdf`, `generateRollupPdf`
- `src/lib/v3SubmitFlow.ts` — per-article save + photo upload + email orchestration

**Modify:**
- `src/types/index.ts` — re-export V3 types
- `src/components/FinalInspectionForm.tsx` — replace V2 body with V3 layout. Keep OPS lookup + email settings dialog.
- `src/components/InspectionList.tsx` — add V3 render path (uses `isV3Inspection`)
- `src/lib/firebase.ts` — no schema change, but add `saveV3Inspection`, `getV3CloudDrafts` helpers
- `src/lib/photoUploader.ts` — extend to upload per article (storage path includes articleId)

**Unchanged:**
- All existing V2 SizeInspectionPanel sub-components (`QualityChecksSection`, `PackagingSection`, `PhotosSection`, `DefectsSection`, `ResultSection`)
- `aqlCalculator.ts`, `aqlTables.ts`
- V1/V2 PDF generators in `pdfGenerator.ts` (still used for legacy resend)

---

## Task 1: V3 Types + Helpers

**Files:**
- Create: `src/types/v3.ts`
- Modify: `src/types/index.ts` (re-export)

- [ ] **Step 1:** Create `src/types/v3.ts`:

```typescript
import type { SizeInspection, Company, Defect } from './index';
import type { OpsOrder } from '../lib/firebase';

export interface ArticleAql {
  lotQty: number;
  codeLetter: string;
  effectiveCodeLetter: string;
  calculatedSampleSize: number;
  acceptNumber: number;
  rejectNumber: number;
  rejectedQty: number;
  isAutoResult: boolean;
  resultOverridden: boolean;
}

export interface ColorInspection {
  id: string;
  colorName: string;
  qty: number;
  sizes: SizeInspection[];
}

export interface ArticleInspection {
  id: string;
  articleName: string;
  inspectedQty: number;
  aql: ArticleAql;
  colors: ColorInspection[];
  submittedAt?: string;
  pdfUrl?: string;
  emailStatus?: 'pending' | 'sending' | 'sent' | 'failed';
  inspectionResult?: 'PASS' | 'FAIL';
  remarks?: string;
}

export interface InspectionV3 {
  version: 3;
  id: string;
  companyCode: 'EHI' | 'EMPL';
  documentNo: string;
  opsNo: string;
  inspectionDate: string;
  inspector: string;
  buyerCode: string;
  buyerName: string;
  poNumber: string;
  merchant: string;
  designName: string;
  totalOpsQty: number;
  articles: ArticleInspection[];
  rollupSentAt?: string;
  rollupPdfUrl?: string;
  rollupEmailStatus?: 'pending' | 'sending' | 'sent' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export function isV3Inspection(doc: any): doc is InspectionV3 {
  return doc && doc.version === 3 && Array.isArray(doc.articles);
}

export function emptyAql(lotQty = 0): ArticleAql {
  return {
    lotQty,
    codeLetter: '',
    effectiveCodeLetter: '',
    calculatedSampleSize: 0,
    acceptNumber: 0,
    rejectNumber: 0,
    rejectedQty: 0,
    isAutoResult: false,
    resultOverridden: false,
  };
}

export function buildArticleSkeletonFromOps(ops: OpsOrder): ArticleInspection[] {
  const byArticle = new Map<string, Map<string, { qty: number; sizes: string[] }>>();
  for (const item of ops.items ?? []) {
    const aName = item.articleName?.trim() || 'Unknown';
    const cName = item.color?.trim() || '—';
    const sName = item.size?.trim() || '—';
    if (!byArticle.has(aName)) byArticle.set(aName, new Map());
    const colors = byArticle.get(aName)!;
    if (!colors.has(cName)) colors.set(cName, { qty: 0, sizes: [] });
    const entry = colors.get(cName)!;
    entry.qty += item.qty ?? 0;
    if (!entry.sizes.includes(sName)) entry.sizes.push(sName);
  }
  const out: ArticleInspection[] = [];
  for (const [articleName, colors] of byArticle.entries()) {
    const totalQty = Array.from(colors.values()).reduce((s, c) => s + c.qty, 0);
    out.push({
      id: crypto.randomUUID(),
      articleName,
      inspectedQty: totalQty,
      aql: emptyAql(totalQty),
      colors: Array.from(colors.entries()).map(([colorName, info]) => ({
        id: crypto.randomUUID(),
        colorName,
        qty: info.qty,
        sizes: info.sizes.map((s) => emptySize(s)),
      })),
    });
  }
  return out;
}

import { createEmptySizeInspection } from './index';

function emptySize(sizeLabel: string): SizeInspection {
  const empty = createEmptySizeInspection();
  return { ...empty, id: crypto.randomUUID(), size: sizeLabel };
}

export function getIncompleteSizes(article: ArticleInspection): { colorName: string; size: string }[] {
  const out: { colorName: string; size: string }[] = [];
  for (const c of article.colors) {
    for (const s of c.sizes) {
      if (!s.inspectionResult) out.push({ colorName: c.colorName, size: s.size });
    }
  }
  return out;
}
```

- [ ] **Step 2:** Re-export from `src/types/index.ts` — append at end:

```typescript
export * from './v3';
```

- [ ] **Step 3:** Commit.

```bash
git add src/types/v3.ts src/types/index.ts
git commit -m "feat(v3): add V3 inspection types and OPS skeleton builder"
```

---

## Task 2: V3 Context (state + reducer)

**Files:**
- Create: `src/context/InspectionFormContextV3.tsx`

- [ ] **Step 1:** Build the context with this shape. State:

```typescript
interface V3State {
  global: GlobalFormDataV3;
  articles: ArticleInspection[];
  activeArticleId: string | null;
  activeColorIdByArticle: Record<string, string | null>;
  activeSizeIdByColor: Record<string, string | null>;
  headerExpanded: boolean;
  loading: boolean;
  // submit/upload tracking per article
  submitInFlight: Record<string, boolean>;
}

interface GlobalFormDataV3 {
  company: 'EHI' | 'EMPL';
  documentNo: string;
  inspectionDate: string;
  qcInspectorName: string;
  customerName: string;
  customerCode: string;
  customerPoNo: string;
  opsNo: string;
  buyerDesignName: string;
  emplDesignNo: string;
  merchant: string;
  totalOrderQty: string;
}
```

Actions: `SET_GLOBAL`, `SET_GLOBAL_BULK`, `INIT_FROM_OPS_DATA` (payload: articles[]), `EXPAND_ARTICLE`, `EXPAND_COLOR`, `SELECT_SIZE_TAB`, `UPDATE_SIZE` (path: {articleId, colorId, sizeId} + field + value), `UPDATE_ARTICLE_AQL`, `MARK_ARTICLE_SUBMITTED` (articleId, submittedAt, pdfUrl?, emailStatus, inspectionResult), `SET_ARTICLE_EMAIL_STATUS`, `TOGGLE_HEADER`, `RESET`.

- [ ] **Step 2:** Commit.

```bash
git add src/context/InspectionFormContextV3.tsx
git commit -m "feat(v3): add InspectionFormContextV3 with article hierarchy state"
```

---

## Task 3: V3 Shell Components

**Files:**
- Create: `src/components/v3/CollapsibleHeader.tsx`
- Create: `src/components/v3/ArticleAccordionList.tsx`
- Create: `src/components/v3/ArticleAccordion.tsx`
- Create: `src/components/v3/ArticleAqlBlock.tsx`
- Create: `src/components/v3/ColorAccordion.tsx`
- Create: `src/components/v3/SizeTabBar.tsx`

- [ ] **Step 1:** Each component reads from `useInspectionFormV3()`, dispatches navigation actions. Markup follows the spec mockup (Tailwind classes matching existing form). Inside the active color's active size tab, mount the existing `<SizeInspectionPanel />` with `size={s}` and an `onUpdate(field, value)` callback that dispatches `UPDATE_SIZE`.

- [ ] **Step 2:** `ArticleAqlBlock` wraps existing `aqlCalculator.calculateAql` to keep the same AQL Z1.4 behavior, scoped per article.

- [ ] **Step 3:** Commit.

```bash
git add src/components/v3/
git commit -m "feat(v3): add article/color/size accordion + tab shell components"
```

---

## Task 4: V3 Submit Flow + PDF

**Files:**
- Create: `src/lib/pdfGeneratorV3.ts`
- Create: `src/lib/v3SubmitFlow.ts`
- Create: `src/components/v3/SubmitArticleButton.tsx`
- Create: `src/components/v3/PendingSizesPromptModal.tsx`
- Create: `src/components/v3/SubmitOpsRollupButton.tsx`

- [ ] **Step 1:** `pdfGeneratorV3.ts` exports `generateArticlePdf(inspection, article)` and `generateRollupPdf(inspection)`. Reuses existing per-size rendering blocks from `pdfGenerator.ts` — copy and adapt rather than refactor V2 generator.

- [ ] **Step 2:** `v3SubmitFlow.ts` exports `submitArticle({ inspection, article, recipients, onProgress })`:
  1. Upsert the parent `InspectionV3` doc in Firestore (collection `final-inspections`).
  2. Upload photos for this article only (background, save-first pattern adapted from V2).
  3. Generate per-article PDF, upload to `final-inspection-reports/{docId}/{articleId}.pdf`.
  4. Send email via the existing Netlify function.
  5. Update Firestore: `articles[i].submittedAt`, `pdfUrl`, `emailStatus`.

- [ ] **Step 3:** `SubmitArticleButton` runs `getIncompleteSizes(article)`; if non-empty, opens `PendingSizesPromptModal` ("X sizes pending: list. Submit anyway?"). On confirm, calls `submitArticle()`.

- [ ] **Step 4:** `SubmitOpsRollupButton` disabled until every article has `submittedAt`. On click, runs `generateRollupPdf()` + email.

- [ ] **Step 5:** Commit.

```bash
git add src/lib/pdfGeneratorV3.ts src/lib/v3SubmitFlow.ts src/components/v3/SubmitArticleButton.tsx src/components/v3/PendingSizesPromptModal.tsx src/components/v3/SubmitOpsRollupButton.tsx
git commit -m "feat(v3): per-article submit flow + per-article and roll-up PDFs"
```

---

## Task 5: Wire V3 into FinalInspectionForm

**Files:**
- Modify: `src/components/FinalInspectionForm.tsx`

- [ ] **Step 1:** Replace V2 body. Keep:
  - Login state, top-level wrapper
  - OPS Lookup section (calls `getOpsByNumber`, then dispatches `INIT_FROM_OPS_DATA` with `buildArticleSkeletonFromOps(ops)`)
  - Cloud Drafts panel (no V3-specific changes for now — V2 drafts get the banner shown via a flag)

Replace per-size scrollable area with `<ArticleAccordionList />` + `<SubmitOpsRollupButton />`.

- [ ] **Step 2:** Swap the `<InspectionFormProvider>` wrapper for `<InspectionFormProviderV3>`.

- [ ] **Step 3:** Commit.

```bash
git add src/components/FinalInspectionForm.tsx
git commit -m "feat(v3): wire V3 article hierarchy into FinalInspectionForm"
```

---

## Task 6: InspectionList V3 Render Path

**Files:**
- Modify: `src/components/InspectionList.tsx`

- [ ] **Step 1:** Add `isV3Inspection(doc)` check before existing `isV2Inspection`. For V3 docs, render a new collapsed card showing OPS, buyer, article count, overall result, with expandable per-article rows that link to per-article PDF + resend button.

- [ ] **Step 2:** Commit.

```bash
git add src/components/InspectionList.tsx
git commit -m "feat(v3): render V3 inspection records in history list"
```

---

## Task 7: Build, smoke test, deploy

**Files:** (no source changes if all earlier tasks pass)

- [ ] **Step 1:** `npm run build` — must complete with no TypeScript errors.

- [ ] **Step 2:** `npm run dev`. Smoke test scenarios in browser:
  - Pick EHI + load OPS-25881 → see article list, AQL auto-fills per article, color sub-accordions appear, size tabs render.
  - Fill quality checks for one size, choose PASS → tab gets green ✓.
  - Click Submit Article without filling other sizes → modal lists incomplete sizes. Confirm submit → toast.
  - Repeat for all articles → Submit OPS Summary becomes enabled. Click → roll-up email.
  - Check Inspections list → V3 record appears.

- [ ] **Step 3:** `git push origin main`. Wait for Netlify deploy. Verify `em-final-inspection.netlify.app` loads V3 form.

- [ ] **Step 4:** Final commit (only if smoke surfaced fixes).

---

## Self-Review

- Spec coverage: every section of `2026-05-13-per-article-color-size-hierarchy-design.md` maps to one or more tasks above.
- Placeholder scan: types and method signatures defined in Task 1 are used consistently downstream (`ArticleInspection.id`, `ColorInspection.id`, `SizeInspection.id`).
- Scope: this is one cohesive feature, fits one plan.
- Backward compat: V1/V2 PDF + InspectionList read paths untouched; only `InspectionList.tsx` adds V3 branch.
