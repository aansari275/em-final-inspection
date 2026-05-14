import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type Phase = 'idle' | 'scanning' | 'uploading' | 'done' | 'empty' | 'error';

interface ScanResult {
  localStorage: Record<string, string>;
  indexedDB: unknown;
  v3DraftPresent: boolean;
  v3DraftSize: number;
  photoCount: number;
}

async function readIndexedDB(): Promise<unknown> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('FinalInspectionDrafts', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('IndexedDB blocked'));
      // If the DB doesn't exist yet, onupgradeneeded fires - just resolve null
      r.onupgradeneeded = () => {
        // empty DB - no draft has ever been saved
      };
    });
    try {
      const stores = Array.from(db.objectStoreNames);
      if (!stores.includes('photoPreviews')) {
        db.close();
        return { _note: 'photoPreviews store missing' };
      }
      const tx = db.transaction('photoPreviews', 'readonly');
      const store = tx.objectStore('photoPreviews');
      const data = await new Promise<unknown>((resolve, reject) => {
        const r = store.get('currentDraft');
        r.onsuccess = () => resolve(r.result ?? null);
        r.onerror = () => reject(r.error);
      });
      db.close();
      return data;
    } catch (e) {
      db.close();
      return { _error: String(e) };
    }
  } catch (e) {
    return { _error: String(e) };
  }
}

function scanLocalStorage(): { all: Record<string, string>; v3Present: boolean; v3Size: number } {
  const all: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) all[k] = localStorage.getItem(k) ?? '';
  }
  const v3 = all['final_inspection_v3_draft'];
  return {
    all,
    v3Present: typeof v3 === 'string' && v3.length > 0,
    v3Size: v3 ? v3.length : 0,
  };
}

function countPhotos(idb: unknown): number {
  if (!idb || typeof idb !== 'object') return 0;
  const o = idb as Record<string, unknown>;
  let n = 0;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'savedAt' || k === '_note' || k === '_error') continue;
    if (typeof v === 'string' && v.startsWith('data:image')) n += 1;
    else if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string' && item.startsWith('data:image')) n += 1;
        else if (item && typeof item === 'object' && typeof (item as { preview?: unknown }).preview === 'string') n += 1;
      }
    } else if (v && typeof v === 'object') {
      for (const val of Object.values(v as Record<string, unknown>)) {
        if (typeof val === 'string' && val.startsWith('data:image')) n += 1;
      }
    }
  }
  return n;
}

export default function DraftRecovery() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [docId, setDocId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('scanning');
      try {
        const ls = scanLocalStorage();
        const idb = await readIndexedDB();
        if (cancelled) return;
        const result: ScanResult = {
          localStorage: ls.all,
          indexedDB: idb,
          v3DraftPresent: ls.v3Present,
          v3DraftSize: ls.v3Size,
          photoCount: countPhotos(idb),
        };
        setScan(result);
        setPhase(ls.v3Present ? 'idle' : 'empty');
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(String(e));
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upload = async () => {
    if (!scan) return;
    setPhase('uploading');
    try {
      const payload = {
        capturedAt: new Date().toISOString(),
        firestoreCreatedAt: serverTimestamp(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        localStorage: scan.localStorage,
        indexedDB: scan.indexedDB,
        meta: {
          v3DraftPresent: scan.v3DraftPresent,
          v3DraftSize: scan.v3DraftSize,
          photoCount: scan.photoCount,
        },
      };
      const ref = await addDoc(collection(db, 'final_inspection_v3_recovery'), payload);
      setDocId(ref.id);
      setPhase('done');
    } catch (e) {
      setErrorMsg(String(e));
      setPhase('error');
    }
  };

  const sizeKB = scan ? Math.round(scan.v3DraftSize / 1024) : 0;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Draft Recovery</h1>
        <p className="text-gray-600 mb-6 text-sm">
          This page recovers any in-progress inspection saved on this device and uploads it to the
          cloud so the team can restore your work.
        </p>

        {phase === 'scanning' && (
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            <span>Scanning this device for saved drafts…</span>
          </div>
        )}

        {phase === 'empty' && scan && (
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center text-amber-700 font-bold flex-shrink-0">
                !
              </div>
              <div>
                <p className="font-semibold text-amber-900">No V3 draft found on this device.</p>
                <p className="text-sm text-amber-800 mt-1">
                  The draft may have been cleared, or this is a different browser/device than the
                  one used during the inspection. Tap upload anyway to send any other data we may
                  use for diagnostics.
                </p>
              </div>
            </div>
            <div className="mt-4 text-xs text-amber-900">
              <div>localStorage keys on this device: {Object.keys(scan.localStorage).length}</div>
              <div>IndexedDB photo entries: {scan.photoCount}</div>
            </div>
            <button
              onClick={upload}
              className="mt-4 w-full py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700"
            >
              Upload diagnostics anyway
            </button>
          </div>
        )}

        {phase === 'idle' && scan && (
          <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                ✓
              </div>
              <div>
                <p className="font-semibold text-emerald-900">Draft found.</p>
                <p className="text-sm text-emerald-800 mt-1">
                  Tap the button below to upload it to the cloud. You can keep working on the
                  inspection afterward — this does not erase anything.
                </p>
              </div>
            </div>
            <div className="mt-4 text-xs text-emerald-900 space-y-1">
              <div>Draft size: {sizeKB} KB</div>
              <div>Photos cached: {scan.photoCount}</div>
              <div>localStorage keys: {Object.keys(scan.localStorage).length}</div>
            </div>
            <button
              onClick={upload}
              className="mt-4 w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700"
            >
              Upload draft to cloud
            </button>
          </div>
        )}

        {phase === 'uploading' && (
          <div className="border border-blue-200 bg-blue-50 rounded-xl p-5 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-blue-900 font-medium">Uploading to cloud…</span>
          </div>
        )}

        {phase === 'done' && (
          <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                ✓
              </div>
              <div>
                <p className="font-bold text-emerald-900 text-lg">Uploaded successfully.</p>
                <p className="text-sm text-emerald-800 mt-1">
                  Tell the office it's done. They can restore your work from this record.
                </p>
                <p className="text-xs text-emerald-700 mt-3 font-mono break-all">
                  Recovery ID: {docId}
                </p>
              </div>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-5">
            <p className="font-semibold text-red-900">Recovery failed</p>
            <p className="text-sm text-red-800 mt-1 break-words">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
