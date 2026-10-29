// 1. Create a Firebase project at https://console.firebase.google.com/
// 2. Add a Web App to the project and copy its Firebase config here.
// 3. Do not place service-account credentials or private API keys in this file.
// The Firebase web config is not a service-account secret; security comes from Auth + rules.
export const firebaseConfig = {
  apiKey: "AIzaSyDDkBMQrcxQO7d8vr8Uic_4EhbVi7GMZV0",
  authDomain:  "smartdoc-locker.firebaseapp.com",
  projectId: "smartdoc-locker",
  storageBucket: "smartdoc-locker.firebasestorage.app",
  messagingSenderId:"153061996997",
  appId: "1:153061996997:web:80ec6e7c4d5e64c82e73ac",
};

export const firebaseConfigured = !Object.values(firebaseConfig).some(value =>
  String(value).startsWith("PASTE_YOUR_")
);
