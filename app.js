// TableTap page logic. Uses LOCATIONS (locations.js) and NTFY_TOPIC / COOLDOWN_MS (config.js).

// ---------- Safe localStorage ----------
// localStorage can throw (private browsing, blocked storage), so wrap it.
// If it fails, we fall back to remembering things only until the page closes.
const memoryStore = {};

function loadValue(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return memoryStore[key] ?? null;
  }
}

function saveValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    memoryStore[key] = value;
  }
}

// ---------- Find this page's location from the URL ----------
const params = new URLSearchParams(window.location.search);
const locId = params.get("loc");
const currentLocation = LOCATIONS.find((l) => l.id === locId);

// ---------- Grab page elements ----------
const pageTitle = document.getElementById("page-title");
const nameSection = document.getElementById("name-section");
const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const notifySection = document.getElementById("notify-section");
const nameDisplay = document.getElementById("name-display");
const changeNameBtn = document.getElementById("change-name");
const notifyBtn = document.getElementById("notify-btn");
const statusEl = document.getElementById("status");
const directionsSection = document.getElementById("directions-section");
const tableList = document.getElementById("table-list");
const unknownSection = document.getElementById("unknown-section");
const locationLinks = document.getElementById("location-links");

// Show a message in the aria-live status area. type: "success", "error", or "".
function showStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status " + type;
}

// ---------- Name ----------
function showNameForm() {
  nameInput.value = loadValue("tabletap-name") || "";
  nameSection.hidden = false;
  notifySection.hidden = true;
  nameInput.focus();
}

function showNotify() {
  nameDisplay.textContent = loadValue("tabletap-name");
  nameSection.hidden = true;
  notifySection.hidden = false;
}

nameForm.addEventListener("submit", (event) => {
  event.preventDefault(); // stop the form from reloading the page
  const name = nameInput.value.trim();
  if (!name) return;
  saveValue("tabletap-name", name);
  showNotify();
  showStatus("Name saved.", "success");
  notifyBtn.focus();
});

changeNameBtn.addEventListener("click", () => {
  showStatus("");
  showNameForm();
});

// ---------- Notify friends (ntfy.sh) ----------
function notifyMessage(name) {
  if (currentLocation.type === "entrance") {
    return `${name} has arrived at the ${currentLocation.name}`;
  }
  return `${name} is sitting at ${currentLocation.name}`;
}

notifyBtn.addEventListener("click", async () => {
  const cooldownKey = "tabletap-last-sent-" + currentLocation.id;
  const lastSent = Number(loadValue(cooldownKey)) || 0;
  const waitMs = lastSent + COOLDOWN_MS - Date.now();
  if (waitMs > 0) {
    const minutes = Math.ceil(waitMs / 60000);
    showStatus(`Already sent! You can notify again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`, "error");
    return;
  }

  notifyBtn.disabled = true; // prevent double-taps while sending
  showStatus("Sending…");
  try {
    const response = await fetch("https://ntfy.sh/" + NTFY_TOPIC, {
      method: "POST",
      body: notifyMessage(loadValue("tabletap-name")),
      headers: { Title: "TableTap", Tags: "fork_and_knife" },
    });
    if (!response.ok) throw new Error("ntfy replied with status " + response.status);
    saveValue(cooldownKey, String(Date.now()));
    showStatus("Sent! Your friends have been notified.", "success");
  } catch (error) {
    console.error(error);
    showStatus("Couldn't send the notification. Check your internet and try again.", "error");
  } finally {
    notifyBtn.disabled = false;
  }
});

// ---------- Entrance: play directions ----------
const player = new Audio(); // one shared player so two clips never overlap

function buildTableList() {
  for (const table of LOCATIONS.filter((l) => l.type === "table")) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary";
    button.textContent = `▶ Play directions to ${table.name}`;
    button.addEventListener("click", () => playDirections(table));
    li.appendChild(button);
    tableList.appendChild(li);
  }
}

function playDirections(table) {
  player.pause();
  player.src = table.audio;
  showStatus(`Playing directions to ${table.name}.`);
  player.play().catch((error) => {
    console.error(error);
    showStatus(`Sorry, directions to ${table.name} aren't available yet.`, "error");
  });
}

// ---------- Unknown / missing location ----------
function showUnknown() {
  pageTitle.textContent = "Location not found";
  for (const l of LOCATIONS) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "?loc=" + encodeURIComponent(l.id);
    a.textContent = l.name;
    li.appendChild(a);
    locationLinks.appendChild(li);
  }
  unknownSection.hidden = false;
}

// ---------- Start ----------
if (!currentLocation) {
  showUnknown();
} else {
  document.title = `${currentLocation.name} – TableTap`;
  if (currentLocation.type === "entrance") {
    pageTitle.textContent = `Welcome! You're at the ${currentLocation.name}`;
    notifyBtn.textContent = "Notify friends I've arrived";
    directionsSection.hidden = false;
    buildTableList();
  } else {
    pageTitle.textContent = `You're at ${currentLocation.name}`;
  }

  if (loadValue("tabletap-name")) {
    showNotify();
  } else {
    showNameForm();
  }
}
