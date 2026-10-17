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
const pageSubtitle = document.getElementById("page-subtitle");
const nameSection = document.getElementById("name-section");
const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const notifySection = document.getElementById("notify-section");
const nameDisplay = document.getElementById("name-display");
const changeNameBtn = document.getElementById("change-name");
const notifyBtn = document.getElementById("notify-btn");
const notifyLabel = document.getElementById("notify-label");
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
  const originalLabel = notifyLabel.textContent;
  notifyLabel.textContent = "Sending…";
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
    notifyLabel.textContent = originalLabel;
  }
});

// ---------- Entrance: play directions ----------
const player = new Audio(); // one shared player so two clips never overlap
let playingButton = null;  // the table button whose directions are playing right now

// Each table becomes a card-style button:  [🍽️]  Table 1 / Play directions  [▶]
function buildTableList() {
  for (const table of LOCATIONS.filter((l) => l.type === "table")) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-btn";
    button.setAttribute("aria-label", `Play directions to ${table.name}`);
    button.innerHTML = `
      <span class="table-icon" aria-hidden="true">🍽️</span>
      <span class="table-text">
        <span class="table-name"></span>
        <span class="table-action">Play directions</span>
      </span>
      <span class="play-icon" aria-hidden="true">▶</span>`;
    // textContent (not innerHTML) for the name, so any text in locations.js is shown safely.
    button.querySelector(".table-name").textContent = table.name;
    button.table = table;
    button.addEventListener("click", () => playDirections(button));
    li.appendChild(button);
    tableList.appendChild(li);
  }
}

// Put a table button back to its normal "Play directions" look.
function stopPlaying() {
  player.pause();
  if (!playingButton) return;
  playingButton.classList.remove("playing");
  playingButton.querySelector(".table-action").textContent = "Play directions";
  playingButton.querySelector(".play-icon").textContent = "▶";
  playingButton.setAttribute("aria-label", `Play directions to ${playingButton.table.name}`);
  playingButton = null;
}

function playDirections(button) {
  const table = button.table;
  const wasPlaying = playingButton === button;
  stopPlaying();
  if (wasPlaying) {
    showStatus(`Stopped directions to ${table.name}.`);
    return;
  }

  player.src = table.audio;
  playingButton = button;
  button.classList.add("playing");
  button.querySelector(".table-action").textContent = "Playing… tap to stop";
  button.querySelector(".play-icon").textContent = "■";
  button.setAttribute("aria-label", `Stop directions to ${table.name}`);
  showStatus(`Playing directions to ${table.name}.`);

  player.play().catch((error) => {
    // Ignore this if the user already tapped another table (that cancels this one).
    if (playingButton !== button) return;
    console.error(error);
    stopPlaying();
    showStatus(`Sorry, directions to ${table.name} aren't available yet.`, "error");
  });
}

player.addEventListener("ended", stopPlaying);

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
// data-view picks the big emoji at the top of the page (see .hero-icon in style.css).
document.body.dataset.view = currentLocation ? currentLocation.type : "unknown";

if (!currentLocation) {
  showUnknown();
} else {
  document.title = `${currentLocation.name} – TableTap`;
  if (currentLocation.type === "entrance") {
    pageTitle.textContent = `Welcome! You're at the ${currentLocation.name}`;
    pageSubtitle.textContent = "Hear directions to any table, or let your friends know you're here.";
    notifyLabel.textContent = "Notify friends I've arrived";
    directionsSection.hidden = false;
    buildTableList();
  } else {
    pageTitle.textContent = `You're at ${currentLocation.name}`;
    pageSubtitle.textContent = "Let your friends know where to find you.";
  }

  if (loadValue("tabletap-name")) {
    showNotify();
  } else {
    showNameForm();
  }
}
