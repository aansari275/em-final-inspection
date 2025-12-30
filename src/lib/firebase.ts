import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
