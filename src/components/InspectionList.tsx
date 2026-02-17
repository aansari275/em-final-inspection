import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, getBuyerMerchantEmails, uploadPdfToStorage } from '../lib/firebase';
import { FinalInspection, COMPANY_NAMES, Company, Defect } from '../types';
import { generateFinalInspectionPDF } from '../lib/pdfGenerator';
import { emailSettingsService } from '../lib/emailSettingsService';
import { Trash2, Eye, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Download, Mail, FileText } from 'lucide-react';

// Helper component for OK/NOT OK status badges
const StatusBadge = ({ status }: { status: 'OK' | 'NOT OK' | string }) => (
  <span className={`font-medium ${status === 'OK' ? 'text-green-600' : 'text-red-600'}`}>
    {status}
  </span>
);

export function InspectionList() {
  const [inspections, setInspections] = useState<(FinalInspection & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [previewInspection, setPreviewInspection] = useState<(FinalInspection & { id: string }) | null>(null);

  useEffect(() => {
    fetchInspections();
  }, []);

  const fetchInspections = async () => {
    try {
      const q = query(
        collection(db, 'final-inspections'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (FinalInspection & { id: string })[];
      setInspections(data);
    } catch (error) {
      console.error('Error fetching inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inspection?')) return;

    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'final-inspections', id));
      setInspections(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error deleting inspection:', error);
      alert('Failed to delete inspection');
    } finally {
      setDeleting(null);
    }
  };

  const handleDownloadPdf = async (inspection: FinalInspection & { id: string }) => {
    setGeneratingPdf(inspection.id);
    try {
      const pdfBase64 = await generateFinalInspectionPDF(inspection);
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfBase64}`;
      link.download = `Final_Inspection_${inspection.customerName}_${inspection.inspectionDate}.pdf`;
      link.click();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleResendEmail = async (inspection: FinalInspection & { id: string }) => {
    setSendingEmail(inspection.id);
    try {
      // Get configured recipients from Firestore
      const baseRecipients = await emailSettingsService.getRecipients();

      // Auto-add merchant emails linked with buyer code
      const merchantEmails = await getBuyerMerchantEmails(inspection.customerCode);
      const allRecipients = [...baseRecipients];
      if (merchantEmails.primary && !allRecipients.includes(merchantEmails.primary)) {
        allRecipients.push(merchantEmails.primary);
      }
      if (merchantEmails.assistant && !allRecipients.includes(merchantEmails.assistant)) {
        allRecipients.push(merchantEmails.assistant);
      }

      if (allRecipients.length === 0) {
        alert('No email recipients found. Configure recipients in Settings or link merchants to the buyer.');
        setSendingEmail(null);
        return;
      }

      // Generate PDF
      const pdfBase64 = await generateFinalInspectionPDF(inspection);
      const pdfFilename = `Final_Inspection_${inspection.customerCode}_${inspection.inspectionDate}.pdf`;

      // Upload PDF to Firebase Storage
      const pdfUrl = await uploadPdfToStorage(pdfBase64, pdfFilename);

      const resultColor = inspection.inspectionResult === 'PASS' ? '#22c55e' : '#ef4444';
      const resultBg = inspection.inspectionResult === 'PASS' ? '#dcfce7' : '#fee2e2';
      const companyFullName = COMPANY_NAMES[inspection.company as Company] || 'Eastern Mills';

      // Helper for OK/NOT OK/NA status styling in email
      const statusStyle = (val: string) => {
        if (val === 'OK') return 'color: #16a34a; font-weight: bold;';
        if (val === 'NOT OK') return 'color: #dc2626; font-weight: bold;';
        return 'color: #9ca3af;';
      };
      const statusLabel = (val: string) => val || 'NA';

      // Table styling
      const tblBorder = 'border: 1px solid #d1d5db;';
      const cellPad = 'padding: 8px 12px;';
      const hdrCell = `${tblBorder} ${cellPad} background-color: #059669; color: white; font-weight: bold; font-size: 13px;`;
      const lblCell = `${tblBorder} ${cellPad} color: #374151; font-size: 13px; background-color: #f9fafb;`;
      const valCell = `${tblBorder} ${cellPad} color: #111827; font-size: 13px;`;
      const secHdr = (t: string) => `<table style="width:100%;border-collapse:collapse;margin-top:20px;"><tr><td style="${hdrCell} text-align:center;font-size:14px;letter-spacing:0.5px;">${t}</td></tr></table>`;

      // Quality checks
      const qualityChecks = [
        { label: 'Approved Sample Available', value: inspection.approvedSampleAvailable || '-' },
        { label: 'Material/Fibre Content', value: inspection.materialFibreContent || '-' },
        { label: 'Motif/Design Check', value: inspection.motifDesignCheck, s: true },
        { label: 'Backing', value: inspection.backing, s: true, note: inspection.backingNotes },
        { label: 'Binding & Edges', value: inspection.bindingAndEdges, s: true },
        { label: 'Hand Feel', value: inspection.handFeel, s: true },
        { label: 'Embossing/Carving', value: inspection.embossingCarving, s: true },
        { label: 'Workmanship', value: inspection.workmanship, s: true },
        { label: 'Product Quality Weight', value: inspection.productQualityWeight, s: true },
      ];

      const measurements = [
        { label: 'Tuft Density', value: inspection.tuftDensity },
        { label: 'Pile Height', value: inspection.pileHeight },
        { label: 'Product Weight', value: inspection.productWeight },
        { label: 'Size Tolerance', value: inspection.sizeTolerance },
        { label: 'Finishing %', value: inspection.finishingPercent },
        { label: 'Packed %', value: inspection.packedPercent },
      ].filter(r => r.value);

      const labelChecks = [
        { label: 'Label Placement', value: inspection.labelPlacement },
        { label: 'Side Marking', value: inspection.sideMarking },
        { label: 'Outer Marking', value: inspection.outerMarking },
        { label: 'Inner Pack', value: inspection.innerPack },
        { label: 'Care Labels', value: inspection.careLabels },
        { label: 'SKU Stickers', value: inspection.skuStickers },
        { label: 'UPC Barcodes', value: inspection.upcBarcodes },
        { label: 'Product Label', value: inspection.productLabel },
        { label: 'Carton Label', value: inspection.cartonLabel },
        { label: 'Barcode Scan', value: inspection.barcodeScan },
      ];

      const pkgRows = [
        { label: 'Carton Ply', value: inspection.cartonPly },
        { label: 'Carton Drop Test', value: inspection.cartonDropTest, s: true },
        { label: 'Packing Type', value: inspection.packingType },
        { label: 'Gross Weight', value: inspection.grossWeight },
        { label: 'Net Weight', value: inspection.netWeight },
        { label: 'Carton/Bale Numbering', value: inspection.cartonBaleNumbering, s: true },
        { label: 'Carton Dimension', value: inspection.cartonDimension, s: true },
        { label: 'Pcs per Carton/Bale', value: inspection.pcsPerCartonBale },
        { label: 'Pcs per Polybag', value: inspection.pcsPerPolybag },
        { label: 'Carton (L x W x H)', value: [inspection.cartonMeasurementL, inspection.cartonMeasurementW, inspection.cartonMeasurementH].filter(Boolean).join(' x ') || '' },
      ];

      const hasDefects = inspection.defects && inspection.defects.length > 0 && inspection.defects.some((d: Defect) => d.defectCode);

      // Collect photos
      const allPhotos = [
        { url: inspection.approvedSamplePhoto, label: 'Approved Sample' },
        { url: inspection.redSealFrontPhoto, label: 'Red Seal - Front' },
        { url: inspection.redSealBackPhoto, label: 'Red Seal - Back' },
        { url: inspection.redSealCloseUpPhoto, label: 'Close-up with Red Seal' },
        { url: inspection.redSealProductFront, label: 'Front with Red Seal' },
        { url: inspection.redSealProductBack, label: 'Back with Red Seal' },
        { url: inspection.labelPhoto, label: 'Label' },
        { url: inspection.moisturePhoto, label: 'Moisture Meter' },
        { url: inspection.sizeFrontPhoto, label: 'Size Front' },
        { url: inspection.sizeSidePhoto, label: 'Size Side' },
        { url: inspection.inspectedSamplesPhoto, label: 'Inspected Samples' },
        { url: inspection.metalCheckingPhoto, label: 'Metal Checking' },
        ...(inspection.stackedGoodsPhoto ? [{ url: inspection.stackedGoodsPhoto, label: 'Stacked Goods' }] : []),
        ...(inspection.consumerPieces || []).map((p: { label: string; url: string }) => ({ url: p.url, label: p.label })),
        ...(inspection.unitLoadPhotos || []).map((p: { label: string; url: string }) => ({ url: p.url, label: p.label })),
        ...(inspection.constructionPhotos?.warpPer10cm ? [{ url: inspection.constructionPhotos.warpPer10cm, label: 'Warp per 10 cms' }] : []),
        ...(inspection.constructionPhotos?.weftPer10cm ? [{ url: inspection.constructionPhotos.weftPer10cm, label: 'Weft per 10 cms' }] : []),
        ...(inspection.constructionPhotos?.pileHeightPhoto ? [{ url: inspection.constructionPhotos.pileHeightPhoto, label: 'Pile Height' }] : []),
        ...(inspection.constructionPhotos?.productNetWeightPhoto ? [{ url: inspection.constructionPhotos.productNetWeightPhoto, label: 'Product Net Weight' }] : []),
        ...(inspection.constructionPhotos?.productGrossWeightPhoto ? [{ url: inspection.constructionPhotos.productGrossWeightPhoto, label: 'Product Gross Weight' }] : []),
        ...(inspection.otherPhotos || []).map((url: string, i: number) => ({ url, label: `Other ${i + 1}` })),
      ].filter(p => p.url);

      // Email with rich content + download link
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background: #ffffff;">
          <!-- Header -->
          <table style="width: 100%; border-collapse: collapse; background: #059669;">
            <tr>
              <td style="padding: 24px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 22px; letter-spacing: 1px;">${companyFullName}</h1>
                <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Final Inspection Report</p>
              </td>
            </tr>
          </table>

          <!-- PASS/FAIL Banner -->
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="background: ${resultBg}; padding: 18px; text-align: center; border-bottom: 4px solid ${resultColor};">
                <span style="color: ${resultColor}; font-size: 28px; font-weight: bold; letter-spacing: 2px;">
                  ${inspection.inspectionResult === 'PASS' ? '&#10003; PASSED' : '&#10007; FAILED'}
                </span>
                ${inspection.resultOverridden ? '<br><span style="color: #d97706; font-size: 12px; font-style: italic;">Inspector Override Applied</span>' : ''}
              </td>
            </tr>
          </table>

          <div style="padding: 20px;">
            <!-- Order Information -->
            ${secHdr('ORDER INFORMATION')}
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="${lblCell} width: 35%;">Inspection Date</td>
                <td style="${valCell}">${inspection.inspectionDate}</td>
                <td style="${lblCell} width: 15%;">Doc No.</td>
                <td style="${valCell}">${inspection.documentNo}</td>
              </tr>
              <tr>
                <td style="${lblCell}">QC Inspector</td>
                <td style="${valCell}">${inspection.qcInspectorName}</td>
                <td style="${lblCell}">Merchant</td>
                <td style="${valCell}">${inspection.merchant}</td>
              </tr>
              <tr>
                <td style="${lblCell}">Customer</td>
                <td style="${valCell}" colspan="3"><strong>${inspection.customerName}</strong> (${inspection.customerCode})</td>
              </tr>
              <tr>
                <td style="${lblCell}">Customer PO</td>
                <td style="${valCell}">${inspection.customerPoNo}</td>
                <td style="${lblCell}">OPS No.</td>
                <td style="${valCell}"><strong>${inspection.opsNo}</strong></td>
              </tr>
              <tr>
                <td style="${lblCell}">Buyer Design</td>
                <td style="${valCell}">${inspection.buyerDesignName}</td>
                <td style="${lblCell}">EMPL Design</td>
                <td style="${valCell}">${inspection.emplDesignNo}</td>
              </tr>
              <tr>
                <td style="${lblCell}">Color</td>
                <td style="${valCell}">${inspection.colorName}</td>
                <td style="${lblCell}">Sizes</td>
                <td style="${valCell}">${inspection.productSizes}</td>
              </tr>
            </table>

            <!-- Inspected Articles -->
            ${inspection.inspectedArticles && inspection.inspectedArticles.length > 0 ? `
            ${secHdr('INSPECTED ARTICLES')}
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="${hdrCell}">Article</td>
                <td style="${hdrCell}">Size</td>
                <td style="${hdrCell}">Color</td>
                <td style="${hdrCell} text-align: right;">Total Pcs</td>
                <td style="${hdrCell} text-align: right;">Inspected</td>
              </tr>
              ${inspection.inspectedArticles.map((a: { articleName?: string; size?: string; color?: string; pcs?: number; inspectedQty?: number }) => `
              <tr>
                <td style="${valCell}">${a.articleName || '-'}</td>
                <td style="${valCell}">${a.size || '-'}</td>
                <td style="${valCell}">${a.color || '-'}</td>
                <td style="${valCell} text-align: right;">${a.pcs || 0}</td>
                <td style="${valCell} text-align: right; font-weight: bold; color: #059669;">${a.inspectedQty || a.pcs || 0}</td>
              </tr>
              `).join('')}
              <tr style="font-weight: bold;">
                <td colspan="3" style="${lblCell}">Total</td>
                <td style="${lblCell} text-align: right;">${inspection.inspectedArticles.reduce((s: number, a: { pcs?: number }) => s + (a.pcs || 0), 0)}</td>
                <td style="${lblCell} text-align: right; color: #059669;">${inspection.inspectedArticles.reduce((s: number, a: { inspectedQty?: number; pcs?: number }) => s + (a.inspectedQty || a.pcs || 0), 0)}</td>
              </tr>
            </table>
            ` : ''}

            <!-- AQL & Quantities -->
            ${secHdr('AQL SAMPLING & QUANTITIES')}
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="${lblCell} width: 35%;">Total Order Qty</td>
                <td style="${valCell}">${inspection.totalOrderQty}</td>
                <td style="${lblCell} width: 15%;">Inspected Lot</td>
                <td style="${valCell}">${inspection.inspectedLotQty}</td>
              </tr>
              <tr>
                <td style="${lblCell}">AQL Level</td>
                <td style="${valCell}">${inspection.aql}</td>
                <td style="${lblCell}">Sample Size</td>
                <td style="${valCell}"><strong>${inspection.sampleSize}</strong></td>
              </tr>
              ${inspection.codeLetter ? `
              <tr>
                <td style="${lblCell}">Code Letter</td>
                <td style="${valCell}"><strong>${inspection.codeLetter}</strong>${inspection.effectiveCodeLetter && inspection.effectiveCodeLetter !== inspection.codeLetter ? ` &#8594; ${inspection.effectiveCodeLetter}` : ''}</td>
                <td style="${lblCell}">Standard</td>
                <td style="${valCell}">Z1.4-2008 Level II</td>
              </tr>
              ` : ''}
              <tr>
                <td style="${lblCell}">Accept &#8804;</td>
                <td style="${valCell}"><span style="color: #16a34a; font-weight: bold; font-size: 16px;">${inspection.acceptNumber ?? inspection.acceptedQty}</span></td>
                <td style="${lblCell}">Reject &#8805;</td>
                <td style="${valCell}"><span style="color: #dc2626; font-weight: bold; font-size: 16px;">${inspection.rejectNumber ?? '-'}</span></td>
              </tr>
              <tr>
                <td style="${lblCell}">Accepted Qty</td>
                <td style="${valCell} color: #16a34a; font-weight: bold;">${inspection.acceptedQty}</td>
                <td style="${lblCell}">Rejected Qty</td>
                <td style="${valCell} color: #dc2626; font-weight: bold;">${inspection.rejectedQty}</td>
              </tr>
            </table>

            <!-- Product Quality Checks -->
            ${secHdr('PRODUCT QUALITY CHECKS')}
            <table style="width: 100%; border-collapse: collapse;">
              ${qualityChecks.map(qc => `
              <tr>
                <td style="${lblCell} width: 50%;">${qc.label}</td>
                <td style="${valCell}${qc.s ? ' ' + statusStyle(qc.value as string) : ''}">${qc.s ? statusLabel(qc.value as string) : (qc.value || '-')}${qc.note ? ` <span style="color: #6b7280; font-weight: normal; font-size: 12px;">(${qc.note})</span>` : ''}</td>
              </tr>
              `).join('')}
            </table>

            <!-- Measurement Details -->
            ${measurements.length > 0 ? `
            ${secHdr('MEASUREMENT DETAILS')}
            <table style="width: 100%; border-collapse: collapse;">
              ${measurements.map((m, i) => {
                if (i % 2 === 0) {
                  const next = measurements[i + 1];
                  return `<tr>
                    <td style="${lblCell} width: 25%;">${m.label}</td>
                    <td style="${valCell} width: 25%;"><strong>${m.value}</strong></td>
                    ${next ? `<td style="${lblCell} width: 25%;">${next.label}</td><td style="${valCell} width: 25%;"><strong>${next.value}</strong></td>` : `<td style="${lblCell} width: 25%;"></td><td style="${valCell} width: 25%;"></td>`}
                  </tr>`;
                }
                return '';
              }).join('')}
            </table>
            ` : ''}

            <!-- Labeling & Marking -->
            ${secHdr('LABELING & MARKING')}
            <table style="width: 100%; border-collapse: collapse;">
              ${labelChecks.map((lc, i) => {
                if (i % 2 === 0) {
                  const next = labelChecks[i + 1];
                  return `<tr>
                    <td style="${lblCell} width: 25%;">${lc.label}</td>
                    <td style="${valCell} width: 25%; ${statusStyle(lc.value as string)}">${statusLabel(lc.value as string)}</td>
                    ${next ? `<td style="${lblCell} width: 25%;">${next.label}</td><td style="${valCell} width: 25%; ${statusStyle(next.value as string)}">${statusLabel(next.value as string)}</td>` : `<td style="${lblCell} width: 25%;"></td><td style="${valCell} width: 25%;"></td>`}
                  </tr>`;
                }
                return '';
              }).join('')}
            </table>

            <!-- Packaging -->
            ${secHdr('PACKAGING')}
            <table style="width: 100%; border-collapse: collapse;">
              ${pkgRows.filter(r => r.value).map((pr, i, arr) => {
                if (i % 2 === 0) {
                  const next = arr[i + 1];
                  return `<tr>
                    <td style="${lblCell} width: 25%;">${pr.label}</td>
                    <td style="${valCell} width: 25%;${pr.s ? ' ' + statusStyle(pr.value as string) : ''}">${pr.s ? statusLabel(pr.value as string) : pr.value}</td>
                    ${next ? `<td style="${lblCell} width: 25%;">${next.label}</td><td style="${valCell} width: 25%;${next.s ? ' ' + statusStyle(next.value as string) : ''}">${next.s ? statusLabel(next.value as string) : next.value}</td>` : `<td style="${lblCell} width: 25%;"></td><td style="${valCell} width: 25%;"></td>`}
                  </tr>`;
                }
                return '';
              }).join('')}
            </table>

            <!-- Defects -->
            ${hasDefects ? `
            ${secHdr('DEFECT TRACKING')}
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="${hdrCell}">Code</td>
                <td style="${hdrCell}">Description</td>
                <td style="${hdrCell} text-align: center;">Major</td>
                <td style="${hdrCell} text-align: center;">Minor</td>
              </tr>
              ${inspection.defects.filter((d: Defect) => d.defectCode).map((d: Defect) => `
              <tr>
                <td style="${valCell} font-weight: bold;">${d.defectCode}</td>
                <td style="${valCell}">${d.description || '-'}</td>
                <td style="${valCell} text-align: center;${d.majorCount > 0 ? ' color: #dc2626; font-weight: bold;' : ''}">${d.majorCount || 0}</td>
                <td style="${valCell} text-align: center;${d.minorCount > 0 ? ' color: #d97706; font-weight: bold;' : ''}">${d.minorCount || 0}</td>
              </tr>
              `).join('')}
              <tr style="font-weight: bold;">
                <td colspan="2" style="${lblCell}">Total Defects</td>
                <td style="${lblCell} text-align: center; color: #dc2626;">${inspection.defects.reduce((s: number, d: Defect) => s + (d.majorCount || 0), 0)}</td>
                <td style="${lblCell} text-align: center; color: #d97706;">${inspection.defects.reduce((s: number, d: Defect) => s + (d.minorCount || 0), 0)}</td>
              </tr>
            </table>
            ` : ''}

            <!-- QC Remarks -->
            ${inspection.qcInspectorRemarks ? `
            ${secHdr('QC INSPECTOR REMARKS')}
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="${valCell} font-style: italic; line-height: 1.6;">${inspection.qcInspectorRemarks}</td></tr>
            </table>
            ` : ''}

            <!-- Photos -->
            ${allPhotos.length > 0 ? `
            ${secHdr('PHOTO DOCUMENTATION')}
            <table style="width: 100%; border-collapse: collapse;">
              ${allPhotos.map((photo, i) => {
                if (i % 2 === 0) {
                  const next = allPhotos[i + 1];
                  return `<tr>
                    <td style="${tblBorder} padding: 8px; text-align: center; width: 50%; vertical-align: top;">
                      <p style="color: #374151; font-size: 12px; font-weight: bold; margin: 0 0 6px;">${photo.label}</p>
                      <img src="${photo.url}" style="max-width: 100%; max-height: 250px; border-radius: 4px;" alt="${photo.label}">
                    </td>
                    ${next ? `
                    <td style="${tblBorder} padding: 8px; text-align: center; width: 50%; vertical-align: top;">
                      <p style="color: #374151; font-size: 12px; font-weight: bold; margin: 0 0 6px;">${next.label}</p>
                      <img src="${next.url}" style="max-width: 100%; max-height: 250px; border-radius: 4px;" alt="${next.label}">
                    </td>` : `<td style="${tblBorder} padding: 8px;"></td>`}
                  </tr>`;
                }
                return '';
              }).join('')}
            </table>
            ` : ''}

            <!-- Download Button -->
            <div style="text-align: center; padding: 24px 0;">
              <a href="${pdfUrl}"
                 style="display: inline-block; background: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                Download Full Report (PDF)
              </a>
            </div>
          </div>

          <!-- Footer -->
          <table style="width: 100%; border-collapse: collapse; background: #059669;">
            <tr>
              <td style="padding: 16px; text-align: center; color: white; font-size: 12px;">
                <p style="margin: 0;">${companyFullName} - Final Inspection Report</p>
                <p style="margin: 4px 0 0; opacity: 0.8;">PDF report attached for complete documentation</p>
              </td>
            </tr>
          </table>
        </div>
      `;

      const response = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: allRecipients,
          subject: `Final Inspection: ${inspection.customerCode}${inspection.opsNo ? ` / ${inspection.opsNo}` : ''} - ${(inspection as Record<string, unknown>).buyerDesignName || ''} [${inspection.inspectionResult}]`,
          html: emailHtml,
          pdfBase64: pdfBase64,
          pdfFilename: pdfFilename
        })
      });

      if (!response.ok) {
        if (window.location.hostname === 'localhost') {
          throw new Error('Email sending requires Netlify. Run "netlify dev" instead of "npm run dev"');
        }
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server error: ${response.status}`);
        } catch {
          throw new Error(`Server error: ${response.status}`);
        }
      }

      const result = await response.json();
      if (result.success) {
        // Update emailStatus in Firestore
        await updateDoc(doc(db, 'final-inspections', inspection.id), { emailStatus: 'sent' }).catch(() => {});
        // Update local state
        setInspections(prev => prev.map(i => i.id === inspection.id ? { ...i, emailStatus: 'sent' } as typeof i : i));
        alert(`Email sent successfully to ${allRecipients.length} recipient(s) with PDF download link!`);
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSendingEmail(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (inspections.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No inspections found.</p>
        <p className="text-sm mt-2">Submit your first inspection to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Past Inspections</h2>

      {inspections.map((inspection) => (
        <div
          key={inspection.id}
          className="bg-white rounded-lg shadow-sm border overflow-hidden"
        >
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
            onClick={() => setExpandedId(expandedId === inspection.id ? null : inspection.id)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                {inspection.inspectionResult === 'PASS' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium text-gray-900">
                  {inspection.customerName}
                </span>
                <span className="text-sm text-gray-500">
                  {inspection.inspectionDate}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  inspection.inspectionResult === 'PASS'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {inspection.inspectionResult}
                </span>
                {inspection.company && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {inspection.company}
                  </span>
                )}
                {/* Email status badge */}
                {(inspection as Record<string, unknown>).emailStatus === 'failed' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    Email Failed
                  </span>
                )}
                {(inspection as Record<string, unknown>).emailStatus === 'sending' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                    Sending...
                  </span>
                )}
                {(inspection as Record<string, unknown>).emailStatus === 'sent' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                    Email Sent
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {inspection.documentNo && <span className="text-emerald-600 font-medium">{inspection.documentNo}</span>}
                {inspection.documentNo && ' | '}
                Design: {inspection.buyerDesignName} | OPS: {inspection.opsNo}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {/* Action Buttons */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewInspection(inspection);
                }}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Preview"
              >
                <FileText size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadPdf(inspection);
                }}
                disabled={generatingPdf === inspection.id}
                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Download PDF"
              >
                {generatingPdf === inspection.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download size={18} />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleResendEmail(inspection);
                }}
                disabled={sendingEmail === inspection.id}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Resend Email"
              >
                {sendingEmail === inspection.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail size={18} />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(inspection.id);
                }}
                disabled={deleting === inspection.id}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                {deleting === inspection.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 size={18} />
                )}
              </button>
              {expandedId === inspection.id ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </div>
          </div>

          {expandedId === inspection.id && (
            <div className="border-t px-4 py-4 bg-gray-50 space-y-4">
              {/* Company & Document Info */}
              {inspection.company && (
                <div className="bg-white rounded-lg p-3 border">
                  <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Company & Document</h5>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Company:</span>
                      <span className="ml-2 text-gray-900 font-medium">{COMPANY_NAMES[inspection.company] || inspection.company}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Document No:</span>
                      <span className="ml-2 text-emerald-600 font-medium">{inspection.documentNo}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Basic Info */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Basic Information</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Inspector:</span>
                    <span className="ml-2 text-gray-900">{inspection.qcInspectorName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Customer Code:</span>
                    <span className="ml-2 text-gray-900">{inspection.customerCode}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Customer PO:</span>
                    <span className="ml-2 text-gray-900">{inspection.customerPoNo}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">EMPL Design:</span>
                    <span className="ml-2 text-gray-900">{inspection.emplDesignNo}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Color:</span>
                    <span className="ml-2 text-gray-900">{inspection.colorName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Sizes:</span>
                    <span className="ml-2 text-gray-900">{inspection.productSizes}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Merchant:</span>
                    <span className="ml-2 text-gray-900">{inspection.merchant}</span>
                  </div>
                </div>
              </div>

              {/* Quantities */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Quantities</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Total Order:</span>
                    <span className="ml-2 text-gray-900">{inspection.totalOrderQty}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Inspected Lot:</span>
                    <span className="ml-2 text-gray-900">{inspection.inspectedLotQty}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">AQL:</span>
                    <span className="ml-2 text-gray-900">{inspection.aql}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Sample Size:</span>
                    <span className="ml-2 text-gray-900">{inspection.sampleSize}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Accepted:</span>
                    <span className="ml-2 text-green-600 font-medium">{inspection.acceptedQty}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rejected:</span>
                    <span className="ml-2 text-red-600 font-medium">{inspection.rejectedQty}</span>
                  </div>
                </div>
              </div>

              {/* Product Quality Checks */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Product Quality Checks</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Approved Sample:</span>
                    <span className={`ml-2 font-medium ${inspection.approvedSampleAvailable === 'Yes' ? 'text-green-600' : 'text-red-600'}`}>
                      {inspection.approvedSampleAvailable || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Material:</span>
                    <span className="ml-2 text-gray-900">{inspection.materialFibreContent || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Motif/Design:</span>
                    <StatusBadge status={inspection.motifDesignCheck || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Backing:</span>
                    <StatusBadge status={inspection.backing || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Binding & Edges:</span>
                    <StatusBadge status={inspection.bindingAndEdges || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Hand Feel:</span>
                    <StatusBadge status={inspection.handFeel || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Embossing/Carving:</span>
                    <StatusBadge status={inspection.embossingCarving || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Workmanship:</span>
                    <StatusBadge status={inspection.workmanship || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Weight Check:</span>
                    <StatusBadge status={inspection.productQualityWeight || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Product Weight:</span>
                    <span className="ml-2 text-gray-900">{inspection.productWeight || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Size Tolerance:</span>
                    <span className="ml-2 text-gray-900">{inspection.sizeTolerance || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Pile Height:</span>
                    <span className="ml-2 text-gray-900">{inspection.pileHeight || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Labeling & Marking */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Labeling & Marking</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Label Placement:</span>
                    <StatusBadge status={inspection.labelPlacement || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Side Marking:</span>
                    <StatusBadge status={inspection.sideMarking || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Outer Marking:</span>
                    <StatusBadge status={inspection.outerMarking || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Inner Pack:</span>
                    <StatusBadge status={inspection.innerPack || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Care Labels:</span>
                    <StatusBadge status={inspection.careLabels || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">SKU Stickers:</span>
                    <StatusBadge status={inspection.skuStickers || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">UPC Barcodes:</span>
                    <StatusBadge status={inspection.upcBarcodes || 'N/A'} />
                  </div>
                </div>
              </div>

              {/* Packaging */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Packaging</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Carton Dimension:</span>
                    <StatusBadge status={inspection.cartonDimension || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Product Label:</span>
                    <StatusBadge status={inspection.productLabel || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Carton Label:</span>
                    <StatusBadge status={inspection.cartonLabel || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Barcode Scan:</span>
                    <StatusBadge status={inspection.barcodeScan || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Carton Drop Test:</span>
                    <StatusBadge status={inspection.cartonDropTest || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Carton Numbering:</span>
                    <StatusBadge status={inspection.cartonBaleNumbering || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Packing Type:</span>
                    <span className="ml-2 text-gray-900">{inspection.packingType || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Carton Ply:</span>
                    <span className="ml-2 text-gray-900">{inspection.cartonPly || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Gross Weight:</span>
                    <span className="ml-2 text-gray-900">{inspection.grossWeight || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Net Weight:</span>
                    <span className="ml-2 text-gray-900">{inspection.netWeight || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Pcs/Carton:</span>
                    <span className="ml-2 text-gray-900">{inspection.pcsPerCartonBale || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Carton L×W×H:</span>
                    <span className="ml-2 text-gray-900">
                      {inspection.cartonMeasurementL && inspection.cartonMeasurementW && inspection.cartonMeasurementH
                        ? `${inspection.cartonMeasurementL} × ${inspection.cartonMeasurementW} × ${inspection.cartonMeasurementH}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Defects */}
              {inspection.defects && inspection.defects.length > 0 && (
                <div className="bg-white rounded-lg p-3 border">
                  <h5 className="text-xs font-semibold text-red-700 uppercase mb-2">Defects Found</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="px-2 py-1">Code</th>
                          <th className="px-2 py-1">Description</th>
                          <th className="px-2 py-1 text-center">Major</th>
                          <th className="px-2 py-1 text-center">Minor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspection.defects.map((defect, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-2 py-1 font-medium">{defect.defectCode}</td>
                            <td className="px-2 py-1">{defect.description}</td>
                            <td className="px-2 py-1 text-center text-red-600 font-medium">{defect.majorCount}</td>
                            <td className="px-2 py-1 text-center text-orange-600 font-medium">{defect.minorCount}</td>
                          </tr>
                        ))}
                        <tr className="border-t bg-gray-50 font-medium">
                          <td className="px-2 py-1" colSpan={2}>Total</td>
                          <td className="px-2 py-1 text-center text-red-600">
                            {inspection.defects.reduce((sum, d) => sum + d.majorCount, 0)}
                          </td>
                          <td className="px-2 py-1 text-center text-orange-600">
                            {inspection.defects.reduce((sum, d) => sum + d.minorCount, 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Remarks */}
              {inspection.qcInspectorRemarks && (
                <div className="bg-white rounded-lg p-3 border">
                  <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">QC Remarks</h5>
                  <p className="text-sm text-gray-900">{inspection.qcInspectorRemarks}</p>
                </div>
              )}

              {/* Photos - Thumbnail Grid */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500 mb-3">Photos:</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {inspection.approvedSamplePhoto && (
                    <a href={inspection.approvedSamplePhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.approvedSamplePhoto} alt="Approved Sample" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Sample</span>
                    </a>
                  )}
                  {inspection.idPhoto && (
                    <a href={inspection.idPhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.idPhoto} alt="ID" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">ID</span>
                    </a>
                  )}
                  {inspection.redSealFrontPhoto && (
                    <a href={inspection.redSealFrontPhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.redSealFrontPhoto} alt="Red Seal Front" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Red Seal</span>
                    </a>
                  )}
                  {inspection.redSealSidePhoto && (
                    <a href={inspection.redSealSidePhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.redSealSidePhoto} alt="Red Seal Side" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Seal Side</span>
                    </a>
                  )}
                  {inspection.backPhoto && (
                    <a href={inspection.backPhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.backPhoto} alt="Back" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Back</span>
                    </a>
                  )}
                  {inspection.labelPhoto && (
                    <a href={inspection.labelPhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.labelPhoto} alt="Label" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Label</span>
                    </a>
                  )}
                  {inspection.moisturePhoto && (
                    <a href={inspection.moisturePhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.moisturePhoto} alt="Moisture" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Moisture</span>
                    </a>
                  )}
                  {inspection.sizeFrontPhoto && (
                    <a href={inspection.sizeFrontPhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.sizeFrontPhoto} alt="Size Front" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Size Front</span>
                    </a>
                  )}
                  {inspection.sizeSidePhoto && (
                    <a href={inspection.sizeSidePhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.sizeSidePhoto} alt="Size Side" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Size Side</span>
                    </a>
                  )}
                  {inspection.inspectedSamplesPhoto && (
                    <a href={inspection.inspectedSamplesPhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.inspectedSamplesPhoto} alt="Inspected Samples" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Inspected</span>
                    </a>
                  )}
                  {inspection.metalCheckingPhoto && (
                    <a href={inspection.metalCheckingPhoto} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={inspection.metalCheckingPhoto} alt="Metal Checking" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Metal</span>
                    </a>
                  )}
                  {inspection.otherPhotos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-400 transition-colors">
                      <img src={url} alt={`Other ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">Other {i + 1}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Preview Modal */}
      {previewInspection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-emerald-600 text-white p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Final Inspection Preview</h3>
              <button
                onClick={() => setPreviewInspection(null)}
                className="text-white hover:bg-emerald-700 rounded-lg p-1"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Result Badge */}
              <div className="text-center">
                <span className={`inline-block px-6 py-2 rounded-full text-lg font-bold ${
                  previewInspection.inspectionResult === 'PASS'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {previewInspection.inspectionResult === 'PASS' ? 'PASSED' : 'FAILED'}
                </span>
              </div>

              {/* Company & Document */}
              {previewInspection.company && (
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="font-semibold text-blue-800">{COMPANY_NAMES[previewInspection.company]}</p>
                  <p className="text-sm text-blue-600">Document No: {previewInspection.documentNo}</p>
                </div>
              )}

              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-700 mb-3">Order Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{previewInspection.customerName}</span></div>
                  <div><span className="text-gray-500">Code:</span> <span className="font-medium">{previewInspection.customerCode}</span></div>
                  <div><span className="text-gray-500">PO No:</span> <span className="font-medium">{previewInspection.customerPoNo}</span></div>
                  <div><span className="text-gray-500">OPS No:</span> <span className="font-medium">{previewInspection.opsNo}</span></div>
                  <div><span className="text-gray-500">Buyer Design:</span> <span className="font-medium">{previewInspection.buyerDesignName}</span></div>
                  <div><span className="text-gray-500">EMPL Design:</span> <span className="font-medium">{previewInspection.emplDesignNo}</span></div>
                  <div><span className="text-gray-500">Color:</span> <span className="font-medium">{previewInspection.colorName}</span></div>
                  <div><span className="text-gray-500">Sizes:</span> <span className="font-medium">{previewInspection.productSizes}</span></div>
                </div>
              </div>

              {/* Quantities */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-700 mb-3">Inspection Quantities</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-gray-800">{previewInspection.totalOrderQty}</div>
                    <div className="text-xs text-gray-500">Total Order</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-600">{previewInspection.acceptedQty}</div>
                    <div className="text-xs text-gray-500">Accepted</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-red-600">{previewInspection.rejectedQty}</div>
                    <div className="text-xs text-gray-500">Rejected</div>
                  </div>
                </div>
              </div>

              {/* Product Quality Checks */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-700 mb-3">Product Quality Checks</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Approved Sample:</span>
                    <span className={previewInspection.approvedSampleAvailable === 'Yes' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {previewInspection.approvedSampleAvailable || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Material:</span>
                    <span className="font-medium">{previewInspection.materialFibreContent || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Motif/Design:</span>
                    <StatusBadge status={previewInspection.motifDesignCheck || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Backing:</span>
                    <StatusBadge status={previewInspection.backing || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Binding & Edges:</span>
                    <StatusBadge status={previewInspection.bindingAndEdges || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hand Feel:</span>
                    <StatusBadge status={previewInspection.handFeel || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Embossing/Carving:</span>
                    <StatusBadge status={previewInspection.embossingCarving || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Workmanship:</span>
                    <StatusBadge status={previewInspection.workmanship || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Weight Check:</span>
                    <StatusBadge status={previewInspection.productQualityWeight || 'N/A'} />
                  </div>
                </div>
              </div>

              {/* Labeling & Marking */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-700 mb-3">Labeling & Marking</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Label Placement:</span>
                    <StatusBadge status={previewInspection.labelPlacement || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Side Marking:</span>
                    <StatusBadge status={previewInspection.sideMarking || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Outer Marking:</span>
                    <StatusBadge status={previewInspection.outerMarking || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Inner Pack:</span>
                    <StatusBadge status={previewInspection.innerPack || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Care Labels:</span>
                    <StatusBadge status={previewInspection.careLabels || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">SKU Stickers:</span>
                    <StatusBadge status={previewInspection.skuStickers || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">UPC Barcodes:</span>
                    <StatusBadge status={previewInspection.upcBarcodes || 'N/A'} />
                  </div>
                </div>
              </div>

              {/* Packaging */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-700 mb-3">Packaging</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton Dimension:</span>
                    <StatusBadge status={previewInspection.cartonDimension || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Product Label:</span>
                    <StatusBadge status={previewInspection.productLabel || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton Label:</span>
                    <StatusBadge status={previewInspection.cartonLabel || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Barcode:</span>
                    <StatusBadge status={previewInspection.barcodeScan || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton Drop Test:</span>
                    <StatusBadge status={previewInspection.cartonDropTest || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton Numbering:</span>
                    <StatusBadge status={previewInspection.cartonBaleNumbering || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Packing Type:</span>
                    <span className="font-medium">{previewInspection.packingType || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton L×W×H:</span>
                    <span className="font-medium">
                      {previewInspection.cartonMeasurementL && previewInspection.cartonMeasurementW && previewInspection.cartonMeasurementH
                        ? `${previewInspection.cartonMeasurementL}×${previewInspection.cartonMeasurementW}×${previewInspection.cartonMeasurementH}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Defects */}
              {previewInspection.defects && previewInspection.defects.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-red-700 mb-3">Defects Found</h4>
                  <div className="space-y-2">
                    {previewInspection.defects.map((defect, idx) => (
                      <div key={idx} className="flex justify-between text-sm bg-white p-2 rounded">
                        <span className="font-medium">{defect.defectCode}: {defect.description}</span>
                        <span>
                          <span className="text-red-600">Major: {defect.majorCount}</span>
                          <span className="mx-2">|</span>
                          <span className="text-orange-600">Minor: {defect.minorCount}</span>
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-red-200">
                      <span>Total</span>
                      <span>
                        <span className="text-red-600">Major: {previewInspection.defects.reduce((sum, d) => sum + d.majorCount, 0)}</span>
                        <span className="mx-2">|</span>
                        <span className="text-orange-600">Minor: {previewInspection.defects.reduce((sum, d) => sum + d.minorCount, 0)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Remarks */}
              {previewInspection.qcInspectorRemarks && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-emerald-700 mb-2">QC Remarks</h4>
                  <p className="text-gray-700">{previewInspection.qcInspectorRemarks}</p>
                </div>
              )}

              {/* Photos Gallery */}
              {(() => {
                const photos = [
                  { url: previewInspection.approvedSamplePhoto, label: 'Approved Sample' },
                  { url: previewInspection.idPhoto, label: 'ID' },
                  { url: previewInspection.redSealFrontPhoto, label: 'Red Seal Front' },
                  { url: previewInspection.redSealSidePhoto, label: 'Red Seal Side' },
                  { url: previewInspection.backPhoto, label: 'Back' },
                  { url: previewInspection.labelPhoto, label: 'Label' },
                  { url: previewInspection.moisturePhoto, label: 'Moisture' },
                  { url: previewInspection.sizeFrontPhoto, label: 'Size Front' },
                  { url: previewInspection.sizeSidePhoto, label: 'Size Side' },
                  { url: previewInspection.inspectedSamplesPhoto, label: 'Inspected' },
                  { url: previewInspection.metalCheckingPhoto, label: 'Metal Check' },
                  ...(previewInspection.otherPhotos || []).map((url, i) => ({ url, label: `Other ${i + 1}` })),
                ].filter(p => p.url);

                return photos.length > 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-emerald-700 mb-3">Photos ({photos.length})</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {photos.map((photo, idx) => (
                        <a
                          key={idx}
                          href={photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-gray-200 hover:border-emerald-400 transition-all hover:shadow-lg"
                        >
                          <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <Eye size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 text-center">
                            {photo.label}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Footer */}
              <div className="border-t pt-4 text-sm text-gray-500 text-center">
                <p>Inspected by: {previewInspection.qcInspectorName} | Date: {previewInspection.inspectionDate}</p>
                {previewInspection.documentNo && (
                  <p className="text-emerald-600 font-medium">{previewInspection.documentNo}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-gray-100 p-4 flex gap-3 justify-end">
              <button
                onClick={() => handleDownloadPdf(previewInspection)}
                disabled={generatingPdf === previewInspection.id}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {generatingPdf === previewInspection.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                Download PDF
              </button>
              <button
                onClick={() => handleResendEmail(previewInspection)}
                disabled={sendingEmail === previewInspection.id}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingEmail === previewInspection.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail size={18} />
                )}
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
