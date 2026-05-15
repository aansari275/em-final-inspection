import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  type ArticleInspectionV3,
  type ArticleAql,
  type SizeInspectionFormState,
  type Company,
  type LabeledPhoto,
  type Defect,
} from '../types';
import { saveCloudDraftV3 } from '../lib/v3CloudDraft';

// ─── Global form data (filled once, header) ───
export interface GlobalFormDataV3 {
  company: Company;
  documentNo: string;
  inspectionDate: string;
  qcInspectorName: string;
  customerName: string;
  customerCode: string;
  customerPoNo: string;
  opsNo: string;
  buyerDesignName: string;
  emplDesignNo: string;
  merchant: string;
  totalOrderQty: string;
}

export interface SaveStatusV3 {
  lastTouchedAt: number;  // ms timestamp of last data edit (0 = clean)
  lastSavedAt: number;    // ms timestamp of last successful save
  saving: boolean;        // mid-save flag
  error: string | null;   // last save error
}

export interface InspectionFormStateV3 {
  global: GlobalFormDataV3;
  articles: ArticleInspectionV3[];
  activeArticleId: string | null;
  activeColorIdByArticle: Record<string, string | null>;
  activeSizeIdByColor: Record<string, string | null>;
  headerExpanded: boolean;
  loading: boolean;
  submitInFlight: Record<string, boolean>;
  saveStatus: SaveStatusV3;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function createInitialStateV3(): InspectionFormStateV3 {
  return {
    global: {
      company: 'EHI',
      documentNo: 'EHI/IP/01',
      inspectionDate: todayISO(),
      qcInspectorName: '',
      customerName: '',
      customerCode: '',
      customerPoNo: '',
      opsNo: '',
      buyerDesignName: '',
      emplDesignNo: '',
      merchant: '',
      totalOrderQty: '',
    },
    articles: [],
    saveStatus: { lastTouchedAt: 0, lastSavedAt: 0, saving: false, error: null },
    activeArticleId: null,
    activeColorIdByArticle: {},
    activeSizeIdByColor: {},
    headerExpanded: false,
    loading: false,
    submitInFlight: {},
  };
}

// ─── Actions ───
type ActionV3 =
  | { type: 'SET_GLOBAL'; field: keyof GlobalFormDataV3; value: string }
  | { type: 'SET_GLOBAL_BULK'; updates: Partial<GlobalFormDataV3> }
  | { type: 'INIT_FROM_OPS_DATA'; articles: ArticleInspectionV3[] }
  | {
      type: 'HYDRATE_FROM_SAVED';
      global: Partial<GlobalFormDataV3>;
      articles: ArticleInspectionV3[];
    }
  | { type: 'EXPAND_ARTICLE'; articleId: string | null }
  | { type: 'EXPAND_COLOR'; articleId: string; colorId: string | null }
  | { type: 'SELECT_SIZE_TAB'; colorId: string; sizeId: string }
  | {
      type: 'UPDATE_SIZE_FIELD';
      articleId: string;
      colorId: string;
      sizeId: string;
      field: string;
      value: unknown;
    }
  | {
      type: 'UPDATE_SIZE_PATCH';
      articleId: string;
      colorId: string;
      sizeId: string;
      patch: Partial<SizeInspectionFormState>;
    }
  | { type: 'SET_SIZE_DEFECTS'; articleId: string; colorId: string; sizeId: string; defects: Defect[] }
  | {
      type: 'SET_SIZE_PHOTO';
      articleId: string;
      colorId: string;
      sizeId: string;
      photoType: string;
      category: 'standard' | 'construction' | 'notOk' | 'stackedGoods';
      file: File | null;
      preview: string;
    }
  | {
      type: 'ADD_OTHER_PHOTO';
      articleId: string;
      colorId: string;
      sizeId: string;
      file: File;
      preview: string;
    }
  | {
      type: 'REMOVE_OTHER_PHOTO';
      articleId: string;
      colorId: string;
      sizeId: string;
      photoIndex: number;
    }
  | {
      type: 'ADD_CONSUMER_PIECE';
      articleId: string;
      colorId: string;
      sizeId: string;
      piece: LabeledPhoto;
    }
  | {
      type: 'UPDATE_CONSUMER_PIECE';
      articleId: string;
      colorId: string;
      sizeId: string;
      pieceIndex: number;
      piece: LabeledPhoto;
    }
  | {
      type: 'REMOVE_CONSUMER_PIECE';
      articleId: string;
      colorId: string;
      sizeId: string;
      pieceIndex: number;
    }
  | {
      type: 'ADD_UNIT_LOAD_PHOTO';
      articleId: string;
      colorId: string;
      sizeId: string;
      photo: LabeledPhoto;
    }
  | {
      type: 'UPDATE_UNIT_LOAD_PHOTO';
      articleId: string;
      colorId: string;
      sizeId: string;
      photoIndex: number;
      photo: LabeledPhoto;
    }
  | {
      type: 'REMOVE_UNIT_LOAD_PHOTO';
      articleId: string;
      colorId: string;
      sizeId: string;
      photoIndex: number;
    }
  | { type: 'UPDATE_ARTICLE_AQL'; articleId: string; aql: Partial<ArticleAql> }
  | {
      type: 'MARK_ARTICLE_SUBMITTED';
      articleId: string;
      submittedAt: string;
      pdfUrl?: string;
      emailStatus?: 'pending' | 'sending' | 'sent' | 'failed';
      inspectionResult?: 'PASS' | 'FAIL';
    }
  | { type: 'SET_ARTICLE_SUBMIT_IN_FLIGHT'; articleId: string; inFlight: boolean }
  | { type: 'TOGGLE_HEADER' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'MARK_SAVING' }
  | { type: 'MARK_SAVED'; at: number; touchedAtAtSaveStart: number }
  | { type: 'MARK_SAVE_ERROR'; error: string }
  | { type: 'RESET' };

// Action types that modify form data and should bump lastTouchedAt.
// HYDRATE_FROM_SAVED is deliberately excluded — restoring a saved draft is
// not a user edit, and bumping lastTouchedAt would trigger an immediate
// re-save round trip.
const DATA_CHANGING_ACTIONS = new Set<ActionV3['type']>([
  'SET_GLOBAL',
  'SET_GLOBAL_BULK',
  'INIT_FROM_OPS_DATA',
  'UPDATE_SIZE_FIELD',
  'UPDATE_SIZE_PATCH',
  'SET_SIZE_DEFECTS',
  'SET_SIZE_PHOTO',
  'ADD_OTHER_PHOTO',
  'REMOVE_OTHER_PHOTO',
  'ADD_CONSUMER_PIECE',
  'UPDATE_CONSUMER_PIECE',
  'REMOVE_CONSUMER_PIECE',
  'ADD_UNIT_LOAD_PHOTO',
  'UPDATE_UNIT_LOAD_PHOTO',
  'REMOVE_UNIT_LOAD_PHOTO',
  'UPDATE_ARTICLE_AQL',
  'MARK_ARTICLE_SUBMITTED',
]);

// ─── Reducer helpers ───
function mapSize(
  state: InspectionFormStateV3,
  articleId: string,
  colorId: string,
  sizeId: string,
  updater: (s: SizeInspectionFormState) => SizeInspectionFormState
): InspectionFormStateV3 {
  return {
    ...state,
    articles: state.articles.map((a) => {
      if (a.id !== articleId) return a;
      return {
        ...a,
        colors: a.colors.map((c) => {
          if (c.id !== colorId) return c;
          return {
            ...c,
            sizes: c.sizes.map((s) => (s.id === sizeId ? updater(s) : s)),
          };
        }),
      };
    }),
  };
}

// ─── Reducer (outer wraps inner to bump lastTouchedAt on data changes) ───
function reducerV3(state: InspectionFormStateV3, action: ActionV3): InspectionFormStateV3 {
  const next = innerReducerV3(state, action);
  if (DATA_CHANGING_ACTIONS.has(action.type) && next !== state) {
    return {
      ...next,
      saveStatus: { ...next.saveStatus, lastTouchedAt: Date.now(), error: null },
    };
  }
  return next;
}

function innerReducerV3(state: InspectionFormStateV3, action: ActionV3): InspectionFormStateV3 {
  switch (action.type) {
    case 'SET_GLOBAL':
      return { ...state, global: { ...state.global, [action.field]: action.value } };

    case 'SET_GLOBAL_BULK':
      return { ...state, global: { ...state.global, ...action.updates } };

    case 'INIT_FROM_OPS_DATA': {
      // CRITICAL: this action used to wipe everything by replacing the articles
      // array with a fresh skeleton (new UUIDs everywhere), even when the
      // inspector was reloading the same OPS. Any filled work was lost.
      //
      // Defense: merge filled data from current state into the new skeleton by
      // matching on (articleName, colorName, sizeLabel) before replacing.
      const incoming = action.articles;
      const merged = incoming.map((newArticle) => {
        const oldArticle = state.articles.find(
          (a) => a.articleName === newArticle.articleName
        );
        if (!oldArticle) return newArticle;
        // Carry over per-article AQL + submission state + remarks
        return {
          ...newArticle,
          aql: oldArticle.aql ?? newArticle.aql,
          submittedAt: oldArticle.submittedAt,
          pdfUrl: oldArticle.pdfUrl,
          emailStatus: oldArticle.emailStatus,
          inspectionResult: oldArticle.inspectionResult,
          remarks: oldArticle.remarks,
          colors: newArticle.colors.map((newColor) => {
            const oldColor = oldArticle.colors.find(
              (c) => c.colorName === newColor.colorName
            );
            if (!oldColor) return newColor;
            return {
              ...newColor,
              sizes: newColor.sizes.map((newSize) => {
                const oldSize = oldColor.sizes.find(
                  (s) => (s.size || '') === (newSize.size || '')
                );
                if (!oldSize) return newSize;
                // Preserve all filled fields but keep the NEW id so React keys
                // stay consistent within this state revision.
                return { ...oldSize, id: newSize.id };
              }),
            };
          }),
        };
      });

      const firstArticle = merged[0] ?? null;
      const activeColorMap: Record<string, string | null> = {};
      const activeSizeMap: Record<string, string | null> = {};
      for (const a of merged) {
        const firstColor = a.colors[0] ?? null;
        activeColorMap[a.id] = firstColor?.id ?? null;
        if (firstColor) {
          activeSizeMap[firstColor.id] = firstColor.sizes[0]?.id ?? null;
        }
      }
      return {
        ...state,
        articles: merged,
        activeArticleId: firstArticle?.id ?? null,
        activeColorIdByArticle: activeColorMap,
        activeSizeIdByColor: activeSizeMap,
      };
    }

    case 'HYDRATE_FROM_SAVED': {
      // Wholesale restore from a previously saved draft (localStorage or
      // cloud). Unlike INIT_FROM_OPS_DATA we don't merge with current state —
      // the caller has already determined the saved version is what we want.
      const articles = action.articles;
      const firstArticle = articles[0] ?? null;
      const activeColorMap: Record<string, string | null> = {};
      const activeSizeMap: Record<string, string | null> = {};
      for (const a of articles) {
        const firstColor = a.colors[0] ?? null;
        activeColorMap[a.id] = firstColor?.id ?? null;
        if (firstColor) {
          activeSizeMap[firstColor.id] = firstColor.sizes[0]?.id ?? null;
        }
      }
      return {
        ...state,
        global: { ...state.global, ...action.global },
        articles,
        activeArticleId: firstArticle?.id ?? null,
        activeColorIdByArticle: activeColorMap,
        activeSizeIdByColor: activeSizeMap,
      };
    }

    case 'EXPAND_ARTICLE':
      return { ...state, activeArticleId: action.articleId };

    case 'EXPAND_COLOR':
      return {
        ...state,
        activeColorIdByArticle: {
          ...state.activeColorIdByArticle,
          [action.articleId]: action.colorId,
        },
      };

    case 'SELECT_SIZE_TAB':
      return {
        ...state,
        activeSizeIdByColor: {
          ...state.activeSizeIdByColor,
          [action.colorId]: action.sizeId,
        },
      };

    case 'UPDATE_SIZE_FIELD':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        [action.field]: action.value,
      }));

    case 'UPDATE_SIZE_PATCH':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        ...action.patch,
      }));

    case 'SET_SIZE_DEFECTS':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        defects: action.defects,
      }));

    case 'SET_SIZE_PHOTO':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => {
        switch (action.category) {
          case 'standard':
            return {
              ...s,
              standardPhotos: { ...s.standardPhotos, [action.photoType]: action.file },
              standardPhotoPreviews: {
                ...s.standardPhotoPreviews,
                [action.photoType]: action.preview,
              },
            };
          case 'construction':
            return {
              ...s,
              constructionPhotos: { ...s.constructionPhotos, [action.photoType]: action.file },
              constructionPhotoPreviews: {
                ...s.constructionPhotoPreviews,
                [action.photoType]: action.preview,
              },
            };
          case 'notOk':
            return {
              ...s,
              notOkPhotosForm: { ...s.notOkPhotosForm, [action.photoType]: action.file },
              notOkPreviews: { ...s.notOkPreviews, [action.photoType]: action.preview },
            };
          case 'stackedGoods':
            return { ...s, stackedGoodsPhoto: action.file, stackedGoodsPreview: action.preview };
          default:
            return s;
        }
      });

    case 'ADD_OTHER_PHOTO':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        otherPhotos: [...s.otherPhotos, action.file],
        otherPhotoPreviews: [...s.otherPhotoPreviews, action.preview],
      }));

    case 'REMOVE_OTHER_PHOTO':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        otherPhotos: s.otherPhotos.filter((_, i) => i !== action.photoIndex),
        otherPhotoPreviews: s.otherPhotoPreviews.filter((_, i) => i !== action.photoIndex),
      }));

    case 'ADD_CONSUMER_PIECE':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        consumerPiecesForm: [...s.consumerPiecesForm, action.piece],
      }));

    case 'UPDATE_CONSUMER_PIECE':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        consumerPiecesForm: s.consumerPiecesForm.map((p, i) =>
          i === action.pieceIndex ? action.piece : p
        ),
      }));

    case 'REMOVE_CONSUMER_PIECE':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        consumerPiecesForm: s.consumerPiecesForm.filter((_, i) => i !== action.pieceIndex),
      }));

    case 'ADD_UNIT_LOAD_PHOTO':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        unitLoadPhotosForm: [...s.unitLoadPhotosForm, action.photo],
      }));

    case 'UPDATE_UNIT_LOAD_PHOTO':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        unitLoadPhotosForm: s.unitLoadPhotosForm.map((p, i) =>
          i === action.photoIndex ? action.photo : p
        ),
      }));

    case 'REMOVE_UNIT_LOAD_PHOTO':
      return mapSize(state, action.articleId, action.colorId, action.sizeId, (s) => ({
        ...s,
        unitLoadPhotosForm: s.unitLoadPhotosForm.filter((_, i) => i !== action.photoIndex),
      }));

    case 'UPDATE_ARTICLE_AQL':
      return {
        ...state,
        articles: state.articles.map((a) =>
          a.id === action.articleId ? { ...a, aql: { ...a.aql, ...action.aql } } : a
        ),
      };

    case 'MARK_ARTICLE_SUBMITTED':
      return {
        ...state,
        articles: state.articles.map((a) =>
          a.id === action.articleId
            ? {
                ...a,
                submittedAt: action.submittedAt,
                pdfUrl: action.pdfUrl ?? a.pdfUrl,
                emailStatus: action.emailStatus ?? a.emailStatus,
                inspectionResult: action.inspectionResult ?? a.inspectionResult,
              }
            : a
        ),
      };

    case 'SET_ARTICLE_SUBMIT_IN_FLIGHT':
      return {
        ...state,
        submitInFlight: { ...state.submitInFlight, [action.articleId]: action.inFlight },
      };

    case 'TOGGLE_HEADER':
      return { ...state, headerExpanded: !state.headerExpanded };

    case 'SET_LOADING':
      return { ...state, loading: action.loading };

    case 'MARK_SAVING':
      return { ...state, saveStatus: { ...state.saveStatus, saving: true, error: null } };

    case 'MARK_SAVED':
      // CRITICAL: lastSavedAt must equal lastTouchedAt-AT-SAVE-START, not the
      // current Date.now(). Otherwise touched === saved is never true and the
      // autosave effect re-fires forever, racing with the user's edits.
      return {
        ...state,
        saveStatus: {
          ...state.saveStatus,
          saving: false,
          lastSavedAt: action.touchedAtAtSaveStart,
          error: null,
        },
      };

    case 'MARK_SAVE_ERROR':
      return {
        ...state,
        saveStatus: { ...state.saveStatus, saving: false, error: action.error },
      };

    case 'RESET':
      return createInitialStateV3();

    default:
      return state;
  }
}

// ─── Context ───
interface CtxV3 {
  state: InspectionFormStateV3;
  dispatch: React.Dispatch<ActionV3>;
}

const Ctx = createContext<CtxV3 | null>(null);

const V3_DRAFT_KEY = 'final_inspection_v3_draft';
const AUTOSAVE_DEBOUNCE_MS = 800;
// Cloud autosave is on a coarser cadence: localStorage stays the fast path
// (every ~800ms) so typing always survives a reload, and Firestore catches up
// every 15s + on pagehide so a dead/wiped/replaced device no longer means lost
// work. See src/lib/v3CloudDraft.ts.
const CLOUD_AUTOSAVE_DEBOUNCE_MS = 15_000;

// Hydrate from localStorage on first mount (if a draft exists).
// Falls back to empty state on parse error.
function loadInitialStateFromStorage(): InspectionFormStateV3 {
  const base = createInitialStateV3();
  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem(V3_DRAFT_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 3 || !Array.isArray(parsed.articles)) return base;
    // Restore active selections if articles still exist; otherwise re-derive.
    const articles = parsed.articles as ArticleInspectionV3[];
    const firstArticle = articles[0] ?? null;
    const activeColorMap: Record<string, string | null> = {};
    const activeSizeMap: Record<string, string | null> = {};
    for (const a of articles) {
      const firstColor = a.colors[0] ?? null;
      activeColorMap[a.id] = firstColor?.id ?? null;
      if (firstColor) {
        activeSizeMap[firstColor.id] = firstColor.sizes[0]?.id ?? null;
      }
    }
    return {
      ...base,
      global: { ...base.global, ...(parsed.global ?? {}) },
      articles,
      activeArticleId: firstArticle?.id ?? null,
      activeColorIdByArticle: activeColorMap,
      activeSizeIdByColor: activeSizeMap,
      saveStatus: {
        lastTouchedAt: parsed.savedAt ?? 0,
        lastSavedAt: parsed.savedAt ?? 0,
        saving: false,
        error: null,
      },
    };
  } catch (e) {
    console.warn('[V3] failed to restore draft from localStorage', e);
    return base;
  }
}

export function InspectionFormProviderV3({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducerV3, undefined, loadInitialStateFromStorage);
  useAutoSaveV3(state, dispatch);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Debounced autosave + synchronous flush on page unload.
// Writes a JSON-safe slice of state to localStorage (Files stripped; previews
// and field values preserved). The pagehide / beforeunload listeners flush any
// pending save SYNCHRONOUSLY before the page goes away — so the inspector
// never loses unsaved work to a tab close, navigation, or PWA SW activation.
function useAutoSaveV3(state: InspectionFormStateV3, dispatch: React.Dispatch<ActionV3>) {
  const timerRef = useRef<number | null>(null);
  // Hold the latest state in a ref so the pagehide listener can read it without
  // re-binding on every state change.
  const stateRef = useRef(state);
  stateRef.current = state;
  const touched = state.saveStatus.lastTouchedAt;
  const saved = state.saveStatus.lastSavedAt;

  // Synchronous flush helper. Safe to call from pagehide/beforeunload.
  const flush = useCallback(() => {
    const s = stateRef.current;
    if (s.saveStatus.lastTouchedAt === 0) return;
    if (s.saveStatus.lastTouchedAt === s.saveStatus.lastSavedAt) return;
    if (s.articles.length === 0) return;
    try {
      localStorage.setItem(V3_DRAFT_KEY, JSON.stringify(serializeStateForDraft(s)));
    } catch (e) {
      console.warn('[V3] flush save failed', e);
    }
  }, []);

  // Debounced background autosave.
  useEffect(() => {
    if (touched === 0 || touched === saved) return;
    if (state.articles.length === 0) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const touchedAtAtSaveStart = touched;
    timerRef.current = window.setTimeout(() => {
      dispatch({ type: 'MARK_SAVING' });
      try {
        const json = JSON.stringify(serializeStateForDraft(stateRef.current));
        localStorage.setItem(V3_DRAFT_KEY, json);
        dispatch({ type: 'MARK_SAVED', at: Date.now(), touchedAtAtSaveStart });
      } catch (e) {
        dispatch({ type: 'MARK_SAVE_ERROR', error: (e as Error).message });
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [touched, saved, state.articles.length, dispatch]);

  // Sync flush on page hide / unload — guarantees the latest typing survives
  // a browser close, navigation, or PWA service-worker update reload.
  useEffect(() => {
    const onUnload = () => flush();
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    return () => {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [flush]);

  // ─── Cloud autosave (coarse cadence, fire-and-forget) ───
  // Why: localStorage alone means a wiped browser / replaced device = total
  // loss of every tab the inspector filled in. Mirroring to Firestore every
  // 15s + on pagehide makes the work device-portable and recoverable.
  const cloudTimerRef = useRef<number | null>(null);
  const lastCloudSavedAtRef = useRef<number>(0);

  const flushCloud = useCallback(() => {
    const s = stateRef.current;
    if (!s.global.opsNo) return;
    if (s.articles.length === 0) return;
    if (s.saveStatus.lastTouchedAt === 0) return;
    if (s.saveStatus.lastTouchedAt === lastCloudSavedAtRef.current) return;
    const snapshot = serializeStateForDraft(s);
    lastCloudSavedAtRef.current = s.saveStatus.lastTouchedAt;
    // Fire and forget — never block UI on the network. Any failure is logged
    // by saveCloudDraftV3; the next 15s tick or pagehide flush will retry.
    saveCloudDraftV3(s.global.opsNo, snapshot, {
      inspectorName: s.global.qcInspectorName,
      customerCode: s.global.customerCode,
    }).catch((e) => console.warn('[V3] cloud autosave failed', e));
  }, []);

  useEffect(() => {
    if (touched === 0 || touched === lastCloudSavedAtRef.current) return;
    if (state.articles.length === 0) return;
    if (!state.global.opsNo) return;
    if (cloudTimerRef.current) window.clearTimeout(cloudTimerRef.current);
    cloudTimerRef.current = window.setTimeout(() => {
      flushCloud();
    }, CLOUD_AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (cloudTimerRef.current) window.clearTimeout(cloudTimerRef.current);
    };
  }, [touched, state.articles.length, state.global.opsNo, flushCloud]);

  useEffect(() => {
    const onUnload = () => {
      // Best-effort sync flush — modern browsers give a brief window for
      // network calls during pagehide. saveCloudDraftV3 uses fetch under the
      // hood via the Firestore SDK; we deliberately don't await it.
      flushCloud();
    };
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [flushCloud]);
}

// Strip File objects (not JSON-serializable). Photo previews (data URLs) survive.
function serializeStateForDraft(state: InspectionFormStateV3) {
  return {
    version: 3,
    savedAt: Date.now(),
    global: state.global,
    articles: state.articles.map((a) => ({
      ...a,
      colors: a.colors.map((c) => ({
        ...c,
        sizes: c.sizes.map((s) => ({
          ...s,
          standardPhotos: {},
          constructionPhotos: {},
          notOkPhotosForm: {},
          stackedGoodsPhoto: null,
          otherPhotos: [],
          consumerPiecesForm: s.consumerPiecesForm.map((p) => ({ ...p, file: undefined })),
          unitLoadPhotosForm: s.unitLoadPhotosForm.map((p) => ({ ...p, file: undefined })),
        })),
      })),
    })),
  };
}

export function useInspectionFormV3(): CtxV3 {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInspectionFormV3 must be used within InspectionFormProviderV3');
  return ctx;
}

// ─── Adapter: lets V2 SizeInspectionPanel work unchanged inside V3 ───
// Returns a dispatch that translates V2 actions (with `index`) into V3 actions
// (with articleId/colorId/sizeId) using the provided path.
export function useV2CompatDispatch(
  articleId: string,
  colorId: string,
  sizeId: string
): (action: any) => void {
  const { dispatch } = useInspectionFormV3();
  return useCallback(
    (action: any) => {
      // Map V2 index-based actions onto V3 path-based actions.
      switch (action.type) {
        case 'SET_SIZE_FIELD':
          dispatch({
            type: 'UPDATE_SIZE_FIELD',
            articleId,
            colorId,
            sizeId,
            field: action.field,
            value: action.value,
          });
          return;
        case 'SET_SIZE_DEFECTS':
          dispatch({
            type: 'SET_SIZE_DEFECTS',
            articleId,
            colorId,
            sizeId,
            defects: action.defects,
          });
          return;
        case 'SET_SIZE_PHOTO':
          dispatch({
            type: 'SET_SIZE_PHOTO',
            articleId,
            colorId,
            sizeId,
            photoType: action.photoType,
            category: action.category,
            file: action.file,
            preview: action.preview,
          });
          return;
        case 'ADD_SIZE_OTHER_PHOTO':
          dispatch({
            type: 'ADD_OTHER_PHOTO',
            articleId,
            colorId,
            sizeId,
            file: action.file,
            preview: action.preview,
          });
          return;
        case 'REMOVE_SIZE_OTHER_PHOTO':
          dispatch({
            type: 'REMOVE_OTHER_PHOTO',
            articleId,
            colorId,
            sizeId,
            photoIndex: action.photoIndex,
          });
          return;
        case 'ADD_CONSUMER_PIECE':
          dispatch({
            type: 'ADD_CONSUMER_PIECE',
            articleId,
            colorId,
            sizeId,
            piece: action.piece,
          });
          return;
        case 'UPDATE_CONSUMER_PIECE':
          dispatch({
            type: 'UPDATE_CONSUMER_PIECE',
            articleId,
            colorId,
            sizeId,
            pieceIndex: action.pieceIndex,
            piece: action.piece,
          });
          return;
        case 'REMOVE_CONSUMER_PIECE':
          dispatch({
            type: 'REMOVE_CONSUMER_PIECE',
            articleId,
            colorId,
            sizeId,
            pieceIndex: action.pieceIndex,
          });
          return;
        case 'ADD_UNIT_LOAD_PHOTO':
          dispatch({
            type: 'ADD_UNIT_LOAD_PHOTO',
            articleId,
            colorId,
            sizeId,
            photo: action.photo,
          });
          return;
        case 'UPDATE_UNIT_LOAD_PHOTO':
          dispatch({
            type: 'UPDATE_UNIT_LOAD_PHOTO',
            articleId,
            colorId,
            sizeId,
            photoIndex: action.photoIndex,
            photo: action.photo,
          });
          return;
        case 'REMOVE_UNIT_LOAD_PHOTO':
          dispatch({
            type: 'REMOVE_UNIT_LOAD_PHOTO',
            articleId,
            colorId,
            sizeId,
            photoIndex: action.photoIndex,
          });
          return;
        default:
          // Drop unsupported V2 actions silently (e.g., ADD_SIZE which doesn't make sense in V3)
          return;
      }
    },
    [dispatch, articleId, colorId, sizeId]
  );
}
