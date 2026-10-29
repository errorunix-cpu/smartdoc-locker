// Firebase Web App configuration for the SmartDoc Locker project.
// This is public client configuration, NOT a service-account credential.
// Security must be enforced with Firebase Authentication and database rules.
export const firebaseConfig = {
  apiKey: "AIzaSyDDkBMQrcxQO7d8vr8Uic_4EhbVi7GM0",
  authDomain: "smartdoc-locker.firebaseapp.com",
  projectId: "smartdoc-locker",
  storageBucket: "smartdoc-locker.firebasestorage.app",
  messagingSenderId: "153061996997",
  appId: "1:153061996997:web:80ec6e7c4d5e64c82e73ac"
};

export const firebaseConfigured = !Object.values(firebaseConfig).some(value =>
  !value || String(value).startsWith("PASTE_YOUR_")
);
