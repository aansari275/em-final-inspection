import { createEmptySizeInspection } from './index';
import type { SizeInspectionFormState } from './index';
import type { OpsOrder } from '../lib/firebase';

// ─── V3: Per-Article × Color × Size hierarchy ───
// Designed 2026-05-13. Replaces V2 flat per-size form on write path.
// V1/V2 records remain readable via existing PDF/InspectionList code.

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

export interface ColorInspectionV3 {
  id: string;
  colorName: string;
  qty: number;
  sizes: SizeInspectionFormState[];
}

export interface ArticleInspectionV3 {
  id: string;
  articleName: string;
  inspectedQty: number;
  aql: ArticleAql;
  colors: ColorInspectionV3[];
  submittedAt?: string;
  pdfUrl?: string;
  emailStatus?: 'pending' | 'sending' | 'sent' | 'failed';
  inspectionResult?: 'PASS' | 'FAIL';
  remarks?: string;
}

export interface InspectionV3Document {
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
  articles: ArticleInspectionV3[];
  rollupSentAt?: string;
  rollupPdfUrl?: string;
  rollupEmailStatus?: 'pending' | 'sending' | 'sent' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export function isV3Inspection(doc: unknown): doc is InspectionV3Document {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as { version?: number; articles?: unknown };
  return d.version === 3 && Array.isArray(d.articles);
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

// Build the article/color/size skeleton from an OPS order's items.
// Groups by articleName, then by color, collecting all unique sizes per color.
export function buildArticleSkeletonFromOps(ops: OpsOrder): ArticleInspectionV3[] {
  type ColorBucket = { qty: number; sizes: Set<string> };
  const byArticle = new Map<string, Map<string, ColorBucket>>();

  for (const item of ops.items ?? []) {
    const aName = (item.articleName ?? '').trim() || 'Unknown';
    const cName = (item.color ?? '').trim() || '—';
    const sName = (item.size ?? '').trim() || '—';

    if (!byArticle.has(aName)) byArticle.set(aName, new Map());
    const colors = byArticle.get(aName)!;
    if (!colors.has(cName)) colors.set(cName, { qty: 0, sizes: new Set() });
    const bucket = colors.get(cName)!;
    bucket.qty += item.pcs ?? 0;
    bucket.sizes.add(sName);
  }

  const out: ArticleInspectionV3[] = [];
  for (const [articleName, colorMap] of byArticle.entries()) {
    const totalQty = Array.from(colorMap.values()).reduce((s, c) => s + c.qty, 0);
    out.push({
      id: crypto.randomUUID(),
      articleName,
      inspectedQty: totalQty,
      aql: emptyAql(totalQty),
      colors: Array.from(colorMap.entries()).map(([colorName, info]) => ({
        id: crypto.randomUUID(),
        colorName,
        qty: info.qty,
        sizes: Array.from(info.sizes).map((s) => sizeWithLabel(s)),
      })),
    });
  }
  return out;
}

function sizeWithLabel(sizeLabel: string): SizeInspectionFormState {
  const empty = createEmptySizeInspection();
  // Heuristic: contains 'x' and digits → use as label
  return { ...empty, id: crypto.randomUUID(), size: sizeLabel || '' };
}

// Returns sizes within an article that have no PASS/FAIL chosen.
export function getIncompleteSizes(
  article: ArticleInspectionV3
): Array<{ colorName: string; size: string }> {
  const out: Array<{ colorName: string; size: string }> = [];
  for (const c of article.colors) {
    for (const s of c.sizes) {
      if (!s.inspectionResult || (s.inspectionResult as string) === '') {
        out.push({ colorName: c.colorName, size: s.size || '(unset size)' });
      }
    }
  }
  return out;
}

// Result rollup for an article: FAIL if any size FAILed, PASS if all PASS, undefined if any unset.
export function computeArticleResult(article: ArticleInspectionV3): 'PASS' | 'FAIL' | undefined {
  let anyFail = false;
  let anyUnset = false;
  for (const c of article.colors) {
    for (const s of c.sizes) {
      if (!s.inspectionResult) anyUnset = true;
      else if (s.inspectionResult === 'FAIL') anyFail = true;
    }
  }
  if (anyFail) return 'FAIL';
  if (anyUnset) return undefined;
  return 'PASS';
}

export function computeOpsResult(articles: ArticleInspectionV3[]): 'PASS' | 'FAIL' | undefined {
  let anyFail = false;
  let anyUnset = false;
  for (const a of articles) {
    const r = computeArticleResult(a);
    if (r === undefined) anyUnset = true;
    else if (r === 'FAIL') anyFail = true;
  }
  if (anyFail) return 'FAIL';
  if (anyUnset) return undefined;
  return 'PASS';
}
