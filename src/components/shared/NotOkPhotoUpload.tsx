import React, { useRef, useState, useEffect } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';

interface NotOkPhotoUploadProps {
  fieldKey: string;
  file: File | null;
  preview: string;
  onPhotoChange: (fieldKey: string, file: File | null) => void;
}

export default function NotOkPhotoUpload({
  fieldKey,
  file,
  preview,
  onPhotoChange,
}: NotOkPhotoUploadProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const hasPhoto = !!file || !!preview;

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
    const selectedFile = e.target.files?.[0] ?? null;
    if (selectedFile) {
      onPhotoChange(fieldKey, selectedFile);
      setPopoverOpen(false);
    }
    e.target.value = '';
  }

  function handleRemove() {
    onPhotoChange(fieldKey, null);
  }

  return (
    <div className="relative inline-flex items-center gap-1.5" ref={popoverRef}>
      {/* Thumbnail */}
      {hasPhoto && preview && (
        <div className="relative group">
          <img
            src={preview}
            alt="Evidence"
            className="w-8 h-8 object-cover rounded border border-gray-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove photo"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {/* Camera icon button */}
      <button
        type="button"
        onClick={() => setPopoverOpen(!popoverOpen)}
        className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
          hasPhoto
            ? 'text-green-600 hover:bg-green-50'
            : 'text-gray-400 hover:bg-gray-100'
        }`}
        title="Add evidence photo"
      >
        <Camera size={14} />
      </button>

      {/* Popover */}
      {popoverOpen && (
        <div className="absolute z-50 top-full mt-1 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[150px]">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Camera size={14} className="text-blue-500" />
            Take Photo
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ImagePlus size={14} className="text-purple-500" />
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
