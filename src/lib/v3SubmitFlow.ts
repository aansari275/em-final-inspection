// V3 submit flow.
// Strategy: each article submission becomes ONE V2-shaped Firestore document in
// `final-inspections`. This way the existing, battle-tested V2 PDF generator,
// email Netlify function, and InspectionList read path all work unchanged.
//
// To group per-article submissions back together for the OPS roll-up, every
// document carries an `opsRollupGroupId` field (currently == the OPS number).
// The roll-up button queries the collection by that field and assembles a
// summary email + PDF.

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  db,
  getBuyerMerchantEmails,
  uploadPdfToStorage,
} from './firebase';
import {
  PHOTO_TYPES,
  type ArticleInspectionV3,
  type FinalInspectionV2,
  type SizeInspection,
  type SizeInspectionFormState,
} from '../types';
import { uploadPhotosInBackground, countTotalPhotos } from './photoUploader';
import { generateFinalInspectionPDF } from './pdfGenerator';
import { emailSettingsService } from './emailSettingsService';
import { stripFilesFromSizes, buildV2EmailHtml } from '../components/FinalInspectionForm';
import type { GlobalFormDataV3 } from '../context/InspectionFormContextV3';

const COLLECTION = 'final-inspections';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10_000;
const MAX_PDF_FOR_EMAIL_BYTES = 5 * 1024 * 1024;
const MAX_EMAIL_PAYLOAD_BYTES = 6 * 1024 * 1024;

export interface SubmitArticleParams {
  global: GlobalFormDataV3;
  article: ArticleInspectionV3;
  onProgress?: (msg: string) => void;
}

export interface SubmitArticleResult {
  docId: string;
  pdfUrl?: string;
  emailStatus: 'sent' | 'failed' | 'no-recipients';
}

// Flatten the article's color×size matrix into one V2 sizeInspections array.
// Each size keeps its own data; the color is prefixed onto the size label so
// it shows up clearly in the PDF and email ("Ivory · 4×6").
function flattenArticleSizes(article: ArticleInspectionV3): SizeInspectionFormState[] {
  const out: SizeInspectionFormState[] = [];
  for (const color of article.colors) {
    for (const size of color.sizes) {
      const sizeLabel = color.colorName && color.colorName !== '—'
        ? `${color.colorName} · ${size.size || '(no size)'}`
        : size.size || '(no size)';
      out.push({ ...size, size: sizeLabel });
    }
  }
  return out;
}

function buildArticleV2Doc(
  global: GlobalFormDataV3,
  article: ArticleInspectionV3,
  flatSizes: SizeInspectionFormState[],
  strippedSizes: SizeInspection[],
  photoCount: number,
  opsRollupGroupId: string
): FinalInspectionV2 & {
  opsRollupGroupId: string;
  articleName: string;
  v3SourceArticleId: string;
} {
  // Per-article result is the worst-case of its sizes; falls back to PASS if
  // no result was chosen anywhere (the inspector saw the prompt and chose to
  // submit anyway).
  const anyFail = flatSizes.some((s) => s.inspectionResult === 'FAIL');
  const inspectionResult: 'PASS' | 'FAIL' = anyFail ? 'FAIL' : 'PASS';
  const colorNames = article.colors.map((c) => c.colorName).filter(Boolean).join(' / ');

  return {
    version: 2,
    company: global.company,
    documentNo: global.documentNo,
    inspectionDate: global.inspectionDate,
    qcInspectorName: global.qcInspectorName,
    customerName: global.customerName,
    customerCode: global.customerCode,
    customerPoNo: global.customerPoNo,
    opsNo: global.opsNo,
    opsNumber: global.opsNo,
    buyerDesignName: global.buyerDesignName,
    emplDesignNo: global.emplDesignNo,
    colorName: colorNames,
    merchant: global.merchant,
    totalOrderQty: Number(global.totalOrderQty) || 0,
    inspectedLotQty: article.aql.lotQty || article.inspectedQty,
    aql: '2.5',
    sampleSize: article.aql.calculatedSampleSize || 0,
    acceptedQty: Math.max(0, (article.aql.lotQty || 0) - (article.aql.rejectedQty || 0)),
    rejectedQty: article.aql.rejectedQty || 0,
    inspectionLevel: 'II',
    codeLetter: article.aql.codeLetter || undefined,
    calculatedSampleSize: article.aql.calculatedSampleSize || undefined,
    acceptNumber: article.aql.acceptNumber ?? undefined,
    rejectNumber: article.aql.rejectNumber ?? undefined,
    effectiveCodeLetter: article.aql.effectiveCodeLetter || undefined,
    isAutoResult: article.aql.isAutoResult,
    resultOverridden: article.aql.resultOverridden,
    inspectedArticles: [
      {
        articleName: article.articleName,
        size: '',
        color: colorNames,
        quality: '',
        pcs: article.inspectedQty,
        sqm: 0,
        inspectedQty: article.inspectedQty,
      },
    ],
    sizeInspections: strippedSizes,
    productSizes: flatSizes.map((s) => s.size).join(', '),
    sizeUnit: flatSizes[0]?.sizeUnit || 'cm',
    inspectionResult,
    photoUploadStatus: photoCount > 0 ? 'pending' : 'complete',
    totalPhotoCount: photoCount,
    uploadedPhotoCount: 0,
    emailStatus: 'pending',
    createdAt: new Date().toISOString(),
    opsRollupGroupId,
    articleName: article.articleName,
    v3SourceArticleId: article.id,
  };
}

export async function submitArticleV3(
  params: SubmitArticleParams
): Promise<SubmitArticleResult> {
  const { global, article, onProgress } = params;
  const flatSizes = flattenArticleSizes(article);
  const strippedSizes = stripFilesFromSizes(flatSizes);
  const photoCount = countTotalPhotos(flatSizes);

  onProgress?.('Saving article inspection…');

  const v2Doc = buildArticleV2Doc(
    global,
    article,
    flatSizes,
    strippedSizes,
    photoCount,
    global.opsNo
  );
  const cleanDoc = JSON.parse(JSON.stringify(v2Doc));

  const docRef = await addDoc(collection(db, COLLECTION), cleanDoc);
  const docId = docRef.id;

  // ─── Background pipeline: upload photos → generate PDF → send email ───
  // Don't await this — the caller can return immediately. We chain promises
  // and update Firestore + emailStatus as we go.
  let emailOutcome: 'sent' | 'failed' | 'no-recipients' = 'failed';
  try {
    if (photoCount > 0) {
      onProgress?.(`Uploading ${photoCount} photo${photoCount === 1 ? '' : 's'}…`);
      await uploadPhotosInBackground(
        docId,
        flatSizes,
        (msg: string) => onProgress?.(msg),
        () => {}
      );
    }

    const recipients = await emailSettingsService.getRecipients();
    let merchantEmails: { primary?: string; assistant?: string } = {};
    try {
      merchantEmails = await getBuyerMerchantEmails(v2Doc.customerCode);
    } catch (e) {
      console.warn('[V3 submit] merchant email lookup failed', e);
    }

    const allRecipients = [...recipients];
    if (merchantEmails.primary && !allRecipients.includes(merchantEmails.primary)) {
      allRecipients.push(merchantEmails.primary);
    }
    if (merchantEmails.assistant && !allRecipients.includes(merchantEmails.assistant)) {
      allRecipients.push(merchantEmails.assistant);
    }

    if (allRecipients.length === 0) {
      emailOutcome = 'no-recipients';
    } else {
      // Re-read the document so we get the photo URLs that finished uploading.
      onProgress?.('Generating PDF…');
      await updateDoc(doc(db, COLLECTION, docId), { emailStatus: 'sending' });
      const snap = await getDoc(doc(db, COLLECTION, docId));
      const upToDate = snap.exists()
        ? ({ ...(snap.data() as FinalInspectionV2), ...v2Doc, ...(snap.data() as FinalInspectionV2) })
        : v2Doc;

      const pdfBase64 = await generateFinalInspectionPDF(upToDate as any, (msg) =>
        onProgress?.(msg)
      );

      // Persist the PDF to Storage so the OPS roll-up can link to it.
      const pdfFilename = `Final_Inspection_${global.opsNo}_${article.articleName}_${global.inspectionDate}.pdf`.replace(/\s+/g, '_');
      let pdfStorageUrl: string | undefined;
      try {
        pdfStorageUrl = await uploadPdfToStorage(pdfBase64, pdfFilename);
      } catch (e) {
        console.warn('[V3 submit] PDF storage upload failed (continuing without download link)', e);
      }

      const html = buildV2EmailHtml(upToDate as FinalInspectionV2);
      const subjectArticle = article.articleName ? ` / ${article.articleName}` : '';
      const subject = `Final Inspection: ${v2Doc.customerCode}${
        v2Doc.opsNo ? ` / ${v2Doc.opsNo}` : ''
      }${subjectArticle} - ${v2Doc.buyerDesignName} [${v2Doc.inspectionResult}]`;

      const pdfSizeBytes = pdfBase64 ? Math.round(pdfBase64.length * 0.75) : 0;
      const tooLargeForAttachment = pdfSizeBytes > MAX_PDF_FOR_EMAIL_BYTES;
      let emailPdfBase64: string | null = tooLargeForAttachment ? null : pdfBase64;

      let payload = JSON.stringify({
        to: allRecipients,
        subject,
        html,
        pdfBase64: emailPdfBase64,
        pdfFilename: emailPdfBase64 ? pdfFilename : null,
        downloadUrl: pdfStorageUrl,
      });
      if (payload.length > MAX_EMAIL_PAYLOAD_BYTES) {
        emailPdfBase64 = null;
        payload = JSON.stringify({
          to: allRecipients,
          subject,
          html,
          pdfBase64: null,
          pdfFilename: null,
          downloadUrl: pdfStorageUrl,
        });
      }

      onProgress?.('Sending email…');
      let sent = false;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          });
          if (!res.ok) throw new Error(`send-email returned ${res.status}`);
          sent = true;
          break;
        } catch (err) {
          console.warn(`[V3 submit] email attempt ${attempt}/${MAX_RETRIES} failed`, err);
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }

      emailOutcome = sent ? 'sent' : 'failed';
      await updateDoc(doc(db, COLLECTION, docId), {
        emailStatus: emailOutcome,
        ...(pdfStorageUrl ? { pdfUrl: pdfStorageUrl } : {}),
      }).catch((e) => console.warn('[V3 submit] update emailStatus failed', e));

      return { docId, pdfUrl: pdfStorageUrl, emailStatus: emailOutcome };
    }

    await updateDoc(doc(db, COLLECTION, docId), { emailStatus: 'sent' }).catch(() => {});
    return { docId, emailStatus: emailOutcome };
  } catch (e) {
    console.error('[V3 submit] pipeline failed', e);
    await updateDoc(doc(db, COLLECTION, docId), { emailStatus: 'failed' }).catch(() => {});
    return { docId, emailStatus: 'failed' };
  }
}

// ─── OPS Roll-up ───
// Queries all per-article docs for this OPS, builds a summary HTML email +
// summary PDF, and sends it. Reuses the same Netlify send-email function.

export interface SubmitRollupResult {
  status: 'sent' | 'failed' | 'no-recipients' | 'no-articles';
  articleCount: number;
}

export async function submitOpsRollupV3(opsNo: string): Promise<SubmitRollupResult> {
  if (!opsNo) return { status: 'no-articles', articleCount: 0 };

  const q = query(collection(db, COLLECTION), where('opsRollupGroupId', '==', opsNo));
  const snap = await getDocs(q);
  if (snap.empty) return { status: 'no-articles', articleCount: 0 };

  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as FinalInspectionV2 & { articleName?: string; pdfUrl?: string }) }));
  const articleCount = docs.length;

  const recipients = await emailSettingsService.getRecipients();
  let merchantEmails: { primary?: string; assistant?: string } = {};
  try {
    merchantEmails = await getBuyerMerchantEmails(docs[0]?.customerCode || '');
  } catch (e) {
    console.warn('[V3 rollup] merchant lookup failed', e);
  }
  const allRecipients = [...recipients];
  if (merchantEmails.primary && !allRecipients.includes(merchantEmails.primary))
    allRecipients.push(merchantEmails.primary);
  if (merchantEmails.assistant && !allRecipients.includes(merchantEmails.assistant))
    allRecipients.push(merchantEmails.assistant);

  if (allRecipients.length === 0) {
    return { status: 'no-recipients', articleCount };
  }

  const head = docs[0];
  const anyFail = docs.some((d) => d.inspectionResult === 'FAIL');
  const overall: 'PASS' | 'FAIL' = anyFail ? 'FAIL' : 'PASS';

  const subject = `Final Inspection SUMMARY: ${head.customerCode} / ${opsNo} - ${head.buyerDesignName} [${overall}]`;

  const html = buildRollupHtml({
    opsNo,
    buyerCode: head.customerCode,
    buyerName: head.customerName,
    poNumber: head.customerPoNo,
    designName: head.buyerDesignName,
    company: head.company,
    inspectionDate: head.inspectionDate,
    inspector: head.qcInspectorName,
    merchant: head.merchant,
    overall,
    articles: docs.map((d) => ({
      name: d.articleName || d.inspectedArticles?.[0]?.articleName || '(unnamed)',
      color: d.colorName,
      qty: d.inspectedLotQty,
      sample: d.calculatedSampleSize ?? d.sampleSize,
      rejected: d.rejectedQty,
      result: d.inspectionResult,
      pdfUrl: d.pdfUrl,
      sizes: d.productSizes,
    })),
  });

  const payload = JSON.stringify({
    to: allRecipients,
    subject,
    html,
    pdfBase64: null,
    pdfFilename: null,
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (!res.ok) throw new Error(`send-email returned ${res.status}`);
      return { status: 'sent', articleCount };
    } catch (err) {
      console.warn(`[V3 rollup] email attempt ${attempt}/${MAX_RETRIES} failed`, err);
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  return { status: 'failed', articleCount };
}

interface RollupRow {
  name: string;
  color?: string;
  qty: number;
  sample: number;
  rejected: number;
  result: 'PASS' | 'FAIL';
  pdfUrl?: string;
  sizes?: string;
}

function buildRollupHtml(input: {
  opsNo: string;
  buyerCode: string;
  buyerName: string;
  poNumber: string;
  designName: string;
  company: string;
  inspectionDate: string;
  inspector: string;
  merchant: string;
  overall: 'PASS' | 'FAIL';
  articles: RollupRow[];
}): string {
  const ok = '#16a34a';
  const bad = '#dc2626';
  const okBg = '#dcfce7';
  const badBg = '#fee2e2';

  const articleRows = input.articles
    .map((a) => {
      const c = a.result === 'PASS' ? ok : bad;
      const bg = a.result === 'PASS' ? okBg : badBg;
      const pdfLink = a.pdfUrl
        ? `<a href="${a.pdfUrl}" style="color:#059669;text-decoration:underline;">Download PDF</a>`
        : '<span style="color:#9ca3af;">(no PDF link)</span>';
      return `
        <tr>
          <td style="border:1px solid #d1d5db;padding:8px 12px;font-size:13px;">${a.name}</td>
          <td style="border:1px solid #d1d5db;padding:8px 12px;font-size:13px;color:#6b7280;">${a.color || '-'}</td>
          <td style="border:1px solid #d1d5db;padding:8px 12px;font-size:13px;color:#6b7280;">${a.sizes || '-'}</td>
          <td style="border:1px solid #d1d5db;padding:8px 12px;font-size:13px;text-align:right;">${a.qty}</td>
          <td style="border:1px solid #d1d5db;padding:8px 12px;font-size:13px;text-align:right;">${a.sample}</td>
          <td style="border:1px solid #d1d5db;padding:8px 12px;font-size:13px;text-align:right;">${a.rejected}</td>
          <td style="border:1px solid #d1d5db;padding:8px 12px;font-size:13px;text-align:center;background-color:${bg};color:${c};font-weight:bold;">${a.result}</td>
          <td style="border:1px solid #d1d5db;padding:8px 12px;font-size:13px;">${pdfLink}</td>
        </tr>`;
    })
    .join('');

  const overallColor = input.overall === 'PASS' ? ok : bad;
  const overallBg = input.overall === 'PASS' ? okBg : badBg;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 16px;">
      <h1 style="color: #059669; margin-bottom: 4px;">Final Inspection — OPS Summary</h1>
      <p style="color: #6b7280; margin-top: 0;">Roll-up report for all articles in this OPS.</p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f9fafb;"><b>OPS</b></td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px;">${input.opsNo}</td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f9fafb;"><b>Buyer</b></td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px;">${input.buyerName} (${input.buyerCode})</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f9fafb;"><b>PO</b></td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px;">${input.poNumber}</td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f9fafb;"><b>Design</b></td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px;">${input.designName}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f9fafb;"><b>Date</b></td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px;">${input.inspectionDate}</td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f9fafb;"><b>Inspector</b></td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px;">${input.inspector}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f9fafb;"><b>Company</b></td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px;">${input.company}</td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f9fafb;"><b>Merchant</b></td>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px;">${input.merchant}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #f9fafb;"><b>Overall Result</b></td>
          <td colspan="3" style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: ${overallBg}; color: ${overallColor}; font-weight: bold; font-size: 16px;">${input.overall}</td>
        </tr>
      </table>

      <h2 style="color: #059669; margin-top: 28px;">Articles (${input.articles.length})</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <th style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #059669; color: white; text-align: left;">Article</th>
          <th style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #059669; color: white; text-align: left;">Color</th>
          <th style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #059669; color: white; text-align: left;">Sizes</th>
          <th style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #059669; color: white; text-align: right;">Qty</th>
          <th style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #059669; color: white; text-align: right;">Sample</th>
          <th style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #059669; color: white; text-align: right;">Rejected</th>
          <th style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #059669; color: white; text-align: center;">Result</th>
          <th style="border: 1px solid #d1d5db; padding: 8px 12px; background-color: #059669; color: white; text-align: left;">PDF</th>
        </tr>
        ${articleRows}
      </table>

      <p style="margin-top: 28px; color: #6b7280; font-size: 12px;">
        ${PHOTO_TYPES.length ? '' : ''}Generated by Eastern Mills Final Inspection · V3 hierarchy
      </p>
    </div>
  `;
}
