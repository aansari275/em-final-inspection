import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search } from 'lucide-react';
import { getOpsByNumber, getOpsList } from '../lib/firebase';
import { buildArticleSkeletonFromOps, type ArticleInspectionV3 } from '../types';
import {
  InspectionFormProviderV3,
  useInspectionFormV3,
} from '../context/InspectionFormContextV3';
import { loadCloudDraftV3, deleteCloudDraftV3 } from '../lib/v3CloudDraft';
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
      const trimmed = opsNo.trim();

      // CRITICAL GUARD #1: if the user is reloading the SAME OPS that's
      // currently loaded, do nothing — preserve all in-flight work.
      if (
        state.global.opsNo === trimmed &&
        state.articles.length > 0
      ) {
        setShowOpsDropdown(false);
        setOpsQuery(trimmed);
        return;
      }

      // CRITICAL GUARD #2: switching to a DIFFERENT OPS while there is
      // existing work needs explicit confirmation. Even though the reducer
      // merges by name where possible, swapping OPSes wipes structure.
      const hasWork =
        state.articles.length > 0 &&
        state.saveStatus.lastTouchedAt > 0 &&
        !!state.global.opsNo &&
        state.global.opsNo !== trimmed;
      if (hasWork) {
        const ok = window.confirm(
          `You have in-progress work for OPS ${state.global.opsNo}. ` +
            `Loading OPS ${trimmed} will discard it. Continue?`
        );
        if (!ok) {
          setShowOpsDropdown(false);
          setOpsQuery(state.global.opsNo);
          return;
        }
      }

      setOpsLookupLoading(true);
      setOpsError(null);
      try {
        const ops = await getOpsByNumber(trimmed);
        if (!ops) {
          setOpsError(`OPS ${opsNo} not found.`);
          return;
        }
        const skeletonArticles = buildArticleSkeletonFromOps(ops);
        if (skeletonArticles.length === 0) {
          setOpsError(`OPS ${opsNo} has no articles. Add items in the Orders app first.`);
          return;
        }

        // Cloud-draft restore: if this inspector has a cloud draft for this
        // OPS, prefer it over a fresh skeleton — that's the saved tab work.
        // Failures (network down, no draft) silently fall through to skeleton.
        let cloudDraft: { articles: ArticleInspectionV3[]; global: Record<string, string> } | null = null;
        try {
          const saved = await loadCloudDraftV3(ops.salesNo);
          if (
            saved &&
            Array.isArray(saved.articles) &&
            saved.articles.length > 0
          ) {
            cloudDraft = {
              articles: saved.articles as ArticleInspectionV3[],
              global: (saved.global as Record<string, string>) || {},
            };
          }
        } catch {
          /* ignore — fall through to fresh skeleton */
        }

        // Order: start from canonical OPS-derived fields, then overlay the
        // cloud draft's saved values (inspector name, date, any edits), then
        // force opsNo back to what was just selected so it can never drift.
        const opsCanonical = {
          customerName: ops.buyerName,
          customerCode: ops.buyerCode,
          customerPoNo: ops.poNumber,
          totalOrderQty: String(ops.totalPcs ?? 0),
          company: ops.companyCode,
          documentNo: ops.companyCode === 'EHI' ? 'EHI/IP/01' : 'EMPL/IP/01',
        };
        dispatch({
          type: 'SET_GLOBAL_BULK',
          updates: {
            ...opsCanonical,
            ...(cloudDraft?.global ?? {}),
            opsNo: ops.salesNo,
          },
        });
        if (cloudDraft) {
          dispatch({
            type: 'HYDRATE_FROM_SAVED',
            global: {},
            articles: cloudDraft.articles,
          });
        } else {
          dispatch({ type: 'INIT_FROM_OPS_DATA', articles: skeletonArticles });
        }
        setShowOpsDropdown(false);
        setOpsQuery(ops.salesNo);
      } catch (e) {
        setOpsError((e as Error).message || 'Failed to load OPS.');
      } finally {
        setOpsLookupLoading(false);
      }
    },
    [dispatch, state.global.opsNo, state.articles.length, state.saveStatus.lastTouchedAt]
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
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-emerald-700">
              Loaded {state.articles.length} article
              {state.articles.length === 1 ? '' : 's'} for {state.global.opsNo}.
            </p>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Discard current draft and start a fresh inspection? This clears autosaved data.'
                  )
                ) {
                  // Delete the cloud draft — otherwise reopening this OPS
                  // would silently restore the discarded work.
                  const opsToClear = state.global.opsNo;
                  if (opsToClear) {
                    void deleteCloudDraftV3(opsToClear);
                  }
                  // Belt and suspenders: clear any legacy localStorage key
                  // from before the cloud-only migration so stale browsers
                  // don't accidentally revive old text via that path.
                  try {
                    localStorage.removeItem('final_inspection_v3_draft');
                  } catch {
                    /* ignore */
                  }
                  dispatch({ type: 'RESET' });
                  setOpsQuery('');
                  setOpsError(null);
                }
              }}
              className="text-xs text-rose-600 hover:text-rose-700 underline"
            >
              Start new inspection
            </button>
          </div>
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
