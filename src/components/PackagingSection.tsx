import { SizeInspectionFormState, OkNotOk, PackingType } from '../types';

interface PackagingSectionProps {
  sizeData: SizeInspectionFormState;
  sizeIndex: number;
  onFieldChange: (field: string, value: unknown) => void;
}

const OK_NOT_OK_PACKAGING_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'cartonDropTest', label: 'Carton Drop Test' },
  { key: 'cartonBaleNumbering', label: 'Carton/Bale Numbering' },
  { key: 'cartonDimension', label: 'Carton Dimension' },
  { key: 'productLabel', label: 'Product Label' },
  { key: 'cartonLabel', label: 'Carton Label' },
  { key: 'barcodeScan', label: 'Barcode Scan' },
];

const TEXT_FIELDS: Array<{ key: string; label: string; placeholder: string; halfWidth?: boolean }> =
  [
    { key: 'cartonPly', label: 'Carton Ply', placeholder: 'e.g. 5-ply' },
    { key: 'grossWeight', label: 'Gross Weight', placeholder: 'e.g. 25 kgs' },
    { key: 'netWeight', label: 'Net Weight', placeholder: 'e.g. 22 kgs' },
    { key: 'pcsPerCartonBale', label: 'Pcs per Carton/Bale', placeholder: 'e.g. 10' },
    { key: 'pcsPerPolybag', label: 'Pcs per Polybag', placeholder: 'e.g. 1' },
  ];

function OkNotOkPills({
  fieldKey,
  value,
  sizeIndex,
  onFieldChange,
}: {
  fieldKey: string;
  value: OkNotOk;
  sizeIndex: number;
  onFieldChange: (field: string, value: unknown) => void;
}) {
  const radioName = `size_${sizeIndex}_pkg_${fieldKey}`;
  return (
    <div className="flex items-center gap-1">
      {(['OK', 'NOT OK', 'NA'] as OkNotOk[]).map((opt) => {
        const isSelected = value === opt;
        let activeClass = '';
        if (isSelected) {
          if (opt === 'OK') activeClass = 'bg-emerald-50 border-emerald-300 text-emerald-700';
          else if (opt === 'NOT OK') activeClass = 'bg-red-50 border-red-300 text-red-700';
          else activeClass = 'bg-gray-100 border-gray-300 text-gray-600';
        }
        let hoverClass = '';
        if (!isSelected) {
          if (opt === 'OK') hoverClass = 'hover:border-emerald-200 hover:text-emerald-600';
          else if (opt === 'NOT OK') hoverClass = 'hover:border-red-200 hover:text-red-600';
          else hoverClass = 'hover:border-gray-300 hover:text-gray-500';
        }
        return (
          <label
            key={opt}
            className={`flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer border transition-colors ${
              isSelected ? activeClass : `border-gray-200 text-gray-400 ${hoverClass}`
            }`}
          >
            <input
              type="radio"
              name={radioName}
              value={opt}
              checked={isSelected}
              onChange={() => onFieldChange(fieldKey, opt)}
              className="sr-only"
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}

export default function PackagingSection({
  sizeData,
  sizeIndex,
  onFieldChange,
}: PackagingSectionProps) {
  return (
    <div className="space-y-4">
      {/* Text inputs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {TEXT_FIELDS.map(({ key, label, placeholder }) => {
          const val = (sizeData as any)[key] as string;
          return (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input
                type="text"
                value={val || ''}
                onChange={(e) => onFieldChange(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          );
        })}

        {/* Packing Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Packing Type</label>
          <select
            value={sizeData.packingType}
            onChange={(e) => onFieldChange('packingType', e.target.value as PackingType)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          >
            <option value="Assorted">Assorted</option>
            <option value="Solid">Solid</option>
          </select>
        </div>
      </div>

      {/* Carton Measurements */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Carton Measurements (L x W x H)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={sizeData.cartonMeasurementL}
            onChange={(e) => onFieldChange('cartonMeasurementL', e.target.value)}
            placeholder="L"
            className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-center"
          />
          <span className="text-gray-400">x</span>
          <input
            type="text"
            value={sizeData.cartonMeasurementW}
            onChange={(e) => onFieldChange('cartonMeasurementW', e.target.value)}
            placeholder="W"
            className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-center"
          />
          <span className="text-gray-400">x</span>
          <input
            type="text"
            value={sizeData.cartonMeasurementH}
            onChange={(e) => onFieldChange('cartonMeasurementH', e.target.value)}
            placeholder="H"
            className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-center"
          />
        </div>
      </div>

      {/* OK/NOT OK fields */}
      <div className="divide-y divide-gray-100">
        {OK_NOT_OK_PACKAGING_FIELDS.map(({ key, label }) => {
          const val = (sizeData as any)[key] as OkNotOk;
          return (
            <div key={key} className="flex items-center gap-2 py-2.5">
              <span className="text-sm font-medium text-gray-700 min-w-0 flex-1 truncate">
                {label}
              </span>
              <OkNotOkPills
                fieldKey={key}
                value={val}
                sizeIndex={sizeIndex}
                onFieldChange={onFieldChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
