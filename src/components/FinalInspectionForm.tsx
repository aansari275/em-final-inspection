import { useState, useEffect, useRef } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, getCustomers, addCustomer } from '../lib/firebase';
import { emailSettingsService } from '../lib/emailSettingsService';
import { generateFinalInspectionPDF } from '../lib/pdfGenerator';
import {
  FinalInspection,
  QC_INSPECTORS,
  MERCHANTS,
  AQL_LEVELS,
  PHOTO_TYPES,
  OkNotOk,
  Defect,
  NotOkPhoto,
  SizeUnit,
  CUSTOM_OPTIONS_KEYS,
  OK_NOT_OK_FIELDS,
  Customer,
  STANDARD_SIZES_CM,
  STANDARD_SIZES_FEET
} from '../types';
import { Loader2, Upload, X, Camera, CheckCircle2, XCircle, Plus } from 'lucide-react';

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
          <span>Add Photo</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPhotoChange(e.target.files?.[0] || null)}
          />
        </label>
      )}
    </div>
  );
}

type PhotoKey = keyof Pick<FinalInspection,
  'approvedSamplePhoto' | 'idPhoto' | 'redSealFrontPhoto' | 'redSealSidePhoto' |
  'backPhoto' | 'labelPhoto' | 'moisturePhoto' | 'sizeFrontPhoto' | 'sizeSidePhoto' |
  'inspectedSamplesPhoto' | 'metalCheckingPhoto'
>;

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

  // Load custom options from localStorage on mount
  useEffect(() => {
    setCustomQcInspectors(getCustomOptions(CUSTOM_OPTIONS_KEYS.qcInspectors));
    setCustomMerchants(getCustomOptions(CUSTOM_OPTIONS_KEYS.merchants));
    setCustomBuyerDesigns(getCustomOptions(CUSTOM_OPTIONS_KEYS.buyerDesigns));
    setCustomSizesCm(getCustomOptions(CUSTOM_OPTIONS_KEYS.customSizesCm));
    setCustomSizesFeet(getCustomOptions(CUSTOM_OPTIONS_KEYS.customSizesFeet));
    setCustomAqlLevels(getCustomOptions(CUSTOM_OPTIONS_KEYS.aqlLevels));
  }, []);

  // Update formData.productSizes when selectedSizes changes
  useEffect(() => {
    const sizesString = selectedSizes.join(', ');
    setFormData(prev => ({ ...prev, productSizes: sizesString }));
  }, [selectedSizes]);

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

  // Handle customer selection - auto-fill customer code
  const handleCustomerChange = (name: string, code: string) => {
    setFormData(prev => ({
      ...prev,
      customerName: name,
      customerCode: code
    }));
  };

  // NOT OK photo state
  const [notOkPhotos, setNotOkPhotos] = useState<Record<string, File | null>>({});
  const [notOkPreviews, setNotOkPreviews] = useState<Record<string, string>>({});

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
        // NOT OK photos
        notOkPhotos: notOkPhotoUrls,
        // Size unit
        sizeUnit: sizeUnit,
        // Results
        qcInspectorRemarks: formData.qcInspectorRemarks,
        inspectionResult: formData.inspectionResult,
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

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <div style="background: #059669; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">Eastern Mills</h1>
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

              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-top: 20px;">Quantities</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #6b7280;">Total Order Qty:</td><td style="padding: 8px 0;">${inspection.totalOrderQty}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">Inspected Lot:</td><td style="padding: 8px 0;">${inspection.inspectedLotQty}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7280;">AQL / Sample Size:</td><td style="padding: 8px 0;">${inspection.aql} / ${inspection.sampleSize}</td></tr>
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
              <p>Eastern Mills QC System - Final Inspection Report</p>
            </div>
          </div>
        `;

        await fetch('/.netlify/functions/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipients,
            subject: `Final Inspection: ${inspection.customerName} - ${inspection.buyerDesignName} [${inspection.inspectionResult}]`,
            html: emailHtml,
            pdfBase64,
            pdfFilename: `Final_Inspection_${inspection.opsNo}_${inspection.inspectionDate}.pdf`
          })
        });
      }

      setSuccess(true);
      // Reset form
      setFormData({
        ...initialFormData,
        inspectionDate: new Date().toISOString().split('T')[0]
      });
      setDefects([]);
      setNotOkPhotos({});
      setNotOkPreviews({});
      setSizeUnit('cm');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="text-emerald-600 w-5 h-5" />
          <span className="text-emerald-700">Inspection submitted successfully!</span>
        </div>
      )}

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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <DropdownWithAdd
            label="Buyer Design Name"
            value={formData.buyerDesignName}
            onChange={(value) => setFormData({ ...formData, buyerDesignName: value })}
            options={[]}
            customOptions={customBuyerDesigns}
            onAddCustom={addCustomBuyerDesign}
            required
            placeholder="Select/Add Design"
          />
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
