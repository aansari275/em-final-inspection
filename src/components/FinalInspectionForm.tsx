import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { emailSettingsService } from '../lib/emailSettingsService';
import { generateFinalInspectionPDF } from '../lib/pdfGenerator';
import {
  FinalInspection,
  Defect,
  Company,
  QC_INSPECTORS,
  MERCHANTS,
  CUSTOMERS,
  BUYER_DESIGNS,
  AQL_LEVELS,
  PHOTO_TYPES,
  COMPANIES,
  COMPANY_NAMES,
  MATERIAL_TYPES,
  DEFECT_CODES
} from '../types';
import { Loader2, Upload, X, Camera, CheckCircle2, XCircle, Plus, Trash2 } from 'lucide-react';

type PhotoKey = keyof Pick<FinalInspection,
  'approvedSamplePhoto' | 'idPhoto' | 'redSealFrontPhoto' | 'redSealSidePhoto' |
  'backPhoto' | 'labelPhoto' | 'moisturePhoto' | 'sizeFrontPhoto' | 'sizeSidePhoto' |
  'inspectedSamplesPhoto' | 'metalCheckingPhoto'
>;

export function FinalInspectionForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    // Company & Document
    company: 'EHI' as Company,
    documentNo: 'EHI/IP/01',

    // Basic Info
    inspectionDate: new Date().toISOString().split('T')[0],
    qcInspectorName: '',
    customerName: '',
    customerCode: '',
    customerPoNo: '',
    opsNo: '',
    buyerDesignName: '',
    emplDesignNo: '',
    colorName: '',
    productSizes: '',
    merchant: '',

    // Quantities
    totalOrderQty: '',
    inspectedLotQty: '',
    aql: '2.5',
    sampleSize: '',
    acceptedQty: '',
    rejectedQty: '',

    // Product Quality Checks
    approvedSampleAvailable: 'Yes',
    materialFibreContent: '',
    motifDesignCheck: 'OK',
    tuftDensity: '',
    backing: 'OK',
    backingNotes: '',
    bindingAndEdges: 'OK',
    handFeel: 'OK',
    pileHeight: '',
    embossingCarving: 'OK',
    workmanship: 'OK',
    productQualityWeight: 'OK',
    productWeight: '',
    sizeTolerance: '',
    finishingPercent: '',
    packedPercent: '',

    // Labeling & Marking
    labelPlacement: 'OK',
    sideMarking: 'OK',
    outerMarking: 'OK',
    innerPack: 'OK',
    careLabels: 'OK',
    skuStickers: 'OK',
    upcBarcodes: 'OK',

    // Packaging
    cartonPly: '',
    cartonDropTest: 'OK',
    packingType: 'Solid',
    grossWeight: '',
    netWeight: '',
    cartonBaleNumbering: 'OK',
    pcsPerCartonBale: '',
    pcsPerPolybag: '',
    cartonMeasurementL: '',
    cartonMeasurementW: '',
    cartonMeasurementH: '',

    // Original Checks (kept for compatibility)
    cartonDimension: 'OK',
    productLabel: 'OK',
    cartonLabel: 'OK',
    barcodeScan: 'OK',

    // Defect Tracking
    dpciSkuStyleNumber: '',
    styleDescription: '',

    qcInspectorRemarks: '',
    inspectionResult: 'PASS'
  });

  const [defects, setDefects] = useState<Defect[]>([]);

  const [photos, setPhotos] = useState<Record<PhotoKey, File | null>>({
    approvedSamplePhoto: null,
    idPhoto: null,
    redSealFrontPhoto: null,
    redSealSidePhoto: null,
    backPhoto: null,
    labelPhoto: null,
    moisturePhoto: null,
    sizeFrontPhoto: null,
    sizeSidePhoto: null,
    inspectedSamplesPhoto: null,
    metalCheckingPhoto: null,
  });

  const [photoPreviews, setPhotoPreviews] = useState<Record<PhotoKey, string>>({
    approvedSamplePhoto: '',
    idPhoto: '',
    redSealFrontPhoto: '',
    redSealSidePhoto: '',
    backPhoto: '',
    labelPhoto: '',
    moisturePhoto: '',
    sizeFrontPhoto: '',
    sizeSidePhoto: '',
    inspectedSamplesPhoto: '',
    metalCheckingPhoto: '',
  });

  const [otherPhotos, setOtherPhotos] = useState<File[]>([]);
  const [otherPreviews, setOtherPreviews] = useState<string[]>([]);

  // Update document number when company changes
  const handleCompanyChange = (company: Company) => {
    const documentNo = company === 'EHI' ? 'EHI/IP/01' : 'EMPL/IP/01';
    setFormData({ ...formData, company, documentNo });
  };

  const handlePhotoChange = (key: PhotoKey, file: File | null) => {
    setPhotos(prev => ({ ...prev, [key]: file }));
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreviews(prev => ({ ...prev, [key]: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setPhotoPreviews(prev => ({ ...prev, [key]: '' }));
    }
  };

  const handleOtherPhotosChange = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    setOtherPhotos(prev => [...prev, ...newFiles]);

    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setOtherPreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeOtherPhoto = (index: number) => {
    setOtherPhotos(prev => prev.filter((_, i) => i !== index));
    setOtherPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Defect management
  const addDefect = () => {
    setDefects([...defects, { defectCode: '', majorCount: 0, minorCount: 0, description: '' }]);
  };

  const updateDefect = (index: number, field: keyof Defect, value: string | number) => {
    const updated = [...defects];
    updated[index] = { ...updated[index], [field]: value };
    setDefects(updated);
  };

  const removeDefect = (index: number) => {
    setDefects(defects.filter((_, i) => i !== index));
  };

  const uploadPhoto = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const timestamp = Date.now();
      const photoUrls: Record<string, string> = {};

      // Upload each required photo
      for (const photoType of PHOTO_TYPES) {
        const key = photoType.key as PhotoKey;
        const file = photos[key];
        if (file) {
          const url = await uploadPhoto(
            file,
            `final-inspection-images/${timestamp}_${key}_${file.name}`
          );
          photoUrls[key] = url;
        }
      }

      // Upload other photos
      const otherPhotoUrls: string[] = [];
      for (let i = 0; i < otherPhotos.length; i++) {
        const url = await uploadPhoto(
          otherPhotos[i],
          `final-inspection-images/${timestamp}_other_${i}_${otherPhotos[i].name}`
        );
        otherPhotoUrls.push(url);
      }

      const inspection: FinalInspection = {
        // Company & Document
        company: formData.company,
        documentNo: formData.documentNo,

        // Basic Info
        inspectionDate: formData.inspectionDate,
        qcInspectorName: formData.qcInspectorName,
        customerName: formData.customerName,
        customerCode: formData.customerCode,
        customerPoNo: formData.customerPoNo,
        opsNo: formData.opsNo,
        buyerDesignName: formData.buyerDesignName,
        emplDesignNo: formData.emplDesignNo,
        colorName: formData.colorName,
        productSizes: formData.productSizes,
        merchant: formData.merchant,

        // Quantities
        totalOrderQty: Number(formData.totalOrderQty),
        inspectedLotQty: Number(formData.inspectedLotQty),
        aql: formData.aql,
        sampleSize: Number(formData.sampleSize),
        acceptedQty: Number(formData.acceptedQty),
        rejectedQty: Number(formData.rejectedQty),

        // Product Quality Checks
        approvedSampleAvailable: formData.approvedSampleAvailable as 'Yes' | 'No',
        materialFibreContent: formData.materialFibreContent,
        motifDesignCheck: formData.motifDesignCheck as 'OK' | 'NOT OK',
        tuftDensity: formData.tuftDensity,
        backing: formData.backing as 'OK' | 'NOT OK',
        backingNotes: formData.backingNotes,
        bindingAndEdges: formData.bindingAndEdges as 'OK' | 'NOT OK',
        handFeel: formData.handFeel as 'OK' | 'NOT OK',
        pileHeight: formData.pileHeight,
        embossingCarving: formData.embossingCarving as 'OK' | 'NOT OK',
        workmanship: formData.workmanship as 'OK' | 'NOT OK',
        productQualityWeight: formData.productQualityWeight as 'OK' | 'NOT OK',
        productWeight: formData.productWeight,
        sizeTolerance: formData.sizeTolerance,
        finishingPercent: formData.finishingPercent,
        packedPercent: formData.packedPercent,

        // Labeling & Marking
        labelPlacement: formData.labelPlacement as 'OK' | 'NOT OK',
        sideMarking: formData.sideMarking as 'OK' | 'NOT OK',
        outerMarking: formData.outerMarking as 'OK' | 'NOT OK',
        innerPack: formData.innerPack as 'OK' | 'NOT OK',
        careLabels: formData.careLabels as 'OK' | 'NOT OK',
        skuStickers: formData.skuStickers as 'OK' | 'NOT OK',
        upcBarcodes: formData.upcBarcodes as 'OK' | 'NOT OK',

        // Packaging
        cartonPly: formData.cartonPly,
        cartonDropTest: formData.cartonDropTest as 'OK' | 'NOT OK',
        packingType: formData.packingType as 'Assorted' | 'Solid',
        grossWeight: formData.grossWeight,
        netWeight: formData.netWeight,
        cartonBaleNumbering: formData.cartonBaleNumbering as 'OK' | 'NOT OK',
        pcsPerCartonBale: formData.pcsPerCartonBale,
        pcsPerPolybag: formData.pcsPerPolybag,
        cartonMeasurementL: formData.cartonMeasurementL,
        cartonMeasurementW: formData.cartonMeasurementW,
        cartonMeasurementH: formData.cartonMeasurementH,

        // Original Checks (kept for compatibility)
        cartonDimension: formData.cartonDimension as 'OK' | 'NOT OK',
        productLabel: formData.productLabel as 'OK' | 'NOT OK',
        cartonLabel: formData.cartonLabel as 'OK' | 'NOT OK',
        barcodeScan: formData.barcodeScan as 'OK' | 'NOT OK',

        // Defect Tracking
        dpciSkuStyleNumber: formData.dpciSkuStyleNumber,
        styleDescription: formData.styleDescription,
        defects: defects,

        // Photos
        approvedSamplePhoto: photoUrls.approvedSamplePhoto || '',
        idPhoto: photoUrls.idPhoto || '',
        redSealFrontPhoto: photoUrls.redSealFrontPhoto || '',
        redSealSidePhoto: photoUrls.redSealSidePhoto || '',
        backPhoto: photoUrls.backPhoto || '',
        labelPhoto: photoUrls.labelPhoto || '',
        moisturePhoto: photoUrls.moisturePhoto || '',
        sizeFrontPhoto: photoUrls.sizeFrontPhoto || '',
        sizeSidePhoto: photoUrls.sizeSidePhoto || '',
        inspectedSamplesPhoto: photoUrls.inspectedSamplesPhoto || '',
        metalCheckingPhoto: photoUrls.metalCheckingPhoto || '',
        otherPhotos: otherPhotoUrls,

        qcInspectorRemarks: formData.qcInspectorRemarks,
        inspectionResult: formData.inspectionResult as 'PASS' | 'FAIL',
        createdAt: new Date().toISOString()
      };

      // Save to Firestore
      await addDoc(collection(db, 'final-inspections'), inspection);

      // Generate PDF and send email
      const recipients = emailSettingsService.getRecipients();
      if (recipients.length > 0) {
        const pdfBase64 = await generateFinalInspectionPDF(inspection);

        const allPhotos = [
          { url: inspection.approvedSamplePhoto, label: 'Approved Sample' },
          { url: inspection.idPhoto, label: 'ID Photo' },
          { url: inspection.redSealFrontPhoto, label: 'Red Seal Front' },
          { url: inspection.redSealSidePhoto, label: 'Red Seal Side' },
          { url: inspection.backPhoto, label: 'Back' },
          { url: inspection.labelPhoto, label: 'Label' },
          { url: inspection.moisturePhoto, label: 'Moisture' },
          { url: inspection.sizeFrontPhoto, label: 'Size Front' },
          { url: inspection.sizeSidePhoto, label: 'Size Side' },
          { url: inspection.inspectedSamplesPhoto, label: 'Inspected Samples' },
          { url: inspection.metalCheckingPhoto, label: 'Metal Checking' },
          ...inspection.otherPhotos.map((url, i) => ({ url, label: `Other ${i + 1}` }))
        ].filter(p => p.url);

        const resultColor = inspection.inspectionResult === 'PASS' ? '#22c55e' : '#ef4444';
        const resultBg = inspection.inspectionResult === 'PASS' ? '#dcfce7' : '#fee2e2';
        const companyName = COMPANY_NAMES[inspection.company];

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <div style="background: #059669; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">${companyName}</h1>
              <p style="margin: 5px 0 0;">Final Inspection Report - ${inspection.documentNo}</p>
            </div>

            <div style="background: ${resultBg}; padding: 20px; text-align: center; border-bottom: 3px solid ${resultColor};">
              <h2 style="color: ${resultColor}; margin: 0; font-size: 28px;">
                ${inspection.inspectionResult === 'PASS' ? '✓ PASSED' : '✗ FAILED'}
              </h2>
            </div>

            <div style="padding: 20px;">
              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Order Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #6b7280;">Date:</td><td style="padding: 8px 0;">${inspection.inspectionDate}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Inspector:</td><td style="padding: 8px 0;">${inspection.qcInspectorName}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Customer:</td><td style="padding: 8px 0;">${inspection.customerName} (${inspection.customerCode})</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Customer PO:</td><td style="padding: 8px 0;">${inspection.customerPoNo}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">OPS No.:</td><td style="padding: 8px 0;">${inspection.opsNo}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Design:</td><td style="padding: 8px 0;">${inspection.buyerDesignName} / ${inspection.emplDesignNo}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Color:</td><td style="padding: 8px 0;">${inspection.colorName}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Sizes:</td><td style="padding: 8px 0;">${inspection.productSizes}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Merchant:</td><td style="padding: 8px 0;">${inspection.merchant}</td></tr>
              </table>

              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">Quantities</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #6b7280;">Total Order Qty:</td><td style="padding: 8px 0;">${inspection.totalOrderQty}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Inspected Lot:</td><td style="padding: 8px 0;">${inspection.inspectedLotQty}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">AQL / Sample Size:</td><td style="padding: 8px 0;">${inspection.aql} / ${inspection.sampleSize}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Accepted:</td><td style="padding: 8px 0; color: #22c55e; font-weight: bold;">${inspection.acceptedQty}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Rejected:</td><td style="padding: 8px 0; color: #ef4444; font-weight: bold;">${inspection.rejectedQty}</td></tr>
              </table>

              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">Product Quality</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #6b7280;">Approved Sample Available:</td><td style="padding: 8px 0;">${inspection.approvedSampleAvailable}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Material/Fibre Content:</td><td style="padding: 8px 0;">${inspection.materialFibreContent}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Motif/Design Check:</td><td style="padding: 8px 0;">${inspection.motifDesignCheck}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Backing:</td><td style="padding: 8px 0;">${inspection.backing}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Binding/Edges:</td><td style="padding: 8px 0;">${inspection.bindingAndEdges}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Hand Feel:</td><td style="padding: 8px 0;">${inspection.handFeel}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Workmanship:</td><td style="padding: 8px 0;">${inspection.workmanship}</td></tr>
              </table>

              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">Labeling & Marking</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #6b7280;">Label Placement:</td><td style="padding: 8px 0;">${inspection.labelPlacement}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Side Marking:</td><td style="padding: 8px 0;">${inspection.sideMarking}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Care Labels:</td><td style="padding: 8px 0;">${inspection.careLabels}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">SKU Stickers:</td><td style="padding: 8px 0;">${inspection.skuStickers}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">UPC Barcodes:</td><td style="padding: 8px 0;">${inspection.upcBarcodes}</td></tr>
              </table>

              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">Packaging</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #6b7280;">Carton Ply:</td><td style="padding: 8px 0;">${inspection.cartonPly}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Carton Drop Test:</td><td style="padding: 8px 0;">${inspection.cartonDropTest}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Packing Type:</td><td style="padding: 8px 0;">${inspection.packingType}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Gross/Net Weight:</td><td style="padding: 8px 0;">${inspection.grossWeight} / ${inspection.netWeight}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Carton Dimensions:</td><td style="padding: 8px 0;">${inspection.cartonMeasurementL} x ${inspection.cartonMeasurementW} x ${inspection.cartonMeasurementH}</td></tr>
              </table>

              ${inspection.defects.length > 0 ? `
                <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">Defects Found</h3>
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Code</th>
                    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Description</th>
                    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Major</th>
                    <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Minor</th>
                  </tr>
                  ${inspection.defects.map(d => `
                    <tr>
                      <td style="padding: 8px; border: 1px solid #e5e7eb;">${d.defectCode}</td>
                      <td style="padding: 8px; border: 1px solid #e5e7eb;">${d.description}</td>
                      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; color: #ef4444;">${d.majorCount}</td>
                      <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; color: #f59e0b;">${d.minorCount}</td>
                    </tr>
                  `).join('')}
                </table>
              ` : ''}

              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">QC Remarks</h3>
              <p style="color: #374151;">${inspection.qcInspectorRemarks || 'No remarks'}</p>

              ${allPhotos.length > 0 ? `
                <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">Photos</h3>
                <div style="display: grid; gap: 20px;">
                  ${allPhotos.map(photo => `
                    <div>
                      <p style="color: #6b7280; margin-bottom: 8px;">${photo.label}</p>
                      <img src="${photo.url}" style="max-width: 100%; border-radius: 8px; border: 1px solid #e5e7eb;" alt="${photo.label}">
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>

            <div style="background: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
              <p>${companyName} QC System - Final Inspection Report</p>
            </div>
          </div>
        `;

        await fetch('/.netlify/functions/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipients,
            subject: `Final Inspection: ${inspection.customerName} - ${inspection.buyerDesignName} [${inspection.inspectionResult}] - ${inspection.documentNo}`,
            html: emailHtml,
            pdfBase64,
            pdfFilename: `Final_Inspection_${inspection.opsNo}_${inspection.inspectionDate}.pdf`
          })
        });
      }

      setSuccess(true);
      // Reset form
      setFormData({
        company: 'EHI',
        documentNo: 'EHI/IP/01',
        inspectionDate: new Date().toISOString().split('T')[0],
        qcInspectorName: '',
        customerName: '',
        customerCode: '',
        customerPoNo: '',
        opsNo: '',
        buyerDesignName: '',
        emplDesignNo: '',
        colorName: '',
        productSizes: '',
        merchant: '',
        totalOrderQty: '',
        inspectedLotQty: '',
        aql: '2.5',
        sampleSize: '',
        acceptedQty: '',
        rejectedQty: '',
        approvedSampleAvailable: 'Yes',
        materialFibreContent: '',
        motifDesignCheck: 'OK',
        tuftDensity: '',
        backing: 'OK',
        backingNotes: '',
        bindingAndEdges: 'OK',
        handFeel: 'OK',
        pileHeight: '',
        embossingCarving: 'OK',
        workmanship: 'OK',
        productQualityWeight: 'OK',
        productWeight: '',
        sizeTolerance: '',
        finishingPercent: '',
        packedPercent: '',
        labelPlacement: 'OK',
        sideMarking: 'OK',
        outerMarking: 'OK',
        innerPack: 'OK',
        careLabels: 'OK',
        skuStickers: 'OK',
        upcBarcodes: 'OK',
        cartonPly: '',
        cartonDropTest: 'OK',
        packingType: 'Solid',
        grossWeight: '',
        netWeight: '',
        cartonBaleNumbering: 'OK',
        pcsPerCartonBale: '',
        pcsPerPolybag: '',
        cartonMeasurementL: '',
        cartonMeasurementW: '',
        cartonMeasurementH: '',
        cartonDimension: 'OK',
        productLabel: 'OK',
        cartonLabel: 'OK',
        barcodeScan: 'OK',
        dpciSkuStyleNumber: '',
        styleDescription: '',
        qcInspectorRemarks: '',
        inspectionResult: 'PASS'
      });
      setDefects([]);
      setPhotos({
        approvedSamplePhoto: null,
        idPhoto: null,
        redSealFrontPhoto: null,
        redSealSidePhoto: null,
        backPhoto: null,
        labelPhoto: null,
        moisturePhoto: null,
        sizeFrontPhoto: null,
        sizeSidePhoto: null,
        inspectedSamplesPhoto: null,
        metalCheckingPhoto: null,
      });
      setPhotoPreviews({
        approvedSamplePhoto: '',
        idPhoto: '',
        redSealFrontPhoto: '',
        redSealSidePhoto: '',
        backPhoto: '',
        labelPhoto: '',
        moisturePhoto: '',
        sizeFrontPhoto: '',
        sizeSidePhoto: '',
        inspectedSamplesPhoto: '',
        metalCheckingPhoto: '',
      });
      setOtherPhotos([]);
      setOtherPreviews([]);

    } catch (error) {
      console.error('Error submitting inspection:', error);
      alert('Failed to submit inspection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  // Helper component for OK/NOT OK radio buttons
  const OkNotOkField = ({ field, label }: { field: string; label: string }) => (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-3">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={field}
            value="OK"
            checked={formData[field as keyof typeof formData] === 'OK'}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            className="text-emerald-600"
          />
          <span className="text-sm text-green-600 font-medium">OK</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={field}
            value="NOT OK"
            checked={formData[field as keyof typeof formData] === 'NOT OK'}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            className="text-red-600"
          />
          <span className="text-sm text-red-600 font-medium">NOT OK</span>
        </label>
      </div>
    </div>
  );

  // Helper component for Yes/No radio buttons
  const YesNoField = ({ field, label }: { field: string; label: string }) => (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-3">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={field}
            value="Yes"
            checked={formData[field as keyof typeof formData] === 'Yes'}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            className="text-emerald-600"
          />
          <span className="text-sm text-green-600 font-medium">Yes</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name={field}
            value="No"
            checked={formData[field as keyof typeof formData] === 'No'}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
            className="text-red-600"
          />
          <span className="text-sm text-red-600 font-medium">No</span>
        </label>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="text-emerald-600 w-5 h-5" />
          <span className="text-emerald-700">Inspection submitted successfully!</span>
        </div>
      )}

      {/* Company & Document */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Company & Document</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Company *</label>
            <select
              required
              value={formData.company}
              onChange={(e) => handleCompanyChange(e.target.value as Company)}
              className={inputClass}
            >
              {COMPANIES.map(company => (
                <option key={company} value={company}>{COMPANY_NAMES[company]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Document No.</label>
            <input
              type="text"
              value={formData.documentNo}
              readOnly
              className={`${inputClass} bg-gray-100`}
            />
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Inspection Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Inspection Date *</label>
            <input
              type="date"
              required
              value={formData.inspectionDate}
              onChange={(e) => setFormData({ ...formData, inspectionDate: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>QC Inspector *</label>
            <select
              required
              value={formData.qcInspectorName}
              onChange={(e) => setFormData({ ...formData, qcInspectorName: e.target.value })}
              className={inputClass}
            >
              <option value="">Select Inspector</option>
              {QC_INSPECTORS.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Order Info */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Customer Name *</label>
            <select
              required
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className={inputClass}
            >
              <option value="">Select Customer</option>
              {CUSTOMERS.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Customer Code *</label>
            <input
              type="text"
              required
              value={formData.customerCode}
              onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Customer PO No. *</label>
            <input
              type="text"
              required
              value={formData.customerPoNo}
              onChange={(e) => setFormData({ ...formData, customerPoNo: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>OPS No. *</label>
            <input
              type="text"
              required
              value={formData.opsNo}
              onChange={(e) => setFormData({ ...formData, opsNo: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Buyer Design Name *</label>
            <select
              required
              value={formData.buyerDesignName}
              onChange={(e) => setFormData({ ...formData, buyerDesignName: e.target.value })}
              className={inputClass}
            >
              <option value="">Select Design</option>
              {BUYER_DESIGNS.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>EMPL Design No. *</label>
            <input
              type="text"
              required
              value={formData.emplDesignNo}
              onChange={(e) => setFormData({ ...formData, emplDesignNo: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Color Name *</label>
            <input
              type="text"
              required
              value={formData.colorName}
              onChange={(e) => setFormData({ ...formData, colorName: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Product Sizes *</label>
            <input
              type="text"
              required
              value={formData.productSizes}
              onChange={(e) => setFormData({ ...formData, productSizes: e.target.value })}
              className={inputClass}
              placeholder="e.g., 5x8, 6x9, 8x10"
            />
          </div>
          <div>
            <label className={labelClass}>Merchant *</label>
            <select
              required
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              className={inputClass}
            >
              <option value="">Select Merchant</option>
              {MERCHANTS.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quantities */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Inspection Quantities</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Total Order Qty *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.totalOrderQty}
              onChange={(e) => setFormData({ ...formData, totalOrderQty: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Inspected Lot Qty *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.inspectedLotQty}
              onChange={(e) => setFormData({ ...formData, inspectedLotQty: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>AQL *</label>
            <select
              required
              value={formData.aql}
              onChange={(e) => setFormData({ ...formData, aql: e.target.value })}
              className={inputClass}
            >
              {AQL_LEVELS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Sample Size *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.sampleSize}
              onChange={(e) => setFormData({ ...formData, sampleSize: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Accepted Qty *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.acceptedQty}
              onChange={(e) => setFormData({ ...formData, acceptedQty: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Rejected Qty *</label>
            <input
              type="number"
              required
              min="0"
              value={formData.rejectedQty}
              onChange={(e) => setFormData({ ...formData, rejectedQty: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Product Quality Checks */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Quality Checks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <YesNoField field="approvedSampleAvailable" label="Approved Sample Available" />
          <div>
            <label className={labelClass}>Material/Fibre Content</label>
            <select
              value={formData.materialFibreContent}
              onChange={(e) => setFormData({ ...formData, materialFibreContent: e.target.value })}
              className={inputClass}
            >
              <option value="">Select Material</option>
              {MATERIAL_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <OkNotOkField field="motifDesignCheck" label="Motif/Design Check" />
          <OkNotOkField field="backing" label="Backing" />
          <OkNotOkField field="bindingAndEdges" label="Binding & Edges" />
          <OkNotOkField field="handFeel" label="Hand Feel" />
          <OkNotOkField field="embossingCarving" label="Embossing/Carving" />
          <OkNotOkField field="workmanship" label="Workmanship" />
          <OkNotOkField field="productQualityWeight" label="Weight Check" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Tuft Density</label>
            <input
              type="text"
              value={formData.tuftDensity}
              onChange={(e) => setFormData({ ...formData, tuftDensity: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Backing Notes</label>
            <input
              type="text"
              value={formData.backingNotes}
              onChange={(e) => setFormData({ ...formData, backingNotes: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Pile Height</label>
            <input
              type="text"
              value={formData.pileHeight}
              onChange={(e) => setFormData({ ...formData, pileHeight: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Product Weight</label>
            <input
              type="text"
              value={formData.productWeight}
              onChange={(e) => setFormData({ ...formData, productWeight: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Size Tolerance</label>
            <input
              type="text"
              value={formData.sizeTolerance}
              onChange={(e) => setFormData({ ...formData, sizeTolerance: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Finishing %</label>
            <input
              type="text"
              value={formData.finishingPercent}
              onChange={(e) => setFormData({ ...formData, finishingPercent: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Packed %</label>
            <input
              type="text"
              value={formData.packedPercent}
              onChange={(e) => setFormData({ ...formData, packedPercent: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Labeling & Marking */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Labeling & Marking</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <OkNotOkField field="labelPlacement" label="Label Placement" />
          <OkNotOkField field="sideMarking" label="Side Marking" />
          <OkNotOkField field="outerMarking" label="Outer Marking" />
          <OkNotOkField field="innerPack" label="Inner Pack" />
          <OkNotOkField field="careLabels" label="Care Labels" />
          <OkNotOkField field="skuStickers" label="SKU Stickers" />
          <OkNotOkField field="upcBarcodes" label="UPC Barcodes" />
        </div>
      </div>

      {/* Packaging */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Packaging</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className={labelClass}>Carton Ply</label>
            <input
              type="text"
              value={formData.cartonPly}
              onChange={(e) => setFormData({ ...formData, cartonPly: e.target.value })}
              className={inputClass}
            />
          </div>
          <OkNotOkField field="cartonDropTest" label="Carton Drop Test" />
          <div>
            <label className={labelClass}>Packing Type</label>
            <select
              value={formData.packingType}
              onChange={(e) => setFormData({ ...formData, packingType: e.target.value })}
              className={inputClass}
            >
              <option value="Solid">Solid</option>
              <option value="Assorted">Assorted</option>
            </select>
          </div>
          <OkNotOkField field="cartonBaleNumbering" label="Carton/Bale Numbering" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Gross Weight</label>
            <input
              type="text"
              value={formData.grossWeight}
              onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Net Weight</label>
            <input
              type="text"
              value={formData.netWeight}
              onChange={(e) => setFormData({ ...formData, netWeight: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Pcs/Carton or Bale</label>
            <input
              type="text"
              value={formData.pcsPerCartonBale}
              onChange={(e) => setFormData({ ...formData, pcsPerCartonBale: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Pcs/Polybag</label>
            <input
              type="text"
              value={formData.pcsPerPolybag}
              onChange={(e) => setFormData({ ...formData, pcsPerPolybag: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <label className={labelClass}>Carton L (cm)</label>
            <input
              type="text"
              value={formData.cartonMeasurementL}
              onChange={(e) => setFormData({ ...formData, cartonMeasurementL: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Carton W (cm)</label>
            <input
              type="text"
              value={formData.cartonMeasurementW}
              onChange={(e) => setFormData({ ...formData, cartonMeasurementW: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Carton H (cm)</label>
            <input
              type="text"
              value={formData.cartonMeasurementH}
              onChange={(e) => setFormData({ ...formData, cartonMeasurementH: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Defect Tracking */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Defect Tracking</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>DPCI/SKU/Style Number</label>
            <input
              type="text"
              value={formData.dpciSkuStyleNumber}
              onChange={(e) => setFormData({ ...formData, dpciSkuStyleNumber: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Style Description</label>
            <input
              type="text"
              value={formData.styleDescription}
              onChange={(e) => setFormData({ ...formData, styleDescription: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {/* Defects List */}
        <div className="space-y-3">
          {defects.map((defect, index) => (
            <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg">
              <div className="flex-1">
                <label className={labelClass}>Defect Code</label>
                <select
                  value={defect.defectCode}
                  onChange={(e) => {
                    const selectedDefect = DEFECT_CODES.find(d => d.code === e.target.value);
                    updateDefect(index, 'defectCode', e.target.value);
                    if (selectedDefect) {
                      updateDefect(index, 'description', selectedDefect.description);
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">Select Code</option>
                  {DEFECT_CODES.map(d => (
                    <option key={d.code} value={d.code}>{d.code} - {d.description}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className={labelClass}>Major</label>
                <input
                  type="number"
                  min="0"
                  value={defect.majorCount}
                  onChange={(e) => updateDefect(index, 'majorCount', parseInt(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div className="w-24">
                <label className={labelClass}>Minor</label>
                <input
                  type="number"
                  min="0"
                  value={defect.minorCount}
                  onChange={(e) => updateDefect(index, 'minorCount', parseInt(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => removeDefect(index)}
                className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addDefect}
          className="mt-3 flex items-center gap-2 px-4 py-2 text-emerald-600 border border-emerald-300 rounded-lg hover:bg-emerald-50"
        >
          <Plus size={18} />
          Add Defect
        </button>
      </div>

      {/* Legacy Quality Checks */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Checks</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <OkNotOkField field="cartonDimension" label="Carton Dimension" />
          <OkNotOkField field="productLabel" label="Product Label" />
          <OkNotOkField field="cartonLabel" label="Carton Label" />
          <OkNotOkField field="barcodeScan" label="Barcode Scan" />
        </div>
      </div>

      {/* Photos */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Photos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PHOTO_TYPES.map(({ key, label }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              {photoPreviews[key as PhotoKey] ? (
                <div className="relative">
                  <img
                    src={photoPreviews[key as PhotoKey]}
                    alt={label}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handlePhotoChange(key as PhotoKey, null)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <Camera className="w-8 h-8 text-gray-400" />
                  <span className="text-xs text-gray-500 mt-1">Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoChange(key as PhotoKey, e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
          ))}
        </div>

        {/* Other Photos */}
        <div className="mt-6">
          <label className={labelClass}>Other Photos</label>
          <div className="flex flex-wrap gap-3 mb-3">
            {otherPreviews.map((preview, i) => (
              <div key={i} className="relative">
                <img
                  src={preview}
                  alt={`Other ${i + 1}`}
                  className="w-24 h-24 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeOtherPhoto(i)}
                  className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <Upload size={18} />
            <span>Add More Photos</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleOtherPhotosChange(e.target.files)}
            />
          </label>
        </div>
      </div>

      {/* Remarks & Result */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Final Result</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>QC Inspector Remarks</label>
            <textarea
              rows={3}
              value={formData.qcInspectorRemarks}
              onChange={(e) => setFormData({ ...formData, qcInspectorRemarks: e.target.value })}
              className={inputClass}
              placeholder="Enter any additional remarks..."
            />
          </div>
          <div>
            <label className={labelClass}>Inspection Result *</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.inspectionResult === 'PASS'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="inspectionResult"
                  value="PASS"
                  checked={formData.inspectionResult === 'PASS'}
                  onChange={(e) => setFormData({ ...formData, inspectionResult: e.target.value })}
                  className="hidden"
                />
                <CheckCircle2 className={`w-6 h-6 ${formData.inspectionResult === 'PASS' ? 'text-green-600' : 'text-gray-400'}`} />
                <span className={`font-semibold ${formData.inspectionResult === 'PASS' ? 'text-green-700' : 'text-gray-500'}`}>
                  PASS
                </span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                formData.inspectionResult === 'FAIL'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="inspectionResult"
                  value="FAIL"
                  checked={formData.inspectionResult === 'FAIL'}
                  onChange={(e) => setFormData({ ...formData, inspectionResult: e.target.value })}
                  className="hidden"
                />
                <XCircle className={`w-6 h-6 ${formData.inspectionResult === 'FAIL' ? 'text-red-600' : 'text-gray-400'}`} />
                <span className={`font-semibold ${formData.inspectionResult === 'FAIL' ? 'text-red-700' : 'text-gray-500'}`}>
                  FAIL
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Submitting...
          </>
        ) : (
          'Submit Inspection Report'
        )}
      </button>
    </form>
  );
}
