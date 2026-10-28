# SmartDoc Locker — setup and publishing guide

This is a static React-free HTML/CSS/JavaScript starter with Firebase Authentication, Cloud Firestore, Firebase Storage, client-side OCR for images, document search, and a prototype document-aware assistant.

## Before you start
- Use **sample / synthetic documents only** while developing.
- This project is a student prototype, not a certified secure vault.
- The assistant in this version is rule-based and searches saved metadata/OCR text. It is **not a live generative AI model**. A real AI model must be connected through a secure backend; never put a private AI API key in browser JavaScript.
- Firebase Storage availability and billing requirements depend on your Firebase project/plan. Check the current Firebase console before enabling it.

## 1. Create a Firebase project
1. Open https://console.firebase.google.com/ and create a project.
2. In Project settings, add a **Web app**.
3. Copy the web app config into `firebase-config.js`, replacing every `PASTE_YOUR_...` value.
4. Under **Authentication → Sign-in method**, enable **Email/Password**.
5. Under **Firestore Database**, create a database.
6. Under **Storage**, set up a bucket if available for your plan.
7. In the Firebase console, open Firestore Rules and paste the contents of `firestore.rules`, then publish.
8. Open Storage Rules and paste the contents of `storage.rules`, then publish.

The Firebase web config is expected to be visible in client code. Do **not** ever put service-account JSON, private keys, or AI provider secrets in this repository. The security rules are critical.

## 2. Run locally
Because this uses JavaScript ES modules, open the folder with a local static server (do not simply double-click `index.html`).
- With VS Code, install/use the Live Server extension, then choose **Open with Live Server**.
- Or with Python installed, run from this folder: `python -m http.server 8000`, then open `http://localhost:8000`.

## 3. Publish on GitHub Pages
1. Create a GitHub repository, for example `smartdoc-locker`.
2. Upload `index.html`, `styles.css`, `app.js`, `firebase-config.js`, and this guide. Keep the rules files for reference.
3. In repository **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
4. Wait for GitHub Pages to publish. Open the published URL and test signup, upload, search, and sign-out.
5. If your site is published at a project URL such as `https://username.github.io/smartdoc-locker/`, the relative file paths in the project work without a custom build.

## 4. What works in this starter
- Animated landing page and responsive layout
- Email/password registration, login, and password reset (once Firebase is configured)
- Minimum of 4 uploaded documents before the dashboard can be opened
- PDF/image uploads to Firebase Storage
- Per-user document metadata in Firestore
- Image OCR using Tesseract.js (PDF OCR is not implemented in this starter)
- Search by document name, category, and OCR text
- View basic document metadata, extracted text (with basic masking), open/download, delete
- Prototype assistant for common library questions and simple matching

## 5. Known limitations and safety notes
- OCR can misread text; the user should confirm category and extracted information.
- The basic masking function is a demonstration only and cannot guarantee all sensitive data is masked. Avoid uploading real Aadhaar, bank, credit/debit card, passport, or other identity documents.
- A Firebase download URL is a bearer-style URL. For production-grade sensitive documents, consider authenticated backend downloads rather than displaying permanent download URLs in the UI.
- Sharing, access revocation, expiration reminders, and true generative AI are not yet implemented in this starter.
- `firestore.rules` and `storage.rules` are starter rules. Test them in the Firebase Rules Playground and review them before storing any real user data.
- The storage rule includes an explicit owner-delete rule; adjust and test rules for your final app.
- This app does not verify document authenticity. Number patterns and OCR are not proof of validity.

## Troubleshooting
- “Firebase is not configured”: replace all placeholders in `firebase-config.js`.
- `auth/operation-not-allowed`: enable Email/Password in Firebase Authentication.
- `permission-denied` or `storage/unauthorized`: publish the rules and confirm the user is signed in.
- Tesseract may take a little while on first use and works best on clear images with readable text.
