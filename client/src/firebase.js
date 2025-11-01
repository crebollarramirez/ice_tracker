import { initializeApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";

import {
  getAuth,
  connectAuthEmulator,
} from "firebase/auth";

import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIRE_BASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize App Check only on client side
if (typeof window !== "undefined") {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(
        process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      ),
      isTokenAutoRefreshEnabled: true,
    });
    console.log("App Check initialized successfully");
  } catch (error) {
    console.warn("App Check initialization failed:", error);
  }
}

// Initialize Realtime Database
const database = getDatabase(app);

// Initialize Firebase Functions
const functions = getFunctions(app);

// initialize Firebase Auth instance
const auth = getAuth(app);

// Connect to the emulator if running locally
if (process.env.NODE_ENV === "development") {
  try {
    connectDatabaseEmulator(database, "127.0.0.1", 9000);
    connectAuthEmulator(auth, "http://127.0.0.1:5050"); // ← Add http:// protocol
    console.log("Connected to Firebase Realtime Database Emulator");
  } catch (error) {
    if (error.message.includes("already")) {
      console.log("Database emulator connection already established");
    } else {
      console.error(
        "❌ Failed to connect to database emulator:",
        error.message
      );
    }
  }

  // Connect to Functions emulator
  try {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    console.log("Connected to Firebase Functions Emulator");
  } catch (error) {
    if (error.message.includes("already")) {
      console.log("Functions emulator connection already established");
    } else {
      console.error(
        "❌ Failed to connect to functions emulator:",
        error.message
      );
    }
  }
} else {
  console.log("Using production Firebase database and functions");
}

// Create callable function reference
const pinFunction = httpsCallable(functions, "pin");

export { database, pinFunction, auth };
