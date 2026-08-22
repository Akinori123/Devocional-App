import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
    // We don't have the config here, it's on the client.
};
