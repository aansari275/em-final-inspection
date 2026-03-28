import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, getCustomers, addCustomer, getDesignNames, addDesignName, DesignName, getOpsByNumber, getOpsList, OpsOrder, getBuyerMerchantEmails, saveCloudDraft, getCloudDrafts, deleteCloudDraft, CloudDraft } from '../lib/firebase';
import { emailSettingsService } from '../lib/emailSettingsService';
import { generateFinalInspectionPDF } from '../lib/pdfGenerator';
import { calculateAql, wouldPass, AqlCalculationResult, LOT_SIZE_CODE_LETTERS, SAMPLE_SIZES, AQL_ACCEPT_REJECT_TABLE, AcceptRejectValue } from '../lib/aqlCalculator';
import { uploadPhotosInBackground, countTotalPhotos } from '../lib/photoUploader';
import {
  createVisibilityHandler,
  createBeforeUnloadHandler,
  createPageHideHandler,
  debounce,
  DRAFT_STORAGE_KEY
} from '../lib/draftPersistence';
import {
  QC_INSPECTORS,
  MERCHANTS,
  PHOTO_TYPES,
  CONSTRUCTION_PHOTO_TYPES,
  OK_NOT_OK_FIELDS,
  Customer,
  SelectedArticle,
  COMPANY_NAMES,
  CUSTOM_OPTIONS_KEYS,
  FinalInspectionV2,
  SizeInspection,
  SizeInspectionFormState,
} from '../types';
import {
  InspectionFormProvider,
  useInspectionForm,
  type GlobalFormData,
} from '../context/InspectionFormContext';
import SizeInspectionList from './SizeInspectionList';
import { Loader2, X, Camera, CheckCircle2, XCircle, Plus, Save, Search, Package, AlertCircle, ChevronDown, Calculator, Info } from 'lucide-react';

// ─── Helpers ───

const getCustomOptions = (key: string): string[] => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveCustomOptions = (key: string, options: string[]) => {
  localStorage.setItem(key, JSON.stringify(options));
};

// ─── Reusable sub-components (kept from old file) ───

interface DropdownWithAddProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | string[];
  customOptions: string[];
  onAddCustom: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

function DropdownWithAdd({
  label,
  value,
  onChange,
  options,
  customOptions,
  onAddCustom,
  required = false,
  placeholder = 'Select...'
}: DropdownWithAddProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newValue, setNewValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const allOptions = [...options, ...customOptions];

  const handleAdd = () => {
    if (newValue.trim() && !allOptions.includes(newValue.trim())) {
      onAddCustom(newValue.trim());
      onChange(newValue.trim());
      setNewValue('');
      setShowAddModal(false);
    }
  };

  useEffect(() => {
    if (showAddModal && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showAddModal]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && '*'}</label>
      <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 bg-white">
        <select
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border-0 bg-transparent focus:ring-0 focus:outline-none"
        >
          <option value="">{placeholder}</option>
          {allOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3 py-2 border-l border-gray-300 text-emerald-600 hover:bg-emerald-50 transition-colors"
          title="Add new option"
        >
          <Plus size={18} />
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Add New {label}</h3>
            <input
              ref={inputRef}
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={`Enter new ${label.toLowerCase()}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setNewValue(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newValue.trim()}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Customer Dropdown with Firestore sync
interface CustomerDropdownProps {
  customerName: string;
  customers: Customer[];
  onCustomerChange: (name: string, code: string) => void;
  onAddCustomer: (customer: Customer) => void;
  required?: boolean;
  loading?: boolean;
}

function CustomerDropdown({
  customerName,
  customers,
  onCustomerChange,
  onAddCustomer,
  required = false,
  loading = false
}: CustomerDropdownProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    if (!selectedValue) {
      onCustomerChange('', '');
      return;
    }
    const customer = customers.find(c => c.name === selectedValue);
    if (customer) {
      onCustomerChange(customer.name, customer.code);
    }
  };

  const handleAdd = async () => {
    if (newName.trim() && newCode.trim()) {
      const customer: Customer = {
        name: newName.trim().toUpperCase(),
        code: newCode.trim().toUpperCase()
      };
      onAddCustomer(customer);
      onCustomerChange(customer.name, customer.code);
      setNewName('');
      setNewCode('');
      setShowAddModal(false);
    }
  };

  useEffect(() => {
    if (showAddModal && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [showAddModal]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name {required && '*'}</label>
      <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 bg-white">
        <select
          required={required}
          value={customerName}
          onChange={handleSelect}
          disabled={loading}
          className="flex-1 px-3 py-2 border-0 bg-transparent focus:ring-0 focus:outline-none disabled:bg-gray-100 disabled:cursor-wait"
        >
          <option value="">{loading ? 'Loading customers...' : 'Select Customer'}</option>
          {customers.map(c => (
            <option key={c.code} value={c.name}>{c.name} ({c.code})</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3 py-2 border-l border-gray-300 text-emerald-600 hover:bg-emerald-50 transition-colors"
          title="Add new customer"
        >
          <Plus size={18} />
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Add New Customer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., NORDIC KNOTS"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Code *</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="e.g., N-02"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 uppercase"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setNewName(''); setNewCode(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newName.trim() || !newCode.trim()}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Draft interface (V2 shape) ───

interface DraftDataV2 {
  global: GlobalFormData;
  sizeInspections: Array<Record<string, unknown>>; // stripped of File objects
  selectedArticles: SelectedArticle[];
  savedAt: string;
}

// ─── Build V2 email HTML ───

function buildV2EmailHtml(
  doc: FinalInspectionV2,
): string {
  const resultColor = doc.inspectionResult === 'PASS' ? '#22c55e' : '#ef4444';
  const resultBg = doc.inspectionResult === 'PASS' ? '#dcfce7' : '#fee2e2';
  const companyFullName = COMPANY_NAMES[doc.company] || 'Eastern Mills';

  const tblBorder = 'border: 1px solid #d1d5db;';
  const cellPad = 'padding: 8px 12px;';
  const headerCell = `${tblBorder} ${cellPad} background-color: #059669; color: white; font-weight: bold; font-size: 13px;`;
  const labelCell = `${tblBorder} ${cellPad} color: #374151; font-size: 13px; background-color: #f9fafb;`;
  const valueCell = `${tblBorder} ${cellPad} color: #111827; font-size: 13px;`;
  const sectionHeader = (title: string) => `
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <tr><td style="${headerCell} text-align: center; font-size: 14px; letter-spacing: 0.5px;">${title}</td></tr>
    </table>`;

  const statusStyle = (val: string) => {
    if (val === 'OK') return 'color: #16a34a; font-weight: bold;';
    if (val === 'NOT OK') return 'color: #dc2626; font-weight: bold;';
    return 'color: #9ca3af;';
  };
  const statusLabel = (val: string) => val || 'NA';

  // Build per-size sections
  const sizeSections = doc.sizeInspections.map((size, idx) => {
    const sizeTitle = size.size ? `Size: ${size.size} ${size.sizeUnit}` : `Size ${idx + 1}`;
    const sizeResultColor = size.inspectionResult === 'PASS' ? '#22c55e' : '#ef4444';
    const sizeResultBg = size.inspectionResult === 'PASS' ? '#dcfce7' : '#fee2e2';

    const qualityChecks = [
      { label: 'Approved Sample Available', value: size.approvedSampleAvailable },
      { label: 'Material/Fibre Content', value: size.materialFibreContent || '-' },
      { label: 'Motif/Design Check', value: size.motifDesignCheck, isStatus: true },
      { label: 'Backing', value: size.backing, isStatus: true, note: size.backingNotes },
      { label: 'Binding & Edges', value: size.bindingAndEdges, isStatus: true },
      { label: 'Hand Feel', value: size.handFeel, isStatus: true },
      { label: 'Embossing/Carving', value: size.embossingCarving, isStatus: true },
      { label: 'Workmanship', value: size.workmanship, isStatus: true },
      { label: 'Product Quality Weight', value: size.productQualityWeight, isStatus: true },
    ];

    const measurementRows = [
      { label: 'Tuft Density', value: size.tuftDensity },
      { label: 'Pile Height', value: size.pileHeight },
      { label: 'Product Weight', value: size.productWeight },
      { label: 'Size Tolerance', value: size.sizeTolerance },
      { label: 'Finishing %', value: size.finishingPercent },
      { label: 'Packed %', value: size.packedPercent },
    ].filter(r => r.value);

    const labelingChecks = [
      { label: 'Label Placement', value: size.labelPlacement },
      { label: 'Side Marking', value: size.sideMarking },
      { label: 'Outer Marking', value: size.outerMarking },
      { label: 'Inner Pack', value: size.innerPack },
      { label: 'Care Labels', value: size.careLabels },
      { label: 'SKU Stickers', value: size.skuStickers },
      { label: 'UPC Barcodes', value: size.upcBarcodes },
      { label: 'Product Label', value: size.productLabel },
      { label: 'Carton Label', value: size.cartonLabel },
      { label: 'Barcode Scan', value: size.barcodeScan },
    ];

    const packagingRows = [
      { label: 'Carton Ply', value: size.cartonPly },
      { label: 'Carton Drop Test', value: size.cartonDropTest, isStatus: true },
      { label: 'Packing Type', value: size.packingType },
      { label: 'Gross Weight', value: size.grossWeight },
      { label: 'Net Weight', value: size.netWeight },
      { label: 'Carton/Bale Numbering', value: size.cartonBaleNumbering, isStatus: true },
      { label: 'Carton Dimension', value: size.cartonDimension, isStatus: true },
      { label: 'Pcs per Carton/Bale', value: size.pcsPerCartonBale },
      { label: 'Pcs per Polybag', value: size.pcsPerPolybag },
      { label: 'Carton (L x W x H)', value: [size.cartonMeasurementL, size.cartonMeasurementW, size.cartonMeasurementH].filter(Boolean).join(' x ') || '' },
    ];

    const hasDefects = size.defects && size.defects.length > 0 && size.defects.some(d => d.defectCode);

    // Collect all photos for this size
    const allSizePhotos: Array<{ url: string; label: string }> = [];
    if (size.stackedGoodsPhotoUrl) allSizePhotos.push({ url: size.stackedGoodsPhotoUrl, label: 'Stacked Goods' });
    for (const pt of PHOTO_TYPES) {
      const url = size.standardPhotoUrls?.[pt.key];
      if (url) allSizePhotos.push({ url, label: pt.label });
    }
    for (const pt of CONSTRUCTION_PHOTO_TYPES) {
      const url = size.constructionPhotoUrls?.[pt.key];
      if (url) allSizePhotos.push({ url, label: pt.label });
    }
    if (size.consumerPieces) {
      for (const cp of size.consumerPieces) {
        if (cp.url) allSizePhotos.push({ url: cp.url, label: cp.label });
      }
    }
    if (size.unitLoadEnabled && size.unitLoadPhotos) {
      for (const ul of size.unitLoadPhotos) {
        if (ul.url) allSizePhotos.push({ url: ul.url, label: ul.label });
      }
    }
    if (size.otherPhotoUrls) {
      size.otherPhotoUrls.forEach((url, i) => {
        if (url) allSizePhotos.push({ url, label: `Other ${i + 1}` });
      });
    }
    if (size.notOkPhotos) {
      for (const nok of size.notOkPhotos) {
        const fieldInfo = OK_NOT_OK_FIELDS.find(f => f.key === nok.field);
        const fieldLabel = fieldInfo ? fieldInfo.label : nok.field;
        if (nok.photo) allSizePhotos.push({ url: nok.photo, label: `${fieldLabel} [NOT OK]` });
      }
    }

    return `
      <!-- Size Header -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
        <tr>
          <td style="background: ${sizeResultBg}; padding: 12px 16px; border: 2px solid ${sizeResultColor}; border-radius: 4px;">
            <span style="font-weight: bold; font-size: 16px; color: #1f2937;">${sizeTitle}</span>
            <span style="float: right; color: ${sizeResultColor}; font-weight: bold; font-size: 16px;">
              ${size.inspectionResult === 'PASS' ? '&#10003; PASS' : '&#10007; FAIL'}
            </span>
          </td>
        </tr>
      </table>

      <!-- Quality Checks -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        ${qualityChecks.map(qc => `
        <tr>
          <td style="${labelCell} width: 50%;">${qc.label}</td>
          <td style="${valueCell}${qc.isStatus ? ' ' + statusStyle(qc.value as string) : ''}">${qc.isStatus ? statusLabel(qc.value as string) : (qc.value || '-')}${qc.note ? ` <span style="color: #6b7280; font-weight: normal; font-size: 12px;">(${qc.note})</span>` : ''}</td>
        </tr>
        `).join('')}
      </table>

      ${measurementRows.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        ${measurementRows.map((m, i) => {
          if (i % 2 === 0) {
            const next = measurementRows[i + 1];
            return `<tr>
              <td style="${labelCell} width: 25%;">${m.label}</td>
              <td style="${valueCell} width: 25%;"><strong>${m.value}</strong></td>
              ${next ? `<td style="${labelCell} width: 25%;">${next.label}</td><td style="${valueCell} width: 25%;"><strong>${next.value}</strong></td>` : `<td style="${labelCell} width: 25%;"></td><td style="${valueCell} width: 25%;"></td>`}
            </tr>`;
          }
          return '';
        }).join('')}
      </table>
      ` : ''}

      <!-- Labeling & Marking -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        ${labelingChecks.map((lc, i) => {
          if (i % 2 === 0) {
            const next = labelingChecks[i + 1];
            return `<tr>
              <td style="${labelCell} width: 25%;">${lc.label}</td>
              <td style="${valueCell} width: 25%; ${statusStyle(lc.value as string)}">${statusLabel(lc.value as string)}</td>
              ${next ? `<td style="${labelCell} width: 25%;">${next.label}</td><td style="${valueCell} width: 25%; ${statusStyle(next.value as string)}">${statusLabel(next.value as string)}</td>` : `<td style="${labelCell} width: 25%;"></td><td style="${valueCell} width: 25%;"></td>`}
            </tr>`;
          }
          return '';
        }).join('')}
      </table>

      <!-- Packaging -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        ${packagingRows.filter(r => r.value).map((pr, i, arr) => {
          if (i % 2 === 0) {
            const next = arr[i + 1];
            return `<tr>
              <td style="${labelCell} width: 25%;">${pr.label}</td>
              <td style="${valueCell} width: 25%;${pr.isStatus ? ' ' + statusStyle(pr.value as string) : ''}">${pr.isStatus ? statusLabel(pr.value as string) : pr.value}</td>
              ${next ? `<td style="${labelCell} width: 25%;">${next.label}</td><td style="${valueCell} width: 25%;${next.isStatus ? ' ' + statusStyle(next.value as string) : ''}">${next.isStatus ? statusLabel(next.value as string) : next.value}</td>` : `<td style="${labelCell} width: 25%;"></td><td style="${valueCell} width: 25%;"></td>`}
            </tr>`;
          }
          return '';
        }).join('')}
      </table>

      ${hasDefects ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px;">
        <tr>
          <td style="${headerCell}">Code</td>
          <td style="${headerCell}">Description</td>
          <td style="${headerCell} text-align: center;">Major</td>
          <td style="${headerCell} text-align: center;">Minor</td>
        </tr>
        ${size.defects.filter(d => d.defectCode).map(d => `
        <tr>
          <td style="${valueCell} font-weight: bold;">${d.defectCode}</td>
          <td style="${valueCell}">${d.description || '-'}</td>
          <td style="${valueCell} text-align: center;${d.majorCount > 0 ? ' color: #dc2626; font-weight: bold;' : ''}">${d.majorCount || 0}</td>
          <td style="${valueCell} text-align: center;${d.minorCount > 0 ? ' color: #d97706; font-weight: bold;' : ''}">${d.minorCount || 0}</td>
        </tr>
        `).join('')}
        <tr style="font-weight: bold;">
          <td colspan="2" style="${labelCell}">Total Defects</td>
          <td style="${labelCell} text-align: center; color: #dc2626;">${size.defects.reduce((s, d) => s + (d.majorCount || 0), 0)}</td>
          <td style="${labelCell} text-align: center; color: #d97706;">${size.defects.reduce((s, d) => s + (d.minorCount || 0), 0)}</td>
        </tr>
      </table>
      ` : ''}

      ${size.qcInspectorRemarks ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <tr><td style="${labelCell}">Remarks</td><td style="${valueCell} font-style: italic;">${size.qcInspectorRemarks}</td></tr>
      </table>
      ` : ''}

      ${allSizePhotos.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        ${allSizePhotos.map((photo, i) => {
          if (i % 2 === 0) {
            const next = allSizePhotos[i + 1];
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
    `;
  }).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background: #ffffff;">
      <!-- Header -->
      <table style="width: 100%; border-collapse: collapse; background: #059669;">
        <tr>
          <td style="padding: 24px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 22px; letter-spacing: 1px;">${companyFullName}</h1>
            <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Final Inspection Report (V2)</p>
          </td>
        </tr>
      </table>

      <!-- PASS/FAIL Banner -->
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="background: ${resultBg}; padding: 18px; text-align: center; border-bottom: 4px solid ${resultColor};">
            <span style="color: ${resultColor}; font-size: 28px; font-weight: bold; letter-spacing: 2px;">
              ${doc.inspectionResult === 'PASS' ? '&#10003; PASSED' : '&#10007; FAILED'}
            </span>
            ${doc.resultOverridden ? '<br><span style="color: #d97706; font-size: 12px; font-style: italic;">Inspector Override Applied</span>' : ''}
          </td>
        </tr>
      </table>

      <div style="padding: 20px;">
        <!-- Order Information -->
        ${sectionHeader('ORDER INFORMATION')}
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="${labelCell} width: 35%;">Inspection Date</td>
            <td style="${valueCell}">${doc.inspectionDate}</td>
            <td style="${labelCell} width: 15%;">Doc No.</td>
            <td style="${valueCell}">${doc.documentNo}</td>
          </tr>
          <tr>
            <td style="${labelCell}">QC Inspector</td>
            <td style="${valueCell}">${doc.qcInspectorName}</td>
            <td style="${labelCell}">Merchant</td>
            <td style="${valueCell}">${doc.merchant}</td>
          </tr>
          <tr>
            <td style="${labelCell}">Customer</td>
            <td style="${valueCell}" colspan="3"><strong>${doc.customerName}</strong> (${doc.customerCode})</td>
          </tr>
          <tr>
            <td style="${labelCell}">Customer PO</td>
            <td style="${valueCell}">${doc.customerPoNo}</td>
            <td style="${labelCell}">OPS No.</td>
            <td style="${valueCell}"><strong>${doc.opsNo}</strong></td>
          </tr>
          <tr>
            <td style="${labelCell}">Buyer Design</td>
            <td style="${valueCell}">${doc.buyerDesignName}</td>
            <td style="${labelCell}">EMPL Design</td>
            <td style="${valueCell}">${doc.emplDesignNo}</td>
          </tr>
          <tr>
            <td style="${labelCell}">Color</td>
            <td style="${valueCell}">${doc.colorName}</td>
            <td style="${labelCell}">Sizes</td>
            <td style="${valueCell}">${doc.productSizes}</td>
          </tr>
        </table>

        <!-- Inspected Articles -->
        ${doc.inspectedArticles && doc.inspectedArticles.length > 0 ? `
        ${sectionHeader('INSPECTED ARTICLES')}
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="${headerCell}">Article</td>
            <td style="${headerCell}">Size</td>
            <td style="${headerCell}">Color</td>
            <td style="${headerCell} text-align: right;">Total Pcs</td>
            <td style="${headerCell} text-align: right;">Inspected</td>
          </tr>
          ${doc.inspectedArticles.map(article => `
          <tr>
            <td style="${valueCell}">${article.articleName || '-'}</td>
            <td style="${valueCell}">${article.size || '-'}</td>
            <td style="${valueCell}">${article.color || '-'}</td>
            <td style="${valueCell} text-align: right;">${article.pcs || 0}</td>
            <td style="${valueCell} text-align: right; font-weight: bold; color: #059669;">${article.inspectedQty || article.pcs || 0}</td>
          </tr>
          `).join('')}
          <tr style="font-weight: bold;">
            <td colspan="3" style="${labelCell}">Total</td>
            <td style="${labelCell} text-align: right;">${doc.inspectedArticles.reduce((sum, a) => sum + (a.pcs || 0), 0)}</td>
            <td style="${labelCell} text-align: right; color: #059669;">${doc.inspectedArticles.reduce((sum, a) => sum + (a.inspectedQty || a.pcs || 0), 0)}</td>
          </tr>
        </table>
        ` : ''}

        <!-- AQL & Quantities -->
        ${sectionHeader('AQL SAMPLING & QUANTITIES')}
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="${labelCell} width: 35%;">Total Order Qty</td>
            <td style="${valueCell}">${doc.totalOrderQty}</td>
            <td style="${labelCell} width: 15%;">Inspected Lot</td>
            <td style="${valueCell}">${doc.inspectedLotQty}</td>
          </tr>
          <tr>
            <td style="${labelCell}">AQL Level</td>
            <td style="${valueCell}">${doc.aql}</td>
            <td style="${labelCell}">Sample Size</td>
            <td style="${valueCell}"><strong>${doc.sampleSize}</strong></td>
          </tr>
          ${doc.codeLetter ? `
          <tr>
            <td style="${labelCell}">Code Letter</td>
            <td style="${valueCell}"><strong>${doc.codeLetter}</strong>${doc.effectiveCodeLetter && doc.effectiveCodeLetter !== doc.codeLetter ? ` &#8594; ${doc.effectiveCodeLetter}` : ''}</td>
            <td style="${labelCell}">Standard</td>
            <td style="${valueCell}">Z1.4-2008 Level II</td>
          </tr>
          ` : ''}
          <tr>
            <td style="${labelCell}">Accept &#8804;</td>
            <td style="${valueCell}"><span style="color: #16a34a; font-weight: bold; font-size: 16px;">${doc.acceptNumber ?? doc.acceptedQty}</span></td>
            <td style="${labelCell}">Reject &#8805;</td>
            <td style="${valueCell}"><span style="color: #dc2626; font-weight: bold; font-size: 16px;">${doc.rejectNumber ?? '-'}</span></td>
          </tr>
          <tr>
            <td style="${labelCell}">Accepted Qty</td>
            <td style="${valueCell} color: #16a34a; font-weight: bold;">${doc.acceptedQty}</td>
            <td style="${labelCell}">Rejected Qty</td>
            <td style="${valueCell} color: #dc2626; font-weight: bold;">${doc.rejectedQty}</td>
          </tr>
        </table>

        <!-- Per-Size Sections -->
        ${sizeSections}
      </div>

      <!-- Footer -->
      <table style="width: 100%; border-collapse: collapse; background: #059669; margin-top: 20px;">
        <tr>
          <td style="padding: 16px; text-align: center; color: white; font-size: 12px;">
            <p style="margin: 0;">${companyFullName} - Final Inspection Report</p>
            <p style="margin: 4px 0 0; opacity: 0.8;">PDF report attached for complete documentation</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

// ─── Strip File objects from size inspections for draft/Firestore ───

function stripFilesFromSizes(sizes: SizeInspectionFormState[]): SizeInspection[] {
  return sizes.map(size => ({
    id: size.id,
    size: size.size,
    sizeUnit: size.sizeUnit,
    approvedSampleAvailable: size.approvedSampleAvailable,
    materialFibreContent: size.materialFibreContent,
    motifDesignCheck: size.motifDesignCheck,
    tuftDensity: size.tuftDensity,
    backing: size.backing,
    backingNotes: size.backingNotes,
    bindingAndEdges: size.bindingAndEdges,
    handFeel: size.handFeel,
    pileHeight: size.pileHeight,
    embossingCarving: size.embossingCarving,
    workmanship: size.workmanship,
    productQualityWeight: size.productQualityWeight,
    productWeight: size.productWeight,
    sizeTolerance: size.sizeTolerance,
    finishingPercent: size.finishingPercent,
    packedPercent: size.packedPercent,
    labelPlacement: size.labelPlacement,
    sideMarking: size.sideMarking,
    outerMarking: size.outerMarking,
    innerPack: size.innerPack,
    careLabels: size.careLabels,
    skuStickers: size.skuStickers,
    upcBarcodes: size.upcBarcodes,
    cartonPly: size.cartonPly,
    cartonDropTest: size.cartonDropTest,
    packingType: size.packingType,
    grossWeight: size.grossWeight,
    netWeight: size.netWeight,
    cartonBaleNumbering: size.cartonBaleNumbering,
    pcsPerCartonBale: size.pcsPerCartonBale,
    pcsPerPolybag: size.pcsPerPolybag,
    cartonMeasurementL: size.cartonMeasurementL,
    cartonMeasurementW: size.cartonMeasurementW,
    cartonMeasurementH: size.cartonMeasurementH,
    cartonDimension: size.cartonDimension,
    productLabel: size.productLabel,
    cartonLabel: size.cartonLabel,
    barcodeScan: size.barcodeScan,
    dpciSkuStyleNumber: size.dpciSkuStyleNumber,
    styleDescription: size.styleDescription,
    defects: size.defects,
    // Photo URLs empty until background upload fills them
    standardPhotoUrls: {},
    constructionPhotoUrls: {},
    otherPhotoUrls: [],
    stackedGoodsPhotoUrl: '',
    consumerPieces: [],
    unitLoadEnabled: size.unitLoadEnabled,
    unitLoadPhotos: [],
    notOkPhotos: [],
    qcInspectorRemarks: size.qcInspectorRemarks,
    inspectionResult: size.inspectionResult,
  }));
}

// ─── Inner form component (uses context) ───

function FinalInspectionFormInner() {
  const { state, dispatch } = useInspectionForm();
  const g = state.global;

  // Local UI/lookup state
  const [opsData, setOpsData] = useState<OpsOrder | null>(null);
  const [opsSearchValue, setOpsSearchValue] = useState('');
  const [showOpsDropdown, setShowOpsDropdown] = useState(false);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState('');
  const [opsListLoading, setOpsListLoading] = useState(true);
  const [opsList, setOpsList] = useState<Array<{ salesNo: string; buyerName: string; buyerCode: string; poNumber: string; totalPcs: number; status: string }>>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [designNames, setDesignNames] = useState<DesignName[]>([]);
  const [designNamesLoading, setDesignNamesLoading] = useState(true);

  const [customQcInspectors, setCustomQcInspectors] = useState<string[]>([]);
  const [customMerchants, setCustomMerchants] = useState<string[]>([]);
  const [_customBuyerDesigns, setCustomBuyerDesigns] = useState<string[]>([]);
  const [_customSizesCm, setCustomSizesCm] = useState<string[]>([]);
  const [_customSizesFeet, setCustomSizesFeet] = useState<string[]>([]);
  const [_customAqlLevels, setCustomAqlLevels] = useState<string[]>([]);
  const [_customConsumerLabels, setCustomConsumerLabels] = useState<string[]>([]);
  const [_customUnitLoadLabels, setCustomUnitLoadLabels] = useState<string[]>([]);

  const [aqlCalculation, setAqlCalculation] = useState<AqlCalculationResult | null>(null);
  const [isAutoResult, setIsAutoResult] = useState(false);
  const [resultOverridden, setResultOverridden] = useState(false);
  const [showAqlChart, setShowAqlChart] = useState(false);

  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [cloudDraftId, setCloudDraftId] = useState<string | null>(null);
  const [cloudDrafts, setCloudDrafts] = useState<CloudDraft[]>([]);
  const [showDraftsList, setShowDraftsList] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  // Size selector local state
  // sizeUnit state removed - dead code after V2 refactor
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  const opsDropdownRef = useRef<HTMLDivElement>(null);
  const saveDraftRef = useRef<() => void>();

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  // Helper to set a single global field
  const setGlobal = useCallback((field: keyof GlobalFormData, value: string) => {
    dispatch({ type: 'SET_GLOBAL', field, value });
  }, [dispatch]);

  const setGlobalBulk = useCallback((updates: Partial<GlobalFormData>) => {
    dispatch({ type: 'SET_GLOBAL_BULK', updates });
  }, [dispatch]);

  // ─── Data loading on mount ───

  useEffect(() => {
    getCustomers().then(setCustomers).catch(console.error).finally(() => setCustomersLoading(false));
  }, []);

  useEffect(() => {
    getDesignNames().then(setDesignNames).catch(console.error).finally(() => setDesignNamesLoading(false));
  }, []);

  useEffect(() => {
    getOpsList().then(setOpsList).catch(console.error).finally(() => setOpsListLoading(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (opsDropdownRef.current && !opsDropdownRef.current.contains(event.target as Node)) {
        setShowOpsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load custom options from localStorage
  useEffect(() => {
    setCustomQcInspectors(getCustomOptions(CUSTOM_OPTIONS_KEYS.qcInspectors));
    setCustomMerchants(getCustomOptions(CUSTOM_OPTIONS_KEYS.merchants));
    setCustomBuyerDesigns(getCustomOptions(CUSTOM_OPTIONS_KEYS.buyerDesigns));
    setCustomSizesCm(getCustomOptions(CUSTOM_OPTIONS_KEYS.customSizesCm));
    setCustomSizesFeet(getCustomOptions(CUSTOM_OPTIONS_KEYS.customSizesFeet));
    setCustomAqlLevels(getCustomOptions(CUSTOM_OPTIONS_KEYS.aqlLevels));
    setCustomConsumerLabels(getCustomOptions(CUSTOM_OPTIONS_KEYS.consumerPieceLabels));
    setCustomUnitLoadLabels(getCustomOptions(CUSTOM_OPTIONS_KEYS.unitLoadLabels));
  }, []);

  // ─── AQL Z1.4-2008 Auto-Calculation ───

  useEffect(() => {
    const lotSize = parseInt(g.inspectedLotQty, 10);
    const aql = g.aql;
    if (!isNaN(lotSize) && lotSize >= 2 && aql) {
      const result = calculateAql(lotSize, aql, 'II');
      setAqlCalculation(result);
      if (result.isValid) {
        setGlobal('sampleSize', String(result.sampleSize));
      }
    } else {
      setAqlCalculation(null);
    }
  }, [g.inspectedLotQty, g.aql, setGlobal]);

  // Auto PASS/FAIL
  useEffect(() => {
    if (!aqlCalculation?.isValid || resultOverridden) return;
    const rejectedQty = parseInt(g.rejectedQty, 10);
    if (isNaN(rejectedQty)) return;
    const passFailResult = wouldPass(rejectedQty, aqlCalculation.acceptNumber, aqlCalculation.rejectNumber);
    if (passFailResult.result !== g.inspectionResult) {
      setGlobal('inspectionResult', passFailResult.result);
      setIsAutoResult(true);
    }
  }, [g.rejectedQty, aqlCalculation, resultOverridden, g.inspectionResult, setGlobal]);

  const handleResultChange = (newResult: 'PASS' | 'FAIL') => {
    const autoResult = aqlCalculation?.isValid && g.rejectedQty
      ? wouldPass(parseInt(g.rejectedQty, 10), aqlCalculation.acceptNumber, aqlCalculation.rejectNumber).result
      : null;
    if (autoResult && newResult !== autoResult) {
      setResultOverridden(true);
    } else {
      setResultOverridden(false);
    }
    setGlobal('inspectionResult', newResult);
  };

  // ─── Custom option handlers ───

  const addCustomQcInspector = (value: string) => {
    const updated = [...customQcInspectors, value];
    setCustomQcInspectors(updated);
    saveCustomOptions(CUSTOM_OPTIONS_KEYS.qcInspectors, updated);
  };

  const addCustomMerchant = (value: string) => {
    const updated = [...customMerchants, value];
    setCustomMerchants(updated);
    saveCustomOptions(CUSTOM_OPTIONS_KEYS.merchants, updated);
  };

  // addCustomSize removed - dead code after V2 refactor

  // Update global productSizes when selected sizes change (kept for backward compat in global)
  // Note: in V2, sizes live per-size-inspection, but we also track them globally for the document rollup
  useEffect(() => {
    // No-op: sizes are now tracked per-size inspection panel, not globally
    // This field is computed on save from sizeInspections
  }, [selectedSizes]);

  // ─── OPS Lookup ───

  const filteredOpsList = opsList.filter(ops => {
    const search = opsSearchValue.toLowerCase();
    return (
      ops.salesNo.toLowerCase().includes(search) ||
      ops.buyerName.toLowerCase().includes(search) ||
      ops.buyerCode.toLowerCase().includes(search) ||
      ops.poNumber.toLowerCase().includes(search)
    );
  });

  const handleOpsLookupByValue = async (value: string) => {
    if (!value.trim()) { setOpsError('Please enter an OPS number'); return; }
    setOpsLoading(true);
    setOpsError('');
    setOpsData(null);
    dispatch({ type: 'SET_SELECTED_ARTICLES', articles: [] });

    try {
      const order = await getOpsByNumber(value.trim());
      if (!order) { setOpsError(`OPS "${value}" not found`); return; }
      setOpsData(order);

      setGlobalBulk({
        opsNo: order.salesNo,
        customerName: order.buyerName,
        customerCode: order.buyerCode,
        customerPoNo: order.poNumber,
        merchant: order.merchantCode,
        totalOrderQty: order.totalPcs.toString(),
      });

      const articles: SelectedArticle[] = order.items.map(item => ({
        id: item.id,
        articleName: item.articleName,
        size: item.size,
        color: item.color,
        quality: item.quality,
        pcs: item.pcs,
        sqm: item.sqm,
        selected: true,
        inspectedQty: item.pcs,
      }));
      dispatch({ type: 'SET_SELECTED_ARTICLES', articles });

      if (articles.length > 0) {
        setGlobal('emplDesignNo', articles[0].articleName);
      }
    } catch (error) {
      console.error('Error looking up OPS:', error);
      setOpsError('Error looking up OPS. Please try again.');
    } finally {
      setOpsLoading(false);
    }
  };

  const handleOpsSelect = async (salesNo: string) => {
    setOpsSearchValue(salesNo);
    setShowOpsDropdown(false);
    await handleOpsLookupByValue(salesNo);
  };

  const handleOpsLookup = async () => {
    await handleOpsLookupByValue(opsSearchValue);
  };

  const toggleArticleSelection = (articleId: string) => {
    const updated = state.selectedArticles.map(article =>
      article.id === articleId ? { ...article, selected: !article.selected } : article
    );
    const firstSelected = updated.find(a => a.selected);
    if (firstSelected) {
      setGlobal('emplDesignNo', firstSelected.articleName);
    }
    dispatch({ type: 'SET_SELECTED_ARTICLES', articles: updated });
  };

  const updateArticleInspectedQty = (articleId: string, qty: number) => {
    const updated = state.selectedArticles.map(article =>
      article.id === articleId ? { ...article, inspectedQty: Math.min(qty, article.pcs) } : article
    );
    dispatch({ type: 'SET_SELECTED_ARTICLES', articles: updated });
  };

  const clearOpsData = () => {
    setOpsData(null);
    setOpsSearchValue('');
    dispatch({ type: 'SET_SELECTED_ARTICLES', articles: [] });
    setOpsError('');
    setGlobalBulk({
      opsNo: '',
      customerName: '',
      customerCode: '',
      customerPoNo: '',
      merchant: '',
      emplDesignNo: '',
      totalOrderQty: '',
    });
  };

  const handleCustomerChange = (name: string, code: string) => {
    setGlobalBulk({ customerName: name, customerCode: code });
  };

  const handleAddCustomer = async (customer: Customer) => {
    try {
      await addCustomer(customer);
      const updatedCustomers = await getCustomers();
      setCustomers(updatedCustomers);
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer. Please try again.');
    }
  };

  // toggleSize + removeSize removed - dead code after V2 refactor

  // ─── Draft persistence ───

  const saveDraft = useCallback(() => {
    try {
      setDraftSaving(true);
      const now = new Date().toLocaleString();

      // TODO: For V2, photo preview IndexedDB persistence is skipped.
      // Only text data (global + sizeInspections stripped of Files) is saved.
      const draft: DraftDataV2 = {
        global: state.global,
        sizeInspections: state.sizeInspections.map(s => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { standardPhotos, constructionPhotos, otherPhotos, stackedGoodsPhoto, consumerPiecesForm, unitLoadPhotosForm, notOkPhotosForm, standardPhotoPreviews, constructionPhotoPreviews, otherPhotoPreviews, stackedGoodsPreview, notOkPreviews, ...rest } = s;
          return rest as unknown as Record<string, unknown>;
        }),
        selectedArticles: state.selectedArticles,
        savedAt: now,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

      // Cloud draft (V1-compatible shape for now)
      saveCloudDraft(cloudDraftId, {
        formData: state.global as unknown as Record<string, unknown>,
        defects: [] as unknown as Array<Record<string, unknown>>,
        selectedSizes: [],
        sizeUnit: 'cm',
      }).then((id) => {
        if (!cloudDraftId) setCloudDraftId(id);
      }).catch((err) => {
        console.warn('Cloud draft save failed (local backup exists):', err);
      });

      setLastSavedAt(now);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setDraftSaving(false);
    }
  }, [state.global, state.sizeInspections, state.selectedArticles, cloudDraftId]);

  useEffect(() => { saveDraftRef.current = saveDraft; }, [saveDraft]);

  // Load draft on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const draft: DraftDataV2 = JSON.parse(savedDraft);
        if (draft.global) {
          dispatch({ type: 'SET_GLOBAL_BULK', updates: draft.global });
          if (draft.selectedArticles) {
            dispatch({ type: 'SET_SELECTED_ARTICLES', articles: draft.selectedArticles });
          }
          setLastSavedAt(draft.savedAt);
          setDraftRestored(true);
          setTimeout(() => setDraftRestored(false), 5000);
        }
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  }, [dispatch]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      if (cloudDraftId) {
        deleteCloudDraft(cloudDraftId).catch(console.error);
        setCloudDraftId(null);
      }
      setLastSavedAt(null);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [cloudDraftId]);

  const loadCloudDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const drafts = await getCloudDrafts();
      setCloudDrafts(drafts);
    } catch (error) {
      console.error('Error loading cloud drafts:', error);
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  const resumeCloudDraft = useCallback(async (draft: CloudDraft) => {
    try {
      const formData = draft.formData as unknown as Partial<GlobalFormData>;
      dispatch({ type: 'SET_GLOBAL_BULK', updates: formData });
      setCloudDraftId(draft.id);
      setLastSavedAt(draft.savedAt);
      setShowDraftsList(false);
      setDraftRestored(true);
      setTimeout(() => setDraftRestored(false), 5000);
    } catch (error) {
      console.error('Error resuming cloud draft:', error);
      alert('Failed to load draft. Please try again.');
    }
  }, [dispatch]);

  const handleDeleteCloudDraft = useCallback(async (draftId: string) => {
    if (!confirm('Delete this draft?')) return;
    try {
      await deleteCloudDraft(draftId);
      setCloudDrafts(prev => prev.filter(d => d.id !== draftId));
      if (cloudDraftId === draftId) setCloudDraftId(null);
    } catch (error) {
      console.error('Error deleting cloud draft:', error);
    }
  }, [cloudDraftId]);

  // Debounced auto-save
  const debouncedSave = useCallback(
    debounce(() => { if (saveDraftRef.current) saveDraftRef.current(); }, 3000),
    []
  );

  useEffect(() => {
    if (g.customerName || g.opsNo || g.buyerDesignName) debouncedSave();
  }, [g, debouncedSave]);

  // Backup interval save
  useEffect(() => {
    const interval = setInterval(() => {
      if (g.customerName || g.opsNo || g.buyerDesignName) {
        if (saveDraftRef.current) saveDraftRef.current();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [g.customerName, g.opsNo, g.buyerDesignName]);

  // Keep-alive for PWA
  useEffect(() => {
    const keepAlive = setInterval(() => {
      localStorage.setItem('finalInspection_keepAlive', Date.now().toString());
    }, 5 * 60 * 1000);
    return () => clearInterval(keepAlive);
  }, []);

  // Save on visibility change / pagehide / beforeunload
  useEffect(() => {
    const c1 = createVisibilityHandler(() => { if (saveDraftRef.current) saveDraftRef.current(); });
    const c2 = createPageHideHandler(() => { if (saveDraftRef.current) saveDraftRef.current(); });
    const c3 = createBeforeUnloadHandler(() => { if (saveDraftRef.current) saveDraftRef.current(); });
    return () => { c1(); c2(); c3(); };
  }, []);

  // ─── Submit handler (V2 flow) ───

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const photoCount = countTotalPhotos(state.sizeInspections);
    if (photoCount === 0) {
      const proceed = window.confirm(
        'No photos have been attached to this inspection.\n\n' +
        'Photos are required for a complete inspection report. ' +
        'Are you sure you want to submit without any photos?'
      );
      if (!proceed) return;
    }

    dispatch({ type: 'SET_UI', updates: { loading: true, success: false, uploadProgress: 'Saving inspection...' } });

    try {
      // Compute rollup fields
      const allSizes = state.sizeInspections.map(s => s.size).filter(Boolean);
      const productSizes = allSizes.join(', ');
      const sizeUnitRollup = state.sizeInspections[0]?.sizeUnit || 'cm';
      const overallResult: 'PASS' | 'FAIL' = state.sizeInspections.some(s => s.inspectionResult === 'FAIL') ? 'FAIL' : g.inspectionResult;

      const v2Doc: FinalInspectionV2 = {
        version: 2,
        company: g.company,
        documentNo: g.documentNo,
        inspectionDate: g.inspectionDate,
        qcInspectorName: g.qcInspectorName,
        customerName: g.customerName,
        customerCode: g.customerCode,
        customerPoNo: g.customerPoNo,
        opsNo: g.opsNo,
        opsNumber: g.opsNo,
        buyerDesignName: g.buyerDesignName,
        emplDesignNo: g.emplDesignNo,
        colorName: g.colorName,
        merchant: g.merchant,
        totalOrderQty: Number(g.totalOrderQty) || 0,
        inspectedLotQty: Number(g.inspectedLotQty) || 0,
        aql: g.aql,
        sampleSize: Number(g.sampleSize) || 0,
        acceptedQty: Number(g.acceptedQty) || 0,
        rejectedQty: Number(g.rejectedQty) || 0,
        inspectionLevel: 'II',
        codeLetter: aqlCalculation?.codeLetter || undefined,
        calculatedSampleSize: aqlCalculation?.sampleSize ?? undefined,
        acceptNumber: aqlCalculation?.acceptNumber ?? undefined,
        rejectNumber: aqlCalculation?.rejectNumber ?? undefined,
        effectiveCodeLetter: aqlCalculation?.effectiveCodeLetter || undefined,
        isAutoResult,
        resultOverridden,
        inspectedArticles: state.selectedArticles
          .filter(a => a.selected)
          .map(a => ({
            articleName: a.articleName || '',
            size: a.size || '',
            color: a.color || '',
            quality: a.quality || '',
            pcs: a.pcs || 0,
            sqm: a.sqm || 0,
            inspectedQty: a.inspectedQty || a.pcs || 0,
          })),
        sizeInspections: stripFilesFromSizes(state.sizeInspections),
        productSizes,
        sizeUnit: sizeUnitRollup,
        inspectionResult: overallResult,
        photoUploadStatus: photoCount > 0 ? 'pending' : 'complete',
        totalPhotoCount: photoCount,
        uploadedPhotoCount: 0,
        emailStatus: 'pending',
        createdAt: new Date().toISOString(),
      };

      // Strip undefined values (Firestore rejects them)
      const cleanDoc = JSON.parse(JSON.stringify(v2Doc));

      // Save to Firestore immediately
      const docRef = await addDoc(collection(db, 'final-inspections'), cleanDoc);
      const savedDocId = docRef.id;

      // Capture sizeInspections before reset (they have File objects needed for upload)
      const capturedSizeInspections = [...state.sizeInspections];
      const capturedV2Doc = { ...v2Doc };

      // Show success, reset form
      dispatch({ type: 'SET_UI', updates: { success: true, loading: false, uploadProgress: '', emailImageCount: photoCount } });
      clearDraft();
      dispatch({ type: 'RESET' });
      setOpsData(null);
      setOpsSearchValue('');
      setOpsError('');
      setCloudDraftId(null);
      setAqlCalculation(null);
      setIsAutoResult(false);
      setResultOverridden(false);
      setSelectedSizes([]);

      // ─── BACKGROUND: Upload photos, then generate PDF + send email ───
      const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'Email is still sending. Are you sure you want to leave?';
      };
      window.addEventListener('beforeunload', beforeUnloadHandler);
      dispatch({ type: 'SET_UI', updates: { emailSending: true, emailFailed: false } });

      (async () => {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 10000;

        // Step 1: Upload photos in background
        if (photoCount > 0) {
          dispatch({ type: 'SET_UI', updates: { emailProgress: `Uploading ${photoCount} photos...` } });
          await uploadPhotosInBackground(
            savedDocId,
            capturedSizeInspections,
            (msg) => dispatch({ type: 'SET_UI', updates: { emailProgress: msg } }),
            (_status) => { /* onStatusUpdate */ }
          );
        }

        // Step 2: Read updated doc (with photo URLs), generate PDF, send email
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            await updateDoc(doc(db, 'final-inspections', savedDocId), { emailStatus: 'sending' });
            dispatch({ type: 'SET_UI', updates: { emailProgress: 'Getting recipients...' } });

            const recipients = await emailSettingsService.getRecipients();
            let merchantEmails: { primary?: string; assistant?: string } = {};
            try {
              merchantEmails = await getBuyerMerchantEmails(capturedV2Doc.customerCode);
            } catch (merchantError) {
              console.warn('Failed to get merchant emails:', merchantError);
            }

            const allRecipients = [...recipients];
            if (merchantEmails.primary && !allRecipients.includes(merchantEmails.primary)) {
              allRecipients.push(merchantEmails.primary);
            }
            if (merchantEmails.assistant && !allRecipients.includes(merchantEmails.assistant)) {
              allRecipients.push(merchantEmails.assistant);
            }

            if (allRecipients.length > 0) {
              // Read the updated doc to get photo URLs
              dispatch({ type: 'SET_UI', updates: { emailProgress: 'Generating PDF...' } });
              const updatedSnap = await getDoc(doc(db, 'final-inspections', savedDocId));
              const updatedData = updatedSnap.exists() ? (updatedSnap.data() as FinalInspectionV2) : capturedV2Doc;

              const pdfBase64 = await generateFinalInspectionPDF(updatedData as any, (msg) => {
                dispatch({ type: 'SET_UI', updates: { emailProgress: msg } });
              });

              const emailHtml = buildV2EmailHtml(updatedData);

              dispatch({ type: 'SET_UI', updates: { emailProgress: 'Sending email...' } });

              // Check PDF size
              let emailPdfBase64: string | null = pdfBase64;
              const pdfSizeBytes = pdfBase64 ? Math.round(pdfBase64.length * 0.75) : 0;
              const MAX_PDF_SIZE = 5 * 1024 * 1024;

              if (pdfSizeBytes > MAX_PDF_SIZE) {
                console.warn(`PDF too large for email (${Math.round(pdfSizeBytes / 1024 / 1024)}MB), sending without attachment`);
                emailPdfBase64 = null;
              }

              const emailPayload = JSON.stringify({
                to: allRecipients,
                subject: `Final Inspection: ${capturedV2Doc.customerCode}${capturedV2Doc.opsNo ? ` / ${capturedV2Doc.opsNo}` : ''} - ${capturedV2Doc.buyerDesignName} [${capturedV2Doc.inspectionResult}]`,
                html: emailHtml,
                pdfBase64: emailPdfBase64,
                pdfFilename: `Final_Inspection_${capturedV2Doc.opsNo}_${capturedV2Doc.inspectionDate}.pdf`
              });

              if (emailPayload.length > 6 * 1024 * 1024) {
                console.warn('Email payload too large, stripping attachment');
                const fallbackPayload = JSON.stringify({
                  to: allRecipients,
                  subject: `Final Inspection: ${capturedV2Doc.customerCode}${capturedV2Doc.opsNo ? ` / ${capturedV2Doc.opsNo}` : ''} - ${capturedV2Doc.buyerDesignName} [${capturedV2Doc.inspectionResult}]`,
                  html: emailHtml,
                  pdfBase64: null,
                  pdfFilename: null
                });
                const emailResponse = await fetch('/.netlify/functions/send-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: fallbackPayload
                });
                if (!emailResponse.ok) throw new Error(`Email API returned ${emailResponse.status}`);
              } else {
                const emailResponse = await fetch('/.netlify/functions/send-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: emailPayload
                });
                if (!emailResponse.ok) throw new Error(`Email API returned ${emailResponse.status}`);
              }
            }

            // Email sent successfully
            await updateDoc(doc(db, 'final-inspections', savedDocId), { emailStatus: 'sent' });
            dispatch({ type: 'SET_UI', updates: { emailSending: false, emailProgress: '', emailFailed: false } });
            window.removeEventListener('beforeunload', beforeUnloadHandler);
            return; // Success, exit retry loop

          } catch (retryError) {
            console.warn(`Email attempt ${attempt}/${MAX_RETRIES} failed:`, retryError);
            if (attempt < MAX_RETRIES) {
              dispatch({ type: 'SET_UI', updates: { emailProgress: `Email failed, retrying in 10s (attempt ${attempt + 1}/${MAX_RETRIES})...` } });
              await new Promise(r => setTimeout(r, RETRY_DELAY));
            } else {
              await updateDoc(doc(db, 'final-inspections', savedDocId), { emailStatus: 'failed' }).catch(() => {});
              dispatch({ type: 'SET_UI', updates: { emailSending: false, emailProgress: '', emailFailed: true } });
              window.removeEventListener('beforeunload', beforeUnloadHandler);
            }
          }
        }
      })().catch((unexpectedError) => {
        console.error('Unexpected error in background email:', unexpectedError);
        updateDoc(doc(db, 'final-inspections', savedDocId), { emailStatus: 'failed' }).catch(() => {});
        dispatch({ type: 'SET_UI', updates: { emailSending: false, emailProgress: '', emailFailed: true } });
        window.removeEventListener('beforeunload', beforeUnloadHandler);
      });

    } catch (error) {
      console.error('Error submitting inspection:', error);
      alert('Failed to submit inspection. Please try again.');
    } finally {
      dispatch({ type: 'SET_UI', updates: { loading: false, uploadProgress: '' } });
    }
  };

  // ─── Render ───

  const photoCount = countTotalPhotos(state.sizeInspections);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Status banners */}
      {state.success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="text-emerald-600 w-5 h-5" />
          <span className="text-emerald-700">Inspection saved successfully!</span>
        </div>
      )}

      {state.emailSending && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="text-blue-600 w-5 h-5 animate-spin" />
          <div>
            <span className="text-blue-700 font-medium">Email with {state.emailImageCount} images is being prepared...</span>
            {state.emailProgress && <p className="text-blue-600 text-sm mt-0.5">{state.emailProgress}</p>}
          </div>
        </div>
      )}

      {state.emailFailed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-600 w-5 h-5" />
            <span className="text-red-700">Email failed after 3 attempts. Inspection was saved. You can resend from the Inspection List.</span>
          </div>
          <button type="button" onClick={() => dispatch({ type: 'SET_UI', updates: { emailFailed: false } })} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {draftRestored && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Save className="text-blue-600 w-5 h-5" />
            <span className="text-blue-700">Draft restored from {lastSavedAt}</span>
          </div>
          <button type="button" onClick={() => setDraftRestored(false)} className="text-blue-400 hover:text-blue-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cloud Drafts Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setShowDraftsList(!showDraftsList); if (!showDraftsList) loadCloudDrafts(); }}
          className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {showDraftsList ? 'Hide Drafts' : 'Cloud Drafts'}
          {cloudDraftId && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
        </button>
      </div>

      {/* Cloud Drafts List */}
      {showDraftsList && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Saved Drafts (Cloud)</h3>
            <button type="button" onClick={() => setShowDraftsList(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          {loadingDrafts ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
              <span className="ml-2 text-sm text-gray-500">Loading drafts...</span>
            </div>
          ) : cloudDrafts.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No saved drafts found</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cloudDrafts.map(draft => (
                <div
                  key={draft.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    cloudDraftId === draft.id
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <button type="button" onClick={() => resumeCloudDraft(draft)} className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {draft.opsNo || draft.customerName || 'New Inspection'}
                      </span>
                      {draft.customerCode && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{draft.customerCode}</span>
                      )}
                      {cloudDraftId === draft.id && (
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded font-medium">Current</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {draft.emplDesignNo && `${draft.emplDesignNo} · `}
                      Saved {new Date(draft.savedAt).toLocaleString()}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteCloudDraft(draft.id); }}
                    className="ml-2 p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors"
                    title="Delete draft"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Company Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Company Selection *</h2>
        <div className="flex gap-4">
          {(['EHI', 'EMPL'] as const).map(comp => (
            <label
              key={comp}
              className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                g.company === comp
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              <input
                type="radio"
                name="company"
                value={comp}
                checked={g.company === comp}
                onChange={() => setGlobalBulk({
                  company: comp,
                  documentNo: comp === 'EHI' ? 'EHI/IP/01' : 'EMPL/IP/01'
                })}
                className="sr-only"
                required
              />
              <div className="text-center">
                <p className="font-bold text-lg">{comp}</p>
                <p className="text-sm opacity-75">{COMPANY_NAMES[comp]}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* OPS Lookup */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg shadow-sm border border-emerald-200 p-6">
        <h2 className="text-lg font-semibold text-emerald-800 mb-4 flex items-center gap-2">
          <Search className="w-5 h-5" />
          OPS Lookup
        </h2>

        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative" ref={opsDropdownRef}>
            <div className="relative">
              <input
                type="text"
                value={opsSearchValue}
                onChange={(e) => { setOpsSearchValue(e.target.value); setShowOpsDropdown(true); }}
                onFocus={() => !opsData && setShowOpsDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleOpsLookup(); setShowOpsDropdown(false); }
                  if (e.key === 'Escape') setShowOpsDropdown(false);
                }}
                placeholder={opsListLoading ? "Loading OPS list..." : "Search or select OPS number..."}
                className="w-full px-4 py-3 pr-10 text-lg border-2 border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={!!opsData}
              />
              {!opsData && (
                <button
                  type="button"
                  onClick={() => setShowOpsDropdown(!showOpsDropdown)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown className={`w-5 h-5 transition-transform ${showOpsDropdown ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {showOpsDropdown && !opsData && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {opsListLoading ? (
                  <div className="p-4 text-center text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading OPS list...
                  </div>
                ) : filteredOpsList.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {opsSearchValue ? `No OPS found matching "${opsSearchValue}"` : 'No OPS orders available'}
                  </div>
                ) : (
                  filteredOpsList.slice(0, 50).map((ops) => (
                    <button
                      key={ops.salesNo}
                      type="button"
                      onClick={() => handleOpsSelect(ops.salesNo)}
                      className="w-full px-4 py-3 text-left hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-emerald-700">{ops.salesNo}</p>
                          <p className="text-sm text-gray-600">{ops.buyerCode}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{ops.totalPcs} pcs</p>
                          {ops.poNumber && <p className="text-xs text-gray-500">PO: {ops.poNumber}</p>}
                        </div>
                      </div>
                    </button>
                  ))
                )}
                {filteredOpsList.length > 50 && (
                  <p className="p-3 text-center text-sm text-gray-500 bg-gray-50">Showing first 50 results. Type to filter more.</p>
                )}
              </div>
            )}
          </div>

          {!opsData ? (
            <button
              type="button"
              onClick={handleOpsLookup}
              disabled={opsLoading || !opsSearchValue.trim()}
              className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {opsLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</> : <><Search className="w-5 h-5" /> Load</>}
            </button>
          ) : (
            <button
              type="button"
              onClick={clearOpsData}
              className="px-6 py-3 border-2 border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <X className="w-5 h-5" /> Clear
            </button>
          )}
        </div>

        {opsError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 mb-4">
            <AlertCircle className="w-5 h-5" /> {opsError}
          </div>
        )}

        {/* OPS Data Display */}
        {opsData && (
          <div className="bg-white rounded-lg border border-emerald-200 p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-gray-200">
              <div><p className="text-xs text-gray-500 uppercase tracking-wide">OPS Number</p><p className="font-semibold text-emerald-700">{opsData.salesNo}</p></div>
              <div><p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p><p className="font-semibold">{opsData.buyerCode}</p></div>
              <div><p className="text-xs text-gray-500 uppercase tracking-wide">PO Number</p><p className="font-semibold">{opsData.poNumber || '-'}</p></div>
              <div><p className="text-xs text-gray-500 uppercase tracking-wide">Total Qty</p><p className="font-semibold">{opsData.totalPcs} pcs</p></div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" /> Articles in this OPS ({opsData.items.length} items)
              </h3>
              {opsData.items.length === 0 ? (
                <p className="text-gray-500 italic">No items found in this OPS</p>
              ) : (
                <div className="space-y-2">
                  {state.selectedArticles.map((article) => (
                    <div
                      key={article.id}
                      className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                        article.selected ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={article.selected}
                        onChange={() => toggleArticleSelection(article.id)}
                        className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{article.articleName}</p>
                        <p className="text-sm text-gray-500">
                          {[article.size, article.color, article.quality].filter(Boolean).join(' \u2022 ') || 'No details'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{article.pcs} pcs</p>
                        {article.sqm > 0 && <p className="text-xs text-gray-500">{article.sqm.toFixed(2)} sqm</p>}
                      </div>
                      {article.selected && (
                        <div className="w-24">
                          <label className="text-xs text-gray-500">Inspect Qty</label>
                          <input
                            type="number"
                            min="1"
                            max={article.pcs}
                            value={article.inspectedQty || article.pcs}
                            onChange={(e) => updateArticleInspectedQty(article.id, parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {state.selectedArticles.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{state.selectedArticles.filter(a => a.selected).length}</span> of {state.selectedArticles.length} articles selected
                  </p>
                  <p className="text-sm font-medium text-emerald-700">
                    Total to inspect: {state.selectedArticles.filter(a => a.selected).reduce((sum, a) => sum + (a.inspectedQty || a.pcs), 0)} pcs
                  </p>
                </div>
              )}
            </div>

            {/* Additional Details (with OPS) */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>EMPL Design No. *</label>
                  <input
                    type="text"
                    required
                    value={g.emplDesignNo}
                    onChange={(e) => setGlobal('emplDesignNo', e.target.value)}
                    placeholder="Auto-filled from article selection"
                    className={`${inputClass} ${g.emplDesignNo ? 'bg-emerald-50 border-emerald-300' : ''}`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from selected article (editable)</p>
                </div>
                <div>
                  <label className={labelClass}>Color Name *</label>
                  <input type="text" required value={g.colorName} onChange={(e) => setGlobal('colorName', e.target.value)} placeholder="Enter color name" className={inputClass} />
                </div>
                <DropdownWithAdd
                  label="Merchant"
                  value={g.merchant}
                  onChange={(value) => setGlobal('merchant', value)}
                  options={MERCHANTS}
                  customOptions={customMerchants}
                  onAddCustom={addCustomMerchant}
                  required
                  placeholder="Select Merchant"
                />
              </div>
            </div>
          </div>
        )}

        {!opsData && !opsError && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 italic">Enter an OPS number to auto-fill customer details and view articles</p>
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Details (Manual Entry)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>EMPL Design No. *</label>
                  <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 bg-white">
                    <select
                      required
                      value={g.emplDesignNo}
                      onChange={(e) => setGlobal('emplDesignNo', e.target.value)}
                      className="flex-1 px-3 py-2.5 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent"
                      disabled={designNamesLoading}
                    >
                      <option value="">{designNamesLoading ? 'Loading...' : 'Select Design...'}</option>
                      {designNames.map((design) => (
                        <option key={design.id} value={design.designName}>{design.designName}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const newDesign = prompt('Enter new EMPL Design Name:');
                        if (newDesign && newDesign.trim()) {
                          addDesignName(newDesign.trim())
                            .then(() => { getDesignNames().then(setDesignNames); setGlobal('emplDesignNo', newDesign.trim()); })
                            .catch((error) => { console.error('Error adding design:', error); alert('Failed to add design name'); });
                        }
                      }}
                      className="px-3 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Color Name *</label>
                  <input type="text" required value={g.colorName} onChange={(e) => setGlobal('colorName', e.target.value)} placeholder="Enter color name" className={inputClass} />
                </div>
                <DropdownWithAdd
                  label="Merchant"
                  value={g.merchant}
                  onChange={(value) => setGlobal('merchant', value)}
                  options={MERCHANTS}
                  customOptions={customMerchants}
                  onAddCustom={addCustomMerchant}
                  required
                  placeholder="Select Merchant"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inspection Details */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Inspection Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Inspection Date *</label>
            <input type="date" required value={g.inspectionDate} onChange={(e) => setGlobal('inspectionDate', e.target.value)} className={inputClass} />
          </div>
          <DropdownWithAdd
            label="QC Inspector"
            value={g.qcInspectorName}
            onChange={(value) => setGlobal('qcInspectorName', value)}
            options={QC_INSPECTORS}
            customOptions={customQcInspectors}
            onAddCustom={addCustomQcInspector}
            required
            placeholder="Select Inspector"
          />
        </div>
      </div>

      {/* Order Info */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          Order Information
          {opsData && (
            <span className="text-xs font-normal bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Auto-filled from OPS</span>
          )}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opsData ? (
            <>
              <div><label className={labelClass}>Customer Name *</label><input type="text" required value={g.customerName} className={`${inputClass} bg-emerald-50 border-emerald-300`} readOnly /></div>
              <div><label className={labelClass}>Customer Code *</label><input type="text" required value={g.customerCode} className={`${inputClass} bg-emerald-50 border-emerald-300`} readOnly /></div>
              <div><label className={labelClass}>Customer PO No. *</label><input type="text" required value={g.customerPoNo} onChange={(e) => setGlobal('customerPoNo', e.target.value)} placeholder="Edit if needed" className={inputClass} /></div>
            </>
          ) : (
            <>
              <CustomerDropdown
                customerName={g.customerName}
                customers={customers}
                onCustomerChange={handleCustomerChange}
                onAddCustomer={handleAddCustomer}
                required
                loading={customersLoading}
              />
              <div>
                <label className={labelClass}>Customer Code *</label>
                <input
                  type="text"
                  required
                  value={g.customerCode}
                  onChange={(e) => setGlobal('customerCode', e.target.value)}
                  className={inputClass}
                  placeholder={customersLoading ? "Loading..." : "Auto-filled from customer"}
                  readOnly={!!g.customerName && customers.some(c => c.name === g.customerName)}
                />
              </div>
              <div><label className={labelClass}>Customer PO No. *</label><input type="text" required value={g.customerPoNo} onChange={(e) => setGlobal('customerPoNo', e.target.value)} className={inputClass} /></div>
            </>
          )}
        </div>
      </div>

      {/* AQL Sampling & Quantities */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Inspection Quantities</h2>
          <button
            type="button"
            onClick={() => setShowAqlChart(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors"
          >
            <Info size={16} /> AQL Reference Chart
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div><label className={labelClass}>Total Order Qty *</label><input type="number" required min="0" value={g.totalOrderQty} onChange={(e) => setGlobal('totalOrderQty', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Inspected Lot Qty *</label><input type="number" required min="0" value={g.inspectedLotQty} onChange={(e) => setGlobal('inspectedLotQty', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>AQL *</label><input type="text" value="2.5" readOnly className={`${inputClass} bg-emerald-50 border-emerald-300 font-semibold cursor-default`} /></div>
        </div>

        {/* AQL Calculation Panel */}
        {aqlCalculation && (
          <div className={`mt-4 p-4 rounded-lg border-2 ${aqlCalculation.isValid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Calculator size={18} className={aqlCalculation.isValid ? 'text-emerald-600' : 'text-amber-600'} />
              <span className="font-semibold text-gray-800">AQL Calculation (Z1.4-2008 Level II)</span>
              {aqlCalculation.codeLetter !== aqlCalculation.effectiveCodeLetter && aqlCalculation.isValid && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  Arrow applied: {aqlCalculation.codeLetter} → {aqlCalculation.effectiveCodeLetter}
                </span>
              )}
            </div>
            {aqlCalculation.isValid ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-lg shadow-sm"><div className="text-xs text-gray-500 uppercase tracking-wide">Code Letter</div><div className="text-xl font-bold text-emerald-700">{aqlCalculation.codeLetter}</div></div>
                <div className="bg-white p-3 rounded-lg shadow-sm"><div className="text-xs text-gray-500 uppercase tracking-wide">Sample Size</div><div className="text-xl font-bold text-emerald-700">{aqlCalculation.sampleSize}</div></div>
                <div className="bg-white p-3 rounded-lg shadow-sm"><div className="text-xs text-gray-500 uppercase tracking-wide">Accept &le;</div><div className="text-xl font-bold text-green-600">{aqlCalculation.acceptNumber}</div></div>
                <div className="bg-white p-3 rounded-lg shadow-sm"><div className="text-xs text-gray-500 uppercase tracking-wide">Reject &ge;</div><div className="text-xl font-bold text-red-600">{aqlCalculation.rejectNumber}</div></div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700"><AlertCircle size={16} /><span>{aqlCalculation.error || 'Unable to calculate AQL values'}</span></div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className={labelClass}>
              Sample Size *
              {aqlCalculation?.isValid && <span className="ml-2 text-xs text-emerald-600 font-normal">(auto-filled)</span>}
            </label>
            <input
              type="number"
              required
              min="0"
              value={g.sampleSize}
              onChange={(e) => setGlobal('sampleSize', e.target.value)}
              className={`${inputClass} ${aqlCalculation?.isValid && g.sampleSize === String(aqlCalculation.sampleSize) ? 'bg-emerald-50 border-emerald-300' : ''}`}
            />
          </div>
          <div><label className={labelClass}>Accepted Qty *</label><input type="number" required min="0" value={g.acceptedQty} onChange={(e) => setGlobal('acceptedQty', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Rejected Qty *</label><input type="number" required min="0" value={g.rejectedQty} onChange={(e) => setGlobal('rejectedQty', e.target.value)} className={inputClass} /></div>
        </div>

        {/* Auto PASS/FAIL */}
        {aqlCalculation?.isValid && g.rejectedQty && (
          <div className={`mt-4 p-4 rounded-lg border-2 ${g.inspectionResult === 'PASS' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                {g.inspectionResult === 'PASS' ? <CheckCircle2 size={20} className="text-green-600" /> : <XCircle size={20} className="text-red-600" />}
                <span className="font-semibold">
                  {isAutoResult && !resultOverridden ? 'Auto-determined: ' : ''}
                  <span className={g.inspectionResult === 'PASS' ? 'text-green-700' : 'text-red-700'}>{g.inspectionResult}</span>
                </span>
                <span className="text-sm text-gray-600">({wouldPass(parseInt(g.rejectedQty, 10), aqlCalculation.acceptNumber, aqlCalculation.rejectNumber).explanation})</span>
              </div>
              {resultOverridden && (
                <div className="flex items-center gap-1 text-amber-600 text-sm"><Info size={14} /><span>Inspector override</span></div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Override:</span>
                <button type="button" onClick={() => handleResultChange('PASS')} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${g.inspectionResult === 'PASS' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-100'}`}>PASS</button>
                <button type="button" onClick={() => handleResultChange('FAIL')} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${g.inspectionResult === 'FAIL' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100'}`}>FAIL</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Per-Size Inspections ═══ */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Size Inspections
        </h2>
        <SizeInspectionList
          sizeInspections={state.sizeInspections}
          activeSizeIndex={state.activeSizeIndex}
          dispatch={dispatch}
        />
      </div>

      {/* Final Result */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Final Result</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Inspection Result *</label>
            <div className="flex gap-4">
              {(['PASS', 'FAIL'] as const).map(result => (
                <label
                  key={result}
                  className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    g.inspectionResult === result
                      ? (result === 'PASS' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="inspectionResult"
                    value={result}
                    checked={g.inspectionResult === result}
                    onChange={() => setGlobal('inspectionResult', result)}
                    className="hidden"
                  />
                  {result === 'PASS'
                    ? <CheckCircle2 className={`w-6 h-6 ${g.inspectionResult === 'PASS' ? 'text-green-600' : 'text-gray-400'}`} />
                    : <XCircle className={`w-6 h-6 ${g.inspectionResult === 'FAIL' ? 'text-red-600' : 'text-gray-400'}`} />}
                  <span className={`font-semibold ${g.inspectionResult === result ? (result === 'PASS' ? 'text-green-700' : 'text-red-700') : 'text-gray-500'}`}>
                    {result}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Draft Status & Submit */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            {lastSavedAt && (
              <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Draft saved: {lastSavedAt}</span>
            )}
            {draftSaved && <span className="text-emerald-600 font-medium ml-2">Saved!</span>}
          </div>
          <div className={`flex items-center gap-2 text-sm font-medium ${photoCount === 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            <Camera className="w-4 h-4" />
            {photoCount === 0 ? 'No photos attached' : `${photoCount} photo${photoCount !== 1 ? 's' : ''} attached`}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={saveDraft}
              disabled={draftSaving}
              className="flex-1 sm:flex-none px-6 py-3 border-2 border-emerald-600 text-emerald-600 font-semibold rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {draftSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : <><Save className="w-5 h-5" /> Save Draft</>}
            </button>
            <button
              type="submit"
              disabled={state.loading}
              className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {state.loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {state.uploadProgress || 'Submitting...'}</> : <><CheckCircle2 className="w-5 h-5" /> Submit Report</>}
            </button>
          </div>
        </div>
      </div>

      {/* AQL Reference Chart Modal */}
      {showAqlChart && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAqlChart(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl z-10">
              <h3 className="text-lg font-semibold text-gray-900">AQL Z1.4-2008 Reference Chart</h3>
              <button type="button" onClick={() => setShowAqlChart(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <h4 className="text-center text-xl font-bold text-teal-700 mb-1">AQL Z1.4-2008</h4>
              <p className="text-center text-sm text-gray-600 mb-4">Level II Normal Inspection</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-sm font-semibold text-teal-600 mb-2 text-center">LOT SIZE → CODE</h5>
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="bg-teal-50"><th className="border border-teal-200 px-2 py-1 text-left">Lot Size</th><th className="border border-teal-200 px-2 py-1 text-center">Code</th></tr></thead>
                    <tbody>
                      {LOT_SIZE_CODE_LETTERS.map((range, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-200 px-2 py-1">{range.max === Infinity ? `${range.min.toLocaleString()}+` : `${range.min.toLocaleString()}-${range.max.toLocaleString()}`} →</td>
                          <td className="border border-gray-200 px-2 py-1 text-center font-semibold text-teal-700">{range.codeLetter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-teal-600 mb-2 text-center">ACCEPT / REJECT BY AQL</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-teal-50">
                          <th className="border border-teal-200 px-1 py-1 text-center">Code</th>
                          <th className="border border-teal-200 px-1 py-1 text-center">Sample</th>
                          {['0.65', '1.0', '1.5', '2.5', '4.0', '6.5'].map(aql => (
                            <th key={aql} className="border border-teal-200 px-1 py-1 text-center" colSpan={2}>{aql}</th>
                          ))}
                        </tr>
                        <tr className="bg-teal-50 text-xs">
                          <th className="border border-teal-200 px-0.5 py-0.5"></th>
                          <th className="border border-teal-200 px-0.5 py-0.5"></th>
                          {['0.65', '1.0', '1.5', '2.5', '4.0', '6.5'].map(aql => (
                            <React.Fragment key={aql}>
                              <th className="border border-teal-200 px-0.5 py-0.5 text-green-600">Ac</th>
                              <th className="border border-teal-200 px-0.5 py-0.5 text-red-600">Re</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q'].map((code, idx) => {
                          const aqlValues = AQL_ACCEPT_REJECT_TABLE[code];
                          const renderCell = (value: AcceptRejectValue | undefined) => {
                            if (!value || value === 'down') return <span className="text-gray-400">↓</span>;
                            if (value === 'up') return <span className="text-gray-400">↑</span>;
                            return value.accept;
                          };
                          const renderRejectCell = (value: AcceptRejectValue | undefined) => {
                            if (!value || value === 'down') return <span className="text-gray-400">↓</span>;
                            if (value === 'up') return <span className="text-gray-400">↑</span>;
                            return value.reject;
                          };
                          return (
                            <tr key={code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="border border-gray-200 px-1 py-0.5 text-center font-semibold text-teal-700">{code}</td>
                              <td className="border border-gray-200 px-1 py-0.5 text-center">{SAMPLE_SIZES[code]}</td>
                              {['0.65', '1.0', '1.5', '2.5', '4.0', '6.5'].map(aql => (
                                <React.Fragment key={aql}>
                                  <td className="border border-gray-200 px-0.5 py-0.5 text-center text-green-600">{renderCell(aqlValues?.[aql])}</td>
                                  <td className="border border-gray-200 px-0.5 py-0.5 text-center text-red-600">{renderRejectCell(aqlValues?.[aql])}</td>
                                </React.Fragment>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs text-gray-500 text-center space-y-1">
                <p><span className="text-green-600 font-medium">Ac</span> = Accept if defects &le; | <span className="text-red-600 font-medium">Re</span> = Reject if defects &ge; | <span className="text-gray-400">↓</span> = Use next larger sample</p>
                <p className="font-medium">Level II Normal Inspection - ANSI/ASQ Z1.4-2008 Standard</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

// ─── Exported wrapper with provider ───

export default function FinalInspectionForm() {
  return (
    <InspectionFormProvider>
      <FinalInspectionFormInner />
    </InspectionFormProvider>
  );
}

// Also export as named export for backward compatibility
export { FinalInspectionForm };
