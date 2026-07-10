const STORAGE_KEY = "symptomImpactDiary.entries.v1";
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);
const form = $("entryForm");
const template = $("entryTemplate");

function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function loadEntries() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function selectedAffected() {
  return [...document.querySelectorAll('input[name="affected"]:checked')].map(x => x.value);
}

function resetForm() {
  form.reset();
  $("entryId").value = "";
  $("entryDate").value = todayISO();
  $("impact").value = "3";
  $("saveBtn").textContent = "Save Entry";
  $("cancelEditBtn").classList.add("hidden");
}

function escapeHtml(text = "") {
  return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  const d = new Date(`${dateString}T12:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

function render() {
  const entries = loadEntries().sort((a,b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`));
  const q = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const impact = $("impactFilter").value;

  const filtered = entries.filter(e => {
    const haystack = [e.description, e.category, e.location, e.duration, e.medication, e.food, e.notes, ...(e.affected || [])].join(" ").toLowerCase();
    return (!q || haystack.includes(q)) && (!category || e.category === category) && (!impact || String(e.impact) === impact);
  });

  $("entryList").innerHTML = "";
  $("emptyState").classList.toggle("hidden", filtered.length > 0);

  filtered.forEach(entry => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = entry.id;
    card.querySelector(".entry-date").textContent = `${formatDate(entry.date)}${entry.time ? ` at ${entry.time}` : ""}`;
    card.querySelector(".entry-meta").textContent = [entry.category, entry.location].filter(Boolean).join(" • ");
    card.querySelector(".impact-badge").textContent = `Impact ${entry.impact}/5`;
    card.querySelector(".entry-description").textContent = entry.description;

    const details = [];
    if (entry.duration) details.push(["Duration / delay", entry.duration]);
    if (entry.medication) details.push(["Medication", entry.medication]);
    if (entry.food) details.push(["Food / drink", entry.food]);
    if (entry.affected?.length) details.push(["Affected", entry.affected.join(", ")]);
    if (entry.notes) details.push(["Notes", entry.notes]);

    card.querySelector(".entry-details").innerHTML = details
      .map(([label, value]) => `<div class="entry-detail"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`)
      .join("");

    card.querySelector(".edit-entry").addEventListener("click", () => editEntry(entry.id));
    card.querySelector(".delete-entry").addEventListener("click", () => deleteEntry(entry.id));
    $("entryList").appendChild(card);
  });

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - 30);
  $("totalEntries").textContent = entries.length;
  $("last30Entries").textContent = entries.filter(e => new Date(`${e.date}T23:59:59`) >= cutoff).length;
  $("highImpactEntries").textContent = entries.filter(e => Number(e.impact) >= 4).length;
  $("daysAffected").textContent = new Set(entries.map(e => e.date)).size;
}

function editEntry(id) {
  const entry = loadEntries().find(e => e.id === id);
  if (!entry) return;
  $("entryId").value = entry.id;
  $("entryDate").value = entry.date || "";
  $("entryTime").value = entry.time || "";
  $("description").value = entry.description || "";
  $("category").value = entry.category || "Urgency";
  $("impact").value = String(entry.impact || 3);
  $("location").value = entry.location || "";
  $("duration").value = entry.duration || "";
  $("medication").value = entry.medication || "";
  $("food").value = entry.food || "";
  $("notes").value = entry.notes || "";
  document.querySelectorAll('input[name="affected"]').forEach(cb => cb.checked = (entry.affected || []).includes(cb.value));
  $("saveBtn").textContent = "Update Entry";
  $("cancelEditBtn").classList.remove("hidden");
  window.scrollTo({top: 0, behavior: "smooth"});
  $("description").focus();
}

function deleteEntry(id) {
  if (!confirm("Delete this diary entry?")) return;
  saveEntries(loadEntries().filter(e => e.id !== id));
  if ($("entryId").value === id) resetForm();
  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const entries = loadEntries();
  const existingId = $("entryId").value;
  const entry = {
    id: existingId || uid(),
    date: $("entryDate").value,
    time: $("entryTime").value,
    description: $("description").value.trim(),
    category: $("category").value,
    impact: Number($("impact").value),
    location: $("location").value.trim(),
    duration: $("duration").value.trim(),
    medication: $("medication").value.trim(),
    food: $("food").value.trim(),
    affected: selectedAffected(),
    notes: $("notes").value.trim(),
    updatedAt: new Date().toISOString()
  };

  const index = entries.findIndex(e => e.id === entry.id);
  if (index >= 0) entries[index] = entry;
  else entries.push(entry);
  saveEntries(entries);
  resetForm();
  render();
});

$("clearBtn").addEventListener("click", resetForm);
$("cancelEditBtn").addEventListener("click", resetForm);
$("searchInput").addEventListener("input", render);
$("categoryFilter").addEventListener("change", render);
$("impactFilter").addEventListener("change", render);
$("printBtn").addEventListener("click", () => window.print());

function downloadFile(name, content, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

$("backupBtn").addEventListener("click", () => {
  downloadFile(`symptom-diary-backup-${todayISO()}.json`, JSON.stringify(loadEntries(), null, 2), "application/json");
});

$("exportCsvBtn").addEventListener("click", () => {
  const entries = loadEntries().sort((a,b) => a.date.localeCompare(b.date));
  const headers = ["Date","Time","Category","Impact","Description","Location","Duration or delay","Medication","Food or drink avoided","Affected","Notes"];
  const rows = entries.map(e => [e.date,e.time,e.category,e.impact,e.description,e.location,e.duration,e.medication,e.food,(e.affected||[]).join("; "),e.notes]);
  const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? "").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  downloadFile(`symptom-diary-${todayISO()}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");
});

$("restoreInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("Invalid backup");
    if (!confirm(`Restore ${data.length} entries? This will replace the diary currently stored on this device.`)) return;
    saveEntries(data);
    resetForm();
    render();
    alert("Backup restored.");
  } catch {
    alert("That file could not be restored. Please choose a valid diary JSON backup.");
  } finally {
    event.target.value = "";
  }
});

$("deleteAllBtn").addEventListener("click", () => {
  if (!loadEntries().length) return;
  if (!confirm("Permanently delete every diary entry stored on this device?")) return;
  if (!confirm("This cannot be undone unless you have a backup. Delete all entries?")) return;
  localStorage.removeItem(STORAGE_KEY);
  resetForm();
  render();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  $("installBtn").classList.remove("hidden");
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("installBtn").classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

resetForm();
render();
