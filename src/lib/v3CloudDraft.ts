// Cloud-mirrored V3 drafts.
//
// localStorage stays the fast tier (autosave every ~800ms).
// Firestore is the durable tier (autosave every ~15s + on pagehide) so a
// dead/wiped/replaced device no longer means lost work.
//
// Doc id is deterministic: `${opsNo}_${userId|deviceId}` — each inspector
// resuming the same OPS finds their own draft, never someone else's.

import { db, auth } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const COLLECTION = 'final_inspection_v3_drafts';
const DEVICE_ID_KEY = 'em_fi_device_id';

// Stable per-browser id for the unauthenticated edge case. We seed it once
// and reuse it forever so a logged-out inspector's draft can still find
// itself after a reload.
function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      const c = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      id = c;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
}

export function getDraftActorId(): string {
  return auth.currentUser?.uid || getOrCreateDeviceId();
}

export function buildDraftKey(opsNo: string, actorId?: string): string {
  const actor = actorId || getDraftActorId();
  // Sanitize: Firestore doc ids can't contain slashes. OPS numbers might
  // include hyphens which are fine; we only need to guard against /.
  const safeOps = opsNo.replace(/\//g, '_');
  return `${safeOps}__${actor}`;
}

export interface CloudDraftPayload {
  version: 3;
  opsNo: string;
  userId: string;
  inspectorName: string;
  customerCode: string;
  global: unknown;
  articles: unknown;
  savedAt: number;
  // updatedAt set by serverTimestamp on write
}

// Save a V3 draft to Firestore. Caller passes the already-serialized snapshot
// from serializeStateForDraft() so we never accidentally embed File objects.
export async function saveCloudDraftV3(
  opsNo: string,
  serializedSnapshot: { version: 3; savedAt: number; global: unknown; articles: unknown },
  meta: { inspectorName: string; customerCode: string }
): Promise<void> {
  if (!opsNo) return;
  const key = buildDraftKey(opsNo);
  const actor = getDraftActorId();
  const payload: CloudDraftPayload & { updatedAt: ReturnType<typeof serverTimestamp> } = {
    version: 3,
    opsNo,
    userId: actor,
    inspectorName: meta.inspectorName || '',
    customerCode: meta.customerCode || '',
    global: serializedSnapshot.global,
    articles: serializedSnapshot.articles,
    savedAt: serializedSnapshot.savedAt,
    updatedAt: serverTimestamp(),
  };
  // setDoc with merge:false replaces the whole doc each time — fine, the
  // localStorage path already debounces and we never want stale arrays bleeding
  // into a fresh snapshot.
  await setDoc(doc(db, COLLECTION, key), payload as unknown as Record<string, unknown>);
}

export async function loadCloudDraftV3(
  opsNo: string
): Promise<{ version: 3; savedAt: number; global: unknown; articles: unknown } | null> {
  if (!opsNo) return null;
  const key = buildDraftKey(opsNo);
  try {
    const snap = await getDoc(doc(db, COLLECTION, key));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.version !== 3 || !Array.isArray(data.articles)) return null;
    return {
      version: 3,
      savedAt: Number(data.savedAt) || 0,
      global: data.global,
      articles: data.articles,
    };
  } catch (e) {
    console.warn('[v3CloudDraft] load failed', e);
    return null;
  }
}

export async function deleteCloudDraftV3(opsNo: string): Promise<void> {
  if (!opsNo) return;
  const key = buildDraftKey(opsNo);
  try {
    await deleteDoc(doc(db, COLLECTION, key));
  } catch (e) {
    console.warn('[v3CloudDraft] delete failed', e);
  }
}
