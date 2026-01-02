import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { Customer } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyBSnzCBh-nhQs2nNuPpV_xpRp29FyUyHuc",
  authDomain: "easternmillscom.firebaseapp.com",
  projectId: "easternmillscom",
  storageBucket: "easternmillscom.firebasestorage.app",
  messagingSenderId: "249673281284",
  appId: "1:249673281284:web:2ca71b5a1d41936d0d2a51"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Customers collection (synced with TED forms)
export const customersCollection = collection(db, 'customers');

// Get all customers from Firestore
export async function getCustomers(): Promise<Customer[]> {
  try {
    const q = query(customersCollection, orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      name: doc.data().name,
      code: doc.data().code
    }));
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
}

// Add a new customer to Firestore
export async function addCustomer(customer: Customer): Promise<void> {
  try {
    await addDoc(customersCollection, {
      name: customer.name,
      code: customer.code,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error adding customer:', error);
    throw error;
  }
}
