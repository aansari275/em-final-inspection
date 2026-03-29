import { jsPDF } from 'jspdf';
import { FinalInspection, FinalInspectionV2, COMPANY_NAMES, OK_NOT_OK_FIELDS, PHOTO_TYPES, CONSTRUCTION_PHOTO_TYPES, isV2Inspection } from '../types';

// Max image dimension for PDF - adjusts based on total photo count
const MAX_IMAGE_DIMENSION_FULL = 1600;   // For ≤30 images: high quality
const MAX_IMAGE_DIMENSION_THUMB = 400;   // For >30 images: thumbnail quality
const JPEG_QUALITY_FULL = 0.85;          // 85% quality
const JPEG_QUALITY_THUMB = 0.6;          // 60% quality for thumbnails

// These get set dynamically per PDF generation
let MAX_IMAGE_DIMENSION = MAX_IMAGE_DIMENSION_FULL;
let JPEG_QUALITY = JPEG_QUALITY_FULL;

// Convert image URL to base64 data URL with compression
async function urlToBase64(url: string): Promise<string | null> {
  if (!url) return null;

  try {
    // For Firebase Storage URLs, ensure proper format
    let fetchUrl = url;

    // If URL is from Firebase Storage and doesn't have alt=media, add it
    if (url.includes('firebasestorage.googleapis.com') && !url.includes('alt=media')) {
      fetchUrl = url + (url.includes('?') ? '&' : '?') + 'alt=media';
    }

    // Use Image element approach for better browser compatibility
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Enable CORS

      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Resize if image is larger than max dimension
          if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
              width = MAX_IMAGE_DIMENSION;
            } else {
              width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
              height = MAX_IMAGE_DIMENSION;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
            resolve(dataUrl);
          } else {
            resolve(null);
          }
        } catch (canvasError) {
          console.error('Canvas error (likely CORS):', canvasError);
          // Fallback to fetch method
          fetchImageAsFallback(fetchUrl).then(resolve);
        }
      };

      img.onerror = () => {
        console.error('Image load error, trying fetch fallback:', url);
        // Fallback to fetch method
        fetchImageAsFallback(fetchUrl).then(resolve);
      };

      // Set timeout to prevent hanging
      setTimeout(() => {
        if (!img.complete) {
          console.error('Image load timeout:', url);
          resolve(null);
        }
      }, 15000); // 15 second timeout

      img.src = fetchUrl;
    });
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    return null;
  }
}

// Fallback fetch method for images with compression
async function fetchImageAsFallback(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit'
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('Fetch failed with status:', response.status);
      return null;
    }

    const blob = await response.blob();

    // Convert blob to image, resize, and compress
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize if needed
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
            height = MAX_IMAGE_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch (error) {
    console.error('Fetch fallback failed:', error);
    return null;
  }
}

// Crop image to consistent landscape aspect ratio (4:3) for uniform PDF grid
const PHOTO_ASPECT_RATIO = 4 / 3; // width / height
async function cropToLandscape(base64: string): Promise<{ data: string; width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;

        // Calculate crop region to fill target ratio (center crop)
        let cropW = srcW;
        let cropH = srcW / PHOTO_ASPECT_RATIO;

        if (cropH > srcH) {
          cropH = srcH;
          cropW = srcH * PHOTO_ASPECT_RATIO;
        }

        const sx = (srcW - cropW) / 2;
        const sy = (srcH - cropH) / 2;

        // Output size capped for PDF quality
        const outW = Math.min(cropW, 800);
        const outH = Math.round(outW / PHOTO_ASPECT_RATIO);

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outW, outH);
          resolve({ data: canvas.toDataURL('image/jpeg', 0.82), width: outW, height: outH });
        } else {
          resolve({ data: base64, width: srcW, height: srcH });
        }
      } catch {
        resolve({ data: base64, width: img.width, height: img.height });
      }
    };
    img.onerror = () => resolve({ data: base64, width: 400, height: 300 });
    img.src = base64;
  });
}

export async function generateFinalInspectionPDF(inspection: FinalInspection | FinalInspectionV2, onProgress?: (msg: string) => void): Promise<string> {
  // V2 per-size inspection documents
  if (isV2Inspection(inspection)) {
    return generateV2PDF(inspection, onProgress);
  }

  // ─── V1 code path (unchanged) ───
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 10;

  // Table layout constants
  const M = 10; // margin
  const TW = pageWidth - M * 2; // table width
  const ROW_H = 7; // standard row height
  const CELL_PAD = 2; // cell padding

  // Colors
  const primaryColor: [number, number, number] = [0, 82, 94];
  const darkGray: [number, number, number] = [55, 65, 81];
  const lightGray: [number, number, number] = [156, 163, 175];
  const successGreen: [number, number, number] = [39, 119, 63];
  const errorRed: [number, number, number] = [185, 28, 28];
  const warningYellow: [number, number, number] = [180, 130, 30];
  const headerBg: [number, number, number] = [0, 82, 94];
  const lightBg: [number, number, number] = [245, 247, 250];
  const borderColor: [number, number, number] = [200, 205, 215];

  const companyName = COMPANY_NAMES[inspection.company] || 'Eastern Mills';

  // Check if we need a new page
  const checkNewPage = (requiredSpace: number = 20) => {
    if (y + requiredSpace > pageHeight - 15) {
      doc.addPage();
      y = 12;
      return true;
    }
    return false;
  };

  // Draw a bordered cell with text
  const drawCell = (x: number, cellY: number, w: number, h: number, text: string, opts?: {
    bold?: boolean; fontSize?: number; color?: [number, number, number];
    bg?: [number, number, number]; align?: 'left' | 'center' | 'right';
    textColor?: [number, number, number]; noBorder?: boolean; topBorder?: boolean;
    bottomBorder?: boolean; leftBorder?: boolean; rightBorder?: boolean;
  }) => {
    const o = opts || {};
    // Background
    if (o.bg) {
      doc.setFillColor(...o.bg);
      doc.rect(x, cellY, w, h, 'F');
    }
    // Border
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    if (!o.noBorder) {
      doc.rect(x, cellY, w, h, 'S');
    } else {
      if (o.topBorder) doc.line(x, cellY, x + w, cellY);
      if (o.bottomBorder) doc.line(x, cellY + h, x + w, cellY + h);
      if (o.leftBorder) doc.line(x, cellY, x, cellY + h);
      if (o.rightBorder) doc.line(x + w, cellY, x + w, cellY + h);
    }
    // Text
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    doc.setFontSize(o.fontSize || 8);
    doc.setTextColor(...(o.textColor || o.color || darkGray));
    const align = o.align || 'left';
    let tx = x + CELL_PAD;
    if (align === 'center') tx = x + w / 2;
    else if (align === 'right') tx = x + w - CELL_PAD;
    // Truncate text to fit
    let displayText = String(text || '-');
    const maxW = w - CELL_PAD * 2;
    while (doc.getTextWidth(displayText) > maxW && displayText.length > 2) {
      displayText = displayText.slice(0, -1);
    }
    if (displayText !== String(text || '-') && text) displayText += '..';
    doc.text(displayText, tx, cellY + h / 2 + (o.fontSize || 8) * 0.12, { align, baseline: 'middle' });
  };

  // Draw a label-value pair in a bordered row
  const drawLabelValue = (x: number, cellY: number, labelW: number, valueW: number, label: string, value: string, h?: number, valueOpts?: {
    color?: [number, number, number]; bold?: boolean;
  }) => {
    const rh = h || ROW_H;
    drawCell(x, cellY, labelW, rh, label, { bold: true, fontSize: 7, bg: lightBg, color: [80, 90, 105] });
    drawCell(x + labelW, cellY, valueW, rh, value, {
      fontSize: 8, color: valueOpts?.color || darkGray, bold: valueOpts?.bold
    });
  };

  // ─── HEADER: Company Name + Title ───
  doc.setFillColor(...headerBg);
  doc.rect(M, y, TW, 12, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(companyName.toUpperCase(), pageWidth / 2, y + 5, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('FINAL INSPECTION REPORT', pageWidth / 2, y + 10, { align: 'center' });
  y += 12;

  // Document No + Date row
  const halfW = TW / 2;
  drawLabelValue(M, y, 28, halfW - 28, 'Doc No.', inspection.documentNo);
  drawLabelValue(M + halfW, y, 28, halfW - 28, 'Date', inspection.inspectionDate);
  y += ROW_H;

  // Result badge row
  const resultBg: [number, number, number] = inspection.inspectionResult === 'PASS' ? successGreen : errorRed;
  drawCell(M, y, TW * 0.7, ROW_H + 2, `QC Inspector: ${inspection.qcInspectorName}`, { bold: true, fontSize: 9, bg: lightBg });
  doc.setFillColor(...resultBg);
  doc.rect(M + TW * 0.7, y, TW * 0.3, ROW_H + 2, 'F');
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.rect(M + TW * 0.7, y, TW * 0.3, ROW_H + 2, 'S');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(inspection.inspectionResult === 'PASS' ? 'PASSED' : 'FAILED', M + TW * 0.85, y + (ROW_H + 2) / 2 + 1, { align: 'center', baseline: 'middle' });
  y += ROW_H + 2;

  // ─── ORDER INFORMATION TABLE ───
  // Section title
  doc.setFillColor(...headerBg);
  doc.rect(M, y, TW, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ORDER INFORMATION', M + 3, y + 4);
  y += 6;

  // 4-column layout: label-value | label-value
  const LW = 30; // label width
  const VW = halfW - LW; // value width

  drawLabelValue(M, y, LW, VW, 'Customer Code', inspection.customerCode);
  drawLabelValue(M + halfW, y, LW, VW, 'Customer PO', inspection.customerPoNo);
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'OPS No.', inspection.opsNo);
  drawLabelValue(M + halfW, y, LW, VW, 'Merchant', inspection.merchant);
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'EMPL Design', inspection.emplDesignNo);
  drawLabelValue(M + halfW, y, LW, VW, 'Color', inspection.colorName);
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'Product Sizes', inspection.productSizes);
  drawLabelValue(M + halfW, y, LW, VW, 'Buyer Design', inspection.buyerDesignName || '-');
  y += ROW_H;

  y += 2;

  // ─── INSPECTED ARTICLES TABLE ───
  if (inspection.inspectedArticles && inspection.inspectedArticles.length > 0) {
    checkNewPage(40);
    doc.setFillColor(...headerBg);
    doc.rect(M, y, TW, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('INSPECTED ARTICLES', M + 3, y + 4);
    y += 6;

    // Table header row
    const cols = [TW * 0.35, TW * 0.15, TW * 0.2, TW * 0.15, TW * 0.15];
    const headers = ['Article Name', 'Size', 'Color', 'Total Pcs', 'Inspected'];
    let cx = M;
    headers.forEach((h, i) => {
      drawCell(cx, y, cols[i], ROW_H, h, { bold: true, fontSize: 7, bg: lightBg, align: 'center' });
      cx += cols[i];
    });
    y += ROW_H;

    // Article data rows
    inspection.inspectedArticles.forEach((article) => {
      checkNewPage();
      cx = M;
      drawCell(cx, y, cols[0], ROW_H, article.articleName || '-', { fontSize: 7.5 });
      cx += cols[0];
      drawCell(cx, y, cols[1], ROW_H, article.size || '-', { fontSize: 7.5, align: 'center' });
      cx += cols[1];
      drawCell(cx, y, cols[2], ROW_H, article.color || '-', { fontSize: 7.5, align: 'center' });
      cx += cols[2];
      drawCell(cx, y, cols[3], ROW_H, String(article.pcs || 0), { fontSize: 7.5, align: 'center' });
      cx += cols[3];
      drawCell(cx, y, cols[4], ROW_H, String(article.inspectedQty || article.pcs || 0), { fontSize: 8, align: 'center', bold: true, color: primaryColor });
      y += ROW_H;
    });

    // Total row
    checkNewPage();
    const totalPcs = inspection.inspectedArticles.reduce((sum, a) => sum + (a.pcs || 0), 0);
    const totalInspected = inspection.inspectedArticles.reduce((sum, a) => sum + (a.inspectedQty || a.pcs || 0), 0);
    cx = M;
    drawCell(cx, y, cols[0] + cols[1] + cols[2], ROW_H, 'TOTAL', { bold: true, fontSize: 8, bg: lightBg, align: 'right' });
    cx += cols[0] + cols[1] + cols[2];
    drawCell(cx, y, cols[3], ROW_H, String(totalPcs), { bold: true, fontSize: 8, bg: lightBg, align: 'center' });
    cx += cols[3];
    drawCell(cx, y, cols[4], ROW_H, String(totalInspected), { bold: true, fontSize: 8, bg: lightBg, align: 'center', color: primaryColor });
    y += ROW_H;

    y += 2;
  }

  // ─── INSPECTION QUANTITIES & AQL ───
  checkNewPage(35);
  doc.setFillColor(...headerBg);
  doc.rect(M, y, TW, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('INSPECTION QUANTITIES & AQL', M + 3, y + 4);
  y += 6;

  drawLabelValue(M, y, LW, VW, 'Total Order Qty', String(inspection.totalOrderQty));
  drawLabelValue(M + halfW, y, LW, VW, 'Inspected Lot', String(inspection.inspectedLotQty));
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'AQL Level', inspection.aql || '2.5');
  drawLabelValue(M + halfW, y, LW, VW, 'Sample Size', String(inspection.sampleSize));
  y += ROW_H;

  // AQL Z1.4-2008 details in bordered table
  if (inspection.codeLetter || inspection.acceptNumber !== undefined) {
    const aqlW = TW / 4;
    const aqlHeaders = ['Code Letter', 'Sample Size', 'Accept ≤', 'Reject ≥'];
    let ax = M;
    aqlHeaders.forEach((h, _i) => {
      drawCell(ax, y, aqlW, 6, h, { bold: true, fontSize: 6.5, bg: [235, 245, 238], align: 'center', color: [80, 90, 105] });
      ax += aqlW;
    });
    y += 6;

    const effectiveCode = inspection.effectiveCodeLetter || inspection.codeLetter || '-';
    ax = M;
    drawCell(ax, y, aqlW, 8, effectiveCode, { bold: true, fontSize: 10, align: 'center' });
    ax += aqlW;
    drawCell(ax, y, aqlW, 8, String(inspection.calculatedSampleSize || inspection.sampleSize), { bold: true, fontSize: 10, align: 'center' });
    ax += aqlW;
    drawCell(ax, y, aqlW, 8, String(inspection.acceptNumber ?? '-'), { bold: true, fontSize: 10, align: 'center', color: successGreen });
    ax += aqlW;
    drawCell(ax, y, aqlW, 8, String(inspection.rejectNumber ?? '-'), { bold: true, fontSize: 10, align: 'center', color: errorRed });
    y += 8;

    if (inspection.isAutoResult !== undefined) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...lightGray);
      const resultNote = inspection.resultOverridden
        ? 'Result: Inspector override'
        : inspection.isAutoResult
          ? 'Result: Auto-determined per Z1.4-2008'
          : 'Result: Manually entered';
      doc.text(resultNote, M + 2, y + 4);
      y += 5;
    }
  }

  // Accepted/Rejected row
  checkNewPage();
  drawLabelValue(M, y, LW, VW, 'Accepted Qty', String(inspection.acceptedQty), ROW_H, { color: successGreen, bold: true });
  drawLabelValue(M + halfW, y, LW, VW, 'Rejected Qty', String(inspection.rejectedQty), ROW_H, { color: errorRed, bold: true });
  y += ROW_H;

  y += 2;

  // ─── PRODUCT QUALITY CHECKS ───
  checkNewPage(40);
  doc.setFillColor(...headerBg);
  doc.rect(M, y, TW, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('PRODUCT QUALITY CHECKS', M + 3, y + 4);
  y += 6;

  // Helper for OK/NOT OK colored value
  const okColor = (val: string): [number, number, number] => {
    if (val === 'OK' || val === 'Yes') return successGreen;
    if (val === 'NOT OK' || val === 'No') return errorRed;
    if (val === 'NA') return lightGray;
    return darkGray;
  };
  const okText = (val: string): string => {
    if (val === 'OK') return 'OK';
    if (val === 'NOT OK') return 'NOT OK';
    if (val === 'NA') return 'N/A';
    if (val === 'Yes') return 'Yes';
    if (val === 'No') return 'No';
    return val || '-';
  };

  drawLabelValue(M, y, LW, VW, 'Approved Sample', okText(inspection.approvedSampleAvailable), ROW_H, { color: okColor(inspection.approvedSampleAvailable), bold: true });
  drawLabelValue(M + halfW, y, LW, VW, 'Material/Fibre', inspection.materialFibreContent);
  y += ROW_H;

  // Quality checks in bordered 4-column grid (label | value | label | value)
  const qcChecks: [string, string][] = [
    ['Motif/Design', inspection.motifDesignCheck],
    ['Backing', inspection.backing],
    ['Binding & Edges', inspection.bindingAndEdges],
    ['Hand Feel', inspection.handFeel],
    ['Embossing/Carving', inspection.embossingCarving],
    ['Workmanship', inspection.workmanship],
    ['Weight Check', inspection.productQualityWeight],
    ['Tuft Density', inspection.tuftDensity || '-'],
  ];

  for (let i = 0; i < qcChecks.length; i += 2) {
    checkNewPage();
    const [l1, v1] = qcChecks[i];
    const isCheck1 = ['OK', 'NOT OK', 'NA'].includes(v1);
    drawLabelValue(M, y, LW, VW, l1, okText(v1), ROW_H, isCheck1 ? { color: okColor(v1), bold: true } : undefined);
    if (i + 1 < qcChecks.length) {
      const [l2, v2] = qcChecks[i + 1];
      const isCheck2 = ['OK', 'NOT OK', 'NA'].includes(v2);
      drawLabelValue(M + halfW, y, LW, VW, l2, okText(v2), ROW_H, isCheck2 ? { color: okColor(v2), bold: true } : undefined);
    }
    y += ROW_H;
  }

  // Additional product fields
  checkNewPage();
  drawLabelValue(M, y, LW, VW, 'Pile Height', inspection.pileHeight || '-');
  drawLabelValue(M + halfW, y, LW, VW, 'Product Weight', inspection.productWeight || '-');
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'Size Tolerance', inspection.sizeTolerance || '-');
  drawLabelValue(M + halfW, y, LW, VW, 'Finishing %', inspection.finishingPercent || '-');
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'Packed %', inspection.packedPercent || '-');
  if (inspection.backingNotes) {
    drawLabelValue(M + halfW, y, LW, VW, 'Backing Notes', inspection.backingNotes);
  }
  y += ROW_H;

  y += 2;

  // ─── LABELING & MARKING ───
  checkNewPage(25);
  doc.setFillColor(...headerBg);
  doc.rect(M, y, TW, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('LABELING & MARKING', M + 3, y + 4);
  y += 6;

  const labelChecks: [string, string][] = [
    ['Label Placement', inspection.labelPlacement],
    ['Side Marking', inspection.sideMarking],
    ['Outer Marking', inspection.outerMarking],
    ['Inner Pack', inspection.innerPack],
    ['Care Labels', inspection.careLabels],
    ['SKU Stickers', inspection.skuStickers],
    ['UPC Barcodes', inspection.upcBarcodes],
  ];

  for (let i = 0; i < labelChecks.length; i += 2) {
    checkNewPage();
    const [l1, v1] = labelChecks[i];
    drawLabelValue(M, y, LW, VW, l1, okText(v1), ROW_H, { color: okColor(v1), bold: true });
    if (i + 1 < labelChecks.length) {
      const [l2, v2] = labelChecks[i + 1];
      drawLabelValue(M + halfW, y, LW, VW, l2, okText(v2), ROW_H, { color: okColor(v2), bold: true });
    }
    y += ROW_H;
  }

  y += 2;

  // ─── PACKAGING ───
  checkNewPage(30);
  doc.setFillColor(...headerBg);
  doc.rect(M, y, TW, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('PACKAGING', M + 3, y + 4);
  y += 6;

  drawLabelValue(M, y, LW, VW, 'Carton Ply', inspection.cartonPly || '-');
  drawLabelValue(M + halfW, y, LW, VW, 'Drop Test', okText(inspection.cartonDropTest), ROW_H, { color: okColor(inspection.cartonDropTest), bold: true });
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'Packing Type', inspection.packingType || '-');
  drawLabelValue(M + halfW, y, LW, VW, 'Bale Numbering', okText(inspection.cartonBaleNumbering), ROW_H, { color: okColor(inspection.cartonBaleNumbering), bold: true });
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'Gross Weight', inspection.grossWeight || '-');
  drawLabelValue(M + halfW, y, LW, VW, 'Net Weight', inspection.netWeight || '-');
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'Pcs/Carton', inspection.pcsPerCartonBale || '-');
  drawLabelValue(M + halfW, y, LW, VW, 'Pcs/Polybag', inspection.pcsPerPolybag || '-');
  y += ROW_H;

  const cartonDimension = `${inspection.cartonMeasurementL || '-'} × ${inspection.cartonMeasurementW || '-'} × ${inspection.cartonMeasurementH || '-'}`;
  drawLabelValue(M, y, LW, TW - LW, 'Carton Dims (L×W×H)', cartonDimension);
  y += ROW_H;

  y += 2;

  // ─── ADDITIONAL QUALITY CHECKS ───
  checkNewPage(20);
  doc.setFillColor(...headerBg);
  doc.rect(M, y, TW, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ADDITIONAL QUALITY CHECKS', M + 3, y + 4);
  y += 6;

  const addlChecks: [string, string][] = [
    ['Carton Dimension', inspection.cartonDimension],
    ['Product Label', inspection.productLabel],
    ['Carton Label', inspection.cartonLabel],
    ['Barcode Scan', inspection.barcodeScan],
  ];
  for (let i = 0; i < addlChecks.length; i += 2) {
    checkNewPage();
    const [l1, v1] = addlChecks[i];
    drawLabelValue(M, y, LW, VW, l1, okText(v1), ROW_H, { color: okColor(v1), bold: true });
    if (i + 1 < addlChecks.length) {
      const [l2, v2] = addlChecks[i + 1];
      drawLabelValue(M + halfW, y, LW, VW, l2, okText(v2), ROW_H, { color: okColor(v2), bold: true });
    }
    y += ROW_H;
  }

  y += 2;

  // ─── DEFECT TRACKING ───
  if (inspection.defects && inspection.defects.length > 0) {
    checkNewPage(30);
    doc.setFillColor(...headerBg);
    doc.rect(M, y, TW, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('DEFECT TRACKING', M + 3, y + 4);
    y += 6;

    if (inspection.dpciSkuStyleNumber || inspection.styleDescription) {
      drawLabelValue(M, y, LW, VW, 'DPCI/SKU/Style', inspection.dpciSkuStyleNumber || '-');
      drawLabelValue(M + halfW, y, LW, VW, 'Style Desc.', inspection.styleDescription || '-');
      y += ROW_H;
    }

    // Defect table header
    const dCols = [TW * 0.2, TW * 0.15, TW * 0.15, TW * 0.5];
    const dHeaders = ['Defect Code', 'Major', 'Minor', 'Description'];
    let dx = M;
    dHeaders.forEach((h, i) => {
      drawCell(dx, y, dCols[i], ROW_H, h, { bold: true, fontSize: 7, bg: lightBg, align: 'center' });
      dx += dCols[i];
    });
    y += ROW_H;

    let totalMajor = 0;
    let totalMinor = 0;

    inspection.defects.forEach((defect) => {
      checkNewPage();
      dx = M;
      drawCell(dx, y, dCols[0], ROW_H, defect.defectCode || '-', { fontSize: 7.5, align: 'center' });
      dx += dCols[0];
      drawCell(dx, y, dCols[1], ROW_H, String(defect.majorCount), { fontSize: 7.5, align: 'center', color: defect.majorCount > 0 ? errorRed : darkGray });
      dx += dCols[1];
      drawCell(dx, y, dCols[2], ROW_H, String(defect.minorCount), { fontSize: 7.5, align: 'center', color: defect.minorCount > 0 ? warningYellow : darkGray });
      dx += dCols[2];
      drawCell(dx, y, dCols[3], ROW_H, defect.description || '-', { fontSize: 7.5 });
      y += ROW_H;
      totalMajor += defect.majorCount || 0;
      totalMinor += defect.minorCount || 0;
    });

    // Totals
    checkNewPage();
    dx = M;
    drawCell(dx, y, dCols[0], ROW_H, 'TOTAL', { bold: true, fontSize: 8, bg: lightBg, align: 'center' });
    dx += dCols[0];
    drawCell(dx, y, dCols[1], ROW_H, String(totalMajor), { bold: true, fontSize: 8, bg: lightBg, align: 'center', color: errorRed });
    dx += dCols[1];
    drawCell(dx, y, dCols[2], ROW_H, String(totalMinor), { bold: true, fontSize: 8, bg: lightBg, align: 'center', color: warningYellow });
    dx += dCols[2];
    drawCell(dx, y, dCols[3], ROW_H, '', { bg: lightBg });
    y += ROW_H;
  }

  y += 2;

  // ─── REMARKS ───
  checkNewPage(20);
  doc.setFillColor(...headerBg);
  doc.rect(M, y, TW, 6, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('QC INSPECTOR REMARKS', M + 3, y + 4);
  y += 6;

  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.setFontSize(8);
  const remarks = doc.splitTextToSize(inspection.qcInspectorRemarks || 'No remarks provided', TW - 6);
  const remarksH = Math.max(remarks.length * 4.5 + 4, 12);

  if (y + remarksH > pageHeight - 15) {
    doc.addPage();
    y = 12;
  }

  doc.rect(M, y, TW, remarksH, 'S');
  doc.text(remarks, M + 3, y + 4);
  y += remarksH;

  // Footer
  const addFooter = () => {
    doc.setDrawColor(229, 231, 235);
    doc.line(M, pageHeight - 12, pageWidth - M, pageHeight - 12);
    doc.setFontSize(6.5);
    doc.setTextColor(...lightGray);
    doc.text(`Generated: ${new Date().toLocaleString()}`, M, pageHeight - 7);
    doc.text(`${companyName} | ${inspection.documentNo}`, pageWidth - M, pageHeight - 7, { align: 'right' });
  };

  addFooter();

  // ─── PHOTO DOCUMENTATION ───
  // 4 photos per row, labels above, grouped by category

  interface PhotoItem {
    url: string;
    label: string;
    base64?: string | null;
    width?: number;
    height?: number;
  }

  interface PhotoGroup {
    title: string;
    photos: PhotoItem[];
  }

  // Build grouped photo sections
  const photoGroups: PhotoGroup[] = [];

  // Group 1: Product & Red Seal Photos
  const productPhotos: PhotoItem[] = [];
  if (inspection.approvedSamplePhoto) productPhotos.push({ url: inspection.approvedSamplePhoto, label: 'Approved Sample' });
  if (inspection.redSealFrontPhoto) productPhotos.push({ url: inspection.redSealFrontPhoto, label: 'Red Seal - Front' });
  if (inspection.redSealBackPhoto) productPhotos.push({ url: inspection.redSealBackPhoto, label: 'Red Seal - Back' });
  if (inspection.redSealCloseUpPhoto) productPhotos.push({ url: inspection.redSealCloseUpPhoto, label: 'Close-up with Red Seal' });
  if (inspection.redSealProductFront) productPhotos.push({ url: inspection.redSealProductFront, label: 'Front with Red Seal' });
  if (inspection.redSealProductBack) productPhotos.push({ url: inspection.redSealProductBack, label: 'Back with Red Seal' });
  if (productPhotos.length > 0) photoGroups.push({ title: 'Product & Red Seal', photos: productPhotos });

  // Group 2: Measurements & Labels
  const measurementPhotos: PhotoItem[] = [];
  if (inspection.labelPhoto) measurementPhotos.push({ url: inspection.labelPhoto, label: 'Label Photo' });
  if (inspection.moisturePhoto) {
    measurementPhotos.push({ url: inspection.moisturePhoto, label: 'Moisture Meter Reading' });
  }
  if (inspection.sizeFrontPhoto) {
    const sizeVal = inspection.productSizes || inspection.sizeTolerance;
    measurementPhotos.push({ url: inspection.sizeFrontPhoto, label: sizeVal ? `Size Front: ${sizeVal}` : 'Size - Front' });
  }
  if (inspection.sizeSidePhoto) {
    const sizeVal = inspection.productSizes || inspection.sizeTolerance;
    measurementPhotos.push({ url: inspection.sizeSidePhoto, label: sizeVal ? `Size Side: ${sizeVal}` : 'Size - Side' });
  }
  if (inspection.inspectedSamplesPhoto) measurementPhotos.push({ url: inspection.inspectedSamplesPhoto, label: `Inspected Samples: ${inspection.inspectedLotQty || '-'}` });
  if (inspection.metalCheckingPhoto) measurementPhotos.push({ url: inspection.metalCheckingPhoto, label: 'Metal Checking' });
  if (measurementPhotos.length > 0) photoGroups.push({ title: 'Measurements & Labels', photos: measurementPhotos });

  // Group 3: Construction Details
  const constructionPhotosList: PhotoItem[] = [];
  if (inspection.constructionPhotos) {
    if (inspection.constructionPhotos.warpPer10cm) constructionPhotosList.push({ url: inspection.constructionPhotos.warpPer10cm, label: 'Warp per 10 cms' });
    if (inspection.constructionPhotos.weftPer10cm) constructionPhotosList.push({ url: inspection.constructionPhotos.weftPer10cm, label: 'Weft per 10 cms' });
    if (inspection.constructionPhotos.pileHeightPhoto) {
      constructionPhotosList.push({ url: inspection.constructionPhotos.pileHeightPhoto, label: inspection.pileHeight ? `Pile Height: ${inspection.pileHeight}` : 'Pile Height' });
    }
    if (inspection.constructionPhotos.productNetWeightPhoto) {
      const nw = inspection.netWeight || inspection.productWeight;
      constructionPhotosList.push({ url: inspection.constructionPhotos.productNetWeightPhoto, label: nw ? `Net Weight: ${nw}` : 'Product Net Weight' });
    }
    if (inspection.constructionPhotos.productGrossWeightPhoto) {
      constructionPhotosList.push({ url: inspection.constructionPhotos.productGrossWeightPhoto, label: inspection.grossWeight ? `Gross Weight: ${inspection.grossWeight}` : 'Product Gross Weight' });
    }
  }
  if (constructionPhotosList.length > 0) photoGroups.push({ title: 'Construction Details', photos: constructionPhotosList });

  // Group 4: Packaging - Stacked Goods + Consumer Pieces + Unit Load
  const packagingPhotos: PhotoItem[] = [];
  if (inspection.stackedGoodsPhoto) packagingPhotos.push({ url: inspection.stackedGoodsPhoto, label: 'Stacked Packed Goods' });
  if (inspection.consumerPieces && inspection.consumerPieces.length > 0) {
    for (const piece of inspection.consumerPieces) {
      if (piece.url) packagingPhotos.push({ url: piece.url, label: piece.label });
    }
  }
  if (inspection.unitLoadEnabled && inspection.unitLoadPhotos && inspection.unitLoadPhotos.length > 0) {
    for (const photo of inspection.unitLoadPhotos) {
      if (photo.url) packagingPhotos.push({ url: photo.url, label: `Unit Load - ${photo.label}` });
    }
  }
  if (packagingPhotos.length > 0) photoGroups.push({ title: 'Packaging & Consumer Pieces', photos: packagingPhotos });

  // Group 5: Quality Check Photos (NOT OK evidence + photos on OK/NA fields)
  const checkPhotosList: PhotoItem[] = [];
  if (inspection.notOkPhotos && inspection.notOkPhotos.length > 0) {
    for (const notOkPhoto of inspection.notOkPhotos) {
      const fieldInfo = OK_NOT_OK_FIELDS.find((f: { key: string }) => f.key === notOkPhoto.field);
      const fieldLabel = fieldInfo ? fieldInfo.label : notOkPhoto.field;
      // Use actual field status instead of assuming NOT OK
      const fieldStatus = (inspection as unknown as Record<string, unknown>)[notOkPhoto.field] as string || '';
      const statusTag = fieldStatus === 'NOT OK' ? 'NOT OK' : fieldStatus === 'OK' ? 'OK' : fieldStatus || '';
      if (notOkPhoto.photo) checkPhotosList.push({ url: notOkPhoto.photo, label: `${fieldLabel} [${statusTag}]` });
    }
  }
  if (checkPhotosList.length > 0) photoGroups.push({ title: 'Quality Check Photos', photos: checkPhotosList });

  // Group 6: Other Photos
  const otherPhotosList: PhotoItem[] = [];
  for (let i = 0; i < inspection.otherPhotos.length; i++) {
    if (inspection.otherPhotos[i]) otherPhotosList.push({ url: inspection.otherPhotos[i], label: `Other Photo ${i + 1}` });
  }
  if (otherPhotosList.length > 0) photoGroups.push({ title: 'Other Photos', photos: otherPhotosList });

  // Flatten all photos for batch loading
  const allPhotos: PhotoItem[] = photoGroups.flatMap(g => g.photos);

  // Smart quality: use thumbnails for large inspections (30+ images)
  if (allPhotos.length > 30) {
    MAX_IMAGE_DIMENSION = MAX_IMAGE_DIMENSION_THUMB;
    JPEG_QUALITY = JPEG_QUALITY_THUMB;
  } else {
    MAX_IMAGE_DIMENSION = MAX_IMAGE_DIMENSION_FULL;
    JPEG_QUALITY = JPEG_QUALITY_FULL;
  }

  // Load all images in parallel (batch of 10 at a time)
  // All images are cropped to consistent 4:3 landscape aspect ratio
  // Uses allSettled to prevent one failed image from killing the entire PDF
  const BATCH_SIZE = 10;
  let loadedCount = 0;
  let failedImages = 0;
  for (let i = 0; i < allPhotos.length; i += BATCH_SIZE) {
    const batch = allPhotos.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(async (photo) => {
      const base64 = await urlToBase64(photo.url);
      if (base64) {
        // Crop to consistent landscape ratio
        const cropped = await cropToLandscape(base64);
        photo.base64 = cropped.data;
        photo.width = cropped.width;
        photo.height = cropped.height;
      } else {
        photo.base64 = null;
      }
      loadedCount++;
      if (onProgress) onProgress(`Processing image ${loadedCount} of ${allPhotos.length}...`);
    }));
    batchResults.forEach((result, idx) => {
      if (result.status === 'rejected') {
        failedImages++;
        batch[idx].base64 = null;
        console.warn(`Failed to load image for PDF: ${batch[idx].url}`, result.reason);
        loadedCount++;
        if (onProgress) onProgress(`Processing image ${loadedCount} of ${allPhotos.length}... (${failedImages} failed)`);
      }
    });
  }
  if (failedImages > 0) {
    console.warn(`${failedImages} images failed to load for PDF generation`);
  }

  // ─── Render photo grid: 4 columns per row ───
  const GRID_COLS = 4;
  const MARGIN = 10;
  const GAP = 3;
  const LABEL_H = 8; // label height above image
  const ROW_HEIGHT = 48; // image cell height
  const SECTION_TITLE_H = 10;

  const gridWidth = pageWidth - MARGIN * 2;
  const cellW = (gridWidth - GAP * (GRID_COLS - 1)) / GRID_COLS;

  // Start photo pages
  let photoPageStarted = false;

  const addPhotoHeader = () => {
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 14, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Photo Documentation', pageWidth / 2, 10, { align: 'center' });
    y = 20;
  };

  const ensurePhotoPage = (neededHeight: number) => {
    if (!photoPageStarted) {
      // First photo section: continue on current page if enough room, else new page
      if (y + neededHeight > pageHeight - 15) {
        doc.addPage();
        addPhotoHeader();
      } else {
        // Enough room — add a small section divider and continue
        y += 4;
        doc.setFillColor(...headerBg);
        doc.rect(M, y, TW, 6, 'F');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('PHOTO DOCUMENTATION', M + 3, y + 4);
        y += 10;
      }
      photoPageStarted = true;
    } else if (y + neededHeight > pageHeight - 15) {
      doc.addPage();
      addPhotoHeader();
    }
  };

  const renderPhotoCell = (photo: PhotoItem, cellX: number, cellY: number) => {
    if (!photo.base64) return;

    // Label above image
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);
    let label = photo.label;
    const maxLblW = cellW - 2;
    while (doc.getTextWidth(label) > maxLblW && label.length > 3) {
      label = label.slice(0, -1);
    }
    if (label !== photo.label) label += '...';
    doc.text(label, cellX + cellW / 2, cellY + 4, { align: 'center' });

    // Image area
    const imgAreaY = cellY + LABEL_H;
    const imgAreaH = ROW_HEIGHT - LABEL_H;
    const imgAreaW = cellW;

    // Light border around image area
    doc.setDrawColor(200, 205, 215);
    doc.setLineWidth(0.3);
    doc.rect(cellX, imgAreaY, imgAreaW, imgAreaH, 'S');

    // All images are pre-cropped to 4:3 landscape — fill the frame
    const pad = 0.5;
    const imgW = imgAreaW - pad * 2;
    const imgH = imgAreaH - pad * 2;
    const imgX = cellX + pad;
    const imgY = imgAreaY + pad;

    try {
      doc.addImage(photo.base64!, 'JPEG', imgX, imgY, imgW, imgH);
    } catch {
      doc.setTextColor(...lightGray);
      doc.setFontSize(6);
      doc.text('Error', cellX + cellW / 2, imgAreaY + imgAreaH / 2, { align: 'center' });
    }
  };

  for (const group of photoGroups) {
    const loadedInGroup = group.photos.filter(p => p.base64);
    if (loadedInGroup.length === 0) continue;

    // rowsNeeded + groupTotalH removed - unused after ensurePhotoPage refactor

    // If the first row won't fit, start new page
    ensurePhotoPage(SECTION_TITLE_H + ROW_HEIGHT + GAP);

    // Section title
    doc.setFillColor(243, 244, 246);
    doc.rect(MARGIN, y, gridWidth, 7, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(group.title, MARGIN + 3, y + 5);
    y += SECTION_TITLE_H;

    // Render rows of 4
    for (let i = 0; i < loadedInGroup.length; i += GRID_COLS) {
      // Check if this row fits
      if (y + ROW_HEIGHT + GAP > pageHeight - 15) {
        ensurePhotoPage(ROW_HEIGHT + GAP + 10);
      }

      const rowPhotos = loadedInGroup.slice(i, i + GRID_COLS);
      for (let col = 0; col < rowPhotos.length; col++) {
        const cellX = MARGIN + col * (cellW + GAP);
        renderPhotoCell(rowPhotos[col], cellX, y);
      }

      y += ROW_HEIGHT + GAP;
    }

    y += 2; // small gap between groups
  }

  // Add footer to last photo page
  if (photoPageStarted) {
    addFooter();
  }

  return doc.output('datauristring').split(',')[1];
}

// ═══════════════════════════════════════════════════════════════════
// V2: Per-Size Inspection PDF
// ═══════════════════════════════════════════════════════════════════

async function generateV2PDF(inspection: FinalInspectionV2, onProgress?: (msg: string) => void): Promise<string> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 10;

  // Table layout constants
  const M = 10; // margin
  const TW = pageWidth - M * 2; // table width
  const ROW_H = 7; // standard row height
  const CELL_PAD = 2; // cell padding

  // Colors
  const primaryColor: [number, number, number] = [5, 150, 105]; // emerald #059669
  const darkGray: [number, number, number] = [55, 65, 81];
  const lightGray: [number, number, number] = [156, 163, 175];
  const successGreen: [number, number, number] = [39, 119, 63];
  const errorRed: [number, number, number] = [185, 28, 28];
  const warningYellow: [number, number, number] = [180, 130, 30];
  const headerBg: [number, number, number] = [5, 150, 105]; // emerald
  const lightBg: [number, number, number] = [245, 247, 250];
  const borderColor: [number, number, number] = [200, 205, 215];

  const companyName = COMPANY_NAMES[inspection.company] || 'Eastern Mills';
  const halfW = TW / 2;
  const LW = 30;
  const VW = halfW - LW;

  // ─── Shared drawing helpers (same as V1) ───

  const checkNewPage = (requiredSpace: number = 20) => {
    if (y + requiredSpace > pageHeight - 15) {
      doc.addPage();
      y = 12;
      return true;
    }
    return false;
  };

  const drawCell = (x: number, cellY: number, w: number, h: number, text: string, opts?: {
    bold?: boolean; fontSize?: number; color?: [number, number, number];
    bg?: [number, number, number]; align?: 'left' | 'center' | 'right';
    textColor?: [number, number, number]; noBorder?: boolean; topBorder?: boolean;
    bottomBorder?: boolean; leftBorder?: boolean; rightBorder?: boolean;
  }) => {
    const o = opts || {};
    if (o.bg) {
      doc.setFillColor(...o.bg);
      doc.rect(x, cellY, w, h, 'F');
    }
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    if (!o.noBorder) {
      doc.rect(x, cellY, w, h, 'S');
    } else {
      if (o.topBorder) doc.line(x, cellY, x + w, cellY);
      if (o.bottomBorder) doc.line(x, cellY + h, x + w, cellY + h);
      if (o.leftBorder) doc.line(x, cellY, x, cellY + h);
      if (o.rightBorder) doc.line(x + w, cellY, x + w, cellY + h);
    }
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    doc.setFontSize(o.fontSize || 8);
    doc.setTextColor(...(o.textColor || o.color || darkGray));
    const align = o.align || 'left';
    let tx = x + CELL_PAD;
    if (align === 'center') tx = x + w / 2;
    else if (align === 'right') tx = x + w - CELL_PAD;
    let displayText = String(text || '-');
    const maxW = w - CELL_PAD * 2;
    while (doc.getTextWidth(displayText) > maxW && displayText.length > 2) {
      displayText = displayText.slice(0, -1);
    }
    if (displayText !== String(text || '-') && text) displayText += '..';
    doc.text(displayText, tx, cellY + h / 2 + (o.fontSize || 8) * 0.12, { align, baseline: 'middle' });
  };

  const drawLabelValue = (x: number, cellY: number, labelW: number, valueW: number, label: string, value: string, h?: number, valueOpts?: {
    color?: [number, number, number]; bold?: boolean;
  }) => {
    const rh = h || ROW_H;
    drawCell(x, cellY, labelW, rh, label, { bold: true, fontSize: 7, bg: lightBg, color: [80, 90, 105] });
    drawCell(x + labelW, cellY, valueW, rh, value, {
      fontSize: 8, color: valueOpts?.color || darkGray, bold: valueOpts?.bold
    });
  };

  const drawSectionHeader = (title: string) => {
    checkNewPage(20);
    doc.setFillColor(...headerBg);
    doc.rect(M, y, TW, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, M + 3, y + 4);
    y += 6;
  };

  const okColor = (val: string): [number, number, number] => {
    if (val === 'OK' || val === 'Yes') return successGreen;
    if (val === 'NOT OK' || val === 'No') return errorRed;
    if (val === 'NA') return lightGray;
    return darkGray;
  };
  const okText = (val: string): string => {
    if (val === 'OK') return 'OK';
    if (val === 'NOT OK') return 'NOT OK';
    if (val === 'NA') return 'N/A';
    if (val === 'Yes') return 'Yes';
    if (val === 'No') return 'No';
    return val || '-';
  };

  const addFooter = () => {
    doc.setDrawColor(229, 231, 235);
    doc.line(M, pageHeight - 12, pageWidth - M, pageHeight - 12);
    doc.setFontSize(6.5);
    doc.setTextColor(...lightGray);
    doc.text(`Generated: ${new Date().toLocaleString()}`, M, pageHeight - 7);
    doc.text(`${companyName} | ${inspection.documentNo}`, pageWidth - M, pageHeight - 7, { align: 'right' });
  };

  // ═══ PAGE 1: Header + PASS/FAIL Banner + Order Info + Articles ═══

  // Header bar
  doc.setFillColor(...headerBg);
  doc.rect(M, y, TW, 12, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(companyName.toUpperCase(), pageWidth / 2, y + 5, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('FINAL INSPECTION REPORT', pageWidth / 2, y + 10, { align: 'center' });
  y += 12;

  // Document No + Date row
  drawLabelValue(M, y, 28, halfW - 28, 'Doc No.', inspection.documentNo);
  drawLabelValue(M + halfW, y, 28, halfW - 28, 'Date', inspection.inspectionDate);
  y += ROW_H;

  // Result badge row (overall)
  const overallResult = inspection.inspectionResult;
  const resultBg: [number, number, number] = overallResult === 'PASS' ? successGreen : errorRed;
  drawCell(M, y, TW * 0.7, ROW_H + 2, `QC Inspector: ${inspection.qcInspectorName}`, { bold: true, fontSize: 9, bg: lightBg });
  doc.setFillColor(...resultBg);
  doc.rect(M + TW * 0.7, y, TW * 0.3, ROW_H + 2, 'F');
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.rect(M + TW * 0.7, y, TW * 0.3, ROW_H + 2, 'S');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(overallResult === 'PASS' ? 'PASSED' : 'FAILED', M + TW * 0.85, y + (ROW_H + 2) / 2 + 1, { align: 'center', baseline: 'middle' });
  y += ROW_H + 2;

  // ─── ORDER INFORMATION ───
  drawSectionHeader('ORDER INFORMATION');

  drawLabelValue(M, y, LW, VW, 'Customer Code', inspection.customerCode);
  drawLabelValue(M + halfW, y, LW, VW, 'Customer PO', inspection.customerPoNo);
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'OPS No.', inspection.opsNo);
  drawLabelValue(M + halfW, y, LW, VW, 'Merchant', inspection.merchant);
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'EMPL Design', inspection.emplDesignNo);
  drawLabelValue(M + halfW, y, LW, VW, 'Color', inspection.colorName);
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'Product Sizes', inspection.productSizes);
  drawLabelValue(M + halfW, y, LW, VW, 'Buyer Design', inspection.buyerDesignName || '-');
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'Sizes Inspected', String(inspection.sizeInspections.length));
  drawLabelValue(M + halfW, y, LW, VW, 'Total Order Qty', String(inspection.totalOrderQty));
  y += ROW_H;

  y += 2;

  // ─── INSPECTED ARTICLES TABLE ───
  if (inspection.inspectedArticles && inspection.inspectedArticles.length > 0) {
    checkNewPage(40);
    drawSectionHeader('INSPECTED ARTICLES');

    const cols = [TW * 0.35, TW * 0.15, TW * 0.2, TW * 0.15, TW * 0.15];
    const headers = ['Article Name', 'Size', 'Color', 'Total Pcs', 'Inspected'];
    let cx = M;
    headers.forEach((h, i) => {
      drawCell(cx, y, cols[i], ROW_H, h, { bold: true, fontSize: 7, bg: lightBg, align: 'center' });
      cx += cols[i];
    });
    y += ROW_H;

    inspection.inspectedArticles.forEach((article) => {
      checkNewPage();
      cx = M;
      drawCell(cx, y, cols[0], ROW_H, article.articleName || '-', { fontSize: 7.5 });
      cx += cols[0];
      drawCell(cx, y, cols[1], ROW_H, article.size || '-', { fontSize: 7.5, align: 'center' });
      cx += cols[1];
      drawCell(cx, y, cols[2], ROW_H, article.color || '-', { fontSize: 7.5, align: 'center' });
      cx += cols[2];
      drawCell(cx, y, cols[3], ROW_H, String(article.pcs || 0), { fontSize: 7.5, align: 'center' });
      cx += cols[3];
      drawCell(cx, y, cols[4], ROW_H, String(article.inspectedQty || article.pcs || 0), { fontSize: 8, align: 'center', bold: true, color: primaryColor });
      y += ROW_H;
    });

    // Total row
    checkNewPage();
    const totalPcs = inspection.inspectedArticles.reduce((sum, a) => sum + (a.pcs || 0), 0);
    const totalInspected = inspection.inspectedArticles.reduce((sum, a) => sum + (a.inspectedQty || a.pcs || 0), 0);
    cx = M;
    drawCell(cx, y, cols[0] + cols[1] + cols[2], ROW_H, 'TOTAL', { bold: true, fontSize: 8, bg: lightBg, align: 'right' });
    cx += cols[0] + cols[1] + cols[2];
    drawCell(cx, y, cols[3], ROW_H, String(totalPcs), { bold: true, fontSize: 8, bg: lightBg, align: 'center' });
    cx += cols[3];
    drawCell(cx, y, cols[4], ROW_H, String(totalInspected), { bold: true, fontSize: 8, bg: lightBg, align: 'center', color: primaryColor });
    y += ROW_H;
    y += 2;
  }

  // ─── AQL SAMPLING (Global) ───
  checkNewPage(35);
  drawSectionHeader('AQL SAMPLING');

  drawLabelValue(M, y, LW, VW, 'Total Order Qty', String(inspection.totalOrderQty));
  drawLabelValue(M + halfW, y, LW, VW, 'Inspected Lot', String(inspection.inspectedLotQty));
  y += ROW_H;

  drawLabelValue(M, y, LW, VW, 'AQL Level', inspection.aql || '2.5');
  drawLabelValue(M + halfW, y, LW, VW, 'Sample Size', String(inspection.sampleSize));
  y += ROW_H;

  // AQL Z1.4 details
  if (inspection.codeLetter || inspection.acceptNumber !== undefined) {
    const aqlW = TW / 4;
    const aqlHeaders = ['Code Letter', 'Sample Size', 'Accept \u2264', 'Reject \u2265'];
    let ax = M;
    aqlHeaders.forEach((h) => {
      drawCell(ax, y, aqlW, 6, h, { bold: true, fontSize: 6.5, bg: [235, 245, 238], align: 'center', color: [80, 90, 105] });
      ax += aqlW;
    });
    y += 6;

    const effectiveCode = inspection.effectiveCodeLetter || inspection.codeLetter || '-';
    ax = M;
    drawCell(ax, y, aqlW, 8, effectiveCode, { bold: true, fontSize: 10, align: 'center' });
    ax += aqlW;
    drawCell(ax, y, aqlW, 8, String(inspection.calculatedSampleSize || inspection.sampleSize), { bold: true, fontSize: 10, align: 'center' });
    ax += aqlW;
    drawCell(ax, y, aqlW, 8, String(inspection.acceptNumber ?? '-'), { bold: true, fontSize: 10, align: 'center', color: successGreen });
    ax += aqlW;
    drawCell(ax, y, aqlW, 8, String(inspection.rejectNumber ?? '-'), { bold: true, fontSize: 10, align: 'center', color: errorRed });
    y += 8;

    if (inspection.isAutoResult !== undefined) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...lightGray);
      const resultNote = inspection.resultOverridden
        ? 'Result: Inspector override'
        : inspection.isAutoResult
          ? 'Result: Auto-determined per Z1.4-2008'
          : 'Result: Manually entered';
      doc.text(resultNote, M + 2, y + 4);
      y += 5;
    }
  }

  // Accepted/Rejected row
  checkNewPage();
  drawLabelValue(M, y, LW, VW, 'Accepted Qty', String(inspection.acceptedQty), ROW_H, { color: successGreen, bold: true });
  drawLabelValue(M + halfW, y, LW, VW, 'Rejected Qty', String(inspection.rejectedQty), ROW_H, { color: errorRed, bold: true });
  y += ROW_H;
  y += 2;

  addFooter();

  // ═══ Collect ALL photos across all sizes for quality threshold calc ═══

  interface PhotoItem {
    url: string;
    label: string;
    base64?: string | null;
    width?: number;
    height?: number;
  }

  // Count total photos across all sizes to determine quality thresholds
  let totalPhotoCount = 0;
  for (const size of inspection.sizeInspections) {
    // Standard photos
    if (size.standardPhotoUrls) {
      totalPhotoCount += Object.values(size.standardPhotoUrls).filter(u => u).length;
    }
    // Construction photos
    if (size.constructionPhotoUrls) {
      totalPhotoCount += Object.values(size.constructionPhotoUrls).filter(u => u).length;
    }
    // Other photos
    if (size.otherPhotoUrls) {
      totalPhotoCount += size.otherPhotoUrls.filter(u => u).length;
    }
    // Stacked goods
    if (size.stackedGoodsPhotoUrl) totalPhotoCount++;
    // Consumer pieces
    if (size.consumerPieces) {
      totalPhotoCount += size.consumerPieces.filter(p => p.url).length;
    }
    // Unit load
    if (size.unitLoadEnabled && size.unitLoadPhotos) {
      totalPhotoCount += size.unitLoadPhotos.filter(p => p.url).length;
    }
    // NOT OK photos
    if (size.notOkPhotos) {
      totalPhotoCount += size.notOkPhotos.filter(p => p.photo).length;
    }
  }

  // Set quality thresholds based on total photo count
  if (totalPhotoCount <= 30) {
    MAX_IMAGE_DIMENSION = 1600;
    JPEG_QUALITY = 0.85;
  } else if (totalPhotoCount <= 100) {
    MAX_IMAGE_DIMENSION = 800;
    JPEG_QUALITY = 0.7;
  } else {
    MAX_IMAGE_DIMENSION = 400;
    JPEG_QUALITY = 0.6;
  }

  // Photo grid constants
  const GRID_COLS = 4;
  const GAP = 3;
  const LABEL_H = 8;
  const PHOTO_ROW_HEIGHT = 48;

  const gridWidth = pageWidth - M * 2;
  const cellW = (gridWidth - GAP * (GRID_COLS - 1)) / GRID_COLS;

  const renderPhotoCell = (photo: PhotoItem, cellX: number, cellY: number) => {
    if (!photo.base64) return;

    // Label above image
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);
    let label = photo.label;
    const maxLblW = cellW - 2;
    while (doc.getTextWidth(label) > maxLblW && label.length > 3) {
      label = label.slice(0, -1);
    }
    if (label !== photo.label) label += '...';
    doc.text(label, cellX + cellW / 2, cellY + 4, { align: 'center' });

    // Image area
    const imgAreaY = cellY + LABEL_H;
    const imgAreaH = PHOTO_ROW_HEIGHT - LABEL_H;
    const imgAreaW = cellW;

    doc.setDrawColor(200, 205, 215);
    doc.setLineWidth(0.3);
    doc.rect(cellX, imgAreaY, imgAreaW, imgAreaH, 'S');

    const pad = 0.5;
    const imgW = imgAreaW - pad * 2;
    const imgH = imgAreaH - pad * 2;
    const imgX = cellX + pad;
    const imgY = imgAreaY + pad;

    try {
      doc.addImage(photo.base64!, 'JPEG', imgX, imgY, imgW, imgH);
    } catch {
      doc.setTextColor(...lightGray);
      doc.setFontSize(6);
      doc.text('Error', cellX + cellW / 2, imgAreaY + imgAreaH / 2, { align: 'center' });
    }
  };

  // ═══ PER-SIZE SECTIONS ═══

  let globalPhotoIndex = 0;

  for (let sIdx = 0; sIdx < inspection.sizeInspections.length; sIdx++) {
    const size = inspection.sizeInspections[sIdx];

    // Continue on same page if room, otherwise new page (avoid wasting space)
    if (sIdx === 0) {
      // First size: add spacing after AQL section
      y += 4;
      checkNewPage(30);
    } else {
      // Subsequent sizes: add a visible divider line
      y += 6;
      checkNewPage(30);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(M, y, M + TW, y);
      y += 6;
    }

    // ─── Size Header Bar ───
    const sizeResultBg: [number, number, number] = size.inspectionResult === 'PASS' ? successGreen : errorRed;
    const sizeLabel = `SIZE: ${size.size} ${size.sizeUnit}`;

    // Full-width header with size name and PASS/FAIL badge
    doc.setFillColor(...headerBg);
    doc.rect(M, y, TW * 0.75, 10, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(sizeLabel, M + 4, y + 7);

    // PASS/FAIL badge
    doc.setFillColor(...sizeResultBg);
    doc.rect(M + TW * 0.75, y, TW * 0.25, 10, 'F');
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.rect(M + TW * 0.75, y, TW * 0.25, 10, 'S');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(size.inspectionResult === 'PASS' ? 'PASSED' : 'FAILED', M + TW * 0.875, y + 6, { align: 'center', baseline: 'middle' });
    y += 12;

    // Size number indicator
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...lightGray);
    doc.text(`Size ${sIdx + 1} of ${inspection.sizeInspections.length}`, M + TW - 2, y, { align: 'right' });
    y += 4;

    // ─── Quality Checks ───
    drawSectionHeader('PRODUCT QUALITY CHECKS');

    drawLabelValue(M, y, LW, VW, 'Approved Sample', okText(size.approvedSampleAvailable), ROW_H, { color: okColor(size.approvedSampleAvailable), bold: true });
    drawLabelValue(M + halfW, y, LW, VW, 'Material/Fibre', size.materialFibreContent);
    y += ROW_H;

    const qcChecks: [string, string][] = [
      ['Motif/Design', size.motifDesignCheck],
      ['Backing', size.backing],
      ['Binding & Edges', size.bindingAndEdges],
      ['Hand Feel', size.handFeel],
      ['Embossing/Carving', size.embossingCarving],
      ['Workmanship', size.workmanship],
      ['Weight Check', size.productQualityWeight],
      ['Tuft Density', size.tuftDensity || '-'],
    ];

    for (let i = 0; i < qcChecks.length; i += 2) {
      checkNewPage();
      const [l1, v1] = qcChecks[i];
      const isCheck1 = ['OK', 'NOT OK', 'NA'].includes(v1);
      drawLabelValue(M, y, LW, VW, l1, okText(v1), ROW_H, isCheck1 ? { color: okColor(v1), bold: true } : undefined);
      if (i + 1 < qcChecks.length) {
        const [l2, v2] = qcChecks[i + 1];
        const isCheck2 = ['OK', 'NOT OK', 'NA'].includes(v2);
        drawLabelValue(M + halfW, y, LW, VW, l2, okText(v2), ROW_H, isCheck2 ? { color: okColor(v2), bold: true } : undefined);
      }
      y += ROW_H;
    }

    // Measurement details
    checkNewPage();
    drawLabelValue(M, y, LW, VW, 'Pile Height', size.pileHeight || '-');
    drawLabelValue(M + halfW, y, LW, VW, 'Product Weight', size.productWeight || '-');
    y += ROW_H;

    drawLabelValue(M, y, LW, VW, 'Size Tolerance', size.sizeTolerance || '-');
    drawLabelValue(M + halfW, y, LW, VW, 'Finishing %', size.finishingPercent || '-');
    y += ROW_H;

    drawLabelValue(M, y, LW, VW, 'Packed %', size.packedPercent || '-');
    if (size.backingNotes) {
      drawLabelValue(M + halfW, y, LW, VW, 'Backing Notes', size.backingNotes);
    }
    y += ROW_H;
    y += 2;

    // ─── Labeling & Marking ───
    checkNewPage(25);
    drawSectionHeader('LABELING & MARKING');

    const labelChecks: [string, string][] = [
      ['Label Placement', size.labelPlacement],
      ['Side Marking', size.sideMarking],
      ['Outer Marking', size.outerMarking],
      ['Inner Pack', size.innerPack],
      ['Care Labels', size.careLabels],
      ['SKU Stickers', size.skuStickers],
      ['UPC Barcodes', size.upcBarcodes],
    ];

    for (let i = 0; i < labelChecks.length; i += 2) {
      checkNewPage();
      const [l1, v1] = labelChecks[i];
      drawLabelValue(M, y, LW, VW, l1, okText(v1), ROW_H, { color: okColor(v1), bold: true });
      if (i + 1 < labelChecks.length) {
        const [l2, v2] = labelChecks[i + 1];
        drawLabelValue(M + halfW, y, LW, VW, l2, okText(v2), ROW_H, { color: okColor(v2), bold: true });
      }
      y += ROW_H;
    }
    y += 2;

    // ─── Packaging ───
    checkNewPage(30);
    drawSectionHeader('PACKAGING');

    drawLabelValue(M, y, LW, VW, 'Carton Ply', size.cartonPly || '-');
    drawLabelValue(M + halfW, y, LW, VW, 'Drop Test', okText(size.cartonDropTest), ROW_H, { color: okColor(size.cartonDropTest), bold: true });
    y += ROW_H;

    drawLabelValue(M, y, LW, VW, 'Packing Type', size.packingType || '-');
    drawLabelValue(M + halfW, y, LW, VW, 'Bale Numbering', okText(size.cartonBaleNumbering), ROW_H, { color: okColor(size.cartonBaleNumbering), bold: true });
    y += ROW_H;

    drawLabelValue(M, y, LW, VW, 'Gross Weight', size.grossWeight || '-');
    drawLabelValue(M + halfW, y, LW, VW, 'Net Weight', size.netWeight || '-');
    y += ROW_H;

    drawLabelValue(M, y, LW, VW, 'Pcs/Carton', size.pcsPerCartonBale || '-');
    drawLabelValue(M + halfW, y, LW, VW, 'Pcs/Polybag', size.pcsPerPolybag || '-');
    y += ROW_H;

    const cartonDimension = `${size.cartonMeasurementL || '-'} \u00D7 ${size.cartonMeasurementW || '-'} \u00D7 ${size.cartonMeasurementH || '-'}`;
    drawLabelValue(M, y, LW, TW - LW, 'Carton Dims (L\u00D7W\u00D7H)', cartonDimension);
    y += ROW_H;
    y += 2;

    // ─── Additional Quality Checks ───
    checkNewPage(20);
    drawSectionHeader('ADDITIONAL QUALITY CHECKS');

    const addlChecks: [string, string][] = [
      ['Carton Dimension', size.cartonDimension],
      ['Product Label', size.productLabel],
      ['Carton Label', size.cartonLabel],
      ['Barcode Scan', size.barcodeScan],
    ];
    for (let i = 0; i < addlChecks.length; i += 2) {
      checkNewPage();
      const [l1, v1] = addlChecks[i];
      drawLabelValue(M, y, LW, VW, l1, okText(v1), ROW_H, { color: okColor(v1), bold: true });
      if (i + 1 < addlChecks.length) {
        const [l2, v2] = addlChecks[i + 1];
        drawLabelValue(M + halfW, y, LW, VW, l2, okText(v2), ROW_H, { color: okColor(v2), bold: true });
      }
      y += ROW_H;
    }
    y += 2;

    // ─── Defect Tracking ───
    if (size.defects && size.defects.length > 0) {
      checkNewPage(30);
      drawSectionHeader('DEFECT TRACKING');

      if (size.dpciSkuStyleNumber || size.styleDescription) {
        drawLabelValue(M, y, LW, VW, 'DPCI/SKU/Style', size.dpciSkuStyleNumber || '-');
        drawLabelValue(M + halfW, y, LW, VW, 'Style Desc.', size.styleDescription || '-');
        y += ROW_H;
      }

      const dCols = [TW * 0.2, TW * 0.15, TW * 0.15, TW * 0.5];
      const dHeaders = ['Defect Code', 'Major', 'Minor', 'Description'];
      let dx = M;
      dHeaders.forEach((h, i) => {
        drawCell(dx, y, dCols[i], ROW_H, h, { bold: true, fontSize: 7, bg: lightBg, align: 'center' });
        dx += dCols[i];
      });
      y += ROW_H;

      let totalMajor = 0;
      let totalMinor = 0;

      size.defects.forEach((defect) => {
        checkNewPage();
        dx = M;
        drawCell(dx, y, dCols[0], ROW_H, defect.defectCode || '-', { fontSize: 7.5, align: 'center' });
        dx += dCols[0];
        drawCell(dx, y, dCols[1], ROW_H, String(defect.majorCount), { fontSize: 7.5, align: 'center', color: defect.majorCount > 0 ? errorRed : darkGray });
        dx += dCols[1];
        drawCell(dx, y, dCols[2], ROW_H, String(defect.minorCount), { fontSize: 7.5, align: 'center', color: defect.minorCount > 0 ? warningYellow : darkGray });
        dx += dCols[2];
        drawCell(dx, y, dCols[3], ROW_H, defect.description || '-', { fontSize: 7.5 });
        y += ROW_H;
        totalMajor += defect.majorCount || 0;
        totalMinor += defect.minorCount || 0;
      });

      // Totals
      checkNewPage();
      dx = M;
      drawCell(dx, y, dCols[0], ROW_H, 'TOTAL', { bold: true, fontSize: 8, bg: lightBg, align: 'center' });
      dx += dCols[0];
      drawCell(dx, y, dCols[1], ROW_H, String(totalMajor), { bold: true, fontSize: 8, bg: lightBg, align: 'center', color: errorRed });
      dx += dCols[1];
      drawCell(dx, y, dCols[2], ROW_H, String(totalMinor), { bold: true, fontSize: 8, bg: lightBg, align: 'center', color: warningYellow });
      dx += dCols[2];
      drawCell(dx, y, dCols[3], ROW_H, '', { bg: lightBg });
      y += ROW_H;
    }
    y += 2;

    // ─── QC Remarks ───
    checkNewPage(20);
    drawSectionHeader('QC INSPECTOR REMARKS');

    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    doc.setFontSize(8);
    const remarks = doc.splitTextToSize(size.qcInspectorRemarks || 'No remarks provided', TW - 6);
    const remarksH = Math.max(remarks.length * 4.5 + 4, 12);

    if (y + remarksH > pageHeight - 15) {
      doc.addPage();
      y = 12;
    }

    doc.rect(M, y, TW, remarksH, 'S');
    doc.text(remarks, M + 3, y + 4);
    y += remarksH;
    y += 2;

    // ─── Photos for this size ───
    const sizePhotos: PhotoItem[] = [];

    // Standard photos
    if (size.standardPhotoUrls) {
      for (const pt of PHOTO_TYPES) {
        const url = size.standardPhotoUrls[pt.key];
        if (url) sizePhotos.push({ url, label: pt.label });
      }
    }

    // Construction photos
    if (size.constructionPhotoUrls) {
      for (const pt of CONSTRUCTION_PHOTO_TYPES) {
        const url = size.constructionPhotoUrls[pt.key];
        if (url) {
          let photoLabel: string = pt.label;
          if (pt.key === 'pileHeightPhoto' && size.pileHeight) photoLabel = `Pile Height: ${size.pileHeight}`;
          if (pt.key === 'productNetWeightPhoto' && size.netWeight) photoLabel = `Net Weight: ${size.netWeight}`;
          if (pt.key === 'productGrossWeightPhoto' && size.grossWeight) photoLabel = `Gross Weight: ${size.grossWeight}`;
          sizePhotos.push({ url, label: photoLabel });
        }
      }
    }

    // Stacked goods
    if (size.stackedGoodsPhotoUrl) {
      sizePhotos.push({ url: size.stackedGoodsPhotoUrl, label: 'Stacked Packed Goods' });
    }

    // Consumer pieces
    if (size.consumerPieces) {
      for (const piece of size.consumerPieces) {
        if (piece.url) sizePhotos.push({ url: piece.url, label: piece.label });
      }
    }

    // Unit load
    if (size.unitLoadEnabled && size.unitLoadPhotos) {
      for (const photo of size.unitLoadPhotos) {
        if (photo.url) sizePhotos.push({ url: photo.url, label: `Unit Load - ${photo.label}` });
      }
    }

    // NOT OK photos
    if (size.notOkPhotos) {
      for (const notOkPhoto of size.notOkPhotos) {
        const fieldInfo = OK_NOT_OK_FIELDS.find((f: { key: string }) => f.key === notOkPhoto.field);
        const fieldLabel = fieldInfo ? fieldInfo.label : notOkPhoto.field;
        const fieldStatus = (size as unknown as Record<string, unknown>)[notOkPhoto.field] as string || '';
        const statusTag = fieldStatus === 'NOT OK' ? 'NOT OK' : fieldStatus === 'OK' ? 'OK' : fieldStatus || '';
        if (notOkPhoto.photo) sizePhotos.push({ url: notOkPhoto.photo, label: `${fieldLabel} [${statusTag}]` });
      }
    }

    // Other photos
    if (size.otherPhotoUrls) {
      for (let i = 0; i < size.otherPhotoUrls.length; i++) {
        if (size.otherPhotoUrls[i]) sizePhotos.push({ url: size.otherPhotoUrls[i], label: `Other Photo ${i + 1}` });
      }
    }

    // Load and render photos for this size
    if (sizePhotos.length > 0) {
      // Load images in batches
      const BATCH_SIZE = 10;
      for (let i = 0; i < sizePhotos.length; i += BATCH_SIZE) {
        const batch = sizePhotos.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(batch.map(async (photo) => {
          const base64 = await urlToBase64(photo.url);
          if (base64) {
            const cropped = await cropToLandscape(base64);
            photo.base64 = cropped.data;
            photo.width = cropped.width;
            photo.height = cropped.height;
          } else {
            photo.base64 = null;
          }
          globalPhotoIndex++;
          if (onProgress) onProgress(`Processing image ${globalPhotoIndex} of ${totalPhotoCount}...`);
        }));
        batchResults.forEach((result, idx) => {
          if (result.status === 'rejected') {
            batch[idx].base64 = null;
            globalPhotoIndex++;
            if (onProgress) onProgress(`Processing image ${globalPhotoIndex} of ${totalPhotoCount}...`);
          }
        });
      }

      const loadedPhotos = sizePhotos.filter(p => p.base64);
      if (loadedPhotos.length > 0) {
        // Photo section header
        checkNewPage(PHOTO_ROW_HEIGHT + 16);
        drawSectionHeader('PHOTOS');

        // Render photo grid: 4 per row
        for (let i = 0; i < loadedPhotos.length; i += GRID_COLS) {
          if (y + PHOTO_ROW_HEIGHT + GAP > pageHeight - 15) {
            doc.addPage();
            y = 12;
          }

          const rowPhotos = loadedPhotos.slice(i, i + GRID_COLS);
          for (let col = 0; col < rowPhotos.length; col++) {
            const cellX = M + col * (cellW + GAP);
            renderPhotoCell(rowPhotos[col], cellX, y);
          }
          y += PHOTO_ROW_HEIGHT + GAP;
        }
      }
    }

    addFooter();
  }

  // ═══ FINAL PAGE: Overall Result Summary ═══
  doc.addPage();
  y = 10;

  doc.setFillColor(...headerBg);
  doc.rect(M, y, TW, 12, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('OVERALL RESULT SUMMARY', pageWidth / 2, y + 8, { align: 'center' });
  y += 16;

  // Summary table header
  const sumCols = [TW * 0.5, TW * 0.25, TW * 0.25];
  const sumHeaders = ['Size', 'Result', 'Defects'];
  let sx = M;
  sumHeaders.forEach((h, i) => {
    drawCell(sx, y, sumCols[i], ROW_H + 1, h, { bold: true, fontSize: 8, bg: lightBg, align: 'center' });
    sx += sumCols[i];
  });
  y += ROW_H + 1;

  // One row per size
  for (const size of inspection.sizeInspections) {
    checkNewPage();
    sx = M;
    drawCell(sx, y, sumCols[0], ROW_H, `${size.size} ${size.sizeUnit}`, { fontSize: 8, bold: true });
    sx += sumCols[0];

    const sizeResBg: [number, number, number] = size.inspectionResult === 'PASS' ? successGreen : errorRed;
    drawCell(sx, y, sumCols[1], ROW_H, size.inspectionResult, { fontSize: 8, bold: true, color: sizeResBg, align: 'center' });
    sx += sumCols[1];

    const defectCount = size.defects ? size.defects.reduce((sum, d) => sum + (d.majorCount || 0) + (d.minorCount || 0), 0) : 0;
    drawCell(sx, y, sumCols[2], ROW_H, String(defectCount), { fontSize: 8, align: 'center', color: defectCount > 0 ? errorRed : darkGray });
    y += ROW_H;
  }

  y += 6;

  // Overall result badge
  const finalBg: [number, number, number] = overallResult === 'PASS' ? successGreen : errorRed;
  doc.setFillColor(...finalBg);
  doc.rect(M, y, TW, 14, 'F');
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.rect(M, y, TW, 14, 'S');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`OVERALL: ${overallResult === 'PASS' ? 'PASSED' : 'FAILED'}`, pageWidth / 2, y + 9, { align: 'center', baseline: 'middle' });
  y += 18;

  // Stats line
  const passCount = inspection.sizeInspections.filter(s => s.inspectionResult === 'PASS').length;
  const failCount = inspection.sizeInspections.filter(s => s.inspectionResult === 'FAIL').length;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.text(`${passCount} size(s) passed, ${failCount} size(s) failed out of ${inspection.sizeInspections.length} total`, pageWidth / 2, y + 2, { align: 'center' });

  addFooter();

  return doc.output('datauristring').split(',')[1];
}
