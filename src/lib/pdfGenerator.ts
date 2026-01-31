import { jsPDF } from 'jspdf';
import { FinalInspection, COMPANY_NAMES, OK_NOT_OK_FIELDS } from '../types';

// Max image dimension for PDF - high quality for readability
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.85; // 85% quality - clear and readable

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

export async function generateFinalInspectionPDF(inspection: FinalInspection): Promise<string> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15;

  // Colors - Professional, muted corporate palette
  const primaryColor: [number, number, number] = [0, 82, 94]; // Deep teal - professional & corporate
  const darkGray: [number, number, number] = [55, 65, 81];
  const lightGray: [number, number, number] = [156, 163, 175];
  const successGreen: [number, number, number] = [39, 119, 63]; // Deep forest green
  const errorRed: [number, number, number] = [185, 28, 28]; // Deep crimson
  const warningYellow: [number, number, number] = [180, 130, 30]; // Dark amber

  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Company name from selection
  const companyName = COMPANY_NAMES[inspection.company] || 'Eastern Mills';
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(companyName.toUpperCase(), pageWidth / 2, 10, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Final Inspection Report', pageWidth / 2, 18, { align: 'center' });

  // Document number
  doc.setFontSize(9);
  doc.text(`Document No: ${inspection.documentNo}`, pageWidth / 2, 26, { align: 'center' });

  y = 44;

  // Result badge
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  if (inspection.inspectionResult === 'PASS') {
    doc.setFillColor(...successGreen);
    doc.roundedRect(pageWidth / 2 - 25, y - 6, 50, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('PASSED', pageWidth / 2, y + 2, { align: 'center' });
  } else {
    doc.setFillColor(...errorRed);
    doc.roundedRect(pageWidth / 2 - 25, y - 6, 50, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('FAILED', pageWidth / 2, y + 2, { align: 'center' });
  }
  y += 18;

  // Check if we need a new page
  const checkNewPage = (requiredSpace: number = 30) => {
    if (y + requiredSpace > pageHeight - 20) {
      doc.addPage();
      y = 20;
      return true;
    }
    return false;
  };

  // Section helper
  const addSection = (title: string) => {
    checkNewPage(40);
    doc.setFillColor(243, 244, 246);
    doc.rect(15, y - 4, pageWidth - 30, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(title, 18, y + 1);
    y += 10;
  };

  // Field helper
  const addField = (label: string, value: string | number, x: number = 15) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...lightGray);
    doc.setFontSize(8);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    doc.setFontSize(9);
    doc.text(String(value || '-'), x, y + 4);
  };

  const addRow = (fields: [string, string | number][]) => {
    checkNewPage();
    const colWidth = (pageWidth - 30) / fields.length;
    fields.forEach((field, i) => {
      const x = 15 + (i * colWidth);
      addField(field[0], field[1], x);
    });
    y += 12;
  };

  // Check result helper (OK/NOT OK)
  const checkResult = (val: string, label: string, x: number, colWidth: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...lightGray);
    doc.setFontSize(7);
    // Truncate label if too long
    const maxLabelWidth = colWidth - 5;
    let displayLabel = label;
    while (doc.getTextWidth(displayLabel) > maxLabelWidth && displayLabel.length > 3) {
      displayLabel = displayLabel.slice(0, -1);
    }
    if (displayLabel !== label) displayLabel += '...';
    doc.text(displayLabel, x, y);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    if (val === 'OK' || val === 'Yes') {
      doc.setTextColor(...successGreen);
      doc.text('OK', x, y + 4);
    } else if (val === 'NOT OK' || val === 'No') {
      doc.setTextColor(...errorRed);
      doc.text('NOT OK', x, y + 4);
    } else if (val === 'NA') {
      doc.setTextColor(...lightGray);
      doc.text('N/A', x, y + 4);
    } else {
      doc.setTextColor(...lightGray);
      doc.text('-', x, y + 4);
    }
  };

  // Yes/No helper
  const yesNoResult = (val: string, label: string, x: number, colWidth: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...lightGray);
    doc.setFontSize(7);
    const maxLabelWidth = colWidth - 5;
    let displayLabel = label;
    while (doc.getTextWidth(displayLabel) > maxLabelWidth && displayLabel.length > 3) {
      displayLabel = displayLabel.slice(0, -1);
    }
    if (displayLabel !== label) displayLabel += '...';
    doc.text(displayLabel, x, y);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    if (val === 'Yes') {
      doc.setTextColor(...successGreen);
      doc.text('Yes', x, y + 4);
    } else {
      doc.setTextColor(...warningYellow);
      doc.text('No', x, y + 4);
    }
  };

  // Order Information Section
  addSection('Order Information');
  addRow([['Inspection Date', inspection.inspectionDate], ['Inspector', inspection.qcInspectorName]]);
  addRow([['Customer Code', inspection.customerCode], ['Customer PO', inspection.customerPoNo]]);
  addRow([['OPS No.', inspection.opsNo], ['Merchant', inspection.merchant]]);
  addRow([['EMPL Design', inspection.emplDesignNo], ['Color', inspection.colorName]]);
  addRow([['Product Sizes', inspection.productSizes], ['Buyer Design', inspection.buyerDesignName || '-']]);

  y += 4;

  // Inspected Articles Section (if available)
  if (inspection.inspectedArticles && inspection.inspectedArticles.length > 0) {
    addSection('Inspected Articles');

    // Table header
    checkNewPage(20);
    doc.setFillColor(243, 244, 246);
    doc.rect(15, y - 2, pageWidth - 30, 8, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);

    const articleColW = (pageWidth - 30) / 5;
    doc.text('Article Name', 18, y + 3);
    doc.text('Size', 18 + articleColW, y + 3);
    doc.text('Color', 18 + articleColW * 2, y + 3);
    doc.text('Total Pcs', 18 + articleColW * 3, y + 3);
    doc.text('Inspected', 18 + articleColW * 4, y + 3);
    y += 10;

    // Article rows
    inspection.inspectedArticles.forEach((article) => {
      checkNewPage();
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkGray);
      doc.setFontSize(8);

      // Truncate article name if needed
      let articleName = article.articleName || '-';
      const maxArticleWidth = articleColW - 5;
      while (doc.getTextWidth(articleName) > maxArticleWidth && articleName.length > 3) {
        articleName = articleName.slice(0, -1);
      }
      if (articleName !== article.articleName && article.articleName) articleName += '...';

      doc.text(articleName, 18, y);
      doc.text(article.size || '-', 18 + articleColW, y);
      doc.text(article.color || '-', 18 + articleColW * 2, y);
      doc.text(String(article.pcs || 0), 18 + articleColW * 3, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text(String(article.inspectedQty || article.pcs || 0), 18 + articleColW * 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkGray);
      y += 8;
    });

    // Total row
    checkNewPage();
    const totalPcs = inspection.inspectedArticles.reduce((sum, a) => sum + (a.pcs || 0), 0);
    const totalInspected = inspection.inspectedArticles.reduce((sum, a) => sum + (a.inspectedQty || a.pcs || 0), 0);
    doc.setFillColor(243, 244, 246);
    doc.rect(15, y - 2, pageWidth - 30, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TOTAL', 18, y + 3);
    doc.text(String(totalPcs), 18 + articleColW * 3, y + 3);
    doc.setTextColor(...primaryColor);
    doc.text(String(totalInspected), 18 + articleColW * 4, y + 3);
    y += 12;
  }

  y += 4;

  // Inspection Quantities Section
  addSection('Inspection Quantities');
  addRow([['Total Order Qty', inspection.totalOrderQty], ['Inspected Lot Qty', inspection.inspectedLotQty]]);
  addRow([['AQL', inspection.aql], ['Sample Size', inspection.sampleSize]]);

  // AQL Z1.4-2008 Calculation Details (if available)
  if (inspection.codeLetter || inspection.acceptNumber !== undefined) {
    checkNewPage();
    doc.setFillColor(243, 248, 243); // Light green background
    doc.rect(15, y - 2, pageWidth - 30, 20, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('AQL Z1.4-2008 (Level II)', 18, y + 2);

    const aqlColW = (pageWidth - 36) / 4;
    doc.setFontSize(7);
    doc.setTextColor(...lightGray);
    doc.text('Code Letter', 18, y + 7);
    doc.text('Sample Size', 18 + aqlColW, y + 7);
    doc.text('Accept ≤', 18 + aqlColW * 2, y + 7);
    doc.text('Reject ≥', 18 + aqlColW * 3, y + 7);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);
    const effectiveCode = inspection.effectiveCodeLetter || inspection.codeLetter || '-';
    doc.text(effectiveCode, 18, y + 13);
    doc.text(String(inspection.calculatedSampleSize || inspection.sampleSize), 18 + aqlColW, y + 13);
    doc.setTextColor(...successGreen);
    doc.text(String(inspection.acceptNumber ?? '-'), 18 + aqlColW * 2, y + 13);
    doc.setTextColor(...errorRed);
    doc.text(String(inspection.rejectNumber ?? '-'), 18 + aqlColW * 3, y + 13);
    y += 22;

    // Show if result was auto-determined or overridden
    if (inspection.isAutoResult !== undefined) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...lightGray);
      const resultNote = inspection.resultOverridden
        ? 'Result: Inspector override'
        : inspection.isAutoResult
          ? 'Result: Auto-determined per Z1.4-2008'
          : 'Result: Manually entered';
      doc.text(resultNote, 18, y);
      y += 6;
    }
  }

  // Accepted/Rejected with colored values
  checkNewPage();
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...lightGray);
  doc.setFontSize(8);
  doc.text('Accepted Qty', 15, y);
  doc.text('Rejected Qty', 15 + (pageWidth - 30) / 2, y);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...successGreen);
  doc.text(String(inspection.acceptedQty), 15, y + 5);
  doc.setTextColor(...errorRed);
  doc.text(String(inspection.rejectedQty), 15 + (pageWidth - 30) / 2, y + 5);
  y += 14;

  y += 4;

  // Product Quality Checks Section
  addSection('Product Quality Checks');

  // Approved Sample Available
  checkNewPage();
  const col3W = (pageWidth - 30) / 3;
  yesNoResult(inspection.approvedSampleAvailable, 'Approved Sample Available', 15, col3W);
  addField('Material/Fibre', inspection.materialFibreContent, 15 + col3W);
  addField('Tuft Density', inspection.tuftDensity, 15 + col3W * 2);
  y += 12;

  // OkNotOk checks row 1
  checkNewPage();
  const col4W = (pageWidth - 30) / 4;
  checkResult(inspection.motifDesignCheck, 'Motif/Design', 15, col4W);
  checkResult(inspection.backing, 'Backing', 15 + col4W, col4W);
  checkResult(inspection.bindingAndEdges, 'Binding & Edges', 15 + col4W * 2, col4W);
  checkResult(inspection.handFeel, 'Hand Feel', 15 + col4W * 3, col4W);
  y += 12;

  // OkNotOk checks row 2
  checkNewPage();
  checkResult(inspection.embossingCarving, 'Embossing/Carving', 15, col4W);
  checkResult(inspection.workmanship, 'Workmanship', 15 + col4W, col4W);
  checkResult(inspection.productQualityWeight, 'Weight Check', 15 + col4W * 2, col4W);
  addField('Pile Height', inspection.pileHeight, 15 + col4W * 3);
  y += 12;

  // Additional product info
  checkNewPage();
  addField('Product Weight', inspection.productWeight, 15);
  addField('Size Tolerance', inspection.sizeTolerance, 15 + col3W);
  addField('Finishing %', inspection.finishingPercent, 15 + col3W * 2);
  y += 12;

  checkNewPage();
  addField('Packed %', inspection.packedPercent, 15);
  if (inspection.backingNotes) {
    addField('Backing Notes', inspection.backingNotes, 15 + col3W);
  }
  y += 12;

  y += 4;

  // Labeling & Marking Section
  addSection('Labeling & Marking');
  checkNewPage();
  checkResult(inspection.labelPlacement, 'Label Placement', 15, col4W);
  checkResult(inspection.sideMarking, 'Side Marking', 15 + col4W, col4W);
  checkResult(inspection.outerMarking, 'Outer Marking', 15 + col4W * 2, col4W);
  checkResult(inspection.innerPack, 'Inner Pack', 15 + col4W * 3, col4W);
  y += 12;

  checkNewPage();
  checkResult(inspection.careLabels, 'Care Labels', 15, col4W);
  checkResult(inspection.skuStickers, 'SKU Stickers', 15 + col4W, col4W);
  checkResult(inspection.upcBarcodes, 'UPC Barcodes', 15 + col4W * 2, col4W);
  y += 12;

  y += 4;

  // Packaging Section
  addSection('Packaging');
  checkNewPage();
  addField('Carton Ply', inspection.cartonPly, 15);
  checkResult(inspection.cartonDropTest, 'Drop Test', 15 + col4W, col4W);
  addField('Packing Type', inspection.packingType, 15 + col4W * 2);
  checkResult(inspection.cartonBaleNumbering, 'Bale Numbering', 15 + col4W * 3, col4W);
  y += 12;

  checkNewPage();
  addField('Gross Weight', inspection.grossWeight, 15);
  addField('Net Weight', inspection.netWeight, 15 + col4W);
  addField('Pcs/Carton-Bale', inspection.pcsPerCartonBale, 15 + col4W * 2);
  addField('Pcs/Polybag', inspection.pcsPerPolybag, 15 + col4W * 3);
  y += 12;

  checkNewPage();
  const cartonDimension = `${inspection.cartonMeasurementL || '-'} × ${inspection.cartonMeasurementW || '-'} × ${inspection.cartonMeasurementH || '-'}`;
  addField('Carton Dimensions (L×W×H)', cartonDimension, 15);
  y += 12;

  y += 4;

  // Original Quality Checks Section (kept for compatibility)
  addSection('Additional Quality Checks');
  checkNewPage();
  checkResult(inspection.cartonDimension, 'Carton Dimension', 15, col4W);
  checkResult(inspection.productLabel, 'Product Label', 15 + col4W, col4W);
  checkResult(inspection.cartonLabel, 'Carton Label', 15 + col4W * 2, col4W);
  checkResult(inspection.barcodeScan, 'Barcode Scan', 15 + col4W * 3, col4W);
  y += 14;

  y += 4;

  // Defect Tracking Section
  if (inspection.defects && inspection.defects.length > 0) {
    addSection('Defect Tracking');

    // DPCI/SKU info
    if (inspection.dpciSkuStyleNumber || inspection.styleDescription) {
      checkNewPage();
      addField('DPCI/SKU/Style No.', inspection.dpciSkuStyleNumber, 15);
      addField('Style Description', inspection.styleDescription, 15 + (pageWidth - 30) / 2);
      y += 12;
    }

    // Defect table header
    checkNewPage(20);
    doc.setFillColor(243, 244, 246);
    doc.rect(15, y - 2, pageWidth - 30, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkGray);

    const defectColW = (pageWidth - 30) / 4;
    doc.text('Defect Code', 18, y + 3);
    doc.text('Major', 18 + defectColW, y + 3);
    doc.text('Minor', 18 + defectColW * 2, y + 3);
    doc.text('Description', 18 + defectColW * 3, y + 3);
    y += 10;

    // Defect rows
    let totalMajor = 0;
    let totalMinor = 0;

    inspection.defects.forEach((defect) => {
      checkNewPage();
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkGray);
      doc.setFontSize(8);

      doc.text(defect.defectCode || '-', 18, y);
      doc.text(String(defect.majorCount), 18 + defectColW, y);
      doc.text(String(defect.minorCount), 18 + defectColW * 2, y);

      // Truncate description if needed
      let desc = defect.description || '-';
      const maxDescWidth = defectColW - 5;
      while (doc.getTextWidth(desc) > maxDescWidth && desc.length > 3) {
        desc = desc.slice(0, -1);
      }
      if (desc !== defect.description && defect.description) desc += '...';
      doc.text(desc, 18 + defectColW * 3, y);

      totalMajor += defect.majorCount || 0;
      totalMinor += defect.minorCount || 0;
      y += 8;
    });

    // Totals row
    checkNewPage();
    doc.setFillColor(243, 244, 246);
    doc.rect(15, y - 2, pageWidth - 30, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TOTAL', 18, y + 3);
    doc.setTextColor(...errorRed);
    doc.text(String(totalMajor), 18 + defectColW, y + 3);
    doc.setTextColor(...warningYellow);
    doc.text(String(totalMinor), 18 + defectColW * 2, y + 3);
    y += 12;
  }

  y += 4;

  // Remarks Section
  addSection('QC Inspector Remarks');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.setFontSize(9);
  const remarks = doc.splitTextToSize(inspection.qcInspectorRemarks || 'No remarks provided', pageWidth - 36);

  // Check if remarks fit on current page
  const remarksHeight = remarks.length * 5;
  if (y + remarksHeight > pageHeight - 20) {
    doc.addPage();
    y = 20;
  }

  doc.text(remarks, 18, y);
  y += remarks.length * 5 + 5;

  // Footer on current page
  const addFooter = () => {
    doc.setDrawColor(229, 231, 235);
    doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
    doc.setFontSize(7);
    doc.setTextColor(...lightGray);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, pageHeight - 8);
    doc.text(`${companyName} | ${inspection.documentNo}`, pageWidth - 15, pageHeight - 8, { align: 'right' });
  };

  addFooter();

  // Collect all photos with labels
  interface PhotoItem {
    url: string;
    label: string;
    base64?: string | null;
    width?: number;
    height?: number;
  }

  const allPhotos: PhotoItem[] = [];

  // Standard photos
  if (inspection.approvedSamplePhoto) allPhotos.push({ url: inspection.approvedSamplePhoto, label: 'Approved Sample' });
  if (inspection.redSealFrontPhoto) allPhotos.push({ url: inspection.redSealFrontPhoto, label: 'Red Seal - Front' });
  if (inspection.redSealBackPhoto) allPhotos.push({ url: inspection.redSealBackPhoto, label: 'Red Seal - Back' });
  if (inspection.redSealCloseUpPhoto) allPhotos.push({ url: inspection.redSealCloseUpPhoto, label: 'Close-up with Red Seal' });
  if (inspection.redSealProductFront) allPhotos.push({ url: inspection.redSealProductFront, label: 'Front with Red Seal' });
  if (inspection.redSealProductBack) allPhotos.push({ url: inspection.redSealProductBack, label: 'Back with Red Seal' });
  if (inspection.labelPhoto) allPhotos.push({ url: inspection.labelPhoto, label: 'Label Photo' });
  if (inspection.moisturePhoto) allPhotos.push({ url: inspection.moisturePhoto, label: 'Moisture Photo' });
  if (inspection.sizeFrontPhoto) allPhotos.push({ url: inspection.sizeFrontPhoto, label: 'Size - Front' });
  if (inspection.sizeSidePhoto) allPhotos.push({ url: inspection.sizeSidePhoto, label: 'Size - Side' });
  if (inspection.inspectedSamplesPhoto) allPhotos.push({ url: inspection.inspectedSamplesPhoto, label: 'Inspected Samples' });
  if (inspection.metalCheckingPhoto) allPhotos.push({ url: inspection.metalCheckingPhoto, label: 'Metal Checking' });

  // New Images section
  if (inspection.stackedGoodsPhoto) allPhotos.push({ url: inspection.stackedGoodsPhoto, label: 'Stacked Packed Goods' });
  if (inspection.consumerPieces && inspection.consumerPieces.length > 0) {
    for (const piece of inspection.consumerPieces) {
      if (piece.url) allPhotos.push({ url: piece.url, label: piece.label });
    }
  }
  if (inspection.unitLoadEnabled && inspection.unitLoadPhotos && inspection.unitLoadPhotos.length > 0) {
    for (const photo of inspection.unitLoadPhotos) {
      if (photo.url) allPhotos.push({ url: photo.url, label: `Unit Load - ${photo.label}` });
    }
  }

  // Construction photos
  if (inspection.constructionPhotos) {
    if (inspection.constructionPhotos.warpPer10cm) allPhotos.push({ url: inspection.constructionPhotos.warpPer10cm, label: 'Warp per 10 cms' });
    if (inspection.constructionPhotos.weftPer10cm) allPhotos.push({ url: inspection.constructionPhotos.weftPer10cm, label: 'Weft per 10 cms' });
    if (inspection.constructionPhotos.pileHeightPhoto) allPhotos.push({ url: inspection.constructionPhotos.pileHeightPhoto, label: 'Pile Height' });
    if (inspection.constructionPhotos.productNetWeightPhoto) allPhotos.push({ url: inspection.constructionPhotos.productNetWeightPhoto, label: 'Product Net Weight' });
    if (inspection.constructionPhotos.productGrossWeightPhoto) allPhotos.push({ url: inspection.constructionPhotos.productGrossWeightPhoto, label: 'Product Gross Weight' });
  }

  // Other photos
  for (let i = 0; i < inspection.otherPhotos.length; i++) {
    if (inspection.otherPhotos[i]) allPhotos.push({ url: inspection.otherPhotos[i], label: `Other Photo ${i + 1}` });
  }

  // NOT OK photos
  if (inspection.notOkPhotos && inspection.notOkPhotos.length > 0) {
    for (const notOkPhoto of inspection.notOkPhotos) {
      const fieldInfo = OK_NOT_OK_FIELDS.find((f: { key: string }) => f.key === notOkPhoto.field);
      const fieldLabel = fieldInfo ? fieldInfo.label : notOkPhoto.field;
      if (notOkPhoto.photo) allPhotos.push({ url: notOkPhoto.photo, label: `NOT OK - ${fieldLabel}` });
    }
  }

  // Load all images and get dimensions
  for (const photo of allPhotos) {
    const base64 = await urlToBase64(photo.url);
    photo.base64 = base64;
    if (base64) {
      try {
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => {
            photo.width = img.naturalWidth || img.width;
            photo.height = img.naturalHeight || img.height;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = base64;
        });
      } catch {
        // Image dimensions not available
      }
    }
  }

  // Filter out photos that failed to load
  const loadedPhotos = allPhotos.filter(p => p.base64);

  // Add photos in 1x2 grid (2 per page - stacked vertically)
  const PHOTOS_PER_PAGE = 2;
  const GRID_COLS = 1;
  const GRID_ROWS = 2;
  const MARGIN = 15;
  const HEADER_HEIGHT = 25;
  const FOOTER_HEIGHT = 20;
  const CELL_PADDING = 5;
  const LABEL_HEIGHT = 12;

  const availableWidth = pageWidth - (MARGIN * 2);
  const availableHeight = pageHeight - HEADER_HEIGHT - FOOTER_HEIGHT - MARGIN;
  const cellWidth = (availableWidth - CELL_PADDING) / GRID_COLS;
  const cellHeight = (availableHeight - CELL_PADDING) / GRID_ROWS;
  const imageMaxWidth = cellWidth - CELL_PADDING * 2;
  const imageMaxHeight = cellHeight - LABEL_HEIGHT - CELL_PADDING * 2;

  for (let pageStart = 0; pageStart < loadedPhotos.length; pageStart += PHOTOS_PER_PAGE) {
    doc.addPage();

    // Page header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    const pageNum = Math.floor(pageStart / PHOTOS_PER_PAGE) + 1;
    const totalPages = Math.ceil(loadedPhotos.length / PHOTOS_PER_PAGE);
    doc.text(`Photo Documentation (${pageNum}/${totalPages})`, pageWidth / 2, 13, { align: 'center' });

    const pagePhotos = loadedPhotos.slice(pageStart, pageStart + PHOTOS_PER_PAGE);

    for (let i = 0; i < pagePhotos.length; i++) {
      const photo = pagePhotos[i];
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);

      const cellX = MARGIN + col * (cellWidth + CELL_PADDING / 2);
      const cellY = HEADER_HEIGHT + row * (cellHeight + CELL_PADDING / 2);

      // Draw cell background
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.roundedRect(cellX, cellY, cellWidth, cellHeight, 2, 2, 'FD');

      // Calculate image dimensions maintaining aspect ratio
      const origWidth = photo.width || 400;
      const origHeight = photo.height || 300;
      const aspectRatio = origWidth / origHeight;

      let imgWidth: number;
      let imgHeight: number;

      if (aspectRatio > imageMaxWidth / imageMaxHeight) {
        // Image is wider - fit to width
        imgWidth = imageMaxWidth;
        imgHeight = imgWidth / aspectRatio;
      } else {
        // Image is taller - fit to height
        imgHeight = imageMaxHeight;
        imgWidth = imgHeight * aspectRatio;
      }

      // Center image in cell
      const imgX = cellX + (cellWidth - imgWidth) / 2;
      const imgY = cellY + CELL_PADDING;

      try {
        doc.addImage(photo.base64!, 'JPEG', imgX, imgY, imgWidth, imgHeight);
      } catch {
        // Failed to add image
        doc.setTextColor(...lightGray);
        doc.setFontSize(8);
        doc.text('Image error', cellX + cellWidth / 2, cellY + cellHeight / 2, { align: 'center' });
      }

      // Add label below image
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkGray);

      // Truncate label if too long
      let label = photo.label;
      const maxLabelWidth = cellWidth - CELL_PADDING * 2;
      while (doc.getTextWidth(label) > maxLabelWidth && label.length > 3) {
        label = label.slice(0, -1);
      }
      if (label !== photo.label) label += '...';

      doc.text(label, cellX + cellWidth / 2, cellY + cellHeight - CELL_PADDING, { align: 'center' });
    }

    addFooter();
  }

  return doc.output('datauristring').split(',')[1];
}
