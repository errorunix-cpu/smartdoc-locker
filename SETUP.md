# SmartDoc Locker — full project files

## Files
- `index.html` — app interface
- `styles.css` — main visual styling
- `styles-extra.css` — theme toggle and added feature styling
- `app.js` — Firebase email/password authentication and app behavior
- `firebase-config.js` — Firebase web app configuration
- `firestore.rules` — starter Firestore rules
- `storage.rules` — starter Storage rules (the app does not currently upload files to Firebase Storage)

## Run / deploy
1. Keep all files in the same project directory.
2. Enable **Email/Password** in Firebase Authentication.
3. Open the project locally using a static development server (ES modules do not work reliably from a `file://` URL), or publish the files to GitHub Pages.
4. Commit and push all seven files to the repository's root folder.

## Features in this build
- Email/password sign-up and sign-in, password reset
- PDF/image upload into temporary browser memory
- File preview, download and delete
- OCR attempt for supported images when Tesseract.js is available
- Search, file-type filter and document-category filter
- Favorites, tags, personal notes and expiry dates
- Expiry indicators and dashboard counts
- Light/dark theme preference stored in local browser storage
- Built-in rules-based Smart AI Search helper (not a connected generative AI model)

## Important storage limitation
**This build does not permanently store uploaded documents or their metadata in Firestore or Firebase Storage.** Files and their metadata live in the current page session and are lost on refresh, tab closure, or sign-out. The theme preference alone is stored in local browser storage. Firebase is used for account authentication only. Do not upload real Aadhaar, PAN, bank, medical, or other sensitive documents; use test/sample files for this prototype.

The Firebase Storage rules file is included for reference but the app does not use Firebase Storage, and no Storage bucket/billing setup is assumed. Do not claim this prototype is a production-secure document vault.
