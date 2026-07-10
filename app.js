
const KEY = "symptomImpactDiary.entries.v2";
let statsDate = new Date();

const $ = (id) => document.getElementById(id);
const views = ["home", "new", "diary", "stats", "more"];
const titles = {
  home: "Symptom & Impact Diary",
  new: "New Entry",
  diary: "Diary",
  stats: "Statistics",
  more: "Export & Report"
};

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function loadEntries() {
  try {
    const raw =
      localStorage.getItem(KEY) ||
      localStorage.getItem("symptomImpactDiary.entries.v1") ||
      "[]";
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showView(name) {
  views.forEach((view) => {
    $(`${view}View`).classList.toggle("active", view === name);
  });

  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });

  $("pageTitle").textContent = titles[name];

  if (name === "home") renderHome();
  if (name === "diary") renderDiary();
  if (name === "stats") renderStats();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.go));
});

function resetForm() {
  $("entryForm").reset();
  $("entryId").value = "";
  $("entryDate").value = today();
  $("impact").value = "3";
  $("saveBtn").textContent = "Save Entry";
  $("cancelEditBtn").classList.add("hidden");
}

function selectedAffected() {
  return [...document.querySelectorAll('input[name="affected"]:checked')].map(
    (item) => item.value
  );
}

$("entryForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!$("entryForm").reportValidity()) return;

  const entries = loadEntries();
  const id = $("entryId").value || uid();

  const entry = {
    id,
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
    significant: $("significant").checked,
    notes: $("notes").value.trim(),
    updatedAt: new Date().toISOString()
  };

  const index = entries.findIndex((item) => item.id === id);

  if (index >= 0) {
    entries[index] = entry;
  } else {
    entries.push(entry);
  }

  saveEntries(entries);
  resetForm();
  showView("diary");
});

$("cancelEditBtn").addEventListener("click", () => {
  resetForm();
  showView("diary");
});

function editEntry(id) {
  const entry = loadEntries().find((item) => item.id === id);
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
  $("significant").checked = Boolean(entry.significant);

  document.querySelectorAll('input[name="affected"]').forEach((checkbox) => {
    checkbox.checked = (entry.affected || []).includes(checkbox.value);
  });

  $("saveBtn").textContent = "Update Entry";
  $("cancelEditBtn").classList.remove("hidden");
  showView("new");
}

function renderDiary() {
  const query = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const impact = $("impactFilter").value;
  const significantOnly = $("significantFilter").checked;

  const entries = loadEntries()
    .sort((a, b) =>
      `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`)
    )
    .filter((entry) => {
      const haystack = [
        entry.description,
        entry.category,
        entry.location,
        entry.duration,
        entry.medication,
        entry.food,
        entry.notes,
        ...(entry.affected || [])
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!query || haystack.includes(query)) &&
        (!category || entry.category === category) &&
        (!impact || String(entry.impact) === impact) &&
        (!significantOnly || entry.significant)
      );
    });

  $("entryList").innerHTML = "";
  $("emptyState").classList.toggle("hidden", entries.length > 0);

  entries.forEach((entry) => {
    const card = $("entryTemplate").content.firstElementChild.cloneNode(true);
    const date = new Date(`${entry.date}T12:00:00`);

    card.querySelector(".day").textContent = String(date.getDate()).padStart(2, "0");
    card.querySelector(".month").textContent = date
      .toLocaleDateString("en-GB", { month: "short" })
      .toUpperCase();
    card.querySelector(".time").textContent = entry.time || "";
    card.querySelector(".category-pill").textContent = entry.category;
    card.querySelector(".star-btn").textContent = entry.significant ? "★" : "☆";
    card.querySelector(".entry-description").textContent = entry.description;
    card.querySelector(".entry-meta").textContent =
      `Impact: ${entry.impact}` +
      (entry.location ? ` • Location: ${entry.location}` : "");

    const extra = [];
    if (entry.duration) extra.push(`Delay: ${entry.duration}`);
    if (entry.affected?.length) extra.push(`Affected: ${entry.affected.join(", ")}`);
    if (entry.medication) extra.push(`Medication: ${entry.medication}`);

    card.querySelector(".entry-extra").textContent = extra.join(" • ");

    card.querySelector(".edit-entry").addEventListener("click", () => {
      editEntry(entry.id);
    });

    card.querySelector(".delete-entry").addEventListener("click", () => {
      if (!confirm("Delete this diary entry?")) return;
      saveEntries(loadEntries().filter((item) => item.id !== entry.id));
      renderDiary();
      renderHome();
    });

    card.querySelector(".star-btn").addEventListener("click", () => {
      const allEntries = loadEntries();
      const target = allEntries.find((item) => item.id === entry.id);
      if (!target) return;

      target.significant = !target.significant;
      saveEntries(allEntries);
      renderDiary();
    });

    $("entryList").appendChild(card);
  });
}

["searchInput", "categoryFilter", "impactFilter", "significantFilter"].forEach(
  (id) => {
    $(id).addEventListener(id === "searchInput" ? "input" : "change", renderDiary);
  }
);

$("toggleFiltersBtn").addEventListener("click", () => {
  $("filtersPanel").classList.toggle("hidden");
});

function entriesForMonth(date) {
  return loadEntries().filter((entry) => {
    const itemDate = new Date(`${entry.date}T12:00:00`);
    return (
      itemDate.getFullYear() === date.getFullYear() &&
      itemDate.getMonth() === date.getMonth()
    );
  });
}

function renderHome() {
  const now = new Date();
  const entries = entriesForMonth(now);

  $("summaryPeriod").textContent = now.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric"
  });

  $("homeEntries").textContent = entries.length;
  $("homeDays").textContent = new Set(entries.map((entry) => entry.date)).size;
  $("homeAverage").textContent = entries.length
    ? (
        entries.reduce((sum, entry) => sum + Number(entry.impact || 0), 0) /
        entries.length
      ).toFixed(1)
    : "0.0";

  $("homeWork").textContent = entries.filter(
    (entry) =>
      (entry.affected || []).includes("Work") ||
      entry.category === "Work impact"
  ).length;
}

function renderStats() {
  const entries = entriesForMonth(statsDate);

  $("statsMonthLabel").textContent = statsDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric"
  });

  $("statDays").textContent = new Set(entries.map((entry) => entry.date)).size;
  $("statEntries").textContent = entries.length;
  $("statWork").textContent = entries.filter(
    (entry) =>
      (entry.affected || []).includes("Work") ||
      entry.category === "Work impact"
  ).length;
  $("statUrgency").textContent = entries.filter(
    (entry) => entry.category === "Urgency"
  ).length;
  $("statSignificant").textContent = entries.filter(
    (entry) => entry.significant
  ).length;
  $("statAverage").textContent = entries.length
    ? (
        entries.reduce((sum, entry) => sum + Number(entry.impact || 0), 0) /
        entries.length
      ).toFixed(1)
    : "0.0";

  const counts = {};
  entries.forEach((entry) => {
    counts[entry.category] = (counts[entry.category] || 0) + 1;
  });

  const maximum = Math.max(1, ...Object.values(counts));

  $("categoryBars").innerHTML =
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([name, count]) => `
          <div class="bar-row">
            <span>${name}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${(count / maximum) * 100}%"></div>
            </div>
            <strong>${count}</strong>
          </div>
        `
      )
      .join("") || '<p class="muted">No entries this month.</p>';
}

$("prevMonth").addEventListener("click", () => {
  statsDate = new Date(statsDate.getFullYear(), statsDate.getMonth() - 1, 1);
  renderStats();
});

$("nextMonth").addEventListener("click", () => {
  statsDate = new Date(statsDate.getFullYear(), statsDate.getMonth() + 1, 1);
  renderStats();
});

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = name;
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 500);
}

$("printBtn").addEventListener("click", () => {
  showView("diary");
  setTimeout(() => window.print(), 100);
});

$("backupBtn").addEventListener("click", () => {
  downloadFile(
    `symptom-diary-backup-${today()}.json`,
    JSON.stringify(loadEntries(), null, 2),
    "application/json"
  );
});

$("exportCsvBtn").addEventListener("click", () => {
  const headers = [
    "Date",
    "Time",
    "Category",
    "Impact",
    "Description",
    "Location",
    "Duration",
    "Medication",
    "Food avoided",
    "Affected",
    "Significant",
    "Notes"
  ];

  const rows = loadEntries().map((entry) => [
    entry.date,
    entry.time,
    entry.category,
    entry.impact,
    entry.description,
    entry.location,
    entry.duration,
    entry.medication,
    entry.food,
    (entry.affected || []).join("; "),
    entry.significant ? "Yes" : "No",
    entry.notes
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\r\n");

  downloadFile(
    `symptom-diary-${today()}.csv`,
    `\uFEFF${csv}`,
    "text/csv;charset=utf-8"
  );
});

$("restoreInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());

    if (!Array.isArray(data)) {
      throw new Error("Invalid backup");
    }

    if (confirm(`Restore ${data.length} entries?`)) {
      saveEntries(data);
      renderHome();
      renderDiary();
      renderStats();
    }
  } catch {
    alert("That file is not a valid diary backup.");
  }

  event.target.value = "";
});

$("deleteAllBtn").addEventListener("click", () => {
  if (!confirm("Delete every diary entry?")) return;

  localStorage.removeItem(KEY);
  renderHome();
  renderDiary();
  renderStats();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

resetForm();
renderHome();
renderDiary();
renderStats();
