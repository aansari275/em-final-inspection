import { jsPDF } from 'jspdf';
import { FinalInspection } from '../types';

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

  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Company name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('EASTERN MILLS', pageWidth / 2, 12, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Final Inspection Report', pageWidth / 2, 21, { align: 'center' });

  y = 40;

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

  // Section helper
  const addSection = (title: string) => {
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
    const colWidth = (pageWidth - 30) / fields.length;
    fields.forEach((field, i) => {
      const x = 15 + (i * colWidth);
      addField(field[0], field[1], x);
    });
    y += 12;
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

  // Quality Checks Section
  addSection('Quality Checks');

  const checkResult = (val: string, label: string, x: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...lightGray);
    doc.setFontSize(8);
    doc.text(label, x, y);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    if (val === 'OK') {
      doc.setTextColor(...successGreen);
      doc.text('OK', x, y + 4);
    } else {
      doc.setTextColor(...errorRed);
      doc.text('NOT OK', x, y + 4);
    }
  };

  const colW = (pageWidth - 30) / 4;
  checkResult(inspection.cartonDimension, 'Carton Dimension', 15);
  checkResult(inspection.productLabel, 'Product Label', 15 + colW);
  checkResult(inspection.cartonLabel, 'Carton Label', 15 + colW * 2);
  checkResult(inspection.barcodeScan, 'Barcode Scan', 15 + colW * 3);
  y += 14;

  y += 4;

  // Remarks Section
  addSection('QC Inspector Remarks');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  doc.setFontSize(9);
  const remarks = doc.splitTextToSize(inspection.qcInspectorRemarks || 'No remarks provided', pageWidth - 36);
  doc.text(remarks, 18, y);
  y += remarks.length * 5 + 5;

  // Footer on first page
  doc.setDrawColor(229, 231, 235);
  doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
  doc.setFontSize(7);
  doc.setTextColor(...lightGray);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 15, pageHeight - 8);
  doc.text('Eastern Mills Quality Control', pageWidth - 15, pageHeight - 8, { align: 'right' });

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
      const y = 28;

      // Image border
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.rect(x - 2, y - 2, imgWidth + 4, imgHeight + 4);

      doc.addImage(base64, 'JPEG', x, y, imgWidth, imgHeight);
    } catch (error) {
      doc.setTextColor(...lightGray);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Image could not be rendered', pageWidth / 2, 100, { align: 'center' });
    }
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
