/**
 * Draft Persistence Service
 *
 * Handles saving and restoring form drafts with support for:
 * - Form data in localStorage (fast, small data)
 * - Photo previews in IndexedDB (handles larger data)
 * - Automatic save on visibility change (when receiving calls, switching apps)
 * - Debounced auto-save on form changes
 */

const DB_NAME = 'FinalInspectionDrafts';
const DB_VERSION = 1;
const PHOTO_STORE = 'photoPreviews';
const DRAFT_STORAGE_KEY = 'finalInspectionDraft';

// Photo data structure for IndexedDB
export interface PhotoDraftData {
  photoPreviews: Record<string, string>;
  constructionPreviews: Record<string, string>;
  notOkPreviews: Record<string, string>;
  stackedGoodsPreview: string;
  consumerPiecePreviews: Array<{ label: string; preview: string }>;
  unitLoadPreviews: Array<{ label: string; preview: string }>;
  otherPreviews: string[];
  unitLoadEnabled: boolean;
  savedAt: string;
}

// Initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
    };
  });
}

// Save photo previews to IndexedDB
export async function savePhotoDraft(data: PhotoDraftData): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(PHOTO_STORE, 'readwrite');
    const store = transaction.objectStore(PHOTO_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(data, 'currentDraft');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch (error) {
    console.error('Error saving photo draft to IndexedDB:', error);
  }
}

// Load photo previews from IndexedDB
export async function loadPhotoDraft(): Promise<PhotoDraftData | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(PHOTO_STORE, 'readonly');
    const store = transaction.objectStore(PHOTO_STORE);

    const data = await new Promise<PhotoDraftData | null>((resolve, reject) => {
      const request = store.get('currentDraft');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return data;
  } catch (error) {
    console.error('Error loading photo draft from IndexedDB:', error);
    return null;
  }
}

// Clear photo draft from IndexedDB
export async function clearPhotoDraft(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(PHOTO_STORE, 'readwrite');
    const store = transaction.objectStore(PHOTO_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete('currentDraft');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch (error) {
    console.error('Error clearing photo draft from IndexedDB:', error);
  }
}

// Debounce utility
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// Create a visibility change handler that saves draft immediately
export function createVisibilityHandler(saveDraft: () => void): () => void {
  const handler = () => {
    if (document.visibilityState === 'hidden') {
      // Page is being hidden (phone call, app switch, tab change)
      saveDraft();
      console.log('Draft saved on visibility change (page hidden)');
    }
  };

  document.addEventListener('visibilitychange', handler);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handler);
  };
}

// Create a beforeunload handler that saves draft
export function createBeforeUnloadHandler(saveDraft: () => void): () => void {
  const handler = (event: BeforeUnloadEvent) => {
    saveDraft();
    // For some browsers, we need to set returnValue
    event.preventDefault();
    event.returnValue = '';
  };

  window.addEventListener('beforeunload', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('beforeunload', handler);
  };
}

// Create a pagehide handler (more reliable on mobile than beforeunload)
export function createPageHideHandler(saveDraft: () => void): () => void {
  const handler = () => {
    saveDraft();
    console.log('Draft saved on pagehide');
  };

  window.addEventListener('pagehide', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('pagehide', handler);
  };
}

// Check if the app is running as a PWA (standalone mode)
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Export storage key for use in form component
export { DRAFT_STORAGE_KEY };
