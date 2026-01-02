export type Company = 'EHI' | 'EMPL';
export type OkNotOk = 'OK' | 'NOT OK';
export type YesNo = 'Yes' | 'No';
export type PackingType = 'Assorted' | 'Solid';

export interface Defect {
  defectCode: string;
  majorCount: number;
  minorCount: number;
  description: string;
}

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

export const CUSTOMERS = [
  'ACME Corporation',
  'Amazon',
  'Anthropic',
  'Ashley Furniture',
  'Bed Bath & Beyond',
  'Bloomingdale\'s',
  'Crate & Barrel',
  'CB2',
  'Costco',
  'Ethan Allen',
  'Home Depot',
  'IKEA',
  'JCPenney',
  'Kohl\'s',
  'Lowe\'s',
  'Macy\'s',
  'Nordstrom',
  'Overstock',
  'Pier 1 Imports',
  'Pottery Barn',
  'Restoration Hardware',
  'Room & Board',
  'Target',
  'The Container Store',
  'Tuesday Morning',
  'Wayfair',
  'West Elm',
  'Williams-Sonoma',
  'World Market',
  'Z Gallerie',
  'Arhaus',
  'Ballard Designs',
  'Frontgate',
  'Grandin Road',
  'Horchow',
  'Joss & Main',
  'Serena & Lily',
  'One Kings Lane',
  'Perigold',
  'Rugs USA',
  'Safavieh',
  'Surya',
  'Nourison',
  'Other'
] as const;

export const BUYER_DESIGNS = [
  'Aegean', 'Agra', 'Amara', 'Amber', 'Andorra', 'Ankara', 'Antique', 'Arabesque', 'Aria', 'Artisan',
  'Ashton', 'Atlas', 'Aurora', 'Avalon', 'Avery', 'Azure', 'Babylon', 'Barcelona', 'Barrington', 'Bellini',
  'Bengal', 'Berlin', 'Bermuda', 'Bethany', 'Beverly', 'Bianca', 'Birch', 'Blossom', 'Bohemian', 'Bombay',
  'Bordeaux', 'Brighton', 'Bristol', 'Brooklyn', 'Brussels', 'Cairo', 'Calabria', 'Cambridge', 'Capri', 'Carmen',
  'Carolina', 'Casablanca', 'Cascade', 'Catalina', 'Celestia', 'Celtic', 'Chantilly', 'Charleston', 'Chelsea', 'Chester',
  'Chevron', 'Claudia', 'Coastal', 'Colonial', 'Como', 'Copenhagen', 'Coral', 'Cordoba', 'Cornwall', 'Corsica',
  'Cosmopolitan', 'Coventry', 'Cyprus', 'Dakota', 'Damascus', 'Damask', 'Delhi', 'Devon', 'Diamond', 'Dynasty',
  'Eclipse', 'Eden', 'Edinburgh', 'Egypt', 'Elegance', 'Elite', 'Emerald', 'Empire', 'Enchanted', 'English',
  'Essence', 'Eternity', 'Europa', 'Everest', 'Exotic', 'Fantasy', 'Fez', 'Fiesta', 'Fiji', 'Flora',
  'Florence', 'Fontana', 'Fortune', 'Fusion', 'Galaxy', 'Geneva', 'Genoa', 'Georgia', 'Gibraltar', 'Glasgow',
  'Global', 'Gloria', 'Granada', 'Grecian', 'Greenwich', 'Greta', 'Hampton', 'Harmony', 'Havana', 'Heritage',
  'Himalaya', 'Hudson', 'Imperial', 'India', 'Infinity', 'Isfahan', 'Istanbul', 'Ivory', 'Jade', 'Jaipur',
  'Jamaica', 'Java', 'Jewel', 'Jordan', 'Kashmir', 'Kenya', 'Kilim', 'Kingston', 'Kyoto', 'Laguna',
  'Lancaster', 'Legend', 'Lexington', 'Liberty', 'Lima', 'London', 'Lotus', 'Lucia', 'Luna', 'Luxor',
  'Lyon', 'Madrid', 'Mahal', 'Malibu', 'Malta', 'Manchester', 'Manhattan', 'Manila', 'Marakesh', 'Marina',
  'Marquee', 'Marseille', 'Maya', 'Mediterranean', 'Melbourne', 'Memphis', 'Meridian', 'Milan', 'Monaco', 'Montana',
  'Monterey', 'Morocco', 'Mumbai', 'Mystic', 'Naples', 'Natural', 'Nepal', 'Newport', 'Nirvana', 'Nordic',
  'Normandy', 'Other'
] as const;

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
