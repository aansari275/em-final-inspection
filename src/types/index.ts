export type Company = 'EHI' | 'EMPL';
export type OkNotOk = 'OK' | 'NOT OK';
export type YesNo = 'Yes' | 'No';
export type PackingType = 'Assorted' | 'Solid';
export type SizeUnit = 'cm' | 'feet';

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
  idPhoto: string;
  redSealFrontPhoto: string;
  redSealSidePhoto: string;
  backPhoto: string;
  labelPhoto: string;
  moisturePhoto: string;
  sizeFrontPhoto: string;
  sizeSidePhoto: string;
  inspectedSamplesPhoto: string;
  metalCheckingPhoto: string;
  otherPhotos: string[];

  // NOT OK photos (photos for fields marked as NOT OK)
  notOkPhotos: NotOkPhoto[];

  // Size unit used
  sizeUnit: SizeUnit;

  qcInspectorRemarks: string;
  inspectionResult: 'PASS' | 'FAIL';

  createdAt: string;
}

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
  '0.65',
  '1.0',
  '1.5',
  '2.5',
  '4.0',
  '6.5'
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
  { key: 'idPhoto', label: 'ID Photo' },
  { key: 'redSealFrontPhoto', label: 'Red Seal Front Photo' },
  { key: 'redSealSidePhoto', label: 'Red Seal Side Photo' },
  { key: 'backPhoto', label: 'Back Photo' },
  { key: 'labelPhoto', label: 'Label Photo' },
  { key: 'moisturePhoto', label: 'Moisture Photo' },
  { key: 'sizeFrontPhoto', label: 'Size Front Photo' },
  { key: 'sizeSidePhoto', label: 'Size Side Photo' },
  { key: 'inspectedSamplesPhoto', label: 'Inspected Samples Photo' },
  { key: 'metalCheckingPhoto', label: 'Metal Checking Photo' },
] as const;
