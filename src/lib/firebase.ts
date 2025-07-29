
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyA5iKyqhZl-MW44GM_udwNthTBRbPIX9_o",
  authDomain: "property-manager-8f81f.firebaseapp.com",
  projectId: "property-manager-8f81f",
  storageBucket: "property-manager-8f81f.appspot.com",
  messagingSenderId: "644647608964",
  appId: "1:644647608964:web:30e419501ccce24a1e58d1",
  measurementId: "G-Z1BMNRWY1F"
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Initialize Firebase.
// This is to prevent crashing the app if the .env.local file is not set up.
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // If initialization fails, ensure services are null to prevent further errors.
    app = null;
    auth = null;
    db = null;
  }
} else {
    // This will show in the browser console if the env vars are missing
    console.warn("Firebase configuration is missing or incomplete. Firebase features will be disabled. Please check your .env.local file.");
}

export { app, auth, db };

    