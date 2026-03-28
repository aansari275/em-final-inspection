import React, { useState, useRef, useEffect } from 'react';
import { Camera, ImagePlus, Plus, X, AlertCircle } from 'lucide-react';
import {
  SizeInspectionFormState,
  LabeledPhoto,
  PHOTO_TYPES,
  CONSTRUCTION_PHOTO_TYPES,
  CONSUMER_PIECE_LABELS,
  UNIT_LOAD_LABELS,
  CUSTOM_OPTIONS_KEYS,
} from '../types';

interface PhotosSectionProps {
  sizeData: SizeInspectionFormState;
  sizeIndex: number;
  onStandardPhotoChange: (key: string, file: File | null) => void;
  onConstructionPhotoChange: (key: string, file: File | null) => void;
  onOtherPhotosChange: (files: FileList | null) => void;
  onRemoveOtherPhoto: (index: number) => void;
  onStackedGoodsChange: (file: File | null) => void;
  // Consumer pieces
  onAddConsumerPiece: () => void;
  onUpdateConsumerPiece: (index: number, updates: Partial<LabeledPhoto>) => void;
  onRemoveConsumerPiece: (index: number) => void;
  onConsumerPiecePhoto: (index: number, file: File | null) => void;
  // Unit load
  onToggleUnitLoad: (enabled: boolean) => void;
  onAddUnitLoadPhoto: () => void;
  onUpdateUnitLoadPhoto: (index: number, updates: Partial<LabeledPhoto>) => void;
  onRemoveUnitLoadPhoto: (index: number) => void;
  onUnitLoadPhotoChange: (index: number, file: File | null) => void;
}

// Self-contained photo input with camera popover
function PhotoInput({
  preview,
  onFileSelect,
  onRemove,
  className = 'w-full h-32',
  iconSize = 24,
  showLabel = true,
  labelText = 'Take Photo',
  multiple = false,
}: {
  preview?: string;
  onFileSelect: (files: FileList | null) => void;
  onRemove?: () => void;
  className?: string;
  iconSize?: number;
  showLabel?: boolean;
  labelText?: string;
  multiple?: boolean;
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e.target.files);
    e.target.value = '';
    setShowMenu(false);
  };

  if (preview) {
    return (
      <div className={`relative ${className}`}>
        <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <Camera size={iconSize} className="text-gray-400" />
        {showLabel && <span className="text-xs text-gray-500 mt-1">{labelText}</span>}
      </button>

      {showMenu && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden w-44 animate-in fade-in slide-in-from-top-1">
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
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

// Labeled photo card (consumer pieces + unit load)
function LabeledPhotoCard({
  piece,
  index: _index,
  labels,
  customLabels,
  onAddCustomLabel,
  onUpdate,
  onRemove,
  onPhotoSelect,
}: {
  piece: LabeledPhoto;
  index: number;
  labels: readonly string[];
  customLabels: string[];
  onAddCustomLabel: (label: string) => void;
  onUpdate: (updates: Partial<LabeledPhoto>) => void;
  onRemove: () => void;
  onPhotoSelect: (file: File | null) => void;
}) {
  return (
    <div className="w-40 border border-gray-200 rounded-lg p-3">
      {/* Label Dropdown */}
      <div className="mb-2">
        <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
          <select
            value={piece.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="flex-1 px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-0 focus:outline-none"
          >
            <option value="">Select label...</option>
            {[...labels, ...customLabels].map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const newLabel = prompt('Enter new label:');
              if (newLabel && newLabel.trim()) {
                onAddCustomLabel(newLabel.trim());
                onUpdate({ label: newLabel.trim() });
              }
            }}
            className="px-2 py-1.5 border-l border-gray-300 text-emerald-600 hover:bg-emerald-50"
            title="Add custom label"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Photo */}
      {piece.preview ? (
        <div className="relative">
          <img
            src={piece.preview}
            alt={piece.label || 'Photo'}
            className={`w-full h-28 object-cover rounded-lg ${
              !piece.file ? 'border-2 border-amber-400' : ''
            }`}
          />
          {!piece.file && (
            <div className="absolute bottom-1 left-1 right-1 bg-amber-100 text-amber-800 text-xs px-1 py-0.5 rounded flex items-center gap-1">
              <AlertCircle size={10} />
              <span>Re-select to upload</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onPhotoSelect(null)}
            className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <PhotoInput
          onFileSelect={(files) => onPhotoSelect(files?.[0] || null)}
          className="w-full h-28"
          iconSize={20}
          showLabel={true}
        />
      )}

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="mt-2 w-full text-xs text-red-600 hover:text-red-700"
      >
        Remove
      </button>
    </div>
  );
}

export default function PhotosSection({
  sizeData,
  sizeIndex: _sizeIndex,
  onStandardPhotoChange,
  onConstructionPhotoChange,
  onOtherPhotosChange,
  onRemoveOtherPhoto,
  onStackedGoodsChange,
  onAddConsumerPiece,
  onUpdateConsumerPiece,
  onRemoveConsumerPiece,
  onConsumerPiecePhoto,
  onToggleUnitLoad,
  onAddUnitLoadPhoto,
  onUpdateUnitLoadPhoto,
  onRemoveUnitLoadPhoto,
  onUnitLoadPhotoChange,
}: PhotosSectionProps) {
  const [customConsumerLabels, setCustomConsumerLabels] = useState<string[]>([]);
  const [customUnitLoadLabels, setCustomUnitLoadLabels] = useState<string[]>([]);

  // Load custom labels from localStorage
  useEffect(() => {
    try {
      const cl = JSON.parse(
        localStorage.getItem(CUSTOM_OPTIONS_KEYS.consumerPieceLabels) || '[]'
      );
      const ul = JSON.parse(
        localStorage.getItem(CUSTOM_OPTIONS_KEYS.unitLoadLabels) || '[]'
      );
      setCustomConsumerLabels(cl);
      setCustomUnitLoadLabels(ul);
    } catch {
      // ignore
    }
  }, []);

  const addCustomConsumerLabel = (label: string) => {
    if (!customConsumerLabels.includes(label)) {
      const updated = [...customConsumerLabels, label];
      setCustomConsumerLabels(updated);
      localStorage.setItem(CUSTOM_OPTIONS_KEYS.consumerPieceLabels, JSON.stringify(updated));
    }
  };

  const addCustomUnitLoadLabel = (label: string) => {
    if (!customUnitLoadLabels.includes(label)) {
      const updated = [...customUnitLoadLabels, label];
      setCustomUnitLoadLabels(updated);
      localStorage.setItem(CUSTOM_OPTIONS_KEYS.unitLoadLabels, JSON.stringify(updated));
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Stacked Goods */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Stacked Goods
        </h3>
        <PhotoInput
          preview={sizeData.stackedGoodsPreview}
          onFileSelect={(files) => onStackedGoodsChange(files?.[0] || null)}
          onRemove={() => onStackedGoodsChange(null)}
          className="w-full max-w-xs h-40"
          iconSize={24}
          showLabel={true}
          labelText="Stacked Goods Photo"
        />
      </div>

      {/* 2. Consumer Pieces */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Packed Consumer Pieces
        </h3>
        <div className="flex flex-wrap gap-4">
          {sizeData.consumerPiecesForm.map((piece, index) => (
            <LabeledPhotoCard
              key={index}
              piece={piece}
              index={index}
              labels={CONSUMER_PIECE_LABELS}
              customLabels={customConsumerLabels}
              onAddCustomLabel={addCustomConsumerLabel}
              onUpdate={(updates) => onUpdateConsumerPiece(index, updates)}
              onRemove={() => onRemoveConsumerPiece(index)}
              onPhotoSelect={(file) => onConsumerPiecePhoto(index, file)}
            />
          ))}
          <button
            type="button"
            onClick={onAddConsumerPiece}
            className="w-40 h-48 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
          >
            <Plus className="w-8 h-8 text-gray-400" />
            <span className="text-sm text-gray-500 mt-2">Add More</span>
          </button>
        </div>
      </div>

      {/* 3. Unit Load */}
      <div className="border-t border-gray-200 pt-4">
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={sizeData.unitLoadEnabled}
            onChange={(e) => onToggleUnitLoad(e.target.checked)}
            className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-gray-700">Unit Load Applicable</span>
        </label>

        {sizeData.unitLoadEnabled && (
          <div className="ml-8">
            <div className="flex flex-wrap gap-4">
              {sizeData.unitLoadPhotosForm.map((photo, index) => (
                <LabeledPhotoCard
                  key={index}
                  piece={photo}
                  index={index}
                  labels={UNIT_LOAD_LABELS}
                  customLabels={customUnitLoadLabels}
                  onAddCustomLabel={addCustomUnitLoadLabel}
                  onUpdate={(updates) => onUpdateUnitLoadPhoto(index, updates)}
                  onRemove={() => onRemoveUnitLoadPhoto(index)}
                  onPhotoSelect={(file) => onUnitLoadPhotoChange(index, file)}
                />
              ))}
              <button
                type="button"
                onClick={onAddUnitLoadPhoto}
                className="w-40 h-48 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
              >
                <Plus className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-500 mt-2">Add More</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Standard Photos */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Standard Photos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PHOTO_TYPES.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <PhotoInput
                preview={sizeData.standardPhotoPreviews[key]}
                onFileSelect={(files) => onStandardPhotoChange(key, files?.[0] || null)}
                onRemove={() => onStandardPhotoChange(key, null)}
                className="w-full h-32"
                iconSize={24}
                showLabel={true}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 5. Construction Photos */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Construction Photos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {CONSTRUCTION_PHOTO_TYPES.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <PhotoInput
                preview={sizeData.constructionPhotoPreviews[key]}
                onFileSelect={(files) => onConstructionPhotoChange(key, files?.[0] || null)}
                onRemove={() => onConstructionPhotoChange(key, null)}
                className="w-full h-32"
                iconSize={24}
                showLabel={true}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 6. Other Photos */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Other Photos
        </h3>
        <div className="flex flex-wrap gap-3 mb-3">
          {sizeData.otherPhotoPreviews.map((preview, i) => (
            <div key={i} className="relative">
              <img
                src={preview}
                alt={`Other ${i + 1}`}
                className="w-24 h-24 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => onRemoveOtherPhoto(i)}
                className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <PhotoInput
          onFileSelect={(files) => onOtherPhotosChange(files)}
          className="w-full max-w-xs h-24"
          iconSize={20}
          showLabel={true}
          labelText="Add Photos"
          multiple={true}
        />
      </div>
    </div>
  );
}
