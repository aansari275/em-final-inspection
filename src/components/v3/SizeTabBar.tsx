import type { ColorInspectionV3 } from '../../types';
import { useInspectionFormV3 } from '../../context/InspectionFormContextV3';

interface Props {
  color: ColorInspectionV3;
}

export default function SizeTabBar({ color }: Props) {
  const { state, dispatch } = useInspectionFormV3();
  const activeSizeId = state.activeSizeIdByColor[color.id];

  if (color.sizes.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-gray-500 italic">
        No sizes for this color in the OPS.
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex overflow-x-auto scrollbar-thin px-2">
        {color.sizes.map((s) => {
          const active = s.id === activeSizeId;
          const status = sizeStatus(s.inspectionResult, hasAnyData(s));
          return (
            <button
              key={s.id}
              type="button"
              onClick={() =>
                dispatch({ type: 'SELECT_SIZE_TAB', colorId: color.id, sizeId: s.id })
              }
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.size || '(no size)'}
              {status === 'pass' && <span className="ml-1.5 text-emerald-600">✓</span>}
              {status === 'fail' && <span className="ml-1.5 text-rose-600">✗</span>}
              {status === 'progress' && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function sizeStatus(
  result: 'PASS' | 'FAIL' | undefined | string,
  touched: boolean
): 'idle' | 'progress' | 'pass' | 'fail' {
  if (result === 'PASS') return 'pass';
  if (result === 'FAIL') return 'fail';
  if (touched) return 'progress';
  return 'idle';
}

function hasAnyData(s: { defects: unknown[]; productWeight: string; netWeight: string; size: string }): boolean {
  return !!(s.productWeight || s.netWeight || (s.defects && s.defects.length > 0));
}
