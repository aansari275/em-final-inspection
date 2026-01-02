// Seed script to clean up and populate Firestore with TED form buyers ONLY
// Run with: node seed-ted-customers.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, addDoc, Timestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBSnzCBh-nhQs2nNuPpV_xpRp29FyUyHuc",
  authDomain: "easternmillscom.firebaseapp.com",
  projectId: "easternmillscom",
  storageBucket: "easternmillscom.firebasestorage.app",
  messagingSenderId: "249673281284",
  appId: "1:249673281284:web:2ca71b5a1d41936d0d2a51"
};

// TED Form Buyers - Source of truth (57 buyers from ted-form-app.js)
const TED_BUYERS = [
  { name: "ARSIN RIG", code: "A-01" },
  { name: "ATELIER TORTIL", code: "A-02" },
  { name: "AMPM", code: "A-03" },
  { name: "ABC ITALIA AMINI", code: "A-05" },
  { name: "ADORA", code: "A-06" },
  { name: "BENUTA", code: "B-02" },
  { name: "COURISTAN", code: "C-01" },
  { name: "C.C.MILANO", code: "C-02" },
  { name: "CLASSIC COLLECTION", code: "C-03" },
  { name: "DESIGNER GUILD", code: "D-01" },
  { name: "DESIGNER RUGS", code: "D-02" },
  { name: "EDITION 1.6.9", code: "E-01" },
  { name: "FERM LIVING", code: "F-01" },
  { name: "FAYETTE STUDIO", code: "F-02" },
  { name: "GRAN LIVING", code: "G-01" },
  { name: "HAY", code: "H-01" },
  { name: "ILVA", code: "I-01" },
  { name: "JOHN LEWIS", code: "J-01" },
  { name: "JACARANDA", code: "J-02" },
  { name: "JAIPUR LIVING", code: "J-03" },
  { name: "KPETTO", code: "K-01" },
  { name: "KAWAMOTO", code: "K-02" },
  { name: "LULU & GEORGIA", code: "L-01" },
  { name: "LOLOI", code: "L-02" },
  { name: "LA-REDOUTE", code: "L-03" },
  { name: "LI WOOD", code: "L-04" },
  { name: "MENU AS", code: "M-01" },
  { name: "MUUTO", code: "M-02" },
  { name: "MOHAWK HOME", code: "M-03" },
  { name: "MIO", code: "M-04" },
  { name: "MARINA RETAIL HOME", code: "M-05" },
  { name: "MARC PHILIPS LA", code: "M-06" },
  { name: "MARC PHILIPS NY", code: "M-07" },
  { name: "MAHARAM", code: "M-08" },
  { name: "MANZIL RUGS", code: "M-09" },
  { name: "MOMINI", code: "M-10" },
  { name: "MEHARBAN RUGS", code: "M-11" },
  { name: "MARTIN PATRIC", code: "M-12" },
  { name: "NOURISON", code: "N-01" },
  { name: "NORDIC KNOTS", code: "N-02" },
  { name: "NINE UNITED", code: "N-03" },
  { name: "PETER PAGE", code: "P-01" },
  { name: "POSL POTTEN", code: "P-02" },
  { name: "RESTORATION HARDWARE", code: "R-01" },
  { name: "RUSTA", code: "R-02" },
  { name: "SOK", code: "S-01" },
  { name: "STANTON", code: "S-02" },
  { name: "SOHO HOME", code: "S-03" },
  { name: "STARK", code: "S-04" },
  { name: "SHIRR RUGS", code: "S-05" },
  { name: "SOSTRENE GRENES", code: "S-06" },
  { name: "Son Tapis", code: "S-07" },
  { name: "THE RUG COLLECTION", code: "T-01" },
  { name: "THE RUG ESTABLISHMENT", code: "T-02" },
  { name: "VERY COOK", code: "V-01" },
  { name: "ZARA", code: "Z-01" }
];

async function seedCustomers() {
  console.log('🔥 Initializing Firebase...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const customersRef = collection(db, 'customers');

  // Step 1: Delete all existing customers
  console.log('\n🗑️  Deleting all existing customers...');
  const existingDocs = await getDocs(customersRef);
  let deleteCount = 0;

  for (const docSnapshot of existingDocs.docs) {
    await deleteDoc(doc(db, 'customers', docSnapshot.id));
    deleteCount++;
  }
  console.log(`   ✅ Deleted ${deleteCount} existing customers`);

  // Step 2: Add TED form buyers
  console.log(`\n📝 Seeding ${TED_BUYERS.length} TED form buyers...`);
  let addCount = 0;

  for (const buyer of TED_BUYERS) {
    await addDoc(customersRef, {
      name: buyer.name,
      code: buyer.code,
      createdAt: Timestamp.now()
    });
    addCount++;
    if (addCount % 10 === 0) {
      console.log(`   Progress: ${addCount}/${TED_BUYERS.length}`);
    }
  }

  console.log(`   ✅ Added ${addCount} TED form buyers`);
  console.log('\n🎉 Done! Firestore customers collection now contains only TED form buyers.');
  process.exit(0);
}

seedCustomers().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
