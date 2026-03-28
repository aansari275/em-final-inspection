import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import {
  SizeUnit,
  STANDARD_SIZES_CM,
  STANDARD_SIZES_FEET,
  CUSTOM_OPTIONS_KEYS,
} from '../types';

interface SizeSelectorProps {
  size: string;
  sizeUnit: SizeUnit;
  onSizeChange: (size: string) => void;
  onUnitChange: (unit: SizeUnit) => void;
  disabledSizes?: string[];
}

export default function SizeSelector({
  size,
  sizeUnit,
  onSizeChange,
  onUnitChange,
  disabledSizes = [],
}: SizeSelectorProps) {
  const [customSizesCm, setCustomSizesCm] = useState<string[]>([]);
  const [customSizesFeet, setCustomSizesFeet] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  // Load custom sizes from localStorage
  useEffect(() => {
    try {
      const cm = JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEYS.customSizesCm) || '[]');
      const ft = JSON.parse(localStorage.getItem(CUSTOM_OPTIONS_KEYS.customSizesFeet) || '[]');
      setCustomSizesCm(cm);
      setCustomSizesFeet(ft);
    } catch {
      // ignore
    }
  }, []);

  const allSizes =
    sizeUnit === 'cm'
      ? [...STANDARD_SIZES_CM, ...customSizesCm]
      : [...STANDARD_SIZES_FEET, ...customSizesFeet];

  const addCustomSize = () => {
    const trimmed = customValue.trim();
    if (!trimmed) return;

    const key =
      sizeUnit === 'cm'
        ? CUSTOM_OPTIONS_KEYS.customSizesCm
        : CUSTOM_OPTIONS_KEYS.customSizesFeet;

    const current =
      sizeUnit === 'cm' ? customSizesCm : customSizesFeet;

    if (!current.includes(trimmed) && !(allSizes as readonly string[]).includes(trimmed)) {
      const updated = [...current, trimmed];
      localStorage.setItem(key, JSON.stringify(updated));
      if (sizeUnit === 'cm') setCustomSizesCm(updated);
      else setCustomSizesFeet(updated);
    }

    onSizeChange(trimmed);
    setCustomValue('');
    setShowCustomInput(false);
  };

  return (
    <div>
      {/* Unit toggle */}
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-gray-700">Size</label>
        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => onUnitChange('cm')}
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
            onClick={() => onUnitChange('feet')}
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

      {/* Size chips */}
      <div className="flex flex-wrap gap-2 items-center">
        {allSizes.map((s) => {
          const isSelected = size === s;
          const isDisabled = disabledSizes.includes(s) && !isSelected;
          return (
            <button
              key={s}
              type="button"
              disabled={isDisabled}
              onClick={() => onSizeChange(isSelected ? '' : s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                isSelected
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : isDisabled
                  ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
              }`}
            >
              {s}
            </button>
          );
        })}

        {/* Add Custom */}
        {showCustomInput ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomSize();
                }
                if (e.key === 'Escape') {
                  setShowCustomInput(false);
                  setCustomValue('');
                }
              }}
              placeholder={`e.g. ${sizeUnit === 'cm' ? '180x270' : '6x9'}`}
              className="px-2 py-1.5 text-sm border border-emerald-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none w-28"
              autoFocus
            />
            <button
              type="button"
              onClick={addCustomSize}
              className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setShowCustomInput(false); setCustomValue(''); }}
              className="p-1.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-dashed border-gray-400 text-gray-600 hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Custom
          </button>
        )}
      </div>
    </div>
  );
}
