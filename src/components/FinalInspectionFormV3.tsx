import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search } from 'lucide-react';
import { getOpsByNumber, getOpsList } from '../lib/firebase';
import { buildArticleSkeletonFromOps } from '../types';
import {
  InspectionFormProviderV3,
  useInspectionFormV3,
} from '../context/InspectionFormContextV3';
import CollapsibleHeader from './v3/CollapsibleHeader';
import ArticleAccordionList from './v3/ArticleAccordionList';
import SubmitOpsRollupButton from './v3/SubmitOpsRollupButton';

interface OpsListItem {
  salesNo: string;
  buyerName: string;
  buyerCode: string;
  poNumber: string;
  totalPcs: number;
  status: string;
}

export function FinalInspectionFormV3() {
  return (
    <InspectionFormProviderV3>
      <FormShell />
    </InspectionFormProviderV3>
  );
}

function FormShell() {
  const { state, dispatch } = useInspectionFormV3();
  const [opsList, setOpsList] = useState<OpsListItem[]>([]);
  const [opsQuery, setOpsQuery] = useState('');
  const [opsLookupLoading, setOpsLookupLoading] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);
  const [showOpsDropdown, setShowOpsDropdown] = useState(false);

  useEffect(() => {
    let alive = true;
    getOpsList()
      .then((list) => {
        if (alive) setOpsList(list);
      })
      .catch(() => {
        /* ignore — search still works via direct lookup */
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadOps = useCallback(
    async (opsNo: string) => {
      if (!opsNo.trim()) return;
      setOpsLookupLoading(true);
      setOpsError(null);
      try {
        const ops = await getOpsByNumber(opsNo.trim());
        if (!ops) {
          setOpsError(`OPS ${opsNo} not found.`);
          return;
        }
        const articles = buildArticleSkeletonFromOps(ops);
        if (articles.length === 0) {
          setOpsError(`OPS ${opsNo} has no articles. Add items in the Orders app first.`);
          return;
        }
        dispatch({
          type: 'SET_GLOBAL_BULK',
          updates: {
            opsNo: ops.salesNo,
            customerName: ops.buyerName,
            customerCode: ops.buyerCode,
            customerPoNo: ops.poNumber,
            totalOrderQty: String(ops.totalPcs ?? 0),
            company: ops.companyCode,
            documentNo: ops.companyCode === 'EHI' ? 'EHI/IP/01' : 'EMPL/IP/01',
          },
        });
        dispatch({ type: 'INIT_FROM_OPS_DATA', articles });
        setShowOpsDropdown(false);
        setOpsQuery(ops.salesNo);
      } catch (e) {
        setOpsError((e as Error).message || 'Failed to load OPS.');
      } finally {
        setOpsLookupLoading(false);
      }
    },
    [dispatch]
  );

  // Show ALL OPS. No slicing — the user expects every OPS in the orders
  // collection to be searchable. Scrolling handles long lists.
  const filtered = opsQuery.trim()
    ? opsList.filter((o) =>
        [o.salesNo, o.buyerName, o.buyerCode, o.poNumber]
          .join(' ')
          .toLowerCase()
          .includes(opsQuery.toLowerCase())
      )
    : opsList;

  return (
    <div className="space-y-3">
      <CollapsibleHeader />

      {/* OPS Lookup */}
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Search size={16} className="text-emerald-700" />
          <h2 className="font-semibold text-emerald-900">OPS Lookup</h2>
        </div>
        <div className="relative">
          <div className="flex gap-2">
            <input
              type="text"
              value={opsQuery}
              onChange={(e) => {
                setOpsQuery(e.target.value);
                setShowOpsDropdown(true);
              }}
              onFocus={() => setShowOpsDropdown(true)}
              placeholder="Search or select OPS number…"
              className="flex-1 px-3 py-2 border border-emerald-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            <button
              type="button"
              onClick={() => loadOps(opsQuery)}
              disabled={opsLookupLoading || !opsQuery.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-md flex items-center gap-1"
            >
              {opsLookupLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              Load
            </button>
          </div>

          {showOpsDropdown && filtered.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg">
              <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100 bg-gray-50 sticky top-0">
                {opsQuery.trim()
                  ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'}`
                  : `Showing all ${opsList.length} OPS`}
              </div>
              {filtered.map((o) => (
                <button
                  key={o.salesNo}
                  type="button"
                  onClick={() => {
                    setOpsQuery(o.salesNo);
                    loadOps(o.salesNo);
                  }}
                  className="w-full px-3 py-2 hover:bg-emerald-50 text-left text-sm border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-mono font-semibold">{o.salesNo}</div>
                  <div className="text-xs text-gray-500">
                    {o.buyerName} ({o.buyerCode}) · PO {o.poNumber} · {o.totalPcs} pcs
                  </div>
                </button>
              ))}
            </div>
          )}
          {showOpsDropdown && opsQuery.trim() && filtered.length === 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg p-3 text-sm text-gray-600">
              No match in the cached list ({opsList.length} OPS). Click Load to
              search Firestore directly by OPS number.
            </div>
          )}
        </div>
        {opsError && <p className="text-sm text-rose-600 mt-2">{opsError}</p>}
        {!opsError && state.articles.length > 0 && (
          <p className="text-xs text-emerald-700 mt-2">
            Loaded {state.articles.length} article
            {state.articles.length === 1 ? '' : 's'} for {state.global.opsNo}.
          </p>
        )}
      </div>

      {/* Article hierarchy */}
      <ArticleAccordionList />

      {/* OPS Roll-up submit */}
      {state.articles.length > 0 && <SubmitOpsRollupButton />}
    </div>
  );
}

export default FinalInspectionFormV3;
