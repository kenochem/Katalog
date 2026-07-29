import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, writeBatch } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const firebaseConfig = {
  apiKey: 'AIzaSyD4663ZvrUlew72cs3E2p0kxk3cpfPubR4',
  authDomain: 'kenochem-f4a5b.firebaseapp.com',
  projectId: 'kenochem-f4a5b',
  storageBucket: 'kenochem-f4a5b.firebasestorage.app',
  messagingSenderId: '372777241729',
  appId: '1:372777241729:web:0df5875cfbcaa6b9ca9180',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const productsPath = join(__dirname, '../data/products.json');
const products = JSON.parse(readFileSync(productsPath, 'utf8'));

console.log(`Importing ${products.length} products to Firestore...`);

const BATCH_SIZE = 400;
let imported = 0;

for (let i = 0; i < products.length; i += BATCH_SIZE) {
  const batch = writeBatch(db);
  const chunk = products.slice(i, i + BATCH_SIZE);

  for (const product of chunk) {
    const ref = doc(db, 'products', product.id);
    batch.set(ref, product);
  }

  await batch.commit();
  imported += chunk.length;
  console.log(`  ${imported}/${products.length}`);
}

console.log('Done! Products imported to Firestore collection "products".');
