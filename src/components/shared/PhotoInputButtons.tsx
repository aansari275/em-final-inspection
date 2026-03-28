import React, { useRef, useState, useEffect } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';

interface PhotoInputButtonsProps {
  onPhotoSelected: (file: File) => void;
  hasPhoto: boolean;
  previewUrl?: string;
  onRemove?: () => void;
  label?: string;
  compact?: boolean;
}

export default function PhotoInputButtons({
  onPhotoSelected,
  hasPhoto,
  previewUrl,
  onRemove,
  label,
  compact = false,
}: PhotoInputButtonsProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverOpen]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onPhotoSelected(file);
      setPopoverOpen(false);
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  const buttonSize = compact ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = compact ? 16 : 20;

  return (
    <div className="relative inline-flex items-center gap-2" ref={popoverRef}>
      {/* Thumbnail preview */}
      {hasPhoto && previewUrl && (
        <div className="relative group">
          <img
            src={previewUrl}
            alt={label || 'Photo'}
            className={`${compact ? 'w-10 h-10' : 'w-14 h-14'} object-cover rounded-md border border-gray-200`}
          />
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              title="Remove photo"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      {/* Camera button */}
      <button
        type="button"
        onClick={() => setPopoverOpen(!popoverOpen)}
        className={`${buttonSize} flex items-center justify-center rounded-lg border transition-colors ${
          hasPhoto
            ? 'border-green-300 bg-green-50 text-green-600 hover:bg-green-100'
            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
        }`}
        title={label || 'Add photo'}
      >
        <Camera size={iconSize} />
      </button>

      {/* Popover */}
      {popoverOpen && (
        <div className="absolute z-50 top-full mt-1 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Camera size={16} className="text-blue-500" />
            Take Photo
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ImagePlus size={16} className="text-purple-500" />
            Choose from Gallery
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
