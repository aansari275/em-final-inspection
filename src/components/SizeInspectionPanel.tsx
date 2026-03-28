import React, { useCallback, useMemo, useRef } from 'react';
import {
  ChevronDown,
  Trash2,
  CheckCircle2,
  XCircle,
  Camera,
  AlertTriangle,
} from 'lucide-react';
import { SizeInspectionFormState, LabeledPhoto, Defect, SizeUnit, PHOTO_TYPES, CONSTRUCTION_PHOTO_TYPES } from '../types';
import SizeSelector from './SizeSelector';
import QualityChecksSection from './QualityChecksSection';
import PackagingSection from './PackagingSection';
import DefectsSection from './DefectsSection';
import PhotosSection from './PhotosSection';
import ResultSection from './ResultSection';

interface SizeInspectionPanelProps {
  sizeData: SizeInspectionFormState;
  sizeIndex: number;
  isActive: boolean;
  totalSizes: number;
  onToggle: () => void;
  onRemove: () => void;
  dispatch: (action: any) => void;
}

// Count all photos for a size entry
function countPhotos(sizeData: SizeInspectionFormState): number {
  let count = 0;
  if (sizeData.stackedGoodsPhoto) count++;
  for (const pt of PHOTO_TYPES) {
    if (sizeData.standardPhotos[pt.key]) count++;
  }
  for (const pt of CONSTRUCTION_PHOTO_TYPES) {
    if (sizeData.constructionPhotos[pt.key]) count++;
  }
  count += sizeData.otherPhotos.length;
  count += sizeData.consumerPiecesForm.filter((p) => p.file).length;
  if (sizeData.unitLoadEnabled) {
    count += sizeData.unitLoadPhotosForm.filter((p) => p.file).length;
  }
  for (const key of Object.keys(sizeData.notOkPhotosForm)) {
    if (sizeData.notOkPhotosForm[key]) count++;
  }
  return count;
}

function countDefects(sizeData: SizeInspectionFormState): number {
  return sizeData.defects.reduce(
    (sum, d) => sum + (d.majorCount || 0) + (d.minorCount || 0),
    0
  );
}

// Helper to read a File as data URL for preview
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

const SizeInspectionPanel = React.memo(function SizeInspectionPanel({
  sizeData,
  sizeIndex,
  isActive,
  totalSizes,
  onToggle,
  onRemove,
  dispatch,
}: SizeInspectionPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // ─── Field change (text/select fields) ───
  const onFieldChange = useCallback(
    (field: string, value: unknown) => {
      dispatch({ type: 'SET_SIZE_FIELD', index: sizeIndex, field, value });
    },
    [dispatch, sizeIndex]
  );

  // ─── NOT OK photo change (from quality checks) ───
  const onPhotoChange = useCallback(
    async (fieldKey: string, file: File | null) => {
      const preview = file ? await readFileAsDataURL(file) : '';
      dispatch({
        type: 'SET_SIZE_PHOTO',
        index: sizeIndex,
        photoType: fieldKey,
        category: 'notOk',
        file,
        preview,
      });
    },
    [dispatch, sizeIndex]
  );

  const onSizeChange = useCallback(
    (size: string) => {
      dispatch({ type: 'SET_SIZE_FIELD', index: sizeIndex, field: 'size', value: size });
    },
    [dispatch, sizeIndex]
  );

  const onUnitChange = useCallback(
    (unit: SizeUnit) => {
      dispatch({ type: 'SET_SIZE_FIELD', index: sizeIndex, field: 'sizeUnit', value: unit });
    },
    [dispatch, sizeIndex]
  );

  const onDefectsChange = useCallback(
    (defects: Defect[]) => {
      dispatch({ type: 'SET_SIZE_DEFECTS', index: sizeIndex, defects });
    },
    [dispatch, sizeIndex]
  );

  // ─── Standard photo change ───
  const onStandardPhotoChange = useCallback(
    async (key: string, file: File | null) => {
      const preview = file ? await readFileAsDataURL(file) : '';
      dispatch({
        type: 'SET_SIZE_PHOTO',
        index: sizeIndex,
        photoType: key,
        category: 'standard',
        file,
        preview,
      });
    },
    [dispatch, sizeIndex]
  );

  // ─── Construction photo change ───
  const onConstructionPhotoChange = useCallback(
    async (key: string, file: File | null) => {
      const preview = file ? await readFileAsDataURL(file) : '';
      dispatch({
        type: 'SET_SIZE_PHOTO',
        index: sizeIndex,
        photoType: key,
        category: 'construction',
        file,
        preview,
      });
    },
    [dispatch, sizeIndex]
  );

  // ─── Other photos (multi-file) ───
  const onOtherPhotosChange = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      for (const file of Array.from(files)) {
        const preview = await readFileAsDataURL(file);
        dispatch({
          type: 'ADD_SIZE_OTHER_PHOTO',
          index: sizeIndex,
          file,
          preview,
        });
      }
    },
    [dispatch, sizeIndex]
  );

  const onRemoveOtherPhoto = useCallback(
    (photoIndex: number) => {
      dispatch({ type: 'REMOVE_SIZE_OTHER_PHOTO', index: sizeIndex, photoIndex });
    },
    [dispatch, sizeIndex]
  );

  // ─── Stacked goods photo ───
  const onStackedGoodsChange = useCallback(
    async (file: File | null) => {
      const preview = file ? await readFileAsDataURL(file) : '';
      dispatch({
        type: 'SET_SIZE_PHOTO',
        index: sizeIndex,
        photoType: 'stackedGoods',
        category: 'stackedGoods',
        file,
        preview,
      });
    },
    [dispatch, sizeIndex]
  );

  // ─── Consumer pieces ───
  const onAddConsumerPiece = useCallback(
    () => dispatch({
      type: 'ADD_CONSUMER_PIECE',
      index: sizeIndex,
      piece: { label: '', preview: '' } as LabeledPhoto,
    }),
    [dispatch, sizeIndex]
  );

  const onUpdateConsumerPiece = useCallback(
    (pieceIndex: number, updates: Partial<LabeledPhoto>) => {
      const current = sizeData.consumerPiecesForm[pieceIndex];
      dispatch({
        type: 'UPDATE_CONSUMER_PIECE',
        index: sizeIndex,
        pieceIndex,
        piece: { ...current, ...updates },
      });
    },
    [dispatch, sizeIndex, sizeData.consumerPiecesForm]
  );

  const onRemoveConsumerPiece = useCallback(
    (pieceIndex: number) => {
      dispatch({ type: 'REMOVE_CONSUMER_PIECE', index: sizeIndex, pieceIndex });
    },
    [dispatch, sizeIndex]
  );

  const onConsumerPiecePhoto = useCallback(
    async (pieceIndex: number, file: File | null) => {
      const preview = file ? await readFileAsDataURL(file) : '';
      const current = sizeData.consumerPiecesForm[pieceIndex];
      dispatch({
        type: 'UPDATE_CONSUMER_PIECE',
        index: sizeIndex,
        pieceIndex,
        piece: { ...current, file: file || undefined, preview },
      });
    },
    [dispatch, sizeIndex, sizeData.consumerPiecesForm]
  );

  // ─── Unit load ───
  const onToggleUnitLoad = useCallback(
    (enabled: boolean) => {
      dispatch({ type: 'SET_SIZE_FIELD', index: sizeIndex, field: 'unitLoadEnabled', value: enabled });
    },
    [dispatch, sizeIndex]
  );

  const onAddUnitLoadPhoto = useCallback(
    () => dispatch({
      type: 'ADD_UNIT_LOAD_PHOTO',
      index: sizeIndex,
      photo: { label: '', preview: '' } as LabeledPhoto,
    }),
    [dispatch, sizeIndex]
  );

  const onUpdateUnitLoadPhoto = useCallback(
    (photoIndex: number, updates: Partial<LabeledPhoto>) => {
      const current = sizeData.unitLoadPhotosForm[photoIndex];
      dispatch({
        type: 'UPDATE_UNIT_LOAD_PHOTO',
        index: sizeIndex,
        photoIndex,
        photo: { ...current, ...updates },
      });
    },
    [dispatch, sizeIndex, sizeData.unitLoadPhotosForm]
  );

  const onRemoveUnitLoadPhoto = useCallback(
    (photoIndex: number) => {
      dispatch({ type: 'REMOVE_UNIT_LOAD_PHOTO', index: sizeIndex, photoIndex });
    },
    [dispatch, sizeIndex]
  );

  const onUnitLoadPhotoChange = useCallback(
    async (photoIndex: number, file: File | null) => {
      const preview = file ? await readFileAsDataURL(file) : '';
      const current = sizeData.unitLoadPhotosForm[photoIndex];
      dispatch({
        type: 'UPDATE_UNIT_LOAD_PHOTO',
        index: sizeIndex,
        photoIndex,
        photo: { ...current, file: file || undefined, preview },
      });
    },
    [dispatch, sizeIndex, sizeData.unitLoadPhotosForm]
  );

  // ─── Computed stats for collapsed header ───
  const photoCount = useMemo(() => countPhotos(sizeData), [sizeData]);
  const defectCount = useMemo(() => countDefects(sizeData), [sizeData]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
            isActive ? 'rotate-180' : ''
          }`}
        />
        <div className="flex-1 text-left">
          <span className="font-semibold text-gray-800">
            {sizeData.size
              ? `${sizeData.size} ${sizeData.sizeUnit}`
              : `Size ${sizeIndex + 1} (not selected)`}
          </span>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2">
          {sizeData.inspectionResult === 'PASS' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
              <CheckCircle2 size={12} />
              PASS
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              <XCircle size={12} />
              FAIL
            </span>
          )}

          {photoCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
              <Camera size={12} />
              {photoCount}
            </span>
          )}

          {defectCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">
              <AlertTriangle size={12} />
              {defectCount}
            </span>
          )}
        </div>

        {/* Remove button */}
        {totalSizes > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Remove this size inspection?')) onRemove();
            }}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
            title="Remove size"
          >
            <Trash2 size={16} />
          </button>
        )}
      </button>

      {/* Expandable content with smooth animation */}
      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{
          gridTemplateRows: isActive ? '1fr' : '0fr',
        }}
      >
        <div className="overflow-hidden">
          <div ref={contentRef} className="px-4 pb-4 space-y-6 border-t border-gray-100 pt-4">
            {/* Size Selector */}
            <SizeSelector
              size={sizeData.size}
              sizeUnit={sizeData.sizeUnit}
              onSizeChange={onSizeChange}
              onUnitChange={onUnitChange}
            />

            {/* Quality Checks */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                Quality Checks
              </h3>
              <QualityChecksSection
                sizeData={sizeData}
                sizeIndex={sizeIndex}
                onFieldChange={onFieldChange}
                onPhotoChange={onPhotoChange}
              />
            </div>

            {/* Packaging */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3">Packaging</h3>
              <PackagingSection
                sizeData={sizeData}
                sizeIndex={sizeIndex}
                onFieldChange={onFieldChange}
              />
            </div>

            {/* Defects */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3">Defect Tracking</h3>
              <DefectsSection
                sizeData={sizeData}
                sizeIndex={sizeIndex}
                onFieldChange={onFieldChange}
                onDefectsChange={onDefectsChange}
              />
            </div>

            {/* Photos */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Photos
              </h3>
              <PhotosSection
                sizeData={sizeData}
                sizeIndex={sizeIndex}
                onStandardPhotoChange={onStandardPhotoChange}
                onConstructionPhotoChange={onConstructionPhotoChange}
                onOtherPhotosChange={onOtherPhotosChange}
                onRemoveOtherPhoto={onRemoveOtherPhoto}
                onStackedGoodsChange={onStackedGoodsChange}
                onAddConsumerPiece={onAddConsumerPiece}
                onUpdateConsumerPiece={onUpdateConsumerPiece}
                onRemoveConsumerPiece={onRemoveConsumerPiece}
                onConsumerPiecePhoto={onConsumerPiecePhoto}
                onToggleUnitLoad={onToggleUnitLoad}
                onAddUnitLoadPhoto={onAddUnitLoadPhoto}
                onUpdateUnitLoadPhoto={onUpdateUnitLoadPhoto}
                onRemoveUnitLoadPhoto={onRemoveUnitLoadPhoto}
                onUnitLoadPhotoChange={onUnitLoadPhotoChange}
              />
            </div>

            {/* Result */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3">Result</h3>
              <ResultSection
                sizeData={sizeData}
                sizeIndex={sizeIndex}
                onFieldChange={onFieldChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SizeInspectionPanel;
