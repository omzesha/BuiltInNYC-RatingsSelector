const DEMO_URL = "https://www.youtube.com/watch?v=0NbemFbr7Jw";

const RATINGS = ["G", "PG", "PG-13", "R", "NC-17"];
const CATEGORIES = [
  { id: "nudity", label: "Nudity", icon: "eye-off" },
  { id: "profanity", label: "Profanity", icon: "volume-x" },
  { id: "violence", label: "Violence", icon: "shield-alert" },
  { id: "gore", label: "Gore", icon: "drop" },
  { id: "drugs", label: "Drugs", icon: "pill" },
  { id: "alcohol", label: "Alcohol", icon: "glass" },
  { id: "sexual-references", label: "Sexual refs", icon: "asterisk" },
  { id: "religious-content", label: "Religious", icon: "book" },
  { id: "jump-scares", label: "Jump scares", icon: "zap" }
];

const DEFAULT_SETTINGS = {
  selectedRating: "G",
  enabledCategories: Object.fromEntries(CATEGORIES.map((category) => [category.id, true])),
  siteEnabled: {},
  pausedVideos: {},
  pendingSubmissions: []
};

const extensionApi = getExtensionApi();

const ICONS = {
  "eye-off": '<path d="m3 3 18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M9.9 4.2A9.8 9.8 0 0 1 12 4c5 0 8.4 4 9.5 8a10.9 10.9 0 0 1-2.1 3.7"></path><path d="M6.4 6.4A10.7 10.7 0 0 0 2.5 12c1.1 4 4.5 8 9.5 8a9.7 9.7 0 0 0 4.1-.9"></path>',
  "volume-x": '<path d="M11 5 6 9H3v6h3l5 4V5Z"></path><path d="m19 9-4 4"></path><path d="m15 9 4 4"></path>',
  "shield-alert": '<path d="M12 3 19 6v5c0 4.3-2.8 7.9-7 9-4.2-1.1-7-4.7-7-9V6l7-3Z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path>',
  drop: '<path d="M12 3s6 6.1 6 10a6 6 0 0 1-12 0c0-3.9 6-10 6-10Z"></path>',
  pill: '<path d="m10.5 20.5 10-10a4.2 4.2 0 0 0-6-6l-10 10a4.2 4.2 0 0 0 6 6Z"></path><path d="m8.5 10.5 5 5"></path>',
  glass: '<path d="M8 3h8l-1 9a3 3 0 0 1-6 0L8 3Z"></path><path d="M12 15v6"></path><path d="M9 21h6"></path>',
  asterisk: '<path d="M12 4v16"></path><path d="m5 8 14 8"></path><path d="m19 8-14 8"></path>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z"></path>',
  zap: '<path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z"></path>'
};

const els = {
  ratingGrid: document.getElementById("ratingGrid"),
  categoryGrid: document.getElementById("categoryGrid"),
  selectedRatingLabel: document.getElementById("selectedRatingLabel"),
  allCategoriesButton: document.getElementById("allCategoriesButton"),
  siteEnabledToggle: document.getElementById("siteEnabledToggle"),
  pauseVideoButton: document.getElementById("pauseVideoButton"),
  openDemoButton: document.getElementById("openDemoButton"),
  suggestButton: document.getElementById("suggestButton"),
  refreshButton: document.getElementById("refreshButton"),
  videoTitle: document.getElementById("videoTitle"),
  videoMeta: document.getElementById("videoMeta"),
  siteLabel: document.getElementById("siteLabel"),
  statusDot: document.getElementById("statusDot"),
  lastActionTitle: document.getElementById("lastActionTitle"),
  lastActionText: document.getElementById("lastActionText"),
  suggestionDialog: document.getElementById("suggestionDialog"),
  suggestionForm: document.getElementById("suggestionForm"),
  closeSuggestionButton: document.getElementById("closeSuggestionButton"),
  cancelSuggestionButton: document.getElementById("cancelSuggestionButton"),
  suggestStartInput: document.getElementById("suggestStartInput"),
  suggestEndInput: document.getElementById("suggestEndInput"),
  suggestCategorySelect: document.getElementById("suggestCategorySelect"),
  suggestRatingSelect: document.getElementById("suggestRatingSelect"),
  suggestActionSelect: document.getElementById("suggestActionSelect"),
  suggestNoteInput: document.getElementById("suggestNoteInput")
};

let settings = structuredClone(DEFAULT_SETTINGS);
let activeTab = null;
let tabStatus = null;
let currentVideoKey = "";
let currentHost = "";

init();

async function init() {
  renderStaticControls();
  settings = await loadSettings();
  activeTab = await getActiveTab();
  currentHost = activeTab?.url ? safeUrl(activeTab.url)?.hostname || "" : "";
  els.siteLabel.textContent = currentHost || "Current website";

  await refreshStatus();
  renderState();
  bindEvents();
}

function renderStaticControls() {
  els.ratingGrid.innerHTML = RATINGS.map((rating) => (
    `<button class="rating-option" type="button" role="radio" data-rating="${rating}" aria-checked="false">${rating}</button>`
  )).join("");

  els.categoryGrid.innerHTML = CATEGORIES.map((category) => (
    `<button class="category-option" type="button" data-category="${category.id}" aria-pressed="true">
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[category.icon]}</svg>
      <span>${category.label}</span>
    </button>`
  )).join("");

  els.suggestCategorySelect.innerHTML = CATEGORIES.map((category) => (
    `<option value="${category.id}">${category.label}</option>`
  )).join("");

  els.suggestRatingSelect.innerHTML = RATINGS.map((rating) => (
    `<option value="${rating}">${rating}</option>`
  )).join("");
}

function bindEvents() {
  els.ratingGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-rating]");
    if (!button) return;
    settings.selectedRating = button.dataset.rating;
    await saveAndBroadcast();
  });

  els.categoryGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    const category = button.dataset.category;
    settings.enabledCategories[category] = !settings.enabledCategories[category];
    await saveAndBroadcast();
  });

  els.allCategoriesButton.addEventListener("click", async () => {
    const allEnabled = CATEGORIES.every((category) => settings.enabledCategories[category.id]);
    CATEGORIES.forEach((category) => {
      settings.enabledCategories[category.id] = !allEnabled;
    });
    await saveAndBroadcast();
  });

  els.siteEnabledToggle.addEventListener("change", async () => {
    if (currentHost) {
      settings.siteEnabled[currentHost] = els.siteEnabledToggle.checked;
    }
    await saveAndBroadcast();
  });

  els.pauseVideoButton.addEventListener("click", async () => {
    if (!currentVideoKey) return;
    settings.pausedVideos[currentVideoKey] = !settings.pausedVideos[currentVideoKey];
    await saveAndBroadcast();
  });

  els.suggestButton.addEventListener("click", () => {
    openSuggestionDialog();
  });

  els.refreshButton.addEventListener("click", async () => {
    await refreshStatus();
    renderState();
  });

  els.openDemoButton.addEventListener("click", () => {
    extensionApi.tabs.create({ url: DEMO_URL });
  });

  els.closeSuggestionButton.addEventListener("click", closeSuggestionDialog);
  els.cancelSuggestionButton.addEventListener("click", closeSuggestionDialog);

  els.suggestionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await savePendingSubmission();
  });
}

async function loadSettings() {
  const stored = await extensionApi.storage.sync.get(DEFAULT_SETTINGS);
  return mergeSettings(stored);
}

function mergeSettings(stored) {
  return {
    selectedRating: stored.selectedRating || DEFAULT_SETTINGS.selectedRating,
    enabledCategories: {
      ...DEFAULT_SETTINGS.enabledCategories,
      ...(stored.enabledCategories || {})
    },
    siteEnabled: stored.siteEnabled || {},
    pausedVideos: stored.pausedVideos || {},
    pendingSubmissions: Array.isArray(stored.pendingSubmissions) ? stored.pendingSubmissions : []
  };
}

async function saveAndBroadcast() {
  await extensionApi.storage.sync.set(settings);
  renderState();
  if (activeTab?.id) {
    extensionApi.tabs.sendMessage(activeTab.id, { type: "RATINGS_ADJUSTER_SETTINGS_UPDATED", settings }, () => {
      extensionApi.runtime.lastError;
    });
  }
}

async function getActiveTab() {
  const tabs = await extensionApi.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function refreshStatus() {
  tabStatus = null;
  if (!activeTab?.id) return;

  tabStatus = await new Promise((resolve) => {
    extensionApi.tabs.sendMessage(activeTab.id, { type: "RATINGS_ADJUSTER_GET_STATUS" }, (response) => {
      if (extensionApi.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response || null);
    });
  });

  currentVideoKey = tabStatus?.videoKey || normalizeVideoUrl(activeTab?.url || "") || "";
}

function renderState() {
  els.selectedRatingLabel.textContent = settings.selectedRating;

  document.querySelectorAll("[data-rating]").forEach((button) => {
    const active = button.dataset.rating === settings.selectedRating;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });

  document.querySelectorAll("[data-category]").forEach((button) => {
    const active = Boolean(settings.enabledCategories[button.dataset.category]);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const allEnabled = CATEGORIES.every((category) => settings.enabledCategories[category.id]);
  els.allCategoriesButton.textContent = allEnabled ? "All off" : "All on";

  const siteEnabled = currentHost ? settings.siteEnabled[currentHost] !== false : true;
  els.siteEnabledToggle.checked = siteEnabled;

  const videoPaused = currentVideoKey ? Boolean(settings.pausedVideos[currentVideoKey]) : false;
  els.pauseVideoButton.classList.toggle("active", videoPaused);
  els.pauseVideoButton.textContent = videoPaused ? "Resume video" : "Pause video";
  els.pauseVideoButton.disabled = !currentVideoKey;

  renderStatus(siteEnabled, videoPaused);
}

function renderStatus(siteEnabled, videoPaused) {
  const hasPlayer = Boolean(tabStatus?.hasPlayer);
  const segmentCount = tabStatus?.segmentCount || 0;
  const matched = Boolean(tabStatus?.hasData);
  const title = tabStatus?.title || inferTitleFromUrl(activeTab?.url) || "Looking for a video player";

  els.videoTitle.textContent = title;
  els.statusDot.className = "status-dot";

  if (!hasPlayer) {
    els.videoMeta.textContent = activeTab?.url?.includes("youtube.com")
      ? "Video player not ready yet. Press refresh after playback starts."
      : "Open the demo YouTube video to start filtering.";
    els.statusDot.classList.add("warning");
    return;
  }

  if (!matched) {
    els.videoMeta.textContent = "No filtering data available for this URL.";
    els.statusDot.classList.add("warning");
    return;
  }

  if (!siteEnabled || videoPaused) {
    els.videoMeta.textContent = `${segmentCount} approved segments loaded, currently paused.`;
    els.statusDot.classList.add("warning");
    return;
  }

  els.videoMeta.textContent = `${segmentCount} approved segments loaded from the local database.`;
  els.statusDot.classList.add("ready");

  if (tabStatus?.lastAction?.label) {
    els.lastActionTitle.textContent = tabStatus.lastAction.label;
    els.lastActionText.textContent = tabStatus.lastAction.detail || "Filtering matched the current settings.";
  }
}

function openSuggestionDialog() {
  const currentTime = Number(tabStatus?.currentTime || 29.5);
  const start = Math.max(0, Math.round(currentTime * 10) / 10);
  const end = Math.round((start + 1) * 10) / 10;

  els.suggestStartInput.value = String(start);
  els.suggestEndInput.value = String(end);
  els.suggestCategorySelect.value = "profanity";
  els.suggestRatingSelect.value = settings.selectedRating || "PG";
  els.suggestActionSelect.value = "mute";
  els.suggestNoteInput.value = "";

  if (typeof els.suggestionDialog.showModal === "function") {
    els.suggestionDialog.showModal();
  } else {
    els.suggestionDialog.setAttribute("open", "");
  }
}

function closeSuggestionDialog() {
  if (typeof els.suggestionDialog.close === "function") {
    els.suggestionDialog.close();
  } else {
    els.suggestionDialog.removeAttribute("open");
  }
}

async function savePendingSubmission() {
  const start = Number(els.suggestStartInput.value);
  const end = Number(els.suggestEndInput.value);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    els.lastActionTitle.textContent = "Fix timestamp range";
    els.lastActionText.textContent = "End time must be after start time.";
    return;
  }

  const submission = {
    id: `local-${Date.now()}`,
    videoUrl: currentVideoKey || normalizeVideoUrl(activeTab?.url || "") || activeTab?.url || DEMO_URL,
    start,
    end,
    rating: els.suggestRatingSelect.value,
    categories: [els.suggestCategorySelect.value],
    action: els.suggestActionSelect.value,
    note: els.suggestNoteInput.value.trim(),
    status: "pending-editor-review",
    submittedAt: new Date().toISOString()
  };

  settings.pendingSubmissions = [submission, ...(settings.pendingSubmissions || [])].slice(0, 12);
  await saveAndBroadcast();
  closeSuggestionDialog();
  els.lastActionTitle.textContent = "Timestamp saved";
  els.lastActionText.textContent = `${formatTime(start)}-${formatTime(end)} is pending editor review.`;
}

function safeUrl(rawUrl) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function normalizeVideoUrl(rawUrl) {
  const url = safeUrl(rawUrl);
  if (!url) return "";

  if (url.hostname.includes("youtube.com") && url.pathname === "/watch") {
    const videoId = url.searchParams.get("v");
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
  }

  if (url.hostname === "youtu.be") {
    const videoId = url.pathname.replace("/", "");
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
  }

  url.hash = "";
  return url.toString();
}

function inferTitleFromUrl(rawUrl) {
  const url = safeUrl(rawUrl || "");
  if (!url) return "";
  if (url.hostname.includes("youtube.com")) return "YouTube video";
  return url.hostname;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  const formattedSeconds = seconds % 1 === 0
    ? String(seconds).padStart(2, "0")
    : seconds.toFixed(1).padStart(4, "0");
  return `${minutes}:${formattedSeconds}`;
}

function getExtensionApi() {
  if (globalThis.chrome?.storage?.sync && globalThis.chrome?.tabs) {
    return globalThis.chrome;
  }

  const previewSettings = structuredClone(DEFAULT_SETTINGS);
  return {
    runtime: { lastError: null },
    storage: {
      sync: {
        async get() {
          return previewSettings;
        },
        async set(nextSettings) {
          Object.assign(previewSettings, nextSettings);
        }
      }
    },
    tabs: {
      async query() {
        return [{
          id: 1,
          url: DEMO_URL,
          title: "Ratings Adjuster demo"
        }];
      },
      create({ url }) {
        window.open(url, "_blank", "noopener,noreferrer");
      },
      sendMessage(_tabId, message, callback) {
        if (message?.type === "RATINGS_ADJUSTER_GET_STATUS") {
          callback({
            hasPlayer: true,
            hasData: true,
            videoKey: DEMO_URL,
            title: "Ratings Adjuster YouTube demo",
            currentTime: 8,
            duration: 140,
            segmentCount: 5,
            filteringEnabled: true,
            lastAction: {
              label: "Muted profanity",
              detail: "0:29.5-0:30.5 because it exceeds G."
            }
          });
          return;
        }
        callback({ ok: true });
      }
    }
  };
}
