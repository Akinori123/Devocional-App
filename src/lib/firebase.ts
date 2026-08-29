import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey || "AIzaSyBInDV-wE6kcOC6ggFBy8xyjNc31HLuD7w",
  authDomain: firebaseConfigJson.authDomain || "devocional-app-63871.firebaseapp.com",
  projectId: firebaseConfigJson.projectId || "devocional-app-63871",
  storageBucket: firebaseConfigJson.storageBucket || "devocional-app-63871.firebasestorage.app",
  messagingSenderId: firebaseConfigJson.messagingSenderId || "448557677071",
  appId: firebaseConfigJson.appId || "1:448557677071:web:36a9227875520a176b817a",
  measurementId: firebaseConfigJson.measurementId || "G-ZYVY151QSP"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, firebaseConfigJson.firestoreDatabaseId || '(default)');
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
