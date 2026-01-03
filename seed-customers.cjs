// One-time seed script to populate Firestore with TED's 57 buyers
// Run with: node seed-customers.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, Timestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBSnzCBh-nhQs2nNuPpV_xpRp29FyUyHuc",
  authDomain: "easternmillscom.firebaseapp.com",
  projectId: "easternmillscom",
  storageBucket: "easternmillscom.firebasestorage.app",
  messagingSenderId: "249673281284",
  appId: "1:249673281284:web:2ca71b5a1d41936d0d2a51"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const customersCollection = collection(db, 'customers');

// TED's 57 pre-defined buyers with codes
const tedBuyers = [
  { name: "ARSIN RIG", code: "A-01" },
  { name: "BENUTA", code: "B-02" },
  { name: "CHARLES & HUNT", code: "C-01" },
  { name: "DESIGN HOUSE INDIA", code: "D-01" },
  { name: "DEPOT", code: "D-02" },
  { name: "DOMOTEX GERMANY", code: "D-03" },
  { name: "ESSENCE OF KASHMIR", code: "E-01" },
  { name: "FABINDIA", code: "F-01" },
  { name: "FEIZY", code: "F-02" },
  { name: "FLOOR & FURNISHINGS", code: "F-03" },
  { name: "GLOBAL VIEWS", code: "G-01" },
  { name: "HABITAT", code: "H-01" },
  { name: "HOME CENTRE", code: "H-02" },
  { name: "HOMEWARE GALLERY", code: "H-03" },
  { name: "IMPERIAL KNOTS", code: "I-01" },
  { name: "JAIPUR LIVING", code: "J-01" },
  { name: "JAIPUR RUGS", code: "J-02" },
  { name: "KAPETTO", code: "K-01" },
  { name: "KALEEN", code: "K-02" },
  { name: "KIRAN'S", code: "K-03" },
  { name: "LIGNE PURE", code: "L-01" },
  { name: "LOLOI", code: "L-02" },
  { name: "MASLAND", code: "M-01" },
  { name: "MANOR HOUSE", code: "M-02" },
  { name: "MILL SILVER", code: "M-03" },
  { name: "MOMENI", code: "M-04" },
  { name: "NORDIC KNOTS", code: "N-02" },
  { name: "NOURISON", code: "N-03" },
  { name: "OBEETEE", code: "O-01" },
  { name: "ORIENTAL WEAVERS", code: "O-02" },
  { name: "POTTERY BARN", code: "P-01" },
  { name: "PAPILIO", code: "P-02" },
  { name: "PIER 1", code: "P-03" },
  { name: "PRIVATE LABEL", code: "P-04" },
  { name: "QUADRIFOGLIO", code: "Q-01" },
  { name: "RESTORATION HARDWARE", code: "R-01" },
  { name: "RIVIERA MAISON", code: "R-02" },
  { name: "RUG REPUBLIC", code: "R-03" },
  { name: "RUGS USA", code: "R-04" },
  { name: "SAFAVIEH", code: "S-01" },
  { name: "SARASWATI GLOBAL", code: "S-02" },
  { name: "SERENA & LILY", code: "S-03" },
  { name: "STARK", code: "S-04" },
  { name: "SURYA", code: "S-05" },
  { name: "TARGET", code: "T-01" },
  { name: "THE RUG COMPANY", code: "T-02" },
  { name: "TIBETAN RUGS", code: "T-03" },
  { name: "URBAN LADDER", code: "U-01" },
  { name: "UTTERMOST", code: "U-02" },
  { name: "VIKRAM EXPORTS", code: "V-01" },
  { name: "WALMART", code: "W-01" },
  { name: "WAYFAIR", code: "W-02" },
  { name: "WEST ELM", code: "W-03" },
  { name: "WILLIAMS SONOMA", code: "W-04" },
  { name: "WORLD MARKET", code: "W-05" },
  { name: "ZARA HOME", code: "Z-01" },
  { name: "Z GALLERIE", code: "Z-02" }
];

async function seedCustomers() {
  console.log('Checking existing customers in Firestore...');

  // Check if collection already has data
  const existingDocs = await getDocs(customersCollection);
  if (!existingDocs.empty) {
    console.log(`Found ${existingDocs.size} existing customers. Skipping seed.`);
    console.log('To re-seed, manually delete the customers collection first.');
    process.exit(0);
  }

  console.log(`Seeding ${tedBuyers.length} customers from TED...`);

  for (const buyer of tedBuyers) {
    try {
      await addDoc(customersCollection, {
        name: buyer.name,
        code: buyer.code,
        createdAt: Timestamp.now()
      });
      console.log(`  + ${buyer.name} (${buyer.code})`);
    } catch (error) {
      console.error(`  ! Failed to add ${buyer.name}:`, error.message);
    }
  }

  console.log('\nSeeding complete!');
  process.exit(0);
}

seedCustomers().catch(console.error);
