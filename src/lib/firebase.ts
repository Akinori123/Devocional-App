import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyBInDV-wE6kcOC6ggFBy8xyjNc31HLuD7w",
  authDomain: "devocional-app-63871.firebaseapp.com",
  projectId: "devocional-app-63871",
  storageBucket: "devocional-app-63871.firebasestorage.app",
  messagingSenderId: "448557677071",
  appId: "1:448557677071:web:36a9227875520a176b817a",
  measurementId: "G-ZYVY151QSP"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});
export const auth = getAuth(app);

export const getMessagingInstance = async () => {
  try {
    if (typeof window === 'undefined') return null;
    const supported = await isSupported();
    if (supported) {
      return getMessaging(app);
    }
    return null;
  } catch (err) {
    console.error("Messaging not supported", err);
    return null;
  }
};
