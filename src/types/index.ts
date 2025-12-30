export interface FinalInspection {
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
  totalOrderQty: number;
  inspectedLotQty: number;
  aql: string;
  sampleSize: number;
  acceptedQty: number;
  rejectedQty: number;

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

  // Checks
  cartonDimension: 'OK' | 'NOT OK';
  productLabel: 'OK' | 'NOT OK';
  cartonLabel: 'OK' | 'NOT OK';
  barcodeScan: 'OK' | 'NOT OK';

  qcInspectorRemarks: string;
  inspectionResult: 'PASS' | 'FAIL';

  createdAt: string;
}

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
