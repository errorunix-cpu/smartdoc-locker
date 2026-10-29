import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  firebaseConfig,
  firebaseConfigured
} from "./firebase-config.js";

const $ = (id) => document.getElementById(id);

const DOC_TYPES = [
  "Aadhaar Card",
  "PAN Card",
  "Credit Card",
  "Debit Card",
  "Voter ID",
  "Caste Certificate",
  "Income Certificate",
  "Caste & Income Certificate",
  "371J Certificate",
  "Driving Licence",
  "10th Marks Card / SSLC",
  "12th Marks Card / PUC",
  "Passport",
  "Bank Passbook",
  "Land Survey Document",
  "Other Document"
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIN_DOCS = 4;

let app;
let auth;
let currentUser = null;
let docsCache = [];
let selectedFile = null;
let authMode = "signup";
let activeFilter = "all";
let activeDocId = null;
let toastTimer;

const pages = [
  "pageWelcome",
  "pageAuth",
  "pageUpload",
  "pageDashboard"
];

/* =========================
   PAGE NAVIGATION
========================= */

function showPage(id) {
  pages.forEach((pageId) => {
    $(pageId).classList.toggle("active", pageId === id);
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================
   NOTIFICATIONS
========================= */

function showToast(message) {
  const el = $("toast");

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3300);
}

function setMessage(id, message, success = false) {
  const el = $(id);

  el.textContent = message;
  el.classList.toggle("success", success);
}

/* =========================
   SECURITY HELPERS
========================= */

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function friendlyError(error) {
  const code = error?.code || "";

  const map = {
    "auth/email-already-in-use":
      "That email already has an account. Try signing in.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Choose a stronger password (at least 8 characters).",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/user-not-found":
      "No account found for this email.",

    "auth/wrong-password":
      "Email or password is incorrect.",

    "auth/too-many-requests":
      "Too many attempts. Please wait and try again.",

    "auth/network-request-failed":
      "Network issue. Check your internet connection.",

    "permission-denied":
      "Firebase denied access. Check your Firebase security settings."
  };

  return map[code] ||
    error?.message ||
    "Something went wrong. Please try again.";
}

function requireConfigured() {
  if (!firebaseConfigured) {
    setMessage(
      "authMessage",
      "Firebase is not configured yet. Add your web app configuration to firebase-config.js."
    );

    return false;
  }

  return true;
}

function getInitials(name, email) {
  const source = (name || email || "U").trim();

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function iconFor(fileName) {
  return /\.pdf$/i.test(fileName) ? "PDF" : "IMG";
}

function formatSize(bytes = 0) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeDate(value) {
  if (!value) {
    return "Just now";
  }

  const date = value?.toDate
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently added";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/* =========================
   SENSITIVE TEXT MASKING
========================= */

function maskSensitive(text = "") {
  return String(text)
    .replace(
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      (match) =>
        "XXXX XXXX " +
        match.replace(/\D/g, "").slice(-4)
    )
    .replace(
      /\b[A-Z]{5}\d{4}[A-Z]\b/gi,
      (match) =>
        `${match.slice(0, 2)}XXXXX${match.slice(-2)}`
    );
}

/* =========================
   DOCUMENT CATEGORIES
========================= */

function fillDocTypes() {
  $("docType").innerHTML = DOC_TYPES
    .map((type) => {
      return `
        <option value="${escapeHtml(type)}">
          ${escapeHtml(type)}
        </option>
      `;
    })
    .join("");

  $("suggestedTypes").innerHTML = DOC_TYPES
    .slice(0, 15)
    .map((type, index) => {
      const alreadyAdded = docsCache.some(
        (doc) => doc.type === type
      );

      return `
        <button
          type="button"
          class="suggested-item"
          data-type="${escapeHtml(type)}"
        >
          <span class="suggested-icon">
            ${index < 4 ? "ID" : index < 9 ? "DOC" : "FILE"}
          </span>

          <span>
            <strong>${escapeHtml(type)}</strong>

            <small>
              ${
                alreadyAdded
                  ? "Already in your library"
                  : "Suggested category"
              }
            </small>
          </span>

          ${
            alreadyAdded
              ? '<span class="added-check">✓</span>'
              : ""
          }
        </button>
      `;
    })
    .join("");

  document.querySelectorAll(".suggested-item").forEach(
    (button) => {
      button.addEventListener("click", () => {
        $("docType").value = button.dataset.type;

        document
          .querySelectorAll(".suggested-item")
          .forEach((item) => {
            item.classList.toggle(
              "selected",
              item === button
            );
          });

        $("docFile").click();
      });
    }
  );
}

/* =========================
   SIGNUP / SIGNIN UI
========================= */

function setAuthMode(mode) {
  authMode = mode;

  const signup = mode === "signup";

  $("authTitle").textContent = signup
    ? "Create your account"
    : "Welcome back";

  $("authSubtitle").textContent = signup
    ? "Start with your email and a strong password."
    : "Sign in to open your private document library.";

  $("nameField").classList.toggle("hidden", !signup);

  $("confirmField").classList.toggle("hidden", !signup);

  $("confirmPassword").required = signup;

  $("fullName").required = signup;

  $("authSubmit").innerHTML = signup
    ? 'Create account <span>→</span>'
    : 'Sign in <span>→</span>';

  $("switchText").textContent = signup
    ? "Already have an account?"
    : "New to SmartDoc Locker?";

  $("switchAuth").textContent = signup
    ? "Sign in"
    : "Create account";

  $("password").autocomplete = signup
    ? "new-password"
    : "current-password";

  setMessage("authMessage", "");
}

function openAuth() {
  setAuthMode("signup");
  showPage("pageAuth");
}

function renderUser(user) {
  const display =
    user.displayName ||
    (user.email || "User").split("@")[0];

  $("uploadUserName").textContent = display;

  $("uploadAvatar").textContent = getInitials(
    user.displayName,
    user.email
  );

  $("dashboardName").textContent =
    display.split(" ")[0];

  $("headerSignOut").classList.remove("hidden");
}

/* =========================
   TEMPORARY DOCUMENT MEMORY
========================= */

async function loadDocuments() {
  /*
    IMPORTANT:
    This project stores document records and file blobs
    only in browser memory.

    It does NOT upload document files to Firebase Storage.
    It does NOT save document records to Firestore.

    Refreshing or closing the page clears this document
    library. Firebase Authentication accounts remain.
  */

  updateUploadUI();
  renderDocuments();
  renderStats();
  fillDocTypes();
}

function updateUploadUI() {
  const count = docsCache.length;

  $("uploadCount").textContent =
    `${count} document${count === 1 ? "" : "s"} added`;

  $("uploadProgressText").textContent =
    count >= MIN_DOCS
      ? "Minimum reached. Continue whenever you're ready."
      : `Add ${MIN_DOCS - count} more document${
          MIN_DOCS - count === 1 ? "" : "s"
        } to unlock your dashboard.`;

  $("progressNumber").textContent =
    `${Math.min(count, MIN_DOCS)} / ${MIN_DOCS}`;

  $("progressBar").style.width =
    `${Math.min(100, (count / MIN_DOCS) * 100)}%`;

  $("continueDashboard").disabled =
    count < MIN_DOCS;

  $("uploadedSummary").textContent = count
    ? `${count} document${count === 1 ? "" : "s"} in your library`
    : "Your uploaded documents will appear here.";

  $("uploadedGrid").innerHTML = docsCache
    .map((doc) => {
      return `
        <article class="uploaded-card">
          <span class="doc-icon ${
            doc.fileType === "pdf" ? "pdf" : "image"
          }">
            ${doc.fileType === "pdf" ? "PDF" : "IMG"}
          </span>

          <span class="doc-copy">
            <strong>${escapeHtml(doc.fileName)}</strong>

            <small>
              ${escapeHtml(doc.type)} ·
              ${escapeHtml(formatSize(doc.size || 0))}
            </small>
          </span>

          <button
            class="remove-doc"
            data-open-doc="${escapeHtml(doc.id)}"
            aria-label="View document"
          >
            ›
          </button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-open-doc]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        openDocument(button.dataset.openDoc);
      });
    }
  );

  fillDocTypes();
}

/* =========================
   DASHBOARD STATISTICS
========================= */

function renderStats() {
  $("totalDocs").textContent = docsCache.length;

  $("totalCategories").textContent =
    new Set(docsCache.map((doc) => doc.type)).size;

  $("ocrDocs").textContent = docsCache.filter(
    (doc) => doc.ocrText && doc.ocrText.trim()
  ).length;
}

/* =========================
   DOCUMENT SEARCH
========================= */

function renderDocuments() {
  const term = $("documentSearch")
    .value
    .trim()
    .toLowerCase();

  const filtered = docsCache.filter((doc) => {
    const matchesTerm = [
      doc.fileName,
      doc.type,
      doc.ocrText,
      doc.notes
    ].some((value) =>
      String(value || "").toLowerCase().includes(term)
    );

    const matchesFilter =
      activeFilter === "all" ||
      doc.fileType === activeFilter;

    return matchesTerm && matchesFilter;
  });

  $("documentList").innerHTML = filtered
    .map((doc) => {
      return `
        <article class="document-row">
          <span class="doc-icon ${
            doc.fileType === "pdf" ? "pdf" : "image"
          }">
            ${doc.fileType === "pdf" ? "PDF" : "IMG"}
          </span>

          <span class="doc-copy">
            <strong>${escapeHtml(doc.fileName)}</strong>

            <small>
              ${escapeHtml(doc.type)} ·
              Added ${escapeHtml(safeDate(doc.createdAt))}
            </small>
          </span>

          <span class="doc-status">
            ${doc.ocrText ? "Text ready" : "Stored"}
          </span>

          <button
            class="row-open"
            data-view-doc="${escapeHtml(doc.id)}"
            aria-label="Open document"
          >
            ↗
          </button>
        </article>
      `;
    })
    .join("");

  $("emptyLibrary").classList.toggle(
    "hidden",
    filtered.length > 0
  );

  $("documentList").classList.toggle(
    "hidden",
    filtered.length === 0
  );

  document.querySelectorAll("[data-view-doc]").forEach(
    (button) => {
      button.addEventListener("click", () => {
        openDocument(button.dataset.viewDoc);
      });
    }
  );
}

/* =========================
   OCR TEXT EXTRACTION
========================= */

async function extractText(file) {
  if (
    !window.Tesseract ||
    file.type === "application/pdf"
  ) {
    return "";
  }

  try {
    const result = await window.Tesseract.recognize(
      file,
      "eng",
      {
        logger: () => {}
      }
    );

    return (result.data.text || "").slice(0, 12000);
  } catch (error) {
    console.warn("OCR failed", error);
    return "";
  }
}

/* =========================
   UPLOAD DOCUMENT
========================= */

async function uploadDocument(file, type) {
  if (!currentUser) {
    throw new Error("Please sign in before uploading.");
  }

  const cleanName =
    file.name
      .replace(/[^\w.\- ()]/g, "_")
      .slice(0, 120) || "document";

  const ocrText = await extractText(file);

  const previewURL = URL.createObjectURL(file);

  const record = {
    id: `temp_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`,

    fileName: cleanName,
    type,

    fileType:
      file.type === "application/pdf"
        ? "pdf"
        : "image",

    contentType: file.type,
    size: file.size,

    blob: file,
    previewURL,
    downloadURL: previewURL,

    ocrText: maskSensitive(ocrText),

    createdAt: new Date(),
    ownerUid: currentUser.uid
  };

  docsCache.unshift(record);

  return record;
}

/* =========================
   VIEW DOCUMENT
========================= */

async function openDocument(id) {
  const doc = docsCache.find(
    (item) => item.id === id
  );

  if (!doc) {
    return;
  }

  activeDocId = id;

  $("modalIcon").textContent =
    doc.fileType === "pdf" ? "PDF" : "IMG";

  $("modalTitle").textContent = doc.fileName;

  $("modalType").textContent = doc.type;

  $("modalDetails").innerHTML = [
    ["File type", doc.fileType.toUpperCase()],
    ["File size", formatSize(doc.size)],
    ["Uploaded", safeDate(doc.createdAt)],
    [
      "Text extraction",
      doc.ocrText ? "Available" : "Not available"
    ]
  ]
    .map(([label, value]) => {
      return `
        <div class="detail-item">
          <small>${label}</small>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `;
    })
    .join("");

  let preview = "";

  if (
    doc.fileType === "image" &&
    doc.downloadURL
  ) {
    preview = `
      <img
        src="${escapeHtml(doc.downloadURL)}"
        alt="Document preview"
      >
    `;
  }

  if (
    doc.fileType === "pdf" &&
    doc.downloadURL
  ) {
    preview = `
      <a
        class="text-link"
        target="_blank"
        rel="noopener noreferrer"
        href="${escapeHtml(doc.downloadURL)}"
      >
        Open PDF in a new tab ↗
      </a>
    `;
  }

  if (doc.ocrText) {
    preview += `
      <p>
        <strong>Extracted text (masked):</strong><br>
        ${escapeHtml(doc.ocrText.slice(0, 1800))}
        ${doc.ocrText.length > 1800 ? "…" : ""}
      </p>
    `;
  } else {
    preview += `
      <p>
        Text could not be extracted automatically.
        You can still search this document by its category
        and file name.
      </p>
    `;
  }

  $("modalPreview").innerHTML = preview;

  $("documentModal").classList.remove("hidden");
}

/* =========================
   DELETE DOCUMENT
========================= */

async function deleteActiveDocument() {
  const index = docsCache.findIndex(
    (item) => item.id === activeDocId
  );

  if (index < 0 || !currentUser) {
    return;
  }

  const doc = docsCache[index];

  if (
    !confirm(
      `Delete "${doc.fileName}" from this temporary session?`
    )
  ) {
    return;
  }

  if (doc.previewURL) {
    URL.revokeObjectURL(doc.previewURL);
  }

  docsCache.splice(index, 1);

  $("documentModal").classList.add("hidden");

  await loadDocuments();

  showToast("Document removed from this temporary session.");
}

/* =========================
   CHAT ASSISTANT
========================= */

function addChatBubble(text, who = "assistant") {
  const div = document.createElement("div");

  div.className =
    `chat-bubble ${
      who === "user"
        ? "user-bubble"
        : "assistant-bubble"
    }`;

  div.textContent = text;

  $("chatMessages").appendChild(div);

  $("chatMessages").scrollTop =
    $("chatMessages").scrollHeight;
}

function answerLibraryQuestion(question) {
  const q = question.toLowerCase();

  if (
    /how many|total|count/.test(q) &&
    /document|file|upload|have|library/.test(q)
  ) {
    return `You currently have ${docsCache.length} document${
      docsCache.length === 1 ? "" : "s"
    } in your SmartDoc library.`;
  }

  if (
    /pdf/.test(q) &&
    /which|find|show|list|document|file/.test(q)
  ) {
    const found = docsCache.filter(
      (doc) => doc.fileType === "pdf"
    );

    return found.length
      ? `I found ${found.length} PDF file${
          found.length === 1 ? "" : "s"
        }:\n${found
          .map((doc) => `• ${doc.fileName} — ${doc.type}`)
          .join("\n")}`
      : "There are no PDFs in your library yet.";
  }

  if (
    /image|photo|picture/.test(q) &&
    /which|find|show|list|document|file/.test(q)
  ) {
    const found = docsCache.filter(
      (doc) => doc.fileType === "image"
    );

    return found.length
      ? `I found ${found.length} image file${
          found.length === 1 ? "" : "s"
        }:\n${found
          .map((doc) => `• ${doc.fileName} — ${doc.type}`)
          .join("\n")}`
      : "There are no image files in your library yet.";
  }

  const matches = docsCache.filter((doc) => {
    const haystack = `
      ${doc.fileName}
      ${doc.type}
      ${doc.ocrText || ""}
      ${doc.notes || ""}
    `.toLowerCase();

    const terms = q
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => {
        return (
          word.length > 2 &&
          ![
            "find",
            "show",
            "search",
            "where",
            "what",
            "about",
            "have",
            "with",
            "from",
            "document",
            "documents",
            "please",
            "tell",
            "give",
            "does",
            "this",
            "that",
            "my"
          ].includes(word)
        );
      });

    return (
      terms.length &&
      terms.some((term) => haystack.includes(term))
    );
  });

  if (matches.length) {
    return `I found ${matches.length} matching document${
      matches.length === 1 ? "" : "s"
    } in your library:\n${matches
      .slice(0, 6)
      .map((doc) => {
        return `• ${doc.fileName} — ${doc.type}${
          doc.ocrText
            ? "\n  Extracted text: " +
              doc.ocrText
                .slice(0, 140)
                .replace(/\s+/g, " ")
            : ""
        }`;
      })
      .join("\n")}

Open a result in Your documents to view its details.`;
  }

  if (
    /aadhaar|aadhar|pan card|passport|driving licence|marks card|sslc|puc|income certificate|caste certificate/.test(q)
  ) {
    return "I couldn't find a matching document in your current library. Check the spelling or upload the document first.";
  }

  if (
    /difference/.test(q) &&
    /aadhaar|aadhar/.test(q) &&
    /pan/.test(q)
  ) {
    return "Aadhaar is an identity number issued by UIDAI, while PAN is a tax identification number issued by India's Income Tax Department. This is general information, not legal or financial advice.";
  }

  if (/hello|hi\b|hey/.test(q)) {
    return "Hey! I can search your saved document names, categories, and available OCR text. Try “Find my Aadhaar card” or “How many documents do I have?”";
  }

  if (/help|what can you do|capabilit/.test(q)) {
    return "I can search your saved document names, categories and OCR text; count your documents; list PDFs or images; and answer a few built-in general questions. Live generative AI is not connected in this starter project.";
  }

  return "I couldn't find an answer in your document library. This starter assistant uses searchable document metadata and a few built-in answers; to answer anything using a real AI model, connect a model through a secure backend (never put its secret API key in frontend code).";
}

function sendQuestion(question) {
  const text = question.trim();

  if (!text) {
    return;
  }

  addChatBubble(text, "user");

  $("chatInput").value = "";

  setTimeout(() => {
    addChatBubble(
      answerLibraryQuestion(text),
      "assistant"
    );
  }, 180);
}

/* =========================
   FILE SELECTION
========================= */

function resetFileSelection() {
  selectedFile = null;

  $("docFile").value = "";

  $("uploadButton").disabled = true;

  $("filePreview").classList.add("hidden");

  $("dropTitle").innerHTML =
    'Drop a file here or <u>browse</u>';

  $("dropSubtitle").textContent =
    "PDF, PNG, JPG or WEBP · Up to 10 MB";
}

function selectFile(file) {
  if (!file) {
    return;
  }

  const allowed = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp"
  ];

  if (!allowed.includes(file.type)) {
    showToast("Choose a PDF, PNG, JPG, or WEBP file.");
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showToast(
      "File is larger than 10 MB. Choose a smaller file."
    );

    return;
  }

  selectedFile = file;

  $("dropTitle").textContent = file.name;

  $("dropSubtitle").textContent =
    `${formatSize(file.size)} · Ready to upload`;

  $("filePreview").classList.remove("hidden");

  $("filePreview").innerHTML = `
    <span class="file-mini-icon">
      ${iconFor(file.name)}
    </span>

    <span>
      <strong>${escapeHtml(file.name)}</strong>
      <small>${formatSize(file.size)} · Ready</small>
    </span>

    <button
      type="button"
      id="removeSelectedFile"
      aria-label="Remove selected file"
    >
      ×
    </button>
  `;

  $("removeSelectedFile").addEventListener(
    "click",
    resetFileSelection
  );

  $("uploadButton").disabled = false;
}

/* =========================
   UPLOAD PAGE NAVIGATION
========================= */

function goToUpload() {
  showPage("pageUpload");
}

/* =========================
   AUTHENTICATION FORM
========================= */

async function handleAuthSubmit(event) {
  event.preventDefault();

  setMessage("authMessage", "");

  if (!requireConfigured()) {
    return;
  }

  const email = $("email").value.trim();

  const password = $("password").value;

  const name = $("fullName").value.trim();

  if (authMode === "signup") {
    if (name.length < 2) {
      return setMessage(
        "authMessage",
        "Enter your name (at least 2 characters)."
      );
    }

    if (password !== $("confirmPassword").value) {
      return setMessage(
        "authMessage",
        "Passwords do not match."
      );
    }
  }

  const submit = $("authSubmit");

  submit.disabled = true;

  submit.textContent =
    authMode === "signup"
      ? "Creating account…"
      : "Signing in…";

  try {
    if (authMode === "signup") {
      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      await updateProfile(credential.user, {
        displayName: name
      });

      currentUser = credential.user;

      renderUser(currentUser);

      await loadDocuments();

      showPage("pageUpload");
    } else {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      currentUser = credential.user;

      renderUser(currentUser);

      await loadDocuments();

      showPage(
        docsCache.length >= MIN_DOCS
          ? "pageDashboard"
          : "pageUpload"
      );
    }
  } catch (error) {
    setMessage(
      "authMessage",
      friendlyError(error)
    );
  } finally {
    submit.disabled = false;

    submit.innerHTML =
      authMode === "signup"
        ? 'Create account <span>→</span>'
        : 'Sign in <span>→</span>';
  }
}

/* =========================
   UPLOAD FORM SUBMISSION
========================= */

async function handleUploadSubmit(event) {
  event.preventDefault();

  if (!currentUser) {
    return showToast("Please sign in first.");
  }

  if (!selectedFile) {
    return showToast("Choose a file first.");
  }

  $("uploadButton").disabled = true;

  $("uploadButton").textContent =
    "Uploading and scanning…";

  setMessage(
    "uploadMessage",
    "Processing the file and extracting text where supported. Please keep this page open."
  );

  try {
    await uploadDocument(
      selectedFile,
      $("docType").value
    );

    resetFileSelection();

    await loadDocuments();

    setMessage(
      "uploadMessage",
      "Document added to temporary browser memory. It will disappear when this page is refreshed or closed.",
      true
    );

    showToast(
      "Document added for this session only."
    );
  } catch (error) {
    console.error(error);

    setMessage(
      "uploadMessage",
      friendlyError(error)
    );
  } finally {
    $("uploadButton").disabled = !selectedFile;

    $("uploadButton").innerHTML =
      'Upload document <span>↑</span>';
  }
}

/* =========================
   ALL BUTTON EVENT HANDLERS
========================= */

function wireEvents() {
  $("getStarted").addEventListener(
    "click",
    openAuth
  );

  $("backWelcome").addEventListener(
    "click",
    () => showPage("pageWelcome")
  );

  $("brandHome").addEventListener(
    "click",
    (event) => {
      event.preventDefault();

      showPage(
        currentUser
          ? "pageDashboard"
          : "pageWelcome"
      );
    }
  );

  $("switchAuth").addEventListener(
    "click",
    () => {
      setAuthMode(
        authMode === "signup"
          ? "signin"
          : "signup"
      );
    }
  );

  $("togglePassword").addEventListener(
    "click",
    () => {
      const input = $("password");

      input.type =
        input.type === "password"
          ? "text"
          : "password";

      $("togglePassword").textContent =
        input.type === "password"
          ? "Show"
          : "Hide";
    }
  );

  $("forgotPassword").addEventListener(
    "click",
    async () => {
      if (!requireConfigured()) {
        return;
      }

      const email = $("email").value.trim();

      if (!email) {
        return setMessage(
          "authMessage",
          "Enter your email address first."
        );
      }

      try {
        await sendPasswordResetEmail(
          auth,
          email
        );

        setMessage(
          "authMessage",
          "Password reset email sent. Check your inbox.",
          true
        );
      } catch (error) {
        setMessage(
          "authMessage",
          friendlyError(error)
        );
      }
    }
  );

  $("authForm").addEventListener(
    "submit",
    handleAuthSubmit
  );

  $("docFile").addEventListener(
    "change",
    (event) => {
      selectFile(event.target.files[0]);
    }
  );

  $("dropzone").addEventListener(
    "dragover",
    (event) => {
      event.preventDefault();

      $("dropzone").classList.add("dragover");
    }
  );

  $("dropzone").addEventListener(
    "dragleave",
    () => {
      $("dropzone").classList.remove("dragover");
    }
  );

  $("dropzone").addEventListener(
    "drop",
    (event) => {
      event.preventDefault();

      $("dropzone").classList.remove("dragover");

      selectFile(event.dataTransfer.files[0]);
    }
  );

  $("uploadForm").addEventListener(
    "submit",
    handleUploadSubmit
  );

  $("continueDashboard").addEventListener(
    "click",
    () => {
      if (docsCache.length >= MIN_DOCS) {
        showPage("pageDashboard");

        renderDocuments();
      }
    }
  );

  $("uploadMore").addEventListener(
    "click",
    () => {
      $("docType").focus();

      $("uploadForm").scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  );

  $("dashboardUpload").addEventListener(
    "click",
    goToUpload
  );

  $("backToUpload").addEventListener(
    "click",
    goToUpload
  );

  $("emptyUpload").addEventListener(
    "click",
    goToUpload
  );

  $("documentSearch").addEventListener(
    "input",
    renderDocuments
  );

  $("clearSearch").addEventListener(
    "click",
    () => {
      $("documentSearch").value = "";

      renderDocuments();
    }
  );

  document.querySelectorAll(".filter-chip").forEach(
    (button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;

        document
          .querySelectorAll(".filter-chip")
          .forEach((item) => {
            item.classList.toggle(
              "selected",
              item === button
            );
          });

        renderDocuments();
      });
    }
  );

  $("chatForm").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      sendQuestion($("chatInput").value);
    }
  );

  document.querySelectorAll(".prompt-chip").forEach(
    (button) => {
      button.addEventListener("click", () => {
        sendQuestion(button.textContent);
      });
    }
  );

  $("headerSignOut").addEventListener(
    "click",
    async () => {
      try {
        await signOut(auth);

        docsCache.forEach((doc) => {
          if (doc.previewURL) {
            URL.revokeObjectURL(doc.previewURL);
          }
        });

        currentUser = null;
        docsCache = [];

        $("headerSignOut").classList.add("hidden");

        showPage("pageWelcome");

        showToast(
          "Signed out. Temporary documents cleared."
        );
      } catch (error) {
        showToast(friendlyError(error));
      }
    }
  );

  $("closeModal").addEventListener(
    "click",
    () => {
      $("documentModal").classList.add("hidden");
    }
  );

  $("modalBackdrop").addEventListener(
    "click",
    () => {
      $("documentModal").classList.add("hidden");
    }
  );

  $("deleteDocument").addEventListener(
    "click",
    deleteActiveDocument
  );

  $("downloadDocument").addEventListener(
    "click",
    () => {
      const doc = docsCache.find(
        (item) => item.id === activeDocId
      );

      if (!doc?.blob) {
        return showToast(
          "This temporary file is no longer available."
        );
      }

      const a = document.createElement("a");

      a.href = doc.previewURL;
      a.download = doc.fileName;

      document.body.appendChild(a);

      a.click();
      a.remove();
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        $("documentModal").classList.add("hidden");
      }
    }
  );
}

/* =========================
   FIREBASE INITIALIZATION
========================= */

function initFirebase() {
  if (!firebaseConfigured) {
    console.info(
      "SmartDoc Locker is in setup mode. Add your Firebase web configuration in firebase-config.js."
    );

    return;
  }

  try {
    app = initializeApp(firebaseConfig);

    auth = getAuth(app);

    onAuthStateChanged(
      auth,
      async (user) => {
        currentUser = user;

        if (user) {
          renderUser(user);

          await loadDocuments();

          if (
            pages.some((id) =>
              $(id).classList.contains("active")
            ) &&
            $("pageWelcome").classList.contains("active")
          ) {
            showPage(
              docsCache.length >= MIN_DOCS
                ? "pageDashboard"
                : "pageUpload"
            );
          }
        } else {
          $("headerSignOut").classList.add("hidden");
        }
      }
    );
  } catch (error) {
    console.error(error);

    showToast(
      "Firebase initialization failed. Check firebase-config.js."
    );
  }
}

/* =========================
   START APPLICATION
========================= */

fillDocTypes();
wireEvents();
initFirebase();
