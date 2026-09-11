// import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB-3-Piwnoda_cO0dzKhHt25OikGOXxzZk",
  authDomain: "klassen-hue-tracker.firebaseapp.com",
  projectId: "klassen-hue-tracker",
  storageBucket: "klassen-hue-tracker.firebasestorage.app",
  messagingSenderId: "914966951850",
  appId: "1:914966951850:web:a99a178f57a7f0d51b9dd3"
};

// Cloudinary
const CLOUDINARY_CLOUD_NAME = "t1npa7rj";
const CLOUDINARY_UPLOAD_PRESET = "hue_tracker";

// start Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// password
const CORRECT_PASSWORD = "8B";

const lockScreen = document.getElementById("lock-screen");
const appDiv = document.getElementById("app");
const passwordInput = document.getElementById("passcode-input");
const unlockBtn = document.getElementById("unlock-btn");
const errorMsg = document.getElementById("error-msg");

function unlock() {
  if (passwordInput.value.trim().toLowerCase() === CORRECT_PASSWORD.toLowerCase()) {
    lockScreen.classList.add("hidden");
    appDiv.classList.remove("hidden");
    sessionStorage.setItem("unlocked", "true");
  } else {
    errorMsg.textContent = "Wrong password!";
  }
}

unlockBtn.addEventListener("click", unlock);
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") unlock();
});

if (sessionStorage.getItem("unlocked") === "true") {
  lockScreen.classList.add("hidden");
  appDiv.classList.remove("hidden");
}

const form = document.getElementById("entry-form");
const subjectInput = document.getElementById("subject-input");
const hwInput = document.getElementById("hw-input");
const fileInput = document.getElementById("file-input");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

let editingId = null;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isImageFile(file) {
  return /\.(jpe?g|png|gif|webp)$/i.test(file.name || file.url || "");
}

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: formData }
  );

  const data = await response.json();
  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || "Upload failed");
  }
  return { url: data.secure_url, name: file.name };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  submitBtn.disabled = true;
  submitBtn.textContent = fileInput.files.length ? "Uploading..." : "Saving...";

  try {
    const selectedType = document.querySelector('input[name="entry-type"]:checked').value;
    const files = Array.from(fileInput.files);
    const uploadedFiles = await Promise.all(files.map(uploadToCloudinary));

    if (editingId) {
      const updateData = {
        subject: subjectInput.value,
        text: hwInput.value,
        type: selectedType
      };
      if (uploadedFiles.length > 0) {
        updateData.files = uploadedFiles;
      }
      await updateDoc(doc(db, "homework", editingId), updateData);
      exitEditMode();
    } else {
      await addDoc(collection(db, "homework"), {
        subject: subjectInput.value,
        text: hwInput.value,
        type: selectedType,
        files: uploadedFiles,
        createdAt: serverTimestamp()
      });
      form.reset();
    }
  } catch (err) {
    console.error(err);
    alert("Couldn't save homework. Please try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingId ? "Update Homework" : "Add Homework";
  }
});

function exitEditMode() {
  editingId = null;
  submitBtn.textContent = "Add Homework";
  cancelEditBtn.classList.add("hidden");
  form.reset();
}

cancelEditBtn.addEventListener("click", exitEditMode);

// --- tabs ---
const tabButtons = document.querySelectorAll(".tab-btn");
let currentFilter = "homework";

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.getAttribute("data-filter");
    renderList();
  });
});

// --- search ---
const searchInput = document.getElementById("search-input");
let searchTerm = "";

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.toLowerCase().trim();
  renderList();
});

// --- live data ---
const hwList = document.getElementById("hw-list");
const q = query(collection(db, "homework"), orderBy("createdAt", "desc"));

let allEntries = [];

onSnapshot(q, (snapshot) => {
  allEntries = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
  renderList();
});

function renderList() {
  hwList.innerHTML = "";

  const filtered = allEntries.filter((entry) => {
    const matchesType = (entry.type || "homework") === currentFilter;
    const matchesSearch =
      searchTerm === "" ||
      entry.subject.toLowerCase().includes(searchTerm) ||
      entry.text.toLowerCase().includes(searchTerm);
    return matchesType && matchesSearch;
  });

  filtered.forEach((data) => {
    const id = data.id;
    const files = data.files || [];

    const attachmentsHtml = files.map((file) => {
      const name = escapeHtml(file.name || "file");
      const url = (file.url || "").startsWith("https://") ? escapeHtml(file.url) : "";
      if (isImageFile(file)) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">
          <img src="${url}" class="file-thumb" alt="${name}">
        </a>`;
      }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="file-link">📄 ${name}</a>`;
    }).join("");

    const typeBadge = data.type === "resource"
      ? `<span class="type-badge resource">📁 Ressource</span>`
      : `<span class="type-badge homework">📝 Hausübung</span>`;

    const li = document.createElement("li");
    li.className = "hw-item";
    li.innerHTML = `
      <div class="hw-item-top">
        <div class="hw-item-content">
          ${typeBadge}
          <span class="subject">${escapeHtml(data.subject)}</span>
          <span>${escapeHtml(data.text)}</span>
          <span class="date">${data.createdAt ? data.createdAt.toDate().toLocaleString("de-AT") : "just now"}</span>
        </div>
        <div class="hw-item-actions">
          <button class="edit-btn" data-id="${id}" aria-label="Edit homework">✏️</button>
          <button class="delete-btn" data-id="${id}" aria-label="Delete homework">🗑️</button>
        </div>
      </div>
      ${attachmentsHtml ? `<div class="file-attachments">${attachmentsHtml}</div>` : ""}
    `;

    hwList.appendChild(li);
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await deleteDoc(doc(db, "homework", id));
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const data = allEntries.find((e) => e.id === id);

      subjectInput.value = data.subject;
      hwInput.value = data.text;
      document.querySelector(`input[name="entry-type"][value="${data.type || "homework"}"]`).checked = true;

      editingId = id;
      submitBtn.textContent = "Update Homework";
      cancelEditBtn.classList.remove("hidden");

      form.scrollIntoView({ behavior: "smooth" });
    });
  });
}