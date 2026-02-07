import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, getCustomers, addCustomer, getDesignNames, addDesignName, DesignName, getOpsByNumber, getOpsList, OpsOrder, OpsOrderItem, getBuyerMerchantEmails } from '../lib/firebase';
import { emailSettingsService } from '../lib/emailSettingsService';
import { generateFinalInspectionPDF } from '../lib/pdfGenerator';
import { calculateAql, wouldPass, AqlCalculationResult, LOT_SIZE_CODE_LETTERS, SAMPLE_SIZES, AQL_ACCEPT_REJECT_TABLE, AcceptRejectValue } from '../lib/aqlCalculator';
import {
  savePhotoDraft,
  loadPhotoDraft,
  clearPhotoDraft,
  createVisibilityHandler,
  createBeforeUnloadHandler,
  createPageHideHandler,
  debounce,
  PhotoDraftData,
  DRAFT_STORAGE_KEY
} from '../lib/draftPersistence';
import {
  FinalInspection,
  QC_INSPECTORS,
  MERCHANTS,
  AQL_LEVELS,
  PHOTO_TYPES,
  CONSTRUCTION_PHOTO_TYPES,
  OkNotOk,
  Defect,
  NotOkPhoto,
  SizeUnit,
  CUSTOM_OPTIONS_KEYS,
  OK_NOT_OK_FIELDS,
  Customer,
  STANDARD_SIZES_CM,
  STANDARD_SIZES_FEET,
  LabeledPhoto,
  CONSUMER_PIECE_LABELS,
  UNIT_LOAD_LABELS,
  SelectedArticle,
  COMPANY_NAMES
} from '../types';
import { Loader2, Upload, X, Camera, CheckCircle2, XCircle, Plus, Save, Search, Package, AlertCircle, ChevronDown, Calculator, Info } from 'lucide-react';

// Draft interface
interface DraftData {
  formData: FormDataState;
  defects: Defect[];
  selectedSizes: string[];
  sizeUnit: SizeUnit;
  savedAt: string;
}

// Helper to get custom options from localStorage
const getCustomOptions = (key: string): string[] => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Helper to save custom options to localStorage
const saveCustomOptions = (key: string, options: string[]) => {
  localStorage.setItem(key, JSON.stringify(options));
};

// Dropdown with Add button component
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

// Customer Dropdown with Firestore sync - shows "Name (Code)" format
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
    // Find the customer by name
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

// NOT OK photo component
interface NotOkPhotoProps {
  fieldKey: string;
  fieldLabel: string;
  isNotOk: boolean;
  photo: File | null;
  preview: string;
  onPhotoChange: (file: File | null) => void;
}

function NotOkPhotoUpload({ fieldLabel, isNotOk, preview, onPhotoChange }: NotOkPhotoProps) {
  if (!isNotOk) return null;

  return (
    <div className="mt-2">
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt={`${fieldLabel} NOT OK`} className="w-20 h-20 object-cover rounded-lg border-2 border-red-300" />
          <button
            type="button"
            onClick={() => onPhotoChange(null)}
            className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg cursor-pointer hover:bg-red-50">
          <Camera size={16} />
          <span>Take/Upload Photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPhotoChange(e.target.files?.[0] || null)}
          />
        </label>
      )}
    </div>
  );
}

type PhotoKey = keyof Pick<FinalInspection,
  'approvedSamplePhoto' | 'redSealFrontPhoto' | 'redSealBackPhoto' |
  'redSealCloseUpPhoto' | 'redSealProductFront' | 'redSealProductBack' |
  'labelPhoto' | 'moisturePhoto' | 'sizeFrontPhoto' | 'sizeSidePhoto' |
  'inspectedSamplesPhoto' | 'metalCheckingPhoto'
>;

type ConstructionPhotoKey = 'warpPer10cm' | 'weftPer10cm' | 'pileHeightPhoto' | 'productNetWeightPhoto' | 'productGrossWeightPhoto';

// Form state type with proper union types
interface FormDataState {
  company: 'EHI' | 'EMPL';
  documentNo: string;
  inspectionDate: string;
  qcInspectorName: string;
  customerName: string;
  customerCode: string;
  customerPoNo: string;
  opsNo: string;
  buyerDesignName: string;
  emplDesignNo: string;
  colorName: string;
  productSizes: string;
  merchant: string;
  totalOrderQty: string;
  inspectedLotQty: string;
  aql: string;
  sampleSize: string;
  acceptedQty: string;
  rejectedQty: string;
  approvedSampleAvailable: 'Yes' | 'No';
  materialFibreContent: string;
  motifDesignCheck: OkNotOk;
  tuftDensity: string;
  backing: OkNotOk;
  backingNotes: string;
  bindingAndEdges: OkNotOk;
  handFeel: OkNotOk;
  pileHeight: string;
  embossingCarving: OkNotOk;
  workmanship: OkNotOk;
  productQualityWeight: OkNotOk;
  productWeight: string;
  sizeTolerance: string;
  finishingPercent: string;
  packedPercent: string;
  labelPlacement: OkNotOk;
  sideMarking: OkNotOk;
  outerMarking: OkNotOk;
  innerPack: OkNotOk;
  careLabels: OkNotOk;
  skuStickers: OkNotOk;
  upcBarcodes: OkNotOk;
  cartonPly: string;
  cartonDropTest: OkNotOk;
  packingType: 'Assorted' | 'Solid';
  grossWeight: string;
  netWeight: string;
  cartonBaleNumbering: OkNotOk;
  pcsPerCartonBale: string;
  pcsPerPolybag: string;
  cartonMeasurementL: string;
  cartonMeasurementW: string;
  cartonMeasurementH: string;
  cartonDimension: OkNotOk;
  productLabel: OkNotOk;
  cartonLabel: OkNotOk;
  barcodeScan: OkNotOk;
  dpciSkuStyleNumber: string;
  styleDescription: string;
  qcInspectorRemarks: string;
  inspectionResult: 'PASS' | 'FAIL';
}

const initialFormData: FormDataState = {
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
};

export function FinalInspectionForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormDataState>(initialFormData);

  const [defects, setDefects] = useState<Defect[]>([]);

  // Custom options from localStorage
  const [customQcInspectors, setCustomQcInspectors] = useState<string[]>([]);
  const [customMerchants, setCustomMerchants] = useState<string[]>([]);
  const [customBuyerDesigns, setCustomBuyerDesigns] = useState<string[]>([]);
  const [customSizesCm, setCustomSizesCm] = useState<string[]>([]);
  const [customSizesFeet, setCustomSizesFeet] = useState<string[]>([]);
  const [customAqlLevels, setCustomAqlLevels] = useState<string[]>([]);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('cm');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  // Firestore customers (synced with TED forms)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);

  // Design names from shared collection
  const [designNames, setDesignNames] = useState<DesignName[]>([]);
  const [designNamesLoading, setDesignNamesLoading] = useState(true);

  // OPS Lookup state
  const [opsSearchValue, setOpsSearchValue] = useState('');
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsData, setOpsData] = useState<OpsOrder | null>(null);
  const [opsError, setOpsError] = useState<string>('');
  const [selectedArticles, setSelectedArticles] = useState<SelectedArticle[]>([]);

  // OPS dropdown list
  const [opsList, setOpsList] = useState<Array<{ salesNo: string; buyerName: string; buyerCode: string; poNumber: string; totalPcs: number; status: string }>>([]);
  const [opsListLoading, setOpsListLoading] = useState(true);
  const [showOpsDropdown, setShowOpsDropdown] = useState(false);
  const opsDropdownRef = useRef<HTMLDivElement>(null);

  // AQL Z1.4-2008 Calculation State
  const [aqlCalculation, setAqlCalculation] = useState<AqlCalculationResult | null>(null);
  const [isAutoResult, setIsAutoResult] = useState(false);
  const [resultOverridden, setResultOverridden] = useState(false);
  const [showAqlChart, setShowAqlChart] = useState(false);

  // Photo state declarations - must be before saveDraft useCallback that references them
  const [notOkPhotos, setNotOkPhotos] = useState<Record<string, File | null>>({});
  const [notOkPreviews, setNotOkPreviews] = useState<Record<string, string>>({});

  const [photos, setPhotos] = useState<Record<PhotoKey, File | null>>({
    approvedSamplePhoto: null,
    redSealFrontPhoto: null,
    redSealBackPhoto: null,
    redSealCloseUpPhoto: null,
    redSealProductFront: null,
    redSealProductBack: null,
    labelPhoto: null,
    moisturePhoto: null,
    sizeFrontPhoto: null,
    sizeSidePhoto: null,
    inspectedSamplesPhoto: null,
    metalCheckingPhoto: null,
  });

  const [photoPreviews, setPhotoPreviews] = useState<Record<PhotoKey, string>>({
    approvedSamplePhoto: '',
    redSealFrontPhoto: '',
    redSealBackPhoto: '',
    redSealCloseUpPhoto: '',
    redSealProductFront: '',
    redSealProductBack: '',
    labelPhoto: '',
    moisturePhoto: '',
    sizeFrontPhoto: '',
    sizeSidePhoto: '',
    inspectedSamplesPhoto: '',
    metalCheckingPhoto: '',
  });

  const [constructionPhotos, setConstructionPhotos] = useState<Record<ConstructionPhotoKey, File | null>>({
    warpPer10cm: null,
    weftPer10cm: null,
    pileHeightPhoto: null,
    productNetWeightPhoto: null,
    productGrossWeightPhoto: null,
  });

  const [constructionPreviews, setConstructionPreviews] = useState<Record<ConstructionPhotoKey, string>>({
    warpPer10cm: '',
    weftPer10cm: '',
    pileHeightPhoto: '',
    productNetWeightPhoto: '',
    productGrossWeightPhoto: '',
  });

  const [stackedGoodsPhoto, setStackedGoodsPhoto] = useState<File | null>(null);
  const [stackedGoodsPreview, setStackedGoodsPreview] = useState<string>('');
  const [consumerPieces, setConsumerPieces] = useState<LabeledPhoto[]>([]);
  const [customConsumerLabels, setCustomConsumerLabels] = useState<string[]>([]);
  const [unitLoadEnabled, setUnitLoadEnabled] = useState<boolean>(false);
  const [unitLoadPhotos, setUnitLoadPhotos] = useState<LabeledPhoto[]>([]);
  const [customUnitLoadLabels, setCustomUnitLoadLabels] = useState<string[]>([]);

  const [otherPhotos, setOtherPhotos] = useState<File[]>([]);
  const [otherPreviews, setOtherPreviews] = useState<string[]>([]);

  // Load customers from Firestore on mount
  useEffect(() => {
    async function loadCustomers() {
      try {
        const firestoreCustomers = await getCustomers();
        setCustomers(firestoreCustomers);
      } catch (error) {
        console.error('Error loading customers:', error);
      } finally {
        setCustomersLoading(false);
      }
    }
    loadCustomers();
  }, []);

  // Load design names from shared collection on mount
  useEffect(() => {
    async function loadDesignNames() {
      try {
        const designs = await getDesignNames();
        setDesignNames(designs);
      } catch (error) {
        console.error('Error loading design names:', error);
      } finally {
        setDesignNamesLoading(false);
      }
    }
    loadDesignNames();
  }, []);

  // Load OPS list for dropdown
  useEffect(() => {
    async function loadOpsList() {
      try {
        const list = await getOpsList();
        setOpsList(list);
      } catch (error) {
        console.error('Error loading OPS list:', error);
      } finally {
        setOpsListLoading(false);
      }
    }
    loadOpsList();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (opsDropdownRef.current && !opsDropdownRef.current.contains(event.target as Node)) {
        setShowOpsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save draft function - saves form data to localStorage and photos to IndexedDB
  const saveDraftRef = useRef<() => void>();

  const saveDraft = useCallback(() => {
    try {
      setDraftSaving(true);
      const now = new Date().toLocaleString();

      // Save form data to localStorage
      const draft: DraftData = {
        formData,
        defects,
        selectedSizes,
        sizeUnit,
        savedAt: now
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));

      // Save photo previews to IndexedDB (async, don't wait)
      const photoDraft: PhotoDraftData = {
        photoPreviews,
        constructionPreviews,
        notOkPreviews,
        stackedGoodsPreview,
        consumerPiecePreviews: consumerPieces.map(p => ({
          label: p.label,
          preview: p.preview || '' // Use the base64 preview already stored
        })),
        unitLoadPreviews: unitLoadPhotos.map(p => ({
          label: p.label,
          preview: p.preview || '' // Use the base64 preview already stored
        })),
        otherPreviews,
        unitLoadEnabled,
        savedAt: now
      };
      savePhotoDraft(photoDraft).catch(console.error);

      setLastSavedAt(now);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
      console.log('Draft saved at', now);
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setDraftSaving(false);
    }
  }, [formData, defects, selectedSizes, sizeUnit, photoPreviews, constructionPreviews, notOkPreviews, stackedGoodsPreview, consumerPieces, unitLoadPhotos, otherPreviews, unitLoadEnabled]);

  // Keep ref updated for event handlers that capture stale closures
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  }, [saveDraft]);

  // Load draft from localStorage and IndexedDB on mount
  useEffect(() => {
    const loadDrafts = async () => {
      try {
        // Load form data from localStorage
        const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedDraft) {
          const draft: DraftData = JSON.parse(savedDraft);
          setFormData(draft.formData);
          setDefects(draft.defects);
          setSelectedSizes(draft.selectedSizes);
          setSizeUnit(draft.sizeUnit);
          setLastSavedAt(draft.savedAt);
          setDraftRestored(true);
          setTimeout(() => setDraftRestored(false), 5000);
          console.log('Form draft restored from', draft.savedAt);
        }

        // Load photo previews from IndexedDB
        const photoDraft = await loadPhotoDraft();
        if (photoDraft) {
          setPhotoPreviews(photoDraft.photoPreviews);
          setConstructionPreviews(photoDraft.constructionPreviews);
          setNotOkPreviews(photoDraft.notOkPreviews);
          setStackedGoodsPreview(photoDraft.stackedGoodsPreview);
          setOtherPreviews(photoDraft.otherPreviews);
          setUnitLoadEnabled(photoDraft.unitLoadEnabled);

          // Restore consumer pieces with previews (files will need to be re-uploaded)
          if (photoDraft.consumerPiecePreviews?.length > 0) {
            setConsumerPieces(photoDraft.consumerPiecePreviews.map(p => ({
              label: p.label,
              preview: p.preview,
              file: undefined // File objects can't be persisted, but previews are preserved
            })));
          }

          // Restore unit load photos with previews
          if (photoDraft.unitLoadPreviews?.length > 0) {
            setUnitLoadPhotos(photoDraft.unitLoadPreviews.map(p => ({
              label: p.label,
              preview: p.preview,
              file: undefined
            })));
          }

          console.log('Photo previews restored from IndexedDB');
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    };

    loadDrafts();
  }, []);

  // Clear draft function
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      clearPhotoDraft().catch(console.error);
      setLastSavedAt(null);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, []);

  // Debounced auto-save - triggers 3 seconds after changes stop
  const debouncedSave = useCallback(
    debounce(() => {
      if (saveDraftRef.current) {
        saveDraftRef.current();
      }
    }, 3000),
    []
  );

  // Trigger debounced save on form data changes
  useEffect(() => {
    // Only auto-save if there's meaningful data
    if (formData.customerName || formData.opsNo || formData.buyerDesignName) {
      debouncedSave();
    }
  }, [formData, defects, selectedSizes, sizeUnit, debouncedSave]);

  // Also trigger debounced save on photo changes
  useEffect(() => {
    const hasPhotos = Object.values(photoPreviews).some(p => p) ||
      Object.values(constructionPreviews).some(p => p) ||
      stackedGoodsPreview ||
      consumerPieces.length > 0 ||
      otherPreviews.length > 0;

    if (hasPhotos) {
      debouncedSave();
    }
  }, [photoPreviews, constructionPreviews, stackedGoodsPreview, consumerPieces, otherPreviews, debouncedSave]);

  // Backup: Interval-based auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.customerName || formData.opsNo || formData.buyerDesignName) {
        if (saveDraftRef.current) {
          saveDraftRef.current();
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [formData.customerName, formData.opsNo, formData.buyerDesignName]);

  // Save draft immediately when page loses visibility (phone call, app switch)
  useEffect(() => {
    const cleanupVisibility = createVisibilityHandler(() => {
      if (saveDraftRef.current) {
        saveDraftRef.current();
      }
    });

    const cleanupPageHide = createPageHideHandler(() => {
      if (saveDraftRef.current) {
        saveDraftRef.current();
      }
    });

    const cleanupBeforeUnload = createBeforeUnloadHandler(() => {
      if (saveDraftRef.current) {
        saveDraftRef.current();
      }
    });

    return () => {
      cleanupVisibility();
      cleanupPageHide();
      cleanupBeforeUnload();
    };
  }, []);

  // Load custom options from localStorage on mount
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

  // Update formData.productSizes when selectedSizes changes
  useEffect(() => {
    const sizesString = selectedSizes.join(', ');
    setFormData(prev => ({ ...prev, productSizes: sizesString }));
  }, [selectedSizes]);

  // AQL Z1.4-2008 Auto-Calculation
  useEffect(() => {
    const lotSize = parseInt(formData.inspectedLotQty, 10);
    const aql = formData.aql;

    if (!isNaN(lotSize) && lotSize >= 2 && aql) {
      const result = calculateAql(lotSize, aql, 'II');
      setAqlCalculation(result);

      if (result.isValid) {
        // Auto-fill sample size
        setFormData(prev => ({
          ...prev,
          sampleSize: String(result.sampleSize)
        }));
      }
    } else {
      setAqlCalculation(null);
    }
  }, [formData.inspectedLotQty, formData.aql]);

  // Auto-determine PASS/FAIL based on rejected qty and AQL calculation
  useEffect(() => {
    if (!aqlCalculation?.isValid || resultOverridden) return;

    const rejectedQty = parseInt(formData.rejectedQty, 10);
    if (isNaN(rejectedQty)) return;

    const passFailResult = wouldPass(rejectedQty, aqlCalculation.acceptNumber, aqlCalculation.rejectNumber);

    if (passFailResult.result !== formData.inspectionResult) {
      setFormData(prev => ({
        ...prev,
        inspectionResult: passFailResult.result
      }));
      setIsAutoResult(true);
    }
  }, [formData.rejectedQty, aqlCalculation, resultOverridden]);

  // Reset auto-result flag when user manually changes result
  const handleResultChange = (newResult: 'PASS' | 'FAIL') => {
    const autoResult = aqlCalculation?.isValid && formData.rejectedQty
      ? wouldPass(parseInt(formData.rejectedQty, 10), aqlCalculation.acceptNumber, aqlCalculation.rejectNumber).result
      : null;

    if (autoResult && newResult !== autoResult) {
      setResultOverridden(true);
    } else {
      setResultOverridden(false);
    }
    setFormData(prev => ({ ...prev, inspectionResult: newResult }));
  };

  // Handlers to add and save custom options
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

  const addCustomBuyerDesign = (value: string) => {
    const updated = [...customBuyerDesigns, value];
    setCustomBuyerDesigns(updated);
    saveCustomOptions(CUSTOM_OPTIONS_KEYS.buyerDesigns, updated);
  };

  const addCustomSize = (value: string) => {
    if (sizeUnit === 'cm') {
      const updated = [...customSizesCm, value];
      setCustomSizesCm(updated);
      saveCustomOptions(CUSTOM_OPTIONS_KEYS.customSizesCm, updated);
    } else {
      const updated = [...customSizesFeet, value];
      setCustomSizesFeet(updated);
      saveCustomOptions(CUSTOM_OPTIONS_KEYS.customSizesFeet, updated);
    }
    // Also add to selected sizes
    if (!selectedSizes.includes(value)) {
      setSelectedSizes(prev => [...prev, value]);
    }
  };

  const addCustomAqlLevel = (value: string) => {
    const updated = [...customAqlLevels, value];
    setCustomAqlLevels(updated);
    saveCustomOptions(CUSTOM_OPTIONS_KEYS.aqlLevels, updated);
  };

  // Add custom consumer piece label
  const addCustomConsumerLabel = (value: string) => {
    const updated = [...customConsumerLabels, value];
    setCustomConsumerLabels(updated);
    saveCustomOptions(CUSTOM_OPTIONS_KEYS.consumerPieceLabels, updated);
  };

  // Add custom unit load label
  const addCustomUnitLoadLabel = (value: string) => {
    const updated = [...customUnitLoadLabels, value];
    setCustomUnitLoadLabels(updated);
    saveCustomOptions(CUSTOM_OPTIONS_KEYS.unitLoadLabels, updated);
  };

  // Handle stacked goods photo
  const handleStackedGoodsChange = (file: File | null) => {
    setStackedGoodsPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setStackedGoodsPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setStackedGoodsPreview('');
    }
  };

  // Add consumer piece photo
  const addConsumerPiece = () => {
    setConsumerPieces(prev => [...prev, { label: '', preview: '' }]);
  };

  // Update consumer piece
  const updateConsumerPiece = (index: number, updates: Partial<LabeledPhoto>) => {
    setConsumerPieces(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  // Handle consumer piece photo upload
  const handleConsumerPiecePhoto = (index: number, file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        updateConsumerPiece(index, { file, preview: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    } else {
      updateConsumerPiece(index, { file: undefined, preview: '' });
    }
  };

  // Remove consumer piece
  const removeConsumerPiece = (index: number) => {
    setConsumerPieces(prev => prev.filter((_, i) => i !== index));
  };

  // Add unit load photo
  const addUnitLoadPhoto = () => {
    setUnitLoadPhotos(prev => [...prev, { label: '', preview: '' }]);
  };

  // Update unit load photo
  const updateUnitLoadPhoto = (index: number, updates: Partial<LabeledPhoto>) => {
    setUnitLoadPhotos(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  // Handle unit load photo upload
  const handleUnitLoadPhotoChange = (index: number, file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        updateUnitLoadPhoto(index, { file, preview: e.target?.result as string });
      };
      reader.readAsDataURL(file);
    } else {
      updateUnitLoadPhoto(index, { file: undefined, preview: '' });
    }
  };

  // Remove unit load photo
  const removeUnitLoadPhoto = (index: number) => {
    setUnitLoadPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSize = (size: string) => {
    setSelectedSizes(prev =>
      prev.includes(size)
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const removeSize = (size: string) => {
    setSelectedSizes(prev => prev.filter(s => s !== size));
  };

  // Add customer to Firestore (synced with TED forms)
  const handleAddCustomer = async (customer: Customer) => {
    try {
      await addCustomer(customer);
      // Refresh customers list from Firestore
      const updatedCustomers = await getCustomers();
      setCustomers(updatedCustomers);
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer. Please try again.');
    }
  };

  // Filter OPS list based on search value
  const filteredOpsList = opsList.filter(ops => {
    const search = opsSearchValue.toLowerCase();
    return (
      ops.salesNo.toLowerCase().includes(search) ||
      ops.buyerName.toLowerCase().includes(search) ||
      ops.buyerCode.toLowerCase().includes(search) ||
      ops.poNumber.toLowerCase().includes(search)
    );
  });

  // Handle OPS selection from dropdown
  const handleOpsSelect = async (salesNo: string) => {
    setOpsSearchValue(salesNo);
    setShowOpsDropdown(false);
    // Trigger lookup
    await handleOpsLookupByValue(salesNo);
  };

  // Handle OPS lookup by value
  const handleOpsLookupByValue = async (value: string) => {
    if (!value.trim()) {
      setOpsError('Please enter an OPS number');
      return;
    }

    setOpsLoading(true);
    setOpsError('');
    setOpsData(null);
    setSelectedArticles([]);

    try {
      const order = await getOpsByNumber(value.trim());

      if (!order) {
        setOpsError(`OPS "${value}" not found`);
        return;
      }

      setOpsData(order);

      // Auto-fill form data from OPS
      setFormData(prev => ({
        ...prev,
        opsNo: order.salesNo,
        customerName: order.buyerName,
        customerCode: order.buyerCode,
        customerPoNo: order.poNumber,
        merchant: order.merchantCode,
        totalOrderQty: order.totalPcs.toString(),
      }));

      // Convert items to selectable articles (all selected by default)
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
      setSelectedArticles(articles);

      // Auto-fill EMPL Design No. from first article
      if (articles.length > 0) {
        setFormData(prev => ({
          ...prev,
          emplDesignNo: articles[0].articleName,
        }));
      }

    } catch (error) {
      console.error('Error looking up OPS:', error);
      setOpsError('Error looking up OPS. Please try again.');
    } finally {
      setOpsLoading(false);
    }
  };

  // Handle OPS lookup (button click)
  const handleOpsLookup = async () => {
    await handleOpsLookupByValue(opsSearchValue);
  };

  // Toggle article selection
  const toggleArticleSelection = (articleId: string) => {
    setSelectedArticles(prev => {
      const updated = prev.map(article =>
        article.id === articleId
          ? { ...article, selected: !article.selected }
          : article
      );

      // Auto-fill EMPL Design No. from first selected article
      const firstSelected = updated.find(a => a.selected);
      if (firstSelected) {
        setFormData(f => ({ ...f, emplDesignNo: firstSelected.articleName }));
      }

      return updated;
    });
  };

  // Update inspected quantity for an article
  const updateArticleInspectedQty = (articleId: string, qty: number) => {
    setSelectedArticles(prev => prev.map(article =>
      article.id === articleId
        ? { ...article, inspectedQty: Math.min(qty, article.pcs) }
        : article
    ));
  };

  // Clear OPS data and reset
  const clearOpsData = () => {
    setOpsData(null);
    setOpsSearchValue('');
    setSelectedArticles([]);
    setOpsError('');
    // Clear auto-filled fields
    setFormData(prev => ({
      ...prev,
      opsNo: '',
      customerName: '',
      customerCode: '',
      customerPoNo: '',
      merchant: '',
      emplDesignNo: '',
      totalOrderQty: '',
    }));
  };

  // Handle customer selection - auto-fill customer code
  const handleCustomerChange = (name: string, code: string) => {
    setFormData(prev => ({
      ...prev,
      customerName: name,
      customerCode: code
    }));
  };

  // NOT OK photo handlers
  const handleNotOkPhotoChange = (fieldKey: string, file: File | null) => {
    setNotOkPhotos(prev => ({ ...prev, [fieldKey]: file }));
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setNotOkPreviews(prev => ({ ...prev, [fieldKey]: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setNotOkPreviews(prev => ({ ...prev, [fieldKey]: '' }));
    }
  };

  // Photo handlers
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

  const handleConstructionPhotoChange = (key: ConstructionPhotoKey, file: File | null) => {
    setConstructionPhotos(prev => ({ ...prev, [key]: file }));
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setConstructionPreviews(prev => ({ ...prev, [key]: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setConstructionPreviews(prev => ({ ...prev, [key]: '' }));
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

      // Upload NOT OK photos
      const notOkPhotoUrls: NotOkPhoto[] = [];
      for (const [fieldKey, file] of Object.entries(notOkPhotos)) {
        if (file) {
          const url = await uploadPhoto(
            file,
            `final-inspection-images/${timestamp}_notok_${fieldKey}_${file.name}`
          );
          notOkPhotoUrls.push({ field: fieldKey, photo: url });
        }
      }

      // Upload stacked goods photo
      let stackedGoodsUrl = '';
      if (stackedGoodsPhoto) {
        stackedGoodsUrl = await uploadPhoto(
          stackedGoodsPhoto,
          `final-inspection-images/${timestamp}_stacked_goods_${stackedGoodsPhoto.name}`
        );
      }

      // Upload consumer pieces photos
      const consumerPiecesUrls: Array<{ label: string; url: string }> = [];
      for (let i = 0; i < consumerPieces.length; i++) {
        const piece = consumerPieces[i];
        if (piece.file && piece.label) {
          const url = await uploadPhoto(
            piece.file,
            `final-inspection-images/${timestamp}_consumer_${i}_${piece.file.name}`
          );
          consumerPiecesUrls.push({ label: piece.label, url });
        }
      }

      // Upload unit load photos (if enabled)
      const unitLoadPhotoUrls: Array<{ label: string; url: string }> = [];
      if (unitLoadEnabled) {
        for (let i = 0; i < unitLoadPhotos.length; i++) {
          const photo = unitLoadPhotos[i];
          if (photo.file && photo.label) {
            const url = await uploadPhoto(
              photo.file,
              `final-inspection-images/${timestamp}_unitload_${i}_${photo.file.name}`
            );
            unitLoadPhotoUrls.push({ label: photo.label, url });
          }
        }
      }

      // Upload construction photos
      const constructionPhotoUrls: Record<string, string> = {};
      for (const photoType of CONSTRUCTION_PHOTO_TYPES) {
        const key = photoType.key as ConstructionPhotoKey;
        const file = constructionPhotos[key];
        if (file) {
          const url = await uploadPhoto(
            file,
            `final-inspection-images/${timestamp}_construction_${key}_${file.name}`
          );
          constructionPhotoUrls[key] = url;
        }
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
        opsNumber: formData.opsNo,  // Standardized OPS reference for cross-app queries
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
        approvedSampleAvailable: formData.approvedSampleAvailable,
        materialFibreContent: formData.materialFibreContent,
        motifDesignCheck: formData.motifDesignCheck,
        tuftDensity: formData.tuftDensity,
        backing: formData.backing,
        backingNotes: formData.backingNotes,
        bindingAndEdges: formData.bindingAndEdges,
        handFeel: formData.handFeel,
        pileHeight: formData.pileHeight,
        embossingCarving: formData.embossingCarving,
        workmanship: formData.workmanship,
        productQualityWeight: formData.productQualityWeight,
        productWeight: formData.productWeight,
        sizeTolerance: formData.sizeTolerance,
        finishingPercent: formData.finishingPercent,
        packedPercent: formData.packedPercent,
        // Labeling & Marking
        labelPlacement: formData.labelPlacement,
        sideMarking: formData.sideMarking,
        outerMarking: formData.outerMarking,
        innerPack: formData.innerPack,
        careLabels: formData.careLabels,
        skuStickers: formData.skuStickers,
        upcBarcodes: formData.upcBarcodes,
        // Packaging
        cartonPly: formData.cartonPly,
        cartonDropTest: formData.cartonDropTest,
        packingType: formData.packingType,
        grossWeight: formData.grossWeight,
        netWeight: formData.netWeight,
        cartonBaleNumbering: formData.cartonBaleNumbering,
        pcsPerCartonBale: formData.pcsPerCartonBale,
        pcsPerPolybag: formData.pcsPerPolybag,
        cartonMeasurementL: formData.cartonMeasurementL,
        cartonMeasurementW: formData.cartonMeasurementW,
        cartonMeasurementH: formData.cartonMeasurementH,
        // Original checks (compatibility)
        cartonDimension: formData.cartonDimension,
        productLabel: formData.productLabel,
        cartonLabel: formData.cartonLabel,
        barcodeScan: formData.barcodeScan,
        // Defect Tracking
        dpciSkuStyleNumber: formData.dpciSkuStyleNumber,
        styleDescription: formData.styleDescription,
        defects: defects,
        // Photos
        approvedSamplePhoto: photoUrls.approvedSamplePhoto || '',
        redSealFrontPhoto: photoUrls.redSealFrontPhoto || '',
        redSealBackPhoto: photoUrls.redSealBackPhoto || '',
        redSealCloseUpPhoto: photoUrls.redSealCloseUpPhoto || '',
        redSealProductFront: photoUrls.redSealProductFront || '',
        redSealProductBack: photoUrls.redSealProductBack || '',
        labelPhoto: photoUrls.labelPhoto || '',
        moisturePhoto: photoUrls.moisturePhoto || '',
        sizeFrontPhoto: photoUrls.sizeFrontPhoto || '',
        sizeSidePhoto: photoUrls.sizeSidePhoto || '',
        inspectedSamplesPhoto: photoUrls.inspectedSamplesPhoto || '',
        metalCheckingPhoto: photoUrls.metalCheckingPhoto || '',
        otherPhotos: otherPhotoUrls,
        // New Images section
        stackedGoodsPhoto: stackedGoodsUrl,
        consumerPieces: consumerPiecesUrls,
        unitLoadEnabled: unitLoadEnabled,
        unitLoadPhotos: unitLoadPhotoUrls,
        // Construction photos
        constructionPhotos: {
          warpPer10cm: constructionPhotoUrls.warpPer10cm || '',
          weftPer10cm: constructionPhotoUrls.weftPer10cm || '',
          pileHeightPhoto: constructionPhotoUrls.pileHeightPhoto || '',
          productNetWeightPhoto: constructionPhotoUrls.productNetWeightPhoto || '',
          productGrossWeightPhoto: constructionPhotoUrls.productGrossWeightPhoto || '',
        },
        // Inspected articles from OPS
        inspectedArticles: selectedArticles
          .filter(a => a.selected)
          .map(a => ({
            articleName: a.articleName,
            size: a.size,
            color: a.color,
            quality: a.quality,
            pcs: a.pcs,
            sqm: a.sqm,
            inspectedQty: a.inspectedQty || a.pcs,
          })),
        // NOT OK photos
        notOkPhotos: notOkPhotoUrls,
        // Size unit
        sizeUnit: sizeUnit,
        // AQL Z1.4-2008 Calculation Fields
        inspectionLevel: 'II',
        codeLetter: aqlCalculation?.codeLetter || undefined,
        calculatedSampleSize: aqlCalculation?.sampleSize || undefined,
        acceptNumber: aqlCalculation?.acceptNumber || undefined,
        rejectNumber: aqlCalculation?.rejectNumber || undefined,
        effectiveCodeLetter: aqlCalculation?.effectiveCodeLetter || undefined,
        isAutoResult: isAutoResult,
        resultOverridden: resultOverridden,
        // Results
        qcInspectorRemarks: formData.qcInspectorRemarks,
        inspectionResult: formData.inspectionResult,
        createdAt: new Date().toISOString()
      };

      // Save to Firestore
      await addDoc(collection(db, 'final-inspections'), inspection);

      // Generate PDF and send email (wrapped in try-catch to not fail submission)
      try {
        const recipients = await emailSettingsService.getRecipients();

        // Auto-add merchant emails (primary and assistant) linked with buyer code
        let merchantEmails: { primary?: string; assistant?: string } = {};
        try {
          merchantEmails = await getBuyerMerchantEmails(inspection.customerCode);
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
        const pdfBase64 = await generateFinalInspectionPDF(inspection);

        const allPhotos = [
          { url: inspection.approvedSamplePhoto, label: 'Approved Sample' },
          { url: inspection.redSealFrontPhoto, label: 'Red Seal - Front' },
          { url: inspection.redSealBackPhoto, label: 'Red Seal - Back' },
          { url: inspection.redSealCloseUpPhoto, label: 'Close-up with Red Seal' },
          { url: inspection.redSealProductFront, label: 'Front Photo with Red Seal' },
          { url: inspection.redSealProductBack, label: 'Back Photo with Red Seal' },
          { url: inspection.labelPhoto, label: 'Label' },
          { url: inspection.moisturePhoto, label: 'Moisture' },
          { url: inspection.sizeFrontPhoto, label: 'Size Front' },
          { url: inspection.sizeSidePhoto, label: 'Size Side' },
          { url: inspection.inspectedSamplesPhoto, label: 'Inspected Samples' },
          { url: inspection.metalCheckingPhoto, label: 'Metal Checking' },
          ...(inspection.stackedGoodsPhoto ? [{ url: inspection.stackedGoodsPhoto, label: 'Stacked Goods' }] : []),
          ...(inspection.consumerPieces || []).map(p => ({ url: p.url, label: p.label })),
          ...(inspection.unitLoadPhotos || []).map(p => ({ url: p.url, label: p.label })),
          // Construction photos
          ...(inspection.constructionPhotos?.warpPer10cm ? [{ url: inspection.constructionPhotos.warpPer10cm, label: 'Warp per 10 cms' }] : []),
          ...(inspection.constructionPhotos?.weftPer10cm ? [{ url: inspection.constructionPhotos.weftPer10cm, label: 'Weft per 10 cms' }] : []),
          ...(inspection.constructionPhotos?.pileHeightPhoto ? [{ url: inspection.constructionPhotos.pileHeightPhoto, label: 'Pile Height' }] : []),
          ...(inspection.constructionPhotos?.productNetWeightPhoto ? [{ url: inspection.constructionPhotos.productNetWeightPhoto, label: 'Product Net Weight' }] : []),
          ...(inspection.constructionPhotos?.productGrossWeightPhoto ? [{ url: inspection.constructionPhotos.productGrossWeightPhoto, label: 'Product Gross Weight' }] : []),
          ...inspection.otherPhotos.map((url, i) => ({ url, label: `Other ${i + 1}` }))
        ].filter(p => p.url);

        const resultColor = inspection.inspectionResult === 'PASS' ? '#22c55e' : '#ef4444';
        const resultBg = inspection.inspectionResult === 'PASS' ? '#dcfce7' : '#fee2e2';
        const companyFullName = COMPANY_NAMES[inspection.company] || 'Eastern Mills';

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <div style="background: #059669; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">${companyFullName}</h1>
              <p style="margin: 5px 0 0;">Final Inspection Report</p>
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

              ${inspection.inspectedArticles && inspection.inspectedArticles.length > 0 ? `
              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">Inspected Articles</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 8px; text-align: left; color: #374151;">Article</th>
                    <th style="padding: 8px; text-align: left; color: #374151;">Size</th>
                    <th style="padding: 8px; text-align: left; color: #374151;">Color</th>
                    <th style="padding: 8px; text-align: right; color: #374151;">Total Pcs</th>
                    <th style="padding: 8px; text-align: right; color: #374151;">Inspected</th>
                  </tr>
                </thead>
                <tbody>
                  ${inspection.inspectedArticles.map(article => `
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 8px; color: #374151;">${article.articleName || '-'}</td>
                    <td style="padding: 8px; color: #6b7280;">${article.size || '-'}</td>
                    <td style="padding: 8px; color: #6b7280;">${article.color || '-'}</td>
                    <td style="padding: 8px; text-align: right; color: #6b7280;">${article.pcs || 0}</td>
                    <td style="padding: 8px; text-align: right; color: #00525e; font-weight: bold;">${article.inspectedQty || article.pcs || 0}</td>
                  </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f3f4f6; font-weight: bold;">
                    <td colspan="3" style="padding: 8px; color: #374151;">Total</td>
                    <td style="padding: 8px; text-align: right; color: #374151;">${inspection.inspectedArticles.reduce((sum, a) => sum + (a.pcs || 0), 0)}</td>
                    <td style="padding: 8px; text-align: right; color: #00525e;">${inspection.inspectedArticles.reduce((sum, a) => sum + (a.inspectedQty || a.pcs || 0), 0)}</td>
                  </tr>
                </tfoot>
              </table>
              ` : ''}

              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">Quantities</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #6b7280;">Total Order Qty:</td><td style="padding: 8px 0;">${inspection.totalOrderQty}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Inspected Lot:</td><td style="padding: 8px 0;">${inspection.inspectedLotQty}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">AQL / Sample Size:</td><td style="padding: 8px 0;">${inspection.aql} / ${inspection.sampleSize}</td></tr>
                ${inspection.codeLetter ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">AQL Z1.4-2008:</td>
                  <td style="padding: 8px 0;">
                    Code: <strong>${inspection.effectiveCodeLetter || inspection.codeLetter}</strong> |
                    Accept ≤ <span style="color: #22c55e; font-weight: bold;">${inspection.acceptNumber}</span> |
                    Reject ≥ <span style="color: #ef4444; font-weight: bold;">${inspection.rejectNumber}</span>
                    ${inspection.resultOverridden ? ' <em style="color: #d97706;">(Override)</em>' : ''}
                  </td>
                </tr>
                ` : ''}
                <tr><td style="padding: 8px 0; color: #6b7280;">Accepted:</td><td style="padding: 8px 0; color: #22c55e; font-weight: bold;">${inspection.acceptedQty}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Rejected:</td><td style="padding: 8px 0; color: #ef4444; font-weight: bold;">${inspection.rejectedQty}</td></tr>
              </table>

              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">Quality Checks</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #6b7280;">Carton Dimension:</td><td style="padding: 8px 0;">${inspection.cartonDimension}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Product Label:</td><td style="padding: 8px 0;">${inspection.productLabel}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Carton Label:</td><td style="padding: 8px 0;">${inspection.cartonLabel}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Barcode Scan:</td><td style="padding: 8px 0;">${inspection.barcodeScan}</td></tr>
              </table>

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
              <p>${companyFullName} - Final Inspection Report</p>
            </div>
          </div>
        `;

        try {
          const emailResponse = await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: allRecipients,
              subject: `Final Inspection: ${inspection.customerCode} - ${inspection.buyerDesignName} [${inspection.inspectionResult}]`,
              html: emailHtml,
              pdfBase64,
              pdfFilename: `Final_Inspection_${inspection.opsNo}_${inspection.inspectionDate}.pdf`
            })
          });

          if (!emailResponse.ok) {
            console.warn('Email sending failed:', emailResponse.status);
            // Don't block submission if email fails
          }
        } catch (emailError) {
          console.warn('Email sending error (inspection saved successfully):', emailError);
          // Don't block submission if email fails
        }
        }
      } catch (emailSetupError) {
        console.warn('Email setup error (inspection saved successfully):', emailSetupError);
        // Don't block submission if email setup fails - inspection was already saved
      }

      setSuccess(true);
      // Clear draft after successful submission
      clearDraft();
      // Reset form
      setFormData({
        ...initialFormData,
        inspectionDate: new Date().toISOString().split('T')[0]
      });
      setDefects([]);
      setSelectedSizes([]);
      setNotOkPhotos({});
      setNotOkPreviews({});
      setSizeUnit('cm');
      setPhotos({
        approvedSamplePhoto: null,
        redSealFrontPhoto: null,
        redSealBackPhoto: null,
        redSealCloseUpPhoto: null,
        redSealProductFront: null,
        redSealProductBack: null,
        labelPhoto: null,
        moisturePhoto: null,
        sizeFrontPhoto: null,
        sizeSidePhoto: null,
        inspectedSamplesPhoto: null,
        metalCheckingPhoto: null,
      });
      setPhotoPreviews({
        approvedSamplePhoto: '',
        redSealFrontPhoto: '',
        redSealBackPhoto: '',
        redSealCloseUpPhoto: '',
        redSealProductFront: '',
        redSealProductBack: '',
        labelPhoto: '',
        moisturePhoto: '',
        sizeFrontPhoto: '',
        sizeSidePhoto: '',
        inspectedSamplesPhoto: '',
        metalCheckingPhoto: '',
      });
      // Reset construction photos
      setConstructionPhotos({
        warpPer10cm: null,
        weftPer10cm: null,
        pileHeightPhoto: null,
        productNetWeightPhoto: null,
        productGrossWeightPhoto: null,
      });
      setConstructionPreviews({
        warpPer10cm: '',
        weftPer10cm: '',
        pileHeightPhoto: '',
        productNetWeightPhoto: '',
        productGrossWeightPhoto: '',
      });
      setOtherPhotos([]);
      setOtherPreviews([]);
      // Reset new Images section
      setStackedGoodsPhoto(null);
      setStackedGoodsPreview('');
      setConsumerPieces([]);
      setUnitLoadEnabled(false);
      setUnitLoadPhotos([]);
      // Reset OPS data
      setOpsData(null);
      setOpsSearchValue('');
      setSelectedArticles([]);
      setOpsError('');

    } catch (error) {
      console.error('Error submitting inspection:', error);
      alert('Failed to submit inspection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="text-emerald-600 w-5 h-5" />
          <span className="text-emerald-700">Inspection submitted successfully!</span>
        </div>
      )}

      {draftRestored && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Save className="text-blue-600 w-5 h-5" />
            <span className="text-blue-700">Draft restored from {lastSavedAt}</span>
          </div>
          <button
            type="button"
            onClick={() => setDraftRestored(false)}
            className="text-blue-400 hover:text-blue-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Company Selection - Required */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Company Selection *</h2>
        <div className="flex gap-4">
          <label
            className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
              formData.company === 'EHI'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-600'
            }`}
          >
            <input
              type="radio"
              name="company"
              value="EHI"
              checked={formData.company === 'EHI'}
              onChange={(e) => setFormData({
                ...formData,
                company: e.target.value as 'EHI' | 'EMPL',
                documentNo: e.target.value === 'EHI' ? 'EHI/IP/01' : 'EMPL/IP/01'
              })}
              className="sr-only"
              required
            />
            <div className="text-center">
              <p className="font-bold text-lg">EHI</p>
              <p className="text-sm opacity-75">Eastern Home Industries</p>
            </div>
          </label>
          <label
            className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
              formData.company === 'EMPL'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-600'
            }`}
          >
            <input
              type="radio"
              name="company"
              value="EMPL"
              checked={formData.company === 'EMPL'}
              onChange={(e) => setFormData({
                ...formData,
                company: e.target.value as 'EHI' | 'EMPL',
                documentNo: e.target.value === 'EHI' ? 'EHI/IP/01' : 'EMPL/IP/01'
              })}
              className="sr-only"
            />
            <div className="text-center">
              <p className="font-bold text-lg">EMPL</p>
              <p className="text-sm opacity-75">Eastern Mills Pvt Ltd</p>
            </div>
          </label>
        </div>
      </div>

      {/* OPS Lookup - Primary Entry */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg shadow-sm border border-emerald-200 p-6">
        <h2 className="text-lg font-semibold text-emerald-800 mb-4 flex items-center gap-2">
          <Search className="w-5 h-5" />
          OPS Lookup
        </h2>

        <div className="flex gap-3 mb-4">
          {/* Searchable Dropdown */}
          <div className="flex-1 relative" ref={opsDropdownRef}>
            <div className="relative">
              <input
                type="text"
                value={opsSearchValue}
                onChange={(e) => {
                  setOpsSearchValue(e.target.value);
                  setShowOpsDropdown(true);
                }}
                onFocus={() => !opsData && setShowOpsDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleOpsLookup();
                    setShowOpsDropdown(false);
                  }
                  if (e.key === 'Escape') {
                    setShowOpsDropdown(false);
                  }
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

            {/* Dropdown List */}
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
                  <p className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                    Showing first 50 results. Type to filter more.
                  </p>
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
              {opsLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Load
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={clearOpsData}
              className="px-6 py-3 border-2 border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <X className="w-5 h-5" />
              Clear
            </button>
          )}
        </div>

        {opsError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 mb-4">
            <AlertCircle className="w-5 h-5" />
            {opsError}
          </div>
        )}

        {/* OPS Data Display */}
        {opsData && (
          <div className="bg-white rounded-lg border border-emerald-200 p-4 space-y-4">
            {/* Order Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">OPS Number</p>
                <p className="font-semibold text-emerald-700">{opsData.salesNo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
                <p className="font-semibold">{opsData.buyerCode}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">PO Number</p>
                <p className="font-semibold">{opsData.poNumber || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Qty</p>
                <p className="font-semibold">{opsData.totalPcs} pcs</p>
              </div>
            </div>

            {/* Articles List */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Articles in this OPS ({opsData.items.length} items)
              </h3>

              {opsData.items.length === 0 ? (
                <p className="text-gray-500 italic">No items found in this OPS</p>
              ) : (
                <div className="space-y-2">
                  {selectedArticles.map((article) => (
                    <div
                      key={article.id}
                      className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                        article.selected
                          ? 'bg-emerald-50 border-emerald-300'
                          : 'bg-gray-50 border-gray-200'
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
                          {[article.size, article.color, article.quality].filter(Boolean).join(' • ') || 'No details'}
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

              {/* Selection Summary */}
              {selectedArticles.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{selectedArticles.filter(a => a.selected).length}</span> of {selectedArticles.length} articles selected
                  </p>
                  <p className="text-sm font-medium text-emerald-700">
                    Total to inspect: {selectedArticles.filter(a => a.selected).reduce((sum, a) => sum + (a.inspectedQty || a.pcs), 0)} pcs
                  </p>
                </div>
              )}
            </div>

            {/* EMPL Design, Color, Sizes, Merchant - Auto-filled from OPS */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>EMPL Design No. *</label>
                  <input
                    type="text"
                    required
                    value={formData.emplDesignNo}
                    onChange={(e) => setFormData({ ...formData, emplDesignNo: e.target.value })}
                    placeholder="Auto-filled from article selection"
                    className={`${inputClass} ${formData.emplDesignNo ? 'bg-emerald-50 border-emerald-300' : ''}`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from selected article (editable)</p>
                </div>
                <div>
                  <label className={labelClass}>Color Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.colorName}
                    onChange={(e) => setFormData({ ...formData, colorName: e.target.value })}
                    placeholder="Enter color name"
                    className={inputClass}
                  />
                </div>
                <DropdownWithAdd
                  label="Merchant"
                  value={formData.merchant}
                  onChange={(value) => setFormData({ ...formData, merchant: value })}
                  options={MERCHANTS}
                  customOptions={customMerchants}
                  onAddCustom={addCustomMerchant}
                  required
                  placeholder="Select Merchant"
                />
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelClass}>Product Sizes *</label>
                    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSizeUnit('cm')}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          sizeUnit === 'cm'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        cm
                      </button>
                      <button
                        type="button"
                        onClick={() => setSizeUnit('feet')}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          sizeUnit === 'feet'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        feet
                      </button>
                    </div>
                  </div>

                  {/* Selected sizes */}
                  {selectedSizes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedSizes.map(size => (
                        <span
                          key={size}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium"
                        >
                          {size}
                          <button
                            type="button"
                            onClick={() => removeSize(size)}
                            className="hover:text-emerald-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Standard sizes as clickable tags */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {(sizeUnit === 'cm' ? [...STANDARD_SIZES_CM, ...customSizesCm] : [...STANDARD_SIZES_FEET, ...customSizesFeet]).map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(size)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          selectedSizes.includes(size)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
                        }`}
                      >
                        {size}
                      </button>
                    ))}

                    {/* Add custom size button */}
                    <button
                      type="button"
                      onClick={() => {
                        const newSize = prompt(`Enter custom size (${sizeUnit}):`);
                        if (newSize && newSize.trim()) {
                          addCustomSize(newSize.trim());
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-gray-400 text-gray-600 hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Size
                    </button>
                  </div>

                  {/* Hidden required input for form validation */}
                  <input
                    type="text"
                    required
                    value={formData.productSizes}
                    onChange={() => {}}
                    className="sr-only"
                    tabIndex={-1}
                  />
                  {selectedSizes.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">Click sizes to select, or add a custom size</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!opsData && !opsError && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 italic">
              Enter an OPS number to auto-fill customer details and view articles
            </p>

            {/* Manual entry for EMPL Design, Color, Sizes, Merchant when no OPS */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Details (Manual Entry)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>EMPL Design No. *</label>
                  <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 bg-white">
                    <select
                      required
                      value={formData.emplDesignNo}
                      onChange={(e) => setFormData({ ...formData, emplDesignNo: e.target.value })}
                      className="flex-1 px-3 py-2.5 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent"
                      disabled={designNamesLoading}
                    >
                      <option value="">{designNamesLoading ? 'Loading...' : 'Select Design...'}</option>
                      {designNames.map((design) => (
                        <option key={design.id} value={design.designName}>
                          {design.designName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const newDesign = prompt('Enter new EMPL Design Name:');
                        if (newDesign && newDesign.trim()) {
                          addDesignName(newDesign.trim())
                            .then(() => {
                              getDesignNames().then(setDesignNames);
                              setFormData({ ...formData, emplDesignNo: newDesign.trim() });
                            })
                            .catch((error) => {
                              console.error('Error adding design:', error);
                              alert('Failed to add design name');
                            });
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
                  <input
                    type="text"
                    required
                    value={formData.colorName}
                    onChange={(e) => setFormData({ ...formData, colorName: e.target.value })}
                    placeholder="Enter color name"
                    className={inputClass}
                  />
                </div>
                <DropdownWithAdd
                  label="Merchant"
                  value={formData.merchant}
                  onChange={(value) => setFormData({ ...formData, merchant: value })}
                  options={MERCHANTS}
                  customOptions={customMerchants}
                  onAddCustom={addCustomMerchant}
                  required
                  placeholder="Select Merchant"
                />
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelClass}>Product Sizes *</label>
                    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSizeUnit('cm')}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          sizeUnit === 'cm'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        cm
                      </button>
                      <button
                        type="button"
                        onClick={() => setSizeUnit('feet')}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          sizeUnit === 'feet'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        feet
                      </button>
                    </div>
                  </div>

                  {/* Selected sizes */}
                  {selectedSizes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedSizes.map(size => (
                        <span
                          key={size}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium"
                        >
                          {size}
                          <button
                            type="button"
                            onClick={() => removeSize(size)}
                            className="hover:text-emerald-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Standard sizes as clickable tags */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {(sizeUnit === 'cm' ? [...STANDARD_SIZES_CM, ...customSizesCm] : [...STANDARD_SIZES_FEET, ...customSizesFeet]).map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(size)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          selectedSizes.includes(size)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
                        }`}
                      >
                        {size}
                      </button>
                    ))}

                    {/* Add custom size button */}
                    <button
                      type="button"
                      onClick={() => {
                        const newSize = prompt(`Enter custom size (${sizeUnit}):`);
                        if (newSize && newSize.trim()) {
                          addCustomSize(newSize.trim());
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-gray-400 text-gray-600 hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add Size
                    </button>
                  </div>

                  {/* Hidden required input for form validation */}
                  <input
                    type="text"
                    required
                    value={formData.productSizes}
                    onChange={() => {}}
                    className="sr-only"
                    tabIndex={-1}
                  />
                  {selectedSizes.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">Click sizes to select, or add a custom size</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
          <DropdownWithAdd
            label="QC Inspector"
            value={formData.qcInspectorName}
            onChange={(value) => setFormData({ ...formData, qcInspectorName: value })}
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
            <span className="text-xs font-normal bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
              Auto-filled from OPS
            </span>
          )}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opsData ? (
            // Read-only customer info when loaded from OPS (except PO which is editable)
            <>
              <div>
                <label className={labelClass}>Customer Name *</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  className={`${inputClass} bg-emerald-50 border-emerald-300`}
                  readOnly
                />
              </div>
              <div>
                <label className={labelClass}>Customer Code *</label>
                <input
                  type="text"
                  required
                  value={formData.customerCode}
                  className={`${inputClass} bg-emerald-50 border-emerald-300`}
                  readOnly
                />
              </div>
              <div>
                <label className={labelClass}>Customer PO No. *</label>
                <input
                  type="text"
                  required
                  value={formData.customerPoNo}
                  onChange={(e) => setFormData({ ...formData, customerPoNo: e.target.value })}
                  placeholder="Edit if needed"
                  className={inputClass}
                />
              </div>
            </>
          ) : (
            // Editable customer info when manual entry
            <>
              <CustomerDropdown
                customerName={formData.customerName}
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
                  value={formData.customerCode}
                  onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })}
                  className={inputClass}
                  placeholder={customersLoading ? "Loading..." : "Auto-filled from customer"}
                  readOnly={!!formData.customerName && customers.some(c => c.name === formData.customerName)}
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
            </>
          )}
        </div>
      </div>

      {/* Images Section - NEW */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Images
        </h2>

        {/* Stacked Images of Packed Goods */}
        <div className="mb-6">
          <label className={labelClass}>Stacked Images of Packed Goods</label>
          {stackedGoodsPreview ? (
            <div className="relative inline-block">
              <img
                src={stackedGoodsPreview}
                alt="Stacked Goods"
                className="w-full max-w-xs h-40 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => handleStackedGoodsChange(null)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full max-w-xs h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <Camera className="w-10 h-10 text-gray-400" />
              <span className="text-sm text-gray-500 mt-2">Take Photo</span>
              <span className="text-xs text-gray-400">or Upload</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleStackedGoodsChange(e.target.files?.[0] || null)}
              />
            </label>
          )}
        </div>

        {/* Consumer Pieces */}
        <div className="mb-6">
          <label className={labelClass}>Packed Consumer Pieces</label>
          <div className="flex flex-wrap gap-4">
            {consumerPieces.map((piece, index) => (
              <div key={index} className="w-40 border border-gray-200 rounded-lg p-3">
                {/* Label Dropdown */}
                <div className="mb-2">
                  <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                    <select
                      value={piece.label}
                      onChange={(e) => updateConsumerPiece(index, { label: e.target.value })}
                      className="flex-1 px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-0 focus:outline-none"
                    >
                      <option value="">Select label...</option>
                      {[...CONSUMER_PIECE_LABELS, ...customConsumerLabels].map(label => (
                        <option key={label} value={label}>{label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const newLabel = prompt('Enter new label:');
                        if (newLabel && newLabel.trim()) {
                          addCustomConsumerLabel(newLabel.trim());
                          updateConsumerPiece(index, { label: newLabel.trim() });
                        }
                      }}
                      className="px-2 py-1.5 border-l border-gray-300 text-emerald-600 hover:bg-emerald-50"
                      title="Add custom label"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                {/* Photo Upload */}
                {piece.preview ? (
                  <div className="relative">
                    <img
                      src={piece.preview}
                      alt={piece.label || 'Consumer Piece'}
                      className={`w-full h-28 object-cover rounded-lg ${!piece.file ? 'border-2 border-amber-400' : ''}`}
                    />
                    {/* Show warning if preview exists but file is missing (restored from draft) */}
                    {!piece.file && (
                      <div className="absolute bottom-1 left-1 right-1 bg-amber-100 text-amber-800 text-xs px-1 py-0.5 rounded flex items-center gap-1">
                        <AlertCircle size={10} />
                        <span>Re-select to upload</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleConsumerPiecePhoto(index, null)}
                      className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Camera className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">Take/Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleConsumerPiecePhoto(index, e.target.files?.[0] || null)}
                    />
                  </label>
                )}
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeConsumerPiece(index)}
                  className="mt-2 w-full text-xs text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
            {/* Add More Button */}
            <button
              type="button"
              onClick={addConsumerPiece}
              className="w-40 h-48 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
            >
              <Plus className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-500 mt-2">Add More</span>
            </button>
          </div>
        </div>

        {/* Unit Load Toggle */}
        <div className="border-t border-gray-200 pt-4">
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={unitLoadEnabled}
              onChange={(e) => setUnitLoadEnabled(e.target.checked)}
              className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-gray-700">Unit Load Applicable</span>
          </label>

          {/* Unit Load Photos (only shown when enabled) */}
          {unitLoadEnabled && (
            <div className="ml-8">
              <label className={labelClass}>Unit Load Photos</label>
              <div className="flex flex-wrap gap-4">
                {unitLoadPhotos.map((photo, index) => (
                  <div key={index} className="w-40 border border-gray-200 rounded-lg p-3">
                    {/* Label Dropdown */}
                    <div className="mb-2">
                      <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                        <select
                          value={photo.label}
                          onChange={(e) => updateUnitLoadPhoto(index, { label: e.target.value })}
                          className="flex-1 px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-0 focus:outline-none"
                        >
                          <option value="">Select label...</option>
                          {[...UNIT_LOAD_LABELS, ...customUnitLoadLabels].map(label => (
                            <option key={label} value={label}>{label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const newLabel = prompt('Enter new label:');
                            if (newLabel && newLabel.trim()) {
                              addCustomUnitLoadLabel(newLabel.trim());
                              updateUnitLoadPhoto(index, { label: newLabel.trim() });
                            }
                          }}
                          className="px-2 py-1.5 border-l border-gray-300 text-emerald-600 hover:bg-emerald-50"
                          title="Add custom label"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Photo Upload */}
                    {photo.preview ? (
                      <div className="relative">
                        <img
                          src={photo.preview}
                          alt={photo.label || 'Unit Load'}
                          className={`w-full h-28 object-cover rounded-lg ${!photo.file ? 'border-2 border-amber-400' : ''}`}
                        />
                        {/* Show warning if preview exists but file is missing (restored from draft) */}
                        {!photo.file && (
                          <div className="absolute bottom-1 left-1 right-1 bg-amber-100 text-amber-800 text-xs px-1 py-0.5 rounded flex items-center gap-1">
                            <AlertCircle size={10} />
                            <span>Re-select to upload</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleUnitLoadPhotoChange(index, null)}
                          className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <Camera className="w-6 h-6 text-gray-400" />
                        <span className="text-xs text-gray-500 mt-1">Take/Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => handleUnitLoadPhotoChange(index, e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeUnitLoadPhoto(index)}
                      className="mt-2 w-full text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {/* Add More Button */}
                <button
                  type="button"
                  onClick={addUnitLoadPhoto}
                  className="w-40 h-48 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                >
                  <Plus className="w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-500 mt-2">Add More</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Construction Photos Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Construction Photos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {CONSTRUCTION_PHOTO_TYPES.map(({ key, label }) => (
            <div key={key}>
              <label className={labelClass}>
                {label}
                {key === 'pileHeightPhoto' && <span className="text-gray-400 text-xs ml-1">(Optional)</span>}
              </label>
              {constructionPreviews[key as ConstructionPhotoKey] ? (
                <div className="relative">
                  <img
                    src={constructionPreviews[key as ConstructionPhotoKey]}
                    alt={label}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleConstructionPhotoChange(key as ConstructionPhotoKey, null)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <Camera className="w-8 h-8 text-gray-400" />
                  <span className="text-xs text-gray-500 mt-1">Take Photo</span>
                  <span className="text-xs text-gray-400">or Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleConstructionPhotoChange(key as ConstructionPhotoKey, e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quantities */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Inspection Quantities</h2>
          <button
            type="button"
            onClick={() => setShowAqlChart(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition-colors"
          >
            <Info size={16} />
            AQL Reference Chart
          </button>
        </div>
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
          <DropdownWithAdd
            label="AQL"
            value={formData.aql}
            onChange={(value) => setFormData({ ...formData, aql: value })}
            options={AQL_LEVELS}
            customOptions={customAqlLevels}
            onAddCustom={addCustomAqlLevel}
            required
            placeholder="Select AQL..."
          />
        </div>

        {/* AQL Z1.4-2008 Calculation Panel */}
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
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Code Letter</div>
                  <div className="text-xl font-bold text-emerald-700">{aqlCalculation.effectiveCodeLetter}</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Sample Size</div>
                  <div className="text-xl font-bold text-emerald-700">{aqlCalculation.sampleSize}</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Accept ≤</div>
                  <div className="text-xl font-bold text-green-600">{aqlCalculation.acceptNumber}</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Reject ≥</div>
                  <div className="text-xl font-bold text-red-600">{aqlCalculation.rejectNumber}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle size={16} />
                <span>{aqlCalculation.error || 'Unable to calculate AQL values'}</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className={labelClass}>
              Sample Size *
              {aqlCalculation?.isValid && (
                <span className="ml-2 text-xs text-emerald-600 font-normal">(auto-filled)</span>
              )}
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.sampleSize}
              onChange={(e) => setFormData({ ...formData, sampleSize: e.target.value })}
              className={`${inputClass} ${aqlCalculation?.isValid && formData.sampleSize === String(aqlCalculation.sampleSize) ? 'bg-emerald-50 border-emerald-300' : ''}`}
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

        {/* Auto PASS/FAIL Determination */}
        {aqlCalculation?.isValid && formData.rejectedQty && (
          <div className={`mt-4 p-4 rounded-lg border-2 ${
            formData.inspectionResult === 'PASS'
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-2">
                {formData.inspectionResult === 'PASS' ? (
                  <CheckCircle2 size={20} className="text-green-600" />
                ) : (
                  <XCircle size={20} className="text-red-600" />
                )}
                <span className="font-semibold">
                  {isAutoResult && !resultOverridden ? 'Auto-determined: ' : ''}
                  <span className={formData.inspectionResult === 'PASS' ? 'text-green-700' : 'text-red-700'}>
                    {formData.inspectionResult}
                  </span>
                </span>
                <span className="text-sm text-gray-600">
                  ({wouldPass(parseInt(formData.rejectedQty, 10), aqlCalculation.acceptNumber, aqlCalculation.rejectNumber).explanation})
                </span>
              </div>

              {resultOverridden && (
                <div className="flex items-center gap-1 text-amber-600 text-sm">
                  <Info size={14} />
                  <span>Inspector override</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Override:</span>
                <button
                  type="button"
                  onClick={() => handleResultChange('PASS')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    formData.inspectionResult === 'PASS'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-green-100'
                  }`}
                >
                  PASS
                </button>
                <button
                  type="button"
                  onClick={() => handleResultChange('FAIL')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    formData.inspectionResult === 'FAIL'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-red-100'
                  }`}
                >
                  FAIL
                </button>
              </div>
            </div>
          </div>
        )}
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
                  <span className="text-xs text-gray-500 mt-1">Take Photo</span>
                  <span className="text-xs text-gray-400">or Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
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
            <Camera size={18} />
            <span>Take/Upload Photos</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => handleOtherPhotosChange(e.target.files)}
            />
          </label>
        </div>
      </div>

      {/* Quality Checks */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quality Checks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {OK_NOT_OK_FIELDS.map(({ key, label }) => {
            const fieldKey = key as keyof FormDataState;
            const fieldValue = formData[fieldKey] as OkNotOk;
            return (
              <div key={key} className="border border-gray-200 rounded-lg p-3">
                <label className={labelClass}>{label}</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={key}
                      value="OK"
                      checked={fieldValue === 'OK'}
                      onChange={() => {
                        setFormData({ ...formData, [fieldKey]: 'OK' as OkNotOk });
                        // Clear photo when changing to OK
                        handleNotOkPhotoChange(key, null);
                      }}
                      className="text-emerald-600"
                    />
                    <span className="text-sm text-green-600 font-medium">OK</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={key}
                      value="NOT OK"
                      checked={fieldValue === 'NOT OK'}
                      onChange={() => setFormData({ ...formData, [fieldKey]: 'NOT OK' as OkNotOk })}
                      className="text-red-600"
                    />
                    <span className="text-sm text-red-600 font-medium">NOT OK</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={key}
                      value="NA"
                      checked={fieldValue === 'NA'}
                      onChange={() => {
                        setFormData({ ...formData, [fieldKey]: 'NA' as OkNotOk });
                        // Clear photo when changing to NA
                        handleNotOkPhotoChange(key, null);
                      }}
                      className="text-gray-400"
                    />
                    <span className="text-sm text-gray-500 font-medium">NA</span>
                  </label>
                </div>
                <NotOkPhotoUpload
                  fieldKey={key}
                  fieldLabel={label}
                  isNotOk={fieldValue === 'NOT OK'}
                  photo={notOkPhotos[key] || null}
                  preview={notOkPreviews[key] || ''}
                  onPhotoChange={(file) => handleNotOkPhotoChange(key, file)}
                />
              </div>
            );
          })}
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
                  onChange={() => setFormData({ ...formData, inspectionResult: 'PASS' as const })}
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
                  onChange={() => setFormData({ ...formData, inspectionResult: 'FAIL' as const })}
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

      {/* Draft Status & Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            {lastSavedAt && (
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Draft saved: {lastSavedAt}
              </span>
            )}
            {draftSaved && (
              <span className="text-emerald-600 font-medium ml-2">Saved!</span>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={saveDraft}
              disabled={draftSaving}
              className="flex-1 sm:flex-none px-6 py-3 border-2 border-emerald-600 text-emerald-600 font-semibold rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {draftSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Draft
                </>
              )}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Submit Report
                </>
              )}
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
              <button
                type="button"
                onClick={() => setShowAqlChart(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <h4 className="text-center text-xl font-bold text-teal-700 mb-1">AQL Z1.4-2008</h4>
              <p className="text-center text-sm text-gray-600 mb-4">Level II Normal Inspection</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Lot Size to Code Table */}
                <div>
                  <h5 className="text-sm font-semibold text-teal-600 mb-2 text-center">LOT SIZE → CODE</h5>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-teal-50">
                        <th className="border border-teal-200 px-2 py-1 text-left">Lot Size</th>
                        <th className="border border-teal-200 px-2 py-1 text-center">Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LOT_SIZE_CODE_LETTERS.map((range, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-200 px-2 py-1">
                            {range.max === Infinity ? `${range.min.toLocaleString()}+` : `${range.min.toLocaleString()}-${range.max.toLocaleString()}`} →
                          </td>
                          <td className="border border-gray-200 px-2 py-1 text-center font-semibold text-teal-700">
                            {range.codeLetter}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Accept/Reject Table */}
                <div>
                  <h5 className="text-sm font-semibold text-teal-600 mb-2 text-center">ACCEPT / REJECT BY AQL</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-teal-50">
                          <th className="border border-teal-200 px-1 py-1 text-center">Code</th>
                          <th className="border border-teal-200 px-1 py-1 text-center">Sample</th>
                          <th className="border border-teal-200 px-1 py-1 text-center" colSpan={2}>0.65</th>
                          <th className="border border-teal-200 px-1 py-1 text-center" colSpan={2}>1.0</th>
                          <th className="border border-teal-200 px-1 py-1 text-center" colSpan={2}>1.5</th>
                          <th className="border border-teal-200 px-1 py-1 text-center" colSpan={2}>2.5</th>
                          <th className="border border-teal-200 px-1 py-1 text-center" colSpan={2}>4.0</th>
                          <th className="border border-teal-200 px-1 py-1 text-center" colSpan={2}>6.5</th>
                        </tr>
                        <tr className="bg-teal-50 text-xs">
                          <th className="border border-teal-200 px-0.5 py-0.5"></th>
                          <th className="border border-teal-200 px-0.5 py-0.5"></th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-green-600">Ac</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-red-600">Re</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-green-600">Ac</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-red-600">Re</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-green-600">Ac</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-red-600">Re</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-green-600">Ac</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-red-600">Re</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-green-600">Ac</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-red-600">Re</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-green-600">Ac</th>
                          <th className="border border-teal-200 px-0.5 py-0.5 text-red-600">Re</th>
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
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-green-600">{renderCell(aqlValues?.['0.65'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-red-600">{renderRejectCell(aqlValues?.['0.65'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-green-600">{renderCell(aqlValues?.['1.0'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-red-600">{renderRejectCell(aqlValues?.['1.0'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-green-600">{renderCell(aqlValues?.['1.5'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-red-600">{renderRejectCell(aqlValues?.['1.5'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-green-600">{renderCell(aqlValues?.['2.5'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-red-600">{renderRejectCell(aqlValues?.['2.5'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-green-600">{renderCell(aqlValues?.['4.0'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-red-600">{renderRejectCell(aqlValues?.['4.0'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-green-600">{renderCell(aqlValues?.['6.5'])}</td>
                              <td className="border border-gray-200 px-0.5 py-0.5 text-center text-red-600">{renderRejectCell(aqlValues?.['6.5'])}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500 text-center space-y-1">
                <p><span className="text-green-600 font-medium">Ac</span> = Accept if defects ≤ | <span className="text-red-600 font-medium">Re</span> = Reject if defects ≥ | <span className="text-gray-400">↓</span> = Use next larger sample</p>
                <p className="font-medium">Level II Normal Inspection • ANSI/ASQ Z1.4-2008 Standard</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
