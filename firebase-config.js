// 1. Create a Firebase project at https://console.firebase.google.com/
// 2. Add a Web App to the project and copy its Firebase config here.
// 3. Do not place service-account credentials or private API keys in this file.
// The Firebase web config is not a service-account secret; security comes from Auth + rules.
export const firebaseConfig = {
  apiKey: "PASTE_YOUR_FIREBASE_WEB_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",
  appId: "PASTE_YOUR_FIREBASE_APP_ID"
};

export const firebaseConfigured = !Object.values(firebaseConfig).some(value =>
  String(value).startsWith("PASTE_YOUR_")
);
