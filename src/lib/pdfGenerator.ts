import { jsPDF } from 'jspdf';
import { FinalInspection, COMPANY_NAMES } from '../types';

// Convert image URL to base64 data URL to avoid CORS issues
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    return null;
  }
}

export async function generateFinalInspectionPDF(inspection: FinalInspection): Promise<string> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15;

  // Colors
  const primaryColor: [number, number, number] = [16, 185, 129]; // Emerald
  const darkGray: [number, number, number] = [55, 65, 81];
  const lightGray: [number, number, number] = [156, 163, 175];
  const successGreen: [number, number, number] = [34, 197, 94];
  const errorRed: [number, number, number] = [239, 68, 68];
  const warningYellow: [number, number, number] = [234, 179, 8];

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
  addRow([['Customer', inspection.customerName], ['Customer Code', inspection.customerCode]]);
  addRow([['Customer PO', inspection.customerPoNo], ['OPS No.', inspection.opsNo]]);
  addRow([['Buyer Design', inspection.buyerDesignName], ['EMPL Design', inspection.emplDesignNo]]);
  addRow([['Color', inspection.colorName], ['Product Sizes', inspection.productSizes]]);
  addRow([['Merchant', inspection.merchant]]);

  y += 4;

  // Inspection Quantities Section
  addSection('Inspection Quantities');
  addRow([['Total Order Qty', inspection.totalOrderQty], ['Inspected Lot Qty', inspection.inspectedLotQty]]);
  addRow([['AQL', inspection.aql], ['Sample Size', inspection.sampleSize]]);

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

  // Add images on new pages
  const addImagePage = async (url: string, title: string) => {
    if (!url) return;

    const base64 = await urlToBase64(url);
    if (!base64) {
      doc.addPage();
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 20, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(title, pageWidth / 2, 13, { align: 'center' });

      doc.setTextColor(...lightGray);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Image could not be loaded', pageWidth / 2, 100, { align: 'center' });
      addFooter();
      return;
    }

    doc.addPage();

    // Page header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, pageWidth / 2, 13, { align: 'center' });

    try {
      // Create temp image to get dimensions
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = base64;
      });

      const maxWidth = pageWidth - 30;
      const maxHeight = pageHeight - 50;
      let imgWidth = img.width;
      let imgHeight = img.height;

      // Scale to fit
      const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
      imgWidth *= scale;
      imgHeight *= scale;

      const x = (pageWidth - imgWidth) / 2;
      const imgY = 28;

      // Image border
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.rect(x - 2, imgY - 2, imgWidth + 4, imgHeight + 4);

      doc.addImage(base64, 'JPEG', x, imgY, imgWidth, imgHeight);
    } catch (error) {
      doc.setTextColor(...lightGray);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Image could not be rendered', pageWidth / 2, 100, { align: 'center' });
    }

    addFooter();
  };

  // Add all photos
  await addImagePage(inspection.approvedSamplePhoto, 'Approved Sample');
  await addImagePage(inspection.idPhoto, 'ID Photo');
  await addImagePage(inspection.redSealFrontPhoto, 'Red Seal - Front');
  await addImagePage(inspection.redSealSidePhoto, 'Red Seal - Side');
  await addImagePage(inspection.backPhoto, 'Back Photo');
  await addImagePage(inspection.labelPhoto, 'Label Photo');
  await addImagePage(inspection.moisturePhoto, 'Moisture Photo');
  await addImagePage(inspection.sizeFrontPhoto, 'Size - Front');
  await addImagePage(inspection.sizeSidePhoto, 'Size - Side');
  await addImagePage(inspection.inspectedSamplesPhoto, 'Inspected Samples');
  await addImagePage(inspection.metalCheckingPhoto, 'Metal Checking');

  for (let i = 0; i < inspection.otherPhotos.length; i++) {
    await addImagePage(inspection.otherPhotos[i], `Other Photo ${i + 1}`);
  }

  return doc.output('datauristring').split(',')[1];
}
