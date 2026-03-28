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
        className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-emerald-50 border-2 border-dashed border-emerald-400 rounded-xl text-emerald-700 font-semibold text-lg hover:bg-emerald-100 hover:border-emerald-500 active:bg-emerald-200 transition-all shadow-sm"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
        Add One More Size
      </button>
    </div>
  );
}
