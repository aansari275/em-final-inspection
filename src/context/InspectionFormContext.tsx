import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import {
  type SizeInspectionFormState,
  type Company,
  type SelectedArticle,
  type LabeledPhoto,
  createEmptySizeInspection,
} from '../types';

// Global form data (filled once)
export interface GlobalFormData {
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
  colorName: string;
  merchant: string;
  totalOrderQty: string;
  // AQL (global)
  inspectedLotQty: string;
  aql: string;
  sampleSize: string;
  acceptedQty: string;
  rejectedQty: string;
  inspectionResult: 'PASS' | 'FAIL';
}

export interface InspectionFormState {
  global: GlobalFormData;
  sizeInspections: SizeInspectionFormState[];
  activeSizeIndex: number;
  selectedArticles: SelectedArticle[];
  // UI state
  loading: boolean;
  success: boolean;
  uploadProgress: string;
  emailSending: boolean;
  emailProgress: string;
  emailFailed: boolean;
  emailImageCount: number;
}

// ─── Actions ───

type Action =
  | { type: 'SET_GLOBAL'; field: keyof GlobalFormData; value: string }
  | { type: 'SET_GLOBAL_BULK'; updates: Partial<GlobalFormData> }
  | { type: 'ADD_SIZE' }
  | { type: 'REMOVE_SIZE'; index: number }
  | { type: 'SET_SIZE_FIELD'; index: number; field: string; value: unknown }
  | { type: 'SET_ACTIVE_SIZE'; index: number }
  | {
      type: 'SET_SIZE_PHOTO';
      index: number;
      photoType: string;
      category: 'standard' | 'construction' | 'notOk' | 'stackedGoods';
      file: File | null;
      preview: string;
    }
  | { type: 'ADD_SIZE_OTHER_PHOTO'; index: number; file: File; preview: string }
  | { type: 'REMOVE_SIZE_OTHER_PHOTO'; index: number; photoIndex: number }
  | { type: 'ADD_CONSUMER_PIECE'; index: number; piece: LabeledPhoto }
  | { type: 'UPDATE_CONSUMER_PIECE'; index: number; pieceIndex: number; piece: LabeledPhoto }
  | { type: 'REMOVE_CONSUMER_PIECE'; index: number; pieceIndex: number }
  | { type: 'ADD_UNIT_LOAD_PHOTO'; index: number; photo: LabeledPhoto }
  | { type: 'UPDATE_UNIT_LOAD_PHOTO'; index: number; photoIndex: number; photo: LabeledPhoto }
  | { type: 'REMOVE_UNIT_LOAD_PHOTO'; index: number; photoIndex: number }
  | { type: 'SET_SIZE_DEFECTS'; index: number; defects: SizeInspectionFormState['defects'] }
  | { type: 'SET_SELECTED_ARTICLES'; articles: SelectedArticle[] }
  | {
      type: 'SET_UI';
      updates: Partial<
        Pick<
          InspectionFormState,
          'loading' | 'success' | 'uploadProgress' | 'emailSending' | 'emailProgress' | 'emailFailed' | 'emailImageCount'
        >
      >;
    }
  | { type: 'RESTORE_DRAFT'; state: InspectionFormState }
  | { type: 'RESET' };

// ─── Helpers ───

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function createInitialState(): InspectionFormState {
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
      colorName: '',
      merchant: '',
      totalOrderQty: '',
      inspectedLotQty: '',
      aql: '2.5',
      sampleSize: '',
      acceptedQty: '',
      rejectedQty: '',
      inspectionResult: 'PASS',
    },
    sizeInspections: [createEmptySizeInspection()],
    activeSizeIndex: 0,
    selectedArticles: [],
    loading: false,
    success: false,
    uploadProgress: '',
    emailSending: false,
    emailProgress: '',
    emailFailed: false,
    emailImageCount: 0,
  };
}

// ─── Reducer ───

function updateSizeAtIndex(
  sizes: SizeInspectionFormState[],
  index: number,
  updater: (size: SizeInspectionFormState) => SizeInspectionFormState
): SizeInspectionFormState[] {
  return sizes.map((s, i) => (i === index ? updater(s) : s));
}

function inspectionFormReducer(state: InspectionFormState, action: Action): InspectionFormState {
  switch (action.type) {
    case 'SET_GLOBAL':
      return {
        ...state,
        global: { ...state.global, [action.field]: action.value },
      };

    case 'SET_GLOBAL_BULK':
      return {
        ...state,
        global: { ...state.global, ...action.updates },
      };

    case 'ADD_SIZE':
      return {
        ...state,
        sizeInspections: [...state.sizeInspections, createEmptySizeInspection()],
        activeSizeIndex: state.sizeInspections.length,
      };

    case 'REMOVE_SIZE': {
      if (state.sizeInspections.length <= 1) return state;
      const newSizes = state.sizeInspections.filter((_, i) => i !== action.index);
      const newActive =
        state.activeSizeIndex >= newSizes.length
          ? newSizes.length - 1
          : state.activeSizeIndex > action.index
            ? state.activeSizeIndex - 1
            : state.activeSizeIndex;
      return {
        ...state,
        sizeInspections: newSizes,
        activeSizeIndex: newActive,
      };
    }

    case 'SET_SIZE_FIELD':
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => ({
          ...size,
          [action.field]: action.value,
        })),
      };

    case 'SET_ACTIVE_SIZE':
      return { ...state, activeSizeIndex: action.index };

    case 'SET_SIZE_PHOTO': {
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => {
          switch (action.category) {
            case 'standard':
              return {
                ...size,
                standardPhotos: { ...size.standardPhotos, [action.photoType]: action.file },
                standardPhotoPreviews: { ...size.standardPhotoPreviews, [action.photoType]: action.preview },
              };
            case 'construction':
              return {
                ...size,
                constructionPhotos: { ...size.constructionPhotos, [action.photoType]: action.file },
                constructionPhotoPreviews: { ...size.constructionPhotoPreviews, [action.photoType]: action.preview },
              };
            case 'notOk':
              return {
                ...size,
                notOkPhotosForm: { ...size.notOkPhotosForm, [action.photoType]: action.file },
                notOkPreviews: { ...size.notOkPreviews, [action.photoType]: action.preview },
              };
            case 'stackedGoods':
              return {
                ...size,
                stackedGoodsPhoto: action.file,
                stackedGoodsPreview: action.preview,
              };
            default:
              return size;
          }
        }),
      };
    }

    case 'ADD_SIZE_OTHER_PHOTO':
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => ({
          ...size,
          otherPhotos: [...size.otherPhotos, action.file],
          otherPhotoPreviews: [...size.otherPhotoPreviews, action.preview],
        })),
      };

    case 'REMOVE_SIZE_OTHER_PHOTO':
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => ({
          ...size,
          otherPhotos: size.otherPhotos.filter((_, i) => i !== action.photoIndex),
          otherPhotoPreviews: size.otherPhotoPreviews.filter((_, i) => i !== action.photoIndex),
        })),
      };

    case 'ADD_CONSUMER_PIECE':
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => ({
          ...size,
          consumerPiecesForm: [...size.consumerPiecesForm, action.piece],
        })),
      };

    case 'UPDATE_CONSUMER_PIECE':
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => ({
          ...size,
          consumerPiecesForm: size.consumerPiecesForm.map((p, i) =>
            i === action.pieceIndex ? action.piece : p
          ),
        })),
      };

    case 'REMOVE_CONSUMER_PIECE':
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => ({
          ...size,
          consumerPiecesForm: size.consumerPiecesForm.filter((_, i) => i !== action.pieceIndex),
        })),
      };

    case 'ADD_UNIT_LOAD_PHOTO':
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => ({
          ...size,
          unitLoadPhotosForm: [...size.unitLoadPhotosForm, action.photo],
        })),
      };

    case 'UPDATE_UNIT_LOAD_PHOTO':
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => ({
          ...size,
          unitLoadPhotosForm: size.unitLoadPhotosForm.map((p, i) =>
            i === action.photoIndex ? action.photo : p
          ),
        })),
      };

    case 'REMOVE_UNIT_LOAD_PHOTO':
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => ({
          ...size,
          unitLoadPhotosForm: size.unitLoadPhotosForm.filter((_, i) => i !== action.photoIndex),
        })),
      };

    case 'SET_SIZE_DEFECTS':
      return {
        ...state,
        sizeInspections: updateSizeAtIndex(state.sizeInspections, action.index, (size) => ({
          ...size,
          defects: action.defects,
        })),
      };

    case 'SET_SELECTED_ARTICLES':
      return { ...state, selectedArticles: action.articles };

    case 'SET_UI':
      return { ...state, ...action.updates };

    case 'RESTORE_DRAFT':
      return action.state;

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

// ─── Context ───

interface InspectionFormContextValue {
  state: InspectionFormState;
  dispatch: React.Dispatch<Action>;
}

const InspectionFormContext = createContext<InspectionFormContextValue | null>(null);

export function InspectionFormProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(inspectionFormReducer, undefined, createInitialState);

  return (
    <InspectionFormContext.Provider value={{ state, dispatch }}>
      {children}
    </InspectionFormContext.Provider>
  );
}

export function useInspectionForm(): InspectionFormContextValue {
  const context = useContext(InspectionFormContext);
  if (!context) {
    throw new Error('useInspectionForm must be used within an InspectionFormProvider');
  }
  return context;
}
