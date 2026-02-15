import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "FIREBASE_API_KEY_PLACEHOLDER",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "FIREBASE_AUTH_DOMAIN_PLACEHOLDER",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "FIREBASE_PROJECT_ID_PLACEHOLDER",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "FIREBASE_STORAGE_BUCKET_PLACEHOLDER",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "FIREBASE_MESSAGING_SENDER_ID_PLACEHOLDER",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "FIREBASE_APP_ID_PLACEHOLDER",
};

const functionsRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION ?? "us-central1";

const requiredConfigKeys: Array<keyof typeof firebaseConfig> = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

export const isFirebaseConfigured = requiredConfigKeys.every((key) => {
  const value = firebaseConfig[key];
  return Boolean(value) && !value.includes("PLACEHOLDER");
});

export const assertFirebaseConfigured = () => {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase is not configured. Set VITE_FIREBASE_* environment variables before running the migrated backend.",
    );
  }
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const firebaseFunctions = getFunctions(firebaseApp, functionsRegion);
export const firebaseStorage = getStorage(firebaseApp);

