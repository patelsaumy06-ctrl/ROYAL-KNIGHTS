// src/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDqvL_2Y4FLuhJEnravHDbopjlVslfmaV0",
  authDomain: import.meta.env.VITE_AUTH_DOMAIN || "needlink-ai.firebaseapp.com",
  databaseURL: import.meta.env.VITE_DATABASE_URL || "https://needlink-ai-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_PROJECT_ID || "needlink-ai",
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET || "needlink-ai.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID || "1015764577813",
  appId: import.meta.env.VITE_APP_ID || "1:1015764577813:web:a7207cf32fb2e482bda81c",
  measurementId: import.meta.env.VITE_MEASUREMENT_ID || "G-05R36B59MQ",
};

// Prevent duplicate app initialization (e.g. hot-reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Analytics only works in browser environments — skip in SSR / Node
isSupported().then((yes) => { if (yes) getAnalytics(app); });

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;