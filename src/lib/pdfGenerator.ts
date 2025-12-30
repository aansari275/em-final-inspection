import { jsPDF } from 'jspdf';
import { FinalInspection } from '../types';

export async function generateFinalInspectionPDF(inspection: FinalInspection): Promise<string> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('EASTERN MILLS', pageWidth / 2, y, { align: 'center' });
  y += 7;

  doc.setFontSize(13);
  doc.text('Final Inspection Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Result badge
  doc.setFontSize(14);
  if (inspection.inspectionResult === 'PASS') {
    doc.setTextColor(34, 139, 34);
    doc.text('✓ PASSED', pageWidth / 2, y, { align: 'center' });
  } else {
    doc.setTextColor(220, 20, 60);
    doc.text('✗ FAILED', pageWidth / 2, y, { align: 'center' });
  }
  doc.setTextColor(0);
  y += 12;

  // Details section
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const addField = (label: string, value: string | number, x: number = 15) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), x + 40, y);
  };

  const addRow = (fields: [string, string | number][]) => {
    fields.forEach((field, i) => {
      const x = i === 0 ? 15 : 110;
      addField(field[0], field[1], x);
    });
    y += 6;
  };

  // Basic Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Order Information', 15, y);
  y += 6;
  doc.setFontSize(9);

  addRow([['Date', inspection.inspectionDate], ['Inspector', inspection.qcInspectorName]]);
  addRow([['Customer', inspection.customerName], ['Code', inspection.customerCode]]);
  addRow([['Customer PO', inspection.customerPoNo], ['OPS No.', inspection.opsNo]]);
  addRow([['Buyer Design', inspection.buyerDesignName], ['EMPL Design', inspection.emplDesignNo]]);
  addRow([['Color', inspection.colorName], ['Sizes', inspection.productSizes]]);
  addRow([['Merchant', inspection.merchant], ['', '']]);

  y += 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Inspection Quantities', 15, y);
  y += 6;
  doc.setFontSize(9);

  addRow([['Total Order Qty', inspection.totalOrderQty], ['Inspected Lot', inspection.inspectedLotQty]]);
  addRow([['AQL', inspection.aql], ['Sample Size', inspection.sampleSize]]);
  addRow([['Accepted', inspection.acceptedQty], ['Rejected', inspection.rejectedQty]]);

  y += 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Quality Checks', 15, y);
  y += 6;
  doc.setFontSize(9);

  const checkIcon = (val: string) => val === 'OK' ? '✓ OK' : '✗ NOT OK';
  addRow([['Carton Dimension', checkIcon(inspection.cartonDimension)], ['Product Label', checkIcon(inspection.productLabel)]]);
  addRow([['Carton Label', checkIcon(inspection.cartonLabel)], ['Barcode Scan', checkIcon(inspection.barcodeScan)]]);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('QC Remarks:', 15, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  const remarks = doc.splitTextToSize(inspection.qcInspectorRemarks || 'No remarks', pageWidth - 30);
  doc.text(remarks, 15, y);
  y += remarks.length * 4 + 5;

  // Add images on new pages
  const addImagePage = async (url: string, title: string) => {
    if (!url) return;
    doc.addPage();
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, 15, { align: 'center' });

    try {
      const img = await loadImage(url);
      const imgWidth = 180;
      const imgHeight = (img.height / img.width) * imgWidth;
      doc.addImage(img.src, 'JPEG', 15, 25, imgWidth, Math.min(imgHeight, 250));
    } catch (error) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Image could not be loaded', pageWidth / 2, 100, { align: 'center' });
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

  // Footer on first page
  doc.setPage(1);
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 285, { align: 'center' });

  return doc.output('datauristring').split(',')[1];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
