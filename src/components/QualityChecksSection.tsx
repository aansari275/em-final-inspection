import React, { useState, useRef, useEffect } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import {
  SizeInspectionFormState,
  OkNotOk,
  YesNo,
  MATERIAL_TYPES,
} from '../types';

interface QualityChecksSectionProps {
  sizeData: SizeInspectionFormState;
  sizeIndex: number;
  onFieldChange: (field: string, value: unknown) => void;
  onPhotoChange: (fieldKey: string, file: File | null) => void;
}

// Quality check fields grouped by section
const PRODUCT_QUALITY_CHECKS: Array<{
  key: string;
  label: string;
  type: 'okNotOk' | 'yesNo' | 'dropdown' | 'text' | 'textWithNotes';
}> = [
  { key: 'approvedSampleAvailable', label: 'Approved Sample Available', type: 'yesNo' },
  { key: 'materialFibreContent', label: 'Material/Fibre Content', type: 'dropdown' },
  { key: 'motifDesignCheck', label: 'Motif/Design Check', type: 'okNotOk' },
  { key: 'backing', label: 'Backing', type: 'textWithNotes' },
  { key: 'bindingAndEdges', label: 'Binding & Edges', type: 'okNotOk' },
  { key: 'handFeel', label: 'Hand Feel', type: 'okNotOk' },
  { key: 'embossingCarving', label: 'Embossing/Carving', type: 'okNotOk' },
  { key: 'workmanship', label: 'Workmanship', type: 'okNotOk' },
  { key: 'productQualityWeight', label: 'Product Quality Weight', type: 'okNotOk' },
];

const MEASUREMENT_FIELDS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: 'tuftDensity', label: 'Tuft Density', placeholder: 'e.g. 120,000' },
  { key: 'pileHeight', label: 'Pile Height', placeholder: 'e.g. 15mm' },
  { key: 'productWeight', label: 'Product Weight', placeholder: 'e.g. 3.5 kgs' },
  { key: 'sizeTolerance', label: 'Size Tolerance', placeholder: 'e.g. +/- 2%' },
  { key: 'finishingPercent', label: 'Finishing %', placeholder: 'e.g. 95%' },
  { key: 'packedPercent', label: 'Packed %', placeholder: 'e.g. 100%' },
];

const LABELING_CHECKS: Array<{ key: string; label: string }> = [
  { key: 'labelPlacement', label: 'Label Placement' },
  { key: 'sideMarking', label: 'Side Marking' },
  { key: 'outerMarking', label: 'Outer Marking' },
  { key: 'innerPack', label: 'Inner Pack' },
  { key: 'careLabels', label: 'Care Labels' },
  { key: 'skuStickers', label: 'SKU Stickers' },
  { key: 'upcBarcodes', label: 'UPC Barcodes' },
];

// Inline photo upload button (camera icon with popover)
function InlinePhotoButton({
  fieldKey: _fieldKey,
  fieldLabel,
  isNotOk,
  preview,
  onPhotoChange,
}: {
  fieldKey: string;
  fieldLabel: string;
  isNotOk: boolean;
  preview: string;
  onPhotoChange: (file: File | null) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMenu]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPhotoChange(e.target.files?.[0] || null);
    e.target.value = '';
    setShowMenu(false);
  };

  return (
    <div className="flex items-center">
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt={fieldLabel}
            className="w-10 h-10 object-cover rounded border border-gray-300"
          />
          <button
            type="button"
            onClick={() => onPhotoChange(null)}
            className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full"
          >
            <X size={10} />
          </button>
        </div>
      ) : (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer border ${
              isNotOk
                ? 'border-red-300 text-red-500 hover:bg-red-50'
                : 'border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'
            }`}
          >
            <Camera size={16} />
          </button>

          {showMenu && (
            <div className="absolute z-50 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden w-44 animate-in fade-in slide-in-from-top-1">
              <button
                type="button"
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera size={18} className="text-gray-500" />
                Take Photo
              </button>
              <hr className="border-gray-100" />
              <button
                type="button"
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                onClick={() => galleryRef.current?.click()}
              >
                <ImagePlus size={18} className="text-gray-500" />
                Choose from Gallery
              </button>
            </div>
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      )}
    </div>
  );
}

// OK / NOT OK / NA pill row
function OkNotOkRow({
  fieldKey,
  label,
  value,
  sizeIndex,
  preview,
  onFieldChange,
  onPhotoChange,
}: {
  fieldKey: string;
  label: string;
  value: OkNotOk;
  sizeIndex: number;
  preview: string;
  onFieldChange: (field: string, value: unknown) => void;
  onPhotoChange: (fieldKey: string, file: File | null) => void;
}) {
  const radioName = `size_${sizeIndex}_${fieldKey}`;
  return (
    <div className="flex items-center gap-2 py-2.5">
      <span className="text-sm font-medium text-gray-700 min-w-0 flex-1 truncate">
        {label}
      </span>
      <div className="flex items-center gap-1 shrink-0">
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
                isSelected
                  ? activeClass
                  : `border-gray-200 text-gray-400 ${hoverClass}`
              }`}
            >
              <input
                type="radio"
                name={radioName}
                value={opt}
                checked={isSelected}
                onChange={() => {
                  onFieldChange(fieldKey, opt);
                  if (opt !== 'NOT OK') onPhotoChange(fieldKey, null);
                }}
                className="sr-only"
              />
              {opt}
            </label>
          );
        })}
      </div>
      <InlinePhotoButton
        fieldKey={fieldKey}
        fieldLabel={label}
        isNotOk={value === 'NOT OK'}
        preview={preview}
        onPhotoChange={(file) => onPhotoChange(fieldKey, file)}
      />
    </div>
  );
}

export default function QualityChecksSection({
  sizeData,
  sizeIndex,
  onFieldChange,
  onPhotoChange,
}: QualityChecksSectionProps) {
  return (
    <div className="space-y-6">
      {/* Product Quality Checks */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Product Quality Checks
        </h3>
        <div className="divide-y divide-gray-100">
          {PRODUCT_QUALITY_CHECKS.map(({ key, label, type }) => {
            if (type === 'yesNo') {
              const val = (sizeData as any)[key] as YesNo;
              return (
                <div key={key} className="flex items-center gap-2 py-2.5">
                  <span className="text-sm font-medium text-gray-700 min-w-0 flex-1 truncate">
                    {label}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {(['Yes', 'No'] as YesNo[]).map((opt) => (
                      <label
                        key={opt}
                        className={`flex items-center justify-center px-3 py-1 rounded-md text-xs font-semibold cursor-pointer border transition-colors ${
                          val === opt
                            ? opt === 'Yes'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-red-50 border-red-300 text-red-700'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`size_${sizeIndex}_${key}`}
                          value={opt}
                          checked={val === opt}
                          onChange={() => onFieldChange(key, opt)}
                          className="sr-only"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              );
            }

            if (type === 'dropdown') {
              const val = (sizeData as any)[key] as string;
              return (
                <div key={key} className="flex items-center gap-2 py-2.5">
                  <span className="text-sm font-medium text-gray-700 min-w-0 flex-1 truncate">
                    {label}
                  </span>
                  <select
                    value={val}
                    onChange={(e) => onFieldChange(key, e.target.value)}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="">Select...</option>
                    {MATERIAL_TYPES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (type === 'textWithNotes') {
              const okVal = (sizeData as any)[key] as OkNotOk;
              const notesVal = (sizeData as any)[`${key}Notes`] as string;
              const preview = sizeData.notOkPreviews[key] || '';
              return (
                <div key={key}>
                  <OkNotOkRow
                    fieldKey={key}
                    label={label}
                    value={okVal}
                    sizeIndex={sizeIndex}
                    preview={preview}
                    onFieldChange={onFieldChange}
                    onPhotoChange={onPhotoChange}
                  />
                  <div className="pl-4 pb-2">
                    <input
                      type="text"
                      value={notesVal || ''}
                      onChange={(e) => onFieldChange(`${key}Notes`, e.target.value)}
                      placeholder="Backing notes..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
              );
            }

            // Default: okNotOk
            const okVal = (sizeData as any)[key] as OkNotOk;
            const preview = sizeData.notOkPreviews[key] || '';
            return (
              <OkNotOkRow
                key={key}
                fieldKey={key}
                label={label}
                value={okVal}
                sizeIndex={sizeIndex}
                preview={preview}
                onFieldChange={onFieldChange}
                onPhotoChange={onPhotoChange}
              />
            );
          })}
        </div>
      </div>

      {/* Measurement Details */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Measurement Details
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {MEASUREMENT_FIELDS.map(({ key, label, placeholder }) => {
            const val = (sizeData as any)[key] as string;
            return (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {label}
                </label>
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
        </div>
      </div>

      {/* Labeling & Marking */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Labeling & Marking
        </h3>
        <div className="divide-y divide-gray-100">
          {LABELING_CHECKS.map(({ key, label }) => {
            const okVal = (sizeData as any)[key] as OkNotOk;
            const preview = sizeData.notOkPreviews[key] || '';
            return (
              <OkNotOkRow
                key={key}
                fieldKey={key}
                label={label}
                value={okVal}
                sizeIndex={sizeIndex}
                preview={preview}
                onFieldChange={onFieldChange}
                onPhotoChange={onPhotoChange}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
