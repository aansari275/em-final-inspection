import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { Customer } from '../types';

// OPS Order Item interface
export interface OpsOrderItem {
  id: string;
  articleName: string;
  size?: string;
  color?: string;
  quality?: string;
  pcs: number;
  sqm: number;
  imageUrl?: string;
}

// OPS Order details interface
export interface OpsOrder {
  id: string;
  salesNo: string;           // OPS number
  poNumber: string;          // Customer PO
  buyerName: string;
  buyerCode: string;
  merchantCode: string;
  companyCode: 'EMPL' | 'EHI';
  orderType: string;
  shipDate: string;
  totalPcs: number;
  totalSqm: number;
  status: string;
  items: OpsOrderItem[];
}

// Firebase configuration for easternmillscom project
const firebaseConfig = {
  apiKey: 'AIzaSyDqFKIL0SdH0pR0rVYKRTlO8snL0jTK4cA',
  authDomain: 'easternmillscom.firebaseapp.com',
  projectId: 'easternmillscom',
  storageBucket: 'easternmillscom.firebasestorage.app',
  messagingSenderId: '104363102649904556055',
  appId: '1:104363102649904556055:web:final-inspection',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ============================================
// Customer/Buyer Operations
// Using shared 'buyers' collection (same as Sample Bazar, Orders, etc.)
// Function names kept as getCustomers/addCustomer for backward compatibility
// ============================================

const BUYERS_COLLECTION = 'buyers';

/**
 * Get all customers/buyers from Firestore (shared buyers collection)
 * @returns Array of customers with name and code
 */
export async function getCustomers(): Promise<Customer[]> {
  try {
    const buyersRef = collection(db, BUYERS_COLLECTION);
    const q = query(buyersRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        name: data.name,
        code: data.code,
      } as Customer;
    });
  } catch (error) {
    console.error('Error fetching customers from shared buyers collection:', error);
    throw error;
  }
}

/**
 * Add a new customer/buyer to the shared buyers collection
 * @param customer Customer with name and code
 * @returns Document ID of the new buyer
 */
export async function addCustomer(customer: Customer): Promise<string> {
  try {
    const buyersRef = collection(db, BUYERS_COLLECTION);
    const docRef = await addDoc(buyersRef, {
      name: customer.name,
      code: customer.code,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding customer to shared buyers collection:', error);
    throw error;
  }
}

// ============================================
// Shared Design Names (from empl_design_name collection)
// ============================================

export interface DesignName {
  id: string;
  designName: string;
  displayName?: string;
  category?: string;
  construction?: string;
  isActive?: boolean;
}

export async function getDesignNames(): Promise<DesignName[]> {
  try {
    const designsRef = collection(db, 'empl_design_name');
    const q = query(designsRef, orderBy('designName', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        designName: doc.data().designName,
        displayName: doc.data().displayName,
        category: doc.data().category,
        construction: doc.data().construction,
        isActive: doc.data().isActive ?? true,
      }))
      .filter(d => d.designName && d.isActive !== false);
  } catch (error) {
    console.error('Error fetching design names:', error);
    return [];
  }
}

export async function addDesignName(designName: string): Promise<string> {
  try {
    const designsRef = collection(db, 'empl_design_name');
    const docRef = await addDoc(designsRef, {
      designName: designName.trim(),
      displayName: designName.trim(),
      isActive: true,
      sources: ['Final Inspection'],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding design name:', error);
    throw error;
  }
}

// ============================================
// Shared Carpet Numbers (from carpet_no collection)
// ============================================

export interface CarpetNumber {
  id: string;
  carpetNo: string;
  designName?: string;
  opsNo?: string;
  productType?: 'rug' | 'broadloom';
  status?: string;
}

export async function getCarpetNumbers(productType?: 'rug' | 'broadloom'): Promise<CarpetNumber[]> {
  try {
    const carpetsRef = collection(db, 'carpet_no');
    const q = query(carpetsRef, orderBy('carpetNo', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        carpetNo: doc.data().carpetNo,
        designName: doc.data().designName,
        opsNo: doc.data().opsNo,
        productType: doc.data().productType,
        status: doc.data().status,
      }))
      .filter(c => {
        if (!c.carpetNo) return false;
        if (productType && c.productType !== productType) return false;
        return true;
      });
  } catch (error) {
    console.error('Error fetching carpet numbers:', error);
    return [];
  }
}

// ============================================
// OPS Order Lookup (from orders/data/orders collection)
// ============================================

/**
 * Normalize OPS number to handle different formats
 * e.g., "EM-25-747", "25-747", "OPS-25747", "EM25747" -> normalized for search
 */
function normalizeOpsNo(opsNo: string): string {
  // Remove common prefixes and normalize
  return opsNo
    .toUpperCase()
    .replace(/^(OPS[-\s]?|EM[-\s]?)/i, '')
    .replace(/[-\s]/g, '')
    .trim();
}

/**
 * Get list of all OPS numbers for dropdown
 * Returns recent orders sorted by date
 */
export async function getOpsList(): Promise<Array<{ salesNo: string; buyerName: string; buyerCode: string; poNumber: string; totalPcs: number; status: string }>> {
  try {
    const ordersRef = collection(db, 'orders', 'data', 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        // Calculate totalPcs from items array if not directly available
        let totalPcs = (data.totalPcs as number) || 0;
        if (totalPcs === 0 && Array.isArray(data.items)) {
          totalPcs = (data.items as Array<{ qty?: number; pcs?: number }>).reduce(
            (sum, item) => sum + ((item.qty as number) || (item.pcs as number) || 0),
            0
          );
        }
        return {
          salesNo: (data.salesNo as string) || '',
          buyerName: (data.buyerName as string) || '',
          buyerCode: (data.buyerCode as string) || (data.customerCode as string) || '',
          poNumber: (data.poNumber as string) || (data.poNo as string) || '',
          totalPcs,
          status: (data.status as string) || '',
        };
      })
      .filter(o => o.salesNo); // Only include orders with OPS numbers
  } catch (error) {
    console.error('Error fetching OPS list:', error);
    return [];
  }
}

/**
 * Get OPS order details by OPS number
 * Searches orders/data/orders by salesNo field
 */
export async function getOpsByNumber(opsNo: string): Promise<OpsOrder | null> {
  if (!opsNo || opsNo.trim().length < 2) return null;

  try {
    const ordersRef = collection(db, 'orders', 'data', 'orders');
    const inputNormalized = normalizeOpsNo(opsNo);

    // First try exact match on salesNo
    let q = query(ordersRef, where('salesNo', '==', opsNo.trim()));
    let snapshot = await getDocs(q);

    // If no exact match, try common formats
    if (snapshot.empty) {
      const formats = [
        opsNo.trim(),
        `OPS-${inputNormalized}`,
        `EM-${inputNormalized}`,
        inputNormalized,
      ];

      for (const format of formats) {
        q = query(ordersRef, where('salesNo', '==', format));
        snapshot = await getDocs(q);
        if (!snapshot.empty) break;
      }
    }

    if (snapshot.empty) {
      // Last resort: get all orders and search (inefficient but handles edge cases)
      const allOrdersSnapshot = await getDocs(ordersRef);
      const normalizedInput = normalizeOpsNo(opsNo);

      for (const doc of allOrdersSnapshot.docs) {
        const data = doc.data();
        if (data.salesNo && normalizeOpsNo(data.salesNo) === normalizedInput) {
          return mapOrderToOps(doc.id, data);
        }
      }
      return null;
    }

    const doc = snapshot.docs[0];
    return mapOrderToOps(doc.id, doc.data());
  } catch (error) {
    console.error('Error fetching OPS order:', error);
    return null;
  }
}

function mapOrderToOps(docId: string, data: Record<string, unknown>): OpsOrder {
  const items = (data.items as Array<Record<string, unknown>> || []).map((item, idx) => ({
    id: (item.id as string) || `item-${idx}`,
    articleName: (item.articleName as string) || '',
    size: item.size as string | undefined,
    color: item.color as string | undefined,
    quality: item.quality as string | undefined,
    pcs: (item.pcs as number) || (item.qty as number) || 0,
    sqm: (item.sqm as number) || 0,
    imageUrl: item.imageUrl as string | undefined,
  }));

  return {
    id: docId,
    salesNo: (data.salesNo as string) || '',
    poNumber: (data.poNumber as string) || (data.poNo as string) || '',
    buyerName: (data.buyerName as string) || '',
    buyerCode: (data.buyerCode as string) || (data.customerCode as string) || '',
    merchantCode: (data.merchantCode as string) || '',
    companyCode: ((data.companyCode as string) || 'EMPL') as 'EMPL' | 'EHI',
    orderType: (data.orderType as string) || 'production',
    shipDate: (data.shipDate as string) || '',
    totalPcs: (data.totalPcs as number) || items.reduce((sum, i) => sum + i.pcs, 0),
    totalSqm: (data.totalSqm as number) || items.reduce((sum, i) => sum + i.sqm, 0),
    status: (data.status as string) || '',
    items,
  };
}

/**
 * Get merchant emails by buyer code
 * Looks up merchants collection and returns emails for primary & assistant merchants
 */
export async function getMerchantEmailsByBuyerCode(buyerCode: string): Promise<string[]> {
  if (!buyerCode) return [];

  try {
    const merchantsRef = collection(db, 'merchants');
    const snapshot = await getDocs(merchantsRef);

    const emails: string[] = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const assignedBuyerCodes = (data.assignedBuyerCodes as string[]) || [];
      const email = (data.email as string) || '';
      const isActive = data.isActive !== false; // Default to active if not specified

      if (isActive && email && assignedBuyerCodes.includes(buyerCode)) {
        emails.push(email);
      }
    });

    return emails;
  } catch (error) {
    console.error('Error fetching merchant emails:', error);
    return [];
  }
}

/**
 * Get buyer profile with merchant info
 * Returns primary and assistant merchant emails for a buyer
 */
export async function getBuyerMerchantEmails(buyerCode: string): Promise<{ primary?: string; assistant?: string }> {
  if (!buyerCode) return {};

  try {
    // First check buyers collection for assigned merchants
    const buyersRef = collection(db, 'buyers');
    const q = query(buyersRef, where('code', '==', buyerCode));
    const buyerSnapshot = await getDocs(q);

    if (buyerSnapshot.empty) return {};

    const buyerData = buyerSnapshot.docs[0].data();
    const primaryMerchantId = buyerData.primaryMerchantId as string;
    const assistantMerchantId = buyerData.assistantMerchantId as string;

    const result: { primary?: string; assistant?: string } = {};

    // Fetch merchant emails by ID
    if (primaryMerchantId || assistantMerchantId) {
      const merchantsRef = collection(db, 'merchants');
      const merchantsSnapshot = await getDocs(merchantsRef);

      merchantsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const email = (data.email as string) || '';
        const merchantId = doc.id;
        const merchantCode = (data.code as string) || '';

        if (email) {
          if (primaryMerchantId && (merchantId === primaryMerchantId || merchantCode === primaryMerchantId)) {
            result.primary = email;
          }
          if (assistantMerchantId && (merchantId === assistantMerchantId || merchantCode === assistantMerchantId)) {
            result.assistant = email;
          }
        }
      });
    }

    return result;
  } catch (error) {
    console.error('Error fetching buyer merchant emails:', error);
    return {};
  }
}

// ============================================
// PDF Upload to Firebase Storage
// ============================================

/**
 * Upload PDF to Firebase Storage and get download URL
 * @param pdfBase64 Base64 encoded PDF string
 * @param filename Filename for the PDF
 * @returns Download URL for the uploaded PDF
 */
export async function uploadPdfToStorage(pdfBase64: string, filename: string): Promise<string> {
  try {
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `final-inspection-reports/${timestamp}_${safeName}`;

    const storageRef = ref(storage, storagePath);

    // Upload the base64 PDF
    await uploadString(storageRef, pdfBase64, 'base64', {
      contentType: 'application/pdf'
    });

    // Get the download URL
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading PDF to storage:', error);
    throw error;
  }
}

// ============================================
// Cloud Draft Persistence (Firestore)
// ============================================

const DRAFTS_COLLECTION = 'final_inspection_drafts';

export interface CloudDraft {
  id: string;
  formData: Record<string, unknown>;
  defects: Array<Record<string, unknown>>;
  selectedSizes: string[];
  sizeUnit: string;
  // OPS-related
  opsNo?: string;
  customerName?: string;
  customerCode?: string;
  emplDesignNo?: string;
  // Metadata
  savedAt: string;
  updatedAt: unknown; // serverTimestamp
  createdAt: unknown;
}

/**
 * Save or update a draft in Firestore
 * Uses a deterministic ID based on form content to avoid duplicates
 */
export async function saveCloudDraft(
  draftId: string | null,
  data: {
    formData: Record<string, unknown>;
    defects: Array<Record<string, unknown>>;
    selectedSizes: string[];
    sizeUnit: string;
  }
): Promise<string> {
  try {
    const formData = data.formData as Record<string, string>;
    const draftData = {
      formData: data.formData,
      defects: data.defects,
      selectedSizes: data.selectedSizes,
      sizeUnit: data.sizeUnit,
      // Denormalized fields for list display
      opsNo: formData.opsNo || '',
      customerName: formData.customerName || '',
      customerCode: formData.customerCode || '',
      emplDesignNo: formData.emplDesignNo || '',
      company: formData.company || '',
      qcInspectorName: formData.qcInspectorName || '',
      savedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    };

    if (draftId) {
      // Update existing draft
      const draftRef = doc(db, DRAFTS_COLLECTION, draftId);
      await setDoc(draftRef, draftData, { merge: true });
      return draftId;
    } else {
      // Create new draft
      const docRef = await addDoc(collection(db, DRAFTS_COLLECTION), {
        ...draftData,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    }
  } catch (error) {
    console.error('Error saving cloud draft:', error);
    throw error;
  }
}

/**
 * Get all cloud drafts, sorted by most recently updated
 */
export async function getCloudDrafts(): Promise<CloudDraft[]> {
  try {
    const draftsRef = collection(db, DRAFTS_COLLECTION);
    const q = query(draftsRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        formData: (data.formData as Record<string, unknown>) || {},
        defects: (data.defects as Array<Record<string, unknown>>) || [],
        selectedSizes: (data.selectedSizes as string[]) || [],
        sizeUnit: (data.sizeUnit as string) || 'cm',
        opsNo: (data.opsNo as string) || '',
        customerName: (data.customerName as string) || '',
        customerCode: (data.customerCode as string) || '',
        emplDesignNo: (data.emplDesignNo as string) || '',
        savedAt: (data.savedAt as string) || '',
        updatedAt: data.updatedAt,
        createdAt: data.createdAt,
      };
    });
  } catch (error) {
    console.error('Error fetching cloud drafts:', error);
    return [];
  }
}

/**
 * Get a single cloud draft by ID
 */
export async function getCloudDraft(draftId: string): Promise<CloudDraft | null> {
  try {
    const draftRef = doc(db, DRAFTS_COLLECTION, draftId);
    const snapshot = await getDoc(draftRef);

    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
      id: snapshot.id,
      formData: (data.formData as Record<string, unknown>) || {},
      defects: (data.defects as Array<Record<string, unknown>>) || [],
      selectedSizes: (data.selectedSizes as string[]) || [],
      sizeUnit: (data.sizeUnit as string) || 'cm',
      opsNo: (data.opsNo as string) || '',
      customerName: (data.customerName as string) || '',
      customerCode: (data.customerCode as string) || '',
      emplDesignNo: (data.emplDesignNo as string) || '',
      savedAt: (data.savedAt as string) || '',
      updatedAt: data.updatedAt,
      createdAt: data.createdAt,
    };
  } catch (error) {
    console.error('Error fetching cloud draft:', error);
    return null;
  }
}

/**
 * Delete a cloud draft
 */
export async function deleteCloudDraft(draftId: string): Promise<void> {
  try {
    const draftRef = doc(db, DRAFTS_COLLECTION, draftId);
    await deleteDoc(draftRef);
  } catch (error) {
    console.error('Error deleting cloud draft:', error);
    throw error;
  }
}

/**
 * Convert Firestore Timestamp to readable string
 */
export function timestampToString(ts: unknown): string {
  if (!ts) return '';
  if (ts instanceof Timestamp) {
    return ts.toDate().toLocaleString();
  }
  if (typeof ts === 'object' && ts !== null && '_seconds' in ts) {
    return new Date((ts as { _seconds: number })._seconds * 1000).toLocaleString();
  }
  if (typeof ts === 'string') return ts;
  return '';
}

export default app;
