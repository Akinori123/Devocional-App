const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('devotionals').get();
  let count = 0;
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (d.theme.toLowerCase().includes('parte')) {
      console.log('Deleting', doc.id, d.theme);
      await db.collection('devotionals').doc(doc.id).delete();
      count++;
    }
  }
  console.log(`Deleted ${count} documents.`);
}
run();
