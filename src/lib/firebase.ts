
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCZsY-8nrPuAg_cA5E8zjUbRKHKsBoTVUA",
  authDomain: "project-manager-6a2b7.firebaseapp.com",
  projectId: "project-manager-6a2b7",
  storageBucket: "project-manager-6a2b7.appspot.com",
  messagingSenderId: "450423267155",
  appId: "1:450423267155:web:dfbd03eb4c62cb6a024ba6",
  measurementId: "G-1114HMBZHW"
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

// Initialize Firebase.
// This is to prevent crashing the app if the .env.local file is not set up.
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // If initialization fails, ensure services are null to prevent further errors.
    app = null;
    auth = null;
    db = null;
    storage = null;
  }
} else {
    // This will show in the browser console if the env vars are missing
    console.warn("Firebase configuration is missing or incomplete. Firebase features will be disabled. Please check your .env.local file.");
}

export { app, auth, db, storage };
