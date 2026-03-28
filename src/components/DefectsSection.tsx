import { Plus, Trash2 } from 'lucide-react';
import { SizeInspectionFormState, Defect, DEFECT_CODES } from '../types';

interface DefectsSectionProps {
  sizeData: SizeInspectionFormState;
  sizeIndex: number;
  onFieldChange: (field: string, value: unknown) => void;
  onDefectsChange: (defects: Defect[]) => void;
}

export default function DefectsSection({
  sizeData,
  sizeIndex: _sizeIndex,
  onFieldChange,
  onDefectsChange,
}: DefectsSectionProps) {
  const { defects, dpciSkuStyleNumber, styleDescription } = sizeData;

  const addDefect = () => {
    onDefectsChange([
      ...defects,
      { defectCode: '', majorCount: 0, minorCount: 0, description: '' },
    ]);
  };

  const updateDefect = (index: number, updates: Partial<Defect>) => {
    const updated = defects.map((d, i) => (i === index ? { ...d, ...updates } : d));
    onDefectsChange(updated);
  };

  const removeDefect = (index: number) => {
    onDefectsChange(defects.filter((_, i) => i !== index));
  };

  const totalMajor = defects.reduce((sum, d) => sum + (d.majorCount || 0), 0);
  const totalMinor = defects.reduce((sum, d) => sum + (d.minorCount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            DPCI/SKU/Style Number
          </label>
          <input
            type="text"
            value={dpciSkuStyleNumber}
            onChange={(e) => onFieldChange('dpciSkuStyleNumber', e.target.value)}
            placeholder="Enter DPCI/SKU/Style..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Style Description
          </label>
          <input
            type="text"
            value={styleDescription}
            onChange={(e) => onFieldChange('styleDescription', e.target.value)}
            placeholder="Enter style description..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Defects table */}
      {defects.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">
                  Defect Code
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 border-b w-20">
                  Major
                </th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 border-b w-20">
                  Minor
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">
                  Description
                </th>
                <th className="w-10 border-b" />
              </tr>
            </thead>
            <tbody>
              {defects.map((defect, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="px-2 py-2">
                    <select
                      value={defect.defectCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const found = DEFECT_CODES.find((d) => d.code === code);
                        updateDefect(index, {
                          defectCode: code,
                          description: found ? found.description : defect.description,
                        });
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">Select...</option>
                      {DEFECT_CODES.map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.code} - {d.description}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      value={defect.majorCount || ''}
                      onChange={(e) =>
                        updateDefect(index, { majorCount: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 text-center"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      value={defect.minorCount || ''}
                      onChange={(e) =>
                        updateDefect(index, { minorCount: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 text-center"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={defect.description}
                      onChange={(e) => updateDefect(index, { description: e.target.value })}
                      placeholder="Description..."
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <button
                      type="button"
                      onClick={() => removeDefect(index)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-3 py-2 text-xs text-gray-600">TOTALS</td>
                <td className="px-3 py-2 text-center text-sm text-red-600">{totalMajor}</td>
                <td className="px-3 py-2 text-center text-sm text-amber-600">{totalMinor}</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {totalMajor + totalMinor} total defects
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Add Defect button */}
      <button
        type="button"
        onClick={addDefect}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
      >
        <Plus size={16} />
        Add Defect
      </button>
    </div>
  );
}
