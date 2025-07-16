import { initializeApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL, // This is for production
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIRE_BASE_APP_ID,
};

console.log("Firebase config:", {
  databaseURL: firebaseConfig.databaseURL,
  projectId: firebaseConfig.projectId,
  nodeEnv: process.env.NODE_ENV,
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
const database = getDatabase(app);

// Connect to the emulator if running locally
if (process.env.NODE_ENV === "development") {
  try {
    connectDatabaseEmulator(database, "127.0.0.1", 9000);
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
} else {
  console.log("Using production Firebase database");
}

export { database };
