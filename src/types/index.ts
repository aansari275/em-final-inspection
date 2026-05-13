export type Company = 'EHI' | 'EMPL';
export type OkNotOk = 'OK' | 'NOT OK' | 'NA';
export type YesNo = 'Yes' | 'No';
export type PackingType = 'Assorted' | 'Solid';
export type SizeUnit = 'cm' | 'feet';

// Labeled photo for Images section (Consumer Pieces & Unit Load)
export interface LabeledPhoto {
  label: string;
  file?: File;
  preview?: string;
  url?: string; // For saved photos from Firebase
}

// Selected article for inspection (from OPS items)
export interface SelectedArticle {
  id: string;
  articleName: string;
  size?: string;
  color?: string;
  quality?: string;
  pcs: number;
  sqm: number;
  selected: boolean;
  inspectedQty?: number; // How many pieces to inspect from this article
}

// Default dropdown options for Consumer Pieces labels
export const CONSUMER_PIECE_LABELS = [
  'Consumer Label',
  'Care Label',
  'SKU Sticker',
  'UPC Barcode',
  'Packaging Front',
  'Packaging Back',
] as const;

// Default dropdown options for Unit Load labels
export const UNIT_LOAD_LABELS = [
  'Unit Load Label',
  'Pallet Marking',
  'Outer Carton',
  'Stretch Wrap',
] as const;

// Customer with code (synced from TED forms via Firestore)
export interface Customer {
  name: string;
  code: string;
}

export interface Defect {
  defectCode: string;
  majorCount: number;
  minorCount: number;
  description: string;
}

// NOT OK photo for quality check fields
export interface NotOkPhoto {
  field: string;
  photo: string;  // URL after upload
}

// Product size with unit
export interface ProductSize {
  value: string;
  unit: SizeUnit;
}

// Custom options storage keys
export const CUSTOM_OPTIONS_KEYS = {
  qcInspectors: 'em_custom_qc_inspectors',
  customers: 'em_custom_customers',
  merchants: 'em_custom_merchants',
  productSizes: 'em_custom_product_sizes',
  buyerDesigns: 'em_custom_buyer_designs',
  customSizesCm: 'em_custom_sizes_cm',
  customSizesFeet: 'em_custom_sizes_feet',
  aqlLevels: 'em_custom_aql_levels',
  consumerPieceLabels: 'em_custom_consumer_piece_labels',
  unitLoadLabels: 'em_custom_unit_load_labels',
} as const;

// Standard product sizes in cm
export const STANDARD_SIZES_CM = [
  '60x90',
  '90x150',
  '120x180',
  '140x200',
  '160x230',
  '170x240',
  '200x300',
  '250x300',
  '250x350',
  '300x400',
] as const;

// Standard product sizes in feet
export const STANDARD_SIZES_FEET = [
  '2x3',
  '3x5',
  '4x6',
  '5x7',
  '5x8',
  '6x9',
  '8x10',
  '9x12',
  '10x14',
  '12x15',
] as const;

// All OK/NOT OK check fields for photo support
export const OK_NOT_OK_FIELDS = [
  { key: 'motifDesignCheck', label: 'Motif/Design Check' },
  { key: 'backing', label: 'Backing' },
  { key: 'bindingAndEdges', label: 'Binding & Edges' },
  { key: 'handFeel', label: 'Hand Feel' },
  { key: 'embossingCarving', label: 'Embossing/Carving' },
  { key: 'workmanship', label: 'Workmanship' },
  { key: 'productQualityWeight', label: 'Product Quality Weight' },
  { key: 'labelPlacement', label: 'Label Placement' },
  { key: 'sideMarking', label: 'Side Marking' },
  { key: 'outerMarking', label: 'Outer Marking' },
  { key: 'innerPack', label: 'Inner Pack' },
  { key: 'careLabels', label: 'Care Labels' },
  { key: 'skuStickers', label: 'SKU Stickers' },
  { key: 'upcBarcodes', label: 'UPC Barcodes' },
  { key: 'cartonDropTest', label: 'Carton Drop Test' },
  { key: 'cartonBaleNumbering', label: 'Carton/Bale Numbering' },
  { key: 'cartonDimension', label: 'Carton Dimension' },
  { key: 'productLabel', label: 'Product Label' },
  { key: 'cartonLabel', label: 'Carton Label' },
  { key: 'barcodeScan', label: 'Barcode Scan' },
] as const;

// ─── V1 Interface (backward compat, existing inspections) ───
export interface FinalInspection {
  // Company & Document
  company: Company;
  documentNo: string;  // EHI/IP/01 or EMPL/IP/01

  // Basic Info
  inspectionDate: string;
  qcInspectorName: string;
  customerName: string;
  customerCode: string;
  customerPoNo: string;
  opsNo: string;
  opsNumber?: string;  // Standardized OPS reference for cross-app queries (dual-write)
  buyerDesignName: string;
  emplDesignNo: string;
  colorName: string;
  productSizes: string;
  merchant: string;

  // Quantities
  totalOrderQty: number;
  inspectedLotQty: number;
  aql: string;
  sampleSize: number;
  acceptedQty: number;
  rejectedQty: number;

  // Product Quality Checks
  approvedSampleAvailable: YesNo;
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

  // Labeling & Marking
  labelPlacement: OkNotOk;
  sideMarking: OkNotOk;
  outerMarking: OkNotOk;
  innerPack: OkNotOk;
  careLabels: OkNotOk;
  skuStickers: OkNotOk;
  upcBarcodes: OkNotOk;

  // Packaging
  cartonPly: string;
  cartonDropTest: OkNotOk;
  packingType: PackingType;
  grossWeight: string;
  netWeight: string;
  cartonBaleNumbering: OkNotOk;
  pcsPerCartonBale: string;
  pcsPerPolybag: string;
  cartonMeasurementL: string;
  cartonMeasurementW: string;
  cartonMeasurementH: string;

  // Original Checks (kept for compatibility)
  cartonDimension: OkNotOk;
  productLabel: OkNotOk;
  cartonLabel: OkNotOk;
  barcodeScan: OkNotOk;

  // Defect Tracking
  dpciSkuStyleNumber: string;
  styleDescription: string;
  defects: Defect[];

  // Photos
  approvedSamplePhoto: string;
  redSealFrontPhoto: string;
  redSealBackPhoto: string;
  redSealCloseUpPhoto: string;
  redSealProductFront: string;
  redSealProductBack: string;
  labelPhoto: string;
  moisturePhoto: string;
  sizeFrontPhoto: string;
  sizeSidePhoto: string;
  inspectedSamplesPhoto: string;
  metalCheckingPhoto: string;
  otherPhotos: string[];

  // New Images section
  stackedGoodsPhoto?: string;
  consumerPieces?: Array<{ label: string; url: string }>;
  unitLoadEnabled?: boolean;
  unitLoadPhotos?: Array<{ label: string; url: string }>;

  // Construction photos
  constructionPhotos?: {
    warpPer10cm?: string;
    weftPer10cm?: string;
    pileHeightPhoto?: string;
    productNetWeightPhoto?: string;
    productGrossWeightPhoto?: string;
  };

  // Inspected articles from OPS (selected during form entry)
  inspectedArticles?: Array<{
    articleName: string;
    size?: string;
    color?: string;
    quality?: string;
    pcs: number;
    sqm: number;
    inspectedQty: number;
  }>;

  // NOT OK photos (photos for fields marked as NOT OK)
  notOkPhotos: NotOkPhoto[];

  // Size unit used
  sizeUnit: SizeUnit;

  // AQL Z1.4-2008 Calculation Fields
  inspectionLevel?: 'I' | 'II' | 'III';  // Default: 'II' (General Level II)
  codeLetter?: string;                    // Auto-calculated code letter (A-R)
  calculatedSampleSize?: number;          // Sample size from Z1.4 table
  acceptNumber?: number;                  // Accept threshold from table
  rejectNumber?: number;                  // Reject threshold from table
  effectiveCodeLetter?: string;           // May differ if arrow applies
  isAutoResult?: boolean;                 // Was PASS/FAIL auto-determined?
  resultOverridden?: boolean;             // Did inspector override auto result?

  qcInspectorRemarks: string;
  inspectionResult: 'PASS' | 'FAIL';

  createdAt: string;
}

// ─── V2: Per-Size Inspection (Firestore document for saved size data) ───
export interface SizeInspection {
  id: string; // crypto.randomUUID()
  size: string;
  sizeUnit: SizeUnit;

  // Product Quality Checks
  approvedSampleAvailable: YesNo;
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

  // Labeling & Marking
  labelPlacement: OkNotOk;
  sideMarking: OkNotOk;
  outerMarking: OkNotOk;
  innerPack: OkNotOk;
  careLabels: OkNotOk;
  skuStickers: OkNotOk;
  upcBarcodes: OkNotOk;

  // Packaging
  cartonPly: string;
  cartonDropTest: OkNotOk;
  packingType: PackingType;
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

  // Defect Tracking
  dpciSkuStyleNumber: string;
  styleDescription: string;
  defects: Defect[];

  // Photo URLs (populated after upload)
  standardPhotoUrls: Record<string, string>;
  constructionPhotoUrls: Record<string, string>;
  otherPhotoUrls: string[];
  stackedGoodsPhotoUrl: string;
  consumerPieces: Array<{ label: string; url: string }>;
  unitLoadEnabled: boolean;
  unitLoadPhotos: Array<{ label: string; url: string }>;
  notOkPhotos: NotOkPhoto[];

  // Result
  qcInspectorRemarks: string;
  inspectionResult: 'PASS' | 'FAIL';
}

// ─── V2: Form state for a size during editing (has File objects) ───
export interface SizeInspectionFormState extends Omit<SizeInspection,
  'standardPhotoUrls' | 'constructionPhotoUrls' | 'otherPhotoUrls' |
  'stackedGoodsPhotoUrl' | 'consumerPieces' | 'unitLoadPhotos' | 'notOkPhotos'
> {
  // File objects during editing
  standardPhotos: Record<string, File | null>;
  standardPhotoPreviews: Record<string, string>;
  constructionPhotos: Record<string, File | null>;
  constructionPhotoPreviews: Record<string, string>;
  otherPhotos: File[];
  otherPhotoPreviews: string[];
  stackedGoodsPhoto: File | null;
  stackedGoodsPreview: string;
  consumerPiecesForm: LabeledPhoto[];
  unitLoadPhotosForm: LabeledPhoto[];
  notOkPhotosForm: Record<string, File | null>;
  notOkPreviews: Record<string, string>;
}

// ─── V2: Firestore document structure ───
export interface FinalInspectionV2 {
  version: 2;

  // Global fields
  company: Company;
  documentNo: string;
  inspectionDate: string;
  qcInspectorName: string;
  customerName: string;
  customerCode: string;
  customerPoNo: string;
  opsNo: string;
  opsNumber?: string;
  buyerDesignName: string;
  emplDesignNo: string;
  colorName: string;
  merchant: string;
  totalOrderQty: number;

  // AQL (global)
  inspectedLotQty: number;
  aql: string;
  sampleSize: number;
  acceptedQty: number;
  rejectedQty: number;
  inspectionLevel?: 'I' | 'II' | 'III';
  codeLetter?: string;
  calculatedSampleSize?: number;
  acceptNumber?: number;
  rejectNumber?: number;
  effectiveCodeLetter?: string;
  isAutoResult?: boolean;
  resultOverridden?: boolean;

  // Inspected articles from OPS
  inspectedArticles?: Array<{
    articleName: string;
    size?: string;
    color?: string;
    quality?: string;
    pcs: number;
    sqm: number;
    inspectedQty: number;
  }>;

  // Per-size inspections
  sizeInspections: SizeInspection[];

  // Rollup fields (computed on save)
  productSizes: string;
  sizeUnit: SizeUnit;
  inspectionResult: 'PASS' | 'FAIL'; // FAIL if any size fails

  // Upload tracking
  photoUploadStatus: 'pending' | 'uploading' | 'complete' | 'partial';
  totalPhotoCount: number;
  uploadedPhotoCount: number;

  emailStatus: 'pending' | 'sending' | 'sent' | 'failed';
  createdAt: string;
}

// Type guard for V2 documents
export function isV2Inspection(doc: FinalInspection | FinalInspectionV2): doc is FinalInspectionV2 {
  return 'version' in doc && doc.version === 2 || 'sizeInspections' in doc && Array.isArray((doc as FinalInspectionV2).sizeInspections);
}

// Helper to create empty photo records
function emptyStandardPhotos(): Record<string, null> {
  const result: Record<string, null> = {};
  for (const pt of PHOTO_TYPES) result[pt.key] = null;
  return result;
}

function emptyStandardPreviews(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pt of PHOTO_TYPES) result[pt.key] = '';
  return result;
}

function emptyConstructionPhotos(): Record<string, null> {
  const result: Record<string, null> = {};
  for (const pt of CONSTRUCTION_PHOTO_TYPES) result[pt.key] = null;
  return result;
}

function emptyConstructionPreviews(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pt of CONSTRUCTION_PHOTO_TYPES) result[pt.key] = '';
  return result;
}

// Create an empty size inspection form state
export function createEmptySizeInspection(): SizeInspectionFormState {
  return {
    id: crypto.randomUUID(),
    size: '',
    sizeUnit: 'cm',
    // Quality checks
    approvedSampleAvailable: 'No',
    materialFibreContent: '',
    motifDesignCheck: 'NA',
    tuftDensity: '',
    backing: 'NA',
    backingNotes: '',
    bindingAndEdges: 'NA',
    handFeel: 'NA',
    pileHeight: '',
    embossingCarving: 'NA',
    workmanship: 'NA',
    productQualityWeight: 'NA',
    productWeight: '',
    sizeTolerance: '',
    finishingPercent: '',
    packedPercent: '',
    // Labeling
    labelPlacement: 'NA',
    sideMarking: 'NA',
    outerMarking: 'NA',
    innerPack: 'NA',
    careLabels: 'NA',
    skuStickers: 'NA',
    upcBarcodes: 'NA',
    // Packaging
    cartonPly: '',
    cartonDropTest: 'NA',
    packingType: 'Assorted',
    grossWeight: '',
    netWeight: '',
    cartonBaleNumbering: 'NA',
    pcsPerCartonBale: '',
    pcsPerPolybag: '',
    cartonMeasurementL: '',
    cartonMeasurementW: '',
    cartonMeasurementH: '',
    cartonDimension: 'NA',
    productLabel: 'NA',
    cartonLabel: 'NA',
    barcodeScan: 'NA',
    // Defects
    dpciSkuStyleNumber: '',
    styleDescription: '',
    defects: [],
    // Photos (File objects during editing)
    standardPhotos: emptyStandardPhotos() as Record<string, File | null>,
    standardPhotoPreviews: emptyStandardPreviews(),
    constructionPhotos: emptyConstructionPhotos() as Record<string, File | null>,
    constructionPhotoPreviews: emptyConstructionPreviews(),
    otherPhotos: [],
    otherPhotoPreviews: [],
    stackedGoodsPhoto: null,
    stackedGoodsPreview: '',
    consumerPiecesForm: [],
    unitLoadEnabled: false,
    unitLoadPhotosForm: [],
    notOkPhotosForm: {},
    notOkPreviews: {},
    // Result
    qcInspectorRemarks: '',
    inspectionResult: 'PASS',
  };
}

// Photo key types
export type PhotoKey = typeof PHOTO_TYPES[number]['key'];
export type ConstructionPhotoKey = typeof CONSTRUCTION_PHOTO_TYPES[number]['key'];

export const COMPANIES: Company[] = ['EHI', 'EMPL'];

export const COMPANY_NAMES: Record<Company, string> = {
  'EHI': 'Eastern Home Industries',
  'EMPL': 'Eastern Mills Pvt Ltd'
};

export const QC_INSPECTORS = [
  'Mahfooz Khan',
  'Faizan',
  'Gulab'
] as const;

export const MERCHANTS = [
  'Haider',
  'Jozey',
  'Shagun',
  'Shahbaz',
  'Sumant',
  'Zahid'
] as const;

// CUSTOMERS removed - now loaded from Firestore (synced with TED forms)

// BUYER_DESIGNS removed - now stored in localStorage with ability to add new ones

export const AQL_LEVELS = [
  '2.5'
] as const;

export const MATERIAL_TYPES = [
  'Wool',
  'Silk',
  'Cotton',
  'Jute',
  'Viscose',
  'Polyester',
  'Nylon',
  'Wool/Silk Blend',
  'Wool/Viscose Blend',
  'Cotton/Jute Blend',
  'Other'
] as const;

export const DEFECT_CODES = [
  { code: 'D01', description: 'Color Variation' },
  { code: 'D02', description: 'Size Deviation' },
  { code: 'D03', description: 'Weaving Defect' },
  { code: 'D04', description: 'Missing Tuft' },
  { code: 'D05', description: 'Stain/Spot' },
  { code: 'D06', description: 'Backing Issue' },
  { code: 'D07', description: 'Edge/Binding Defect' },
  { code: 'D08', description: 'Pattern Mismatch' },
  { code: 'D09', description: 'Pile Height Variation' },
  { code: 'D10', description: 'Fringe Issue' },
  { code: 'D11', description: 'Label Error' },
  { code: 'D12', description: 'Packaging Damage' },
  { code: 'D13', description: 'Metal Detected' },
  { code: 'D14', description: 'Moisture Issue' },
  { code: 'D15', description: 'Other' }
] as const;

export const PHOTO_TYPES = [
  { key: 'approvedSamplePhoto', label: 'Approved Sample Photo' },
  // Red Seal Photos section
  { key: 'redSealFrontPhoto', label: 'Red Seal - Front' },
  { key: 'redSealBackPhoto', label: 'Red Seal - Back' },
  { key: 'redSealCloseUpPhoto', label: 'Close-up with Red Seal' },
  { key: 'redSealProductFront', label: 'Front Photo with Red Seal' },
  { key: 'redSealProductBack', label: 'Back Photo with Red Seal' },
  // Other photos
  { key: 'labelPhoto', label: 'Label Photo' },
  { key: 'moisturePhoto', label: 'Moisture Photo' },
  { key: 'sizeFrontPhoto', label: 'Size Front Photo' },
  { key: 'sizeSidePhoto', label: 'Size Side Photo' },
  { key: 'inspectedSamplesPhoto', label: 'Inspected Samples Photo' },
  { key: 'metalCheckingPhoto', label: 'Metal Checking Photo' },
] as const;

// Construction photo types with measurements
export const CONSTRUCTION_PHOTO_TYPES = [
  { key: 'warpPer10cm', label: 'Warp per 10 cms' },
  { key: 'weftPer10cm', label: 'Weft per 10 cms' },
  { key: 'pileHeightPhoto', label: 'Pile Height' },
  { key: 'productNetWeightPhoto', label: 'Product Net Weight' },
  { key: 'productGrossWeightPhoto', label: 'Product Gross Weight' },
] as const;

// V3 hierarchy types (re-export)
export * from './v3';
