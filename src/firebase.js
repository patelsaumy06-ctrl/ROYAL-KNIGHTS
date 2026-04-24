// src/firebase.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Keep runtime configuration in env vars so keys/domains are not hardcoded in source control.
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDqvL_2Y4FLuhJEnravHDbopjlVslfmaV0",
  authDomain: "needlink-ai.firebaseapp.com",
  databaseURL: "https://needlink-ai-default-rtdb.firebaseio.com",
  projectId: "needlink-ai",
  storageBucket: "needlink-ai.firebasestorage.app",
  messagingSenderId: "1015764577813",
  appId: "1:1015764577813:web:a7207cf32fb2e482bda81c",
  measurementId: "G-05R36B59MQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Analytics
// analytics already initialized above

export default app;