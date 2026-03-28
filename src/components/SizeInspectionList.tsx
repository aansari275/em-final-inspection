import { useCallback } from 'react';
import { Plus } from 'lucide-react';
import { SizeInspectionFormState } from '../types';
import SizeInspectionPanel from './SizeInspectionPanel';

interface SizeInspectionListProps {
  sizeInspections: SizeInspectionFormState[];
  activeSizeIndex: number;
  dispatch: (action: any) => void;
}

export default function SizeInspectionList({
  sizeInspections,
  activeSizeIndex,
  dispatch,
}: SizeInspectionListProps) {
  const handleToggle = useCallback(
    (index: number) => {
      dispatch({
        type: 'SET_ACTIVE_SIZE',
        index: activeSizeIndex === index ? -1 : index,
      });
    },
    [dispatch, activeSizeIndex]
  );

  const handleRemove = useCallback(
    (index: number) => {
      dispatch({ type: 'REMOVE_SIZE', index });
    },
    [dispatch]
  );

  const handleAdd = useCallback(() => {
    dispatch({ type: 'ADD_SIZE' });
  }, [dispatch]);

  return (
    <div className="space-y-3">
      {sizeInspections.map((sizeData, index) => (
        <SizeInspectionPanel
          key={sizeData.id}
          sizeData={sizeData}
          sizeIndex={index}
          isActive={activeSizeIndex === index}
          totalSizes={sizeInspections.length}
          onToggle={() => handleToggle(index)}
          onRemove={() => handleRemove(index)}
          dispatch={dispatch}
        />
      ))}

      {/* Add Size button */}
      <button
        type="button"
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-emerald-300 rounded-lg text-emerald-600 font-medium hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Add One More Size
      </button>
    </div>
  );
}
