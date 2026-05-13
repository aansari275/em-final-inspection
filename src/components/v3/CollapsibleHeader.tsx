import { ChevronDown, ChevronUp } from 'lucide-react';
import { useInspectionFormV3 } from '../../context/InspectionFormContextV3';
import { COMPANY_NAMES, QC_INSPECTORS } from '../../types';

interface Props {
  onCompanyChange?: (company: 'EHI' | 'EMPL') => void;
}

export default function CollapsibleHeader({ onCompanyChange }: Props) {
  const { state, dispatch } = useInspectionFormV3();
  const g = state.global;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-3 overflow-hidden">
      {/* Collapsed summary row (always visible) */}
      <button
        type="button"
        onClick={() => dispatch({ type: 'TOGGLE_HEADER' })}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold text-emerald-700">{g.company}</span>
            <span className="text-gray-400">·</span>
            <span className="font-bold">{g.opsNo || '(no OPS)'}</span>
            {g.customerName && (
              <>
                <span className="text-gray-400">·</span>
                <span>{g.customerName}</span>
              </>
            )}
            {g.customerPoNo && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">PO {g.customerPoNo}</span>
              </>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {g.inspectionDate}
            {g.qcInspectorName ? ` · Inspector: ${g.qcInspectorName}` : ''}
            {g.merchant ? ` · Merchant: ${g.merchant}` : ''}
            {g.totalOrderQty ? ` · ${g.totalOrderQty} pcs` : ''}
          </div>
        </div>
        <div className="ml-2 text-gray-400 flex-shrink-0">
          {state.headerExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expanded edit area */}
      {state.headerExpanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Company
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['EHI', 'EMPL'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'SET_GLOBAL', field: 'company', value: c });
                    dispatch({
                      type: 'SET_GLOBAL',
                      field: 'documentNo',
                      value: c === 'EHI' ? 'EHI/IP/01' : 'EMPL/IP/01',
                    });
                    onCompanyChange?.(c);
                  }}
                  className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                    g.company === c
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold">{c}</div>
                  <div className="text-[10px] opacity-70">{COMPANY_NAMES[c]}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Date
              </label>
              <input
                type="date"
                value={g.inspectionDate}
                onChange={(e) =>
                  dispatch({ type: 'SET_GLOBAL', field: 'inspectionDate', value: e.target.value })
                }
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                QC Inspector
              </label>
              <select
                value={g.qcInspectorName}
                onChange={(e) =>
                  dispatch({ type: 'SET_GLOBAL', field: 'qcInspectorName', value: e.target.value })
                }
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
              >
                <option value="">Select...</option>
                {QC_INSPECTORS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Document No.
            </label>
            <input
              value={g.documentNo}
              onChange={(e) =>
                dispatch({ type: 'SET_GLOBAL', field: 'documentNo', value: e.target.value })
              }
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}
