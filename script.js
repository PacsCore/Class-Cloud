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


const firebaseConfig = {
  apiKey: "AIzaSyB-3-Piwnoda_cO0dzKhHt25OikGOXxzZk",
  authDomain: "klassen-hue-tracker.firebaseapp.com",
  projectId: "klassen-hue-tracker",
  storageBucket: "klassen-hue-tracker.firebasestorage.app",
  messagingSenderId: "914966951850",
  appId: "1:914966951850:web:a99a178f57a7f0d51b9dd3"
};

const CLOUDINARY_CLOUD_NAME = "t1npa7rj";
const CLOUDINARY_UPLOAD_PRESET = "hue_tracker";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function lockBodyScroll() {
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  document.body.style.overflow = "";
}

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
const deadlineInput = document.getElementById("deadline-input");
const formTitle = document.getElementById("form-title");

const fabBtn = document.getElementById("fab-btn");
const formOverlay = document.getElementById("form-overlay");
const closeFormBtn = document.getElementById("close-form-btn");

let editingId = null;

function openForm() {
  formOverlay.classList.remove("hidden");
  lockBodyScroll();
}

function closeForm() {
  formOverlay.classList.add("hidden");
  unlockBodyScroll();
  exitEditMode();
}

fabBtn.addEventListener("click", () => {
  formTitle.textContent = "New Entry";
  submitBtn.textContent = "Add Entry";
  openForm();
});

closeFormBtn.addEventListener("click", closeForm);

formOverlay.addEventListener("click", (e) => {
  if (e.target === formOverlay) closeForm();
});

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
        type: selectedType,
        deadline: deadlineInput.value || null
      };
      if (uploadedFiles.length > 0) {
        updateData.files = uploadedFiles;
      }
      await updateDoc(doc(db, "homework", editingId), updateData);
    } else {
      await addDoc(collection(db, "homework"), {
        subject: subjectInput.value,
        text: hwInput.value,
        type: selectedType,
        deadline: deadlineInput.value || null,
        files: uploadedFiles,
        createdAt: serverTimestamp()
      });
    }

    closeForm();
  } catch (err) {
    console.error(err);
    alert(`Couldn't save entry: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editingId ? "Update Entry" : "Add Entry";
  }
});

function exitEditMode() {
  editingId = null;
  submitBtn.textContent = "Add Entry";
  cancelEditBtn.classList.add("hidden");
  form.reset();
}

cancelEditBtn.addEventListener("click", closeForm);

const tabButtons = document.querySelectorAll(".tab-btn");
let currentFilter = "homework";

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.getAttribute("data-filter");
    updateSubjectOptions();
    renderList();
  });
});

const searchInput = document.getElementById("search-input");
let searchTerm = "";

const subjectFilterSelect = document.getElementById("subject-filter");
let selectedSubject = "all";

subjectFilterSelect.addEventListener("change", () => {
  selectedSubject = subjectFilterSelect.value;
  renderList();
});

function updateSubjectOptions() {
  const subjects = [...new Set(
    allEntries
      .filter((e) => (e.type || "homework") === currentFilter)
      .map((e) => e.subject)
  )].sort();

  const current = subjectFilterSelect.value;
  subjectFilterSelect.innerHTML =
    '<option value="all">All Subjects</option>' +
    subjects.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");

  if (subjects.includes(current)) {
    subjectFilterSelect.value = current;
  } else {
    subjectFilterSelect.value = "all";
    selectedSubject = "all";
  }
}

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.toLowerCase().trim();
  renderList();
});

const detailModal = document.getElementById("detail-modal");
const detailContent = document.getElementById("detail-content");
const closeDetailBtn = document.getElementById("close-detail-btn");

function openDetail(data) {
  const files = data.files || [];

  const attachmentsHtml = files.map((file) => {
    const name = escapeHtml(file.name || "file");
    const url = (file.url || "").startsWith("https://") ? escapeHtml(file.url) : "";
    if (isImageFile(file)) {
      return `<img src="${url}" alt="${name}">`;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="file-link">📄 ${name}</a>`;
  }).join("");

  const typeBadge = data.type === "resource"
    ? `<span class="type-badge resource">📁 Resource</span>`
    : `<span class="type-badge homework">📝 Homework</span>`;

  const deadlineHtml = data.deadline
    ? `<span class="deadline-badge ${new Date(data.deadline) < new Date() ? "overdue" : ""}">📅 ${new Date(data.deadline).toLocaleDateString("de-AT")}</span>`
    : "";

  detailContent.innerHTML = `
    ${typeBadge}
    ${deadlineHtml}
    <h2>${escapeHtml(data.subject)}</h2>
    <span class="detail-date">${data.createdAt ? data.createdAt.toDate().toLocaleString("de-AT") : "just now"}</span>
    <p>${escapeHtml(data.text)}</p>
    ${attachmentsHtml ? `<div class="detail-attachments">${attachmentsHtml}</div>` : ""}
  `;

  detailModal.classList.remove("hidden");
  lockBodyScroll();
}

closeDetailBtn.addEventListener("click", () => {
  detailModal.classList.add("hidden");
  unlockBodyScroll();
});

detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) {
    detailModal.classList.add("hidden");
    unlockBodyScroll();
  }
});

const hwList = document.getElementById("hw-list");
const q = query(collection(db, "homework"), orderBy("createdAt", "desc"));

let allEntries = [];

onSnapshot(q, (snapshot) => {
  allEntries = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
  updateSubjectOptions();
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
    const matchesSubject = selectedSubject === "all" || entry.subject === selectedSubject;
    return matchesType && matchesSearch && matchesSubject;
  });

  filtered.sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  const groups = {};
  filtered.forEach((entry) => {
    const key = entry.subject || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  });

  const subjectKeys = Object.keys(groups).sort();

  subjectKeys.forEach((subjectName) => {
    if (selectedSubject === "all") {
      const header = document.createElement("li");
      header.className = "subject-header";
      header.textContent = subjectName;
      hwList.appendChild(header);
    }

    groups[subjectName].forEach((data) => {
      const id = data.id;
      const files = data.files || [];

      const attachmentsHtml = files.map((file) => {
        const name = escapeHtml(file.name || "file");
        const url = (file.url || "").startsWith("https://") ? escapeHtml(file.url) : "";
        if (isImageFile(file)) {
          return `<img src="${url}" class="file-thumb" alt="${name}">`;
        }
        return `<span class="file-link">📄 ${name}</span>`;
      }).join("");

      const typeBadge = data.type === "resource"
        ? `<span class="type-badge resource">📁 Resource</span>`
        : `<span class="type-badge homework">📝 Homework</span>`;

      const deadlineHtml = data.deadline
        ? `<span class="deadline-badge ${new Date(data.deadline) < new Date() ? "overdue" : ""}">📅 ${new Date(data.deadline).toLocaleDateString("de-AT")}</span>`
        : "";

      const li = document.createElement("li");
      li.className = "hw-item";
      li.innerHTML = `
        <div class="hw-item-top">
          <div class="hw-item-content">
            ${typeBadge}
            ${deadlineHtml}
            <span class="subject">${escapeHtml(data.subject)}</span>
            <span>${escapeHtml(data.text)}</span>
            <span class="date">${data.createdAt ? data.createdAt.toDate().toLocaleString("de-AT") : "just now"}</span>
          </div>
          <div class="hw-item-actions">
            <button class="edit-btn" data-id="${id}" aria-label="Edit">✏️</button>
            <button class="delete-btn" data-id="${id}" aria-label="Delete">🗑️</button>
          </div>
        </div>
        ${attachmentsHtml ? `<div class="file-attachments">${attachmentsHtml}</div>` : ""}
      `;

      li.addEventListener("click", () => openDetail(data));

      hwList.appendChild(li);
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      await deleteDoc(doc(db, "homework", id));
    });
  });

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const data = allEntries.find((entry) => entry.id === id);

      if (![...subjectInput.options].some((o) => o.value === data.subject)) {
        subjectInput.add(new Option(data.subject, data.subject));
      }
      subjectInput.value = data.subject;
      hwInput.value = data.text;
      deadlineInput.value = data.deadline || "";
      document.querySelector(`input[name="entry-type"][value="${data.type || "homework"}"]`).checked = true;

      editingId = id;
      formTitle.textContent = "Edit Entry";
      submitBtn.textContent = "Update Entry";
      cancelEditBtn.classList.remove("hidden");

      openForm();
    });
  });
}