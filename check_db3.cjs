const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('devotionals').get();
  snapshot.forEach(doc => {
    const d = doc.data();
    if (d.theme.toLowerCase().includes('amor')) {
      console.log(doc.id, d.theme, d.title);
    }
  });
}
run();
