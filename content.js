(() => {
  const RATINGS = ["G", "PG", "PG-13", "R", "NC-17"];
  const CATEGORY_LABELS = {
    nudity: "Nudity",
    profanity: "Profanity",
    violence: "Violence",
    gore: "Gore",
    drugs: "Drugs",
    alcohol: "Alcohol",
    "sexual-references": "Sexual references",
    "religious-content": "Religious content",
    "jump-scares": "Jump scares"
  };

  const DEFAULT_SETTINGS = {
    selectedRating: "G",
    enabledCategories: Object.fromEntries(Object.keys(CATEGORY_LABELS).map((id) => [id, true])),
    siteEnabled: {},
    pausedVideos: {}
  };

  const state = {
    database: null,
    settings: { ...DEFAULT_SETTINGS },
    video: null,
    videoKey: "",
    activeMuteSegmentId: "",
    previousMuted: false,
    lastAction: null,
    lastNoDataKey: "",
    lastUrl: location.href,
    toastRoot: null,
    toastTimer: 0
  };

  init();

  async function init() {
    state.settings = mergeSettings(await chrome.storage.sync.get(DEFAULT_SETTINGS));
    state.database = await loadDatabase();
    installMessageListener();
    installUrlWatcher();
    window.setInterval(tick, 250);
    tick();
  }

  async function loadDatabase() {
    try {
      const response = await fetch(chrome.runtime.getURL("data/curatedSegments.json"));
      return await response.json();
    } catch (error) {
      console.warn("[Ratings Adjuster] Failed to load local segment database.", error);
      return { videos: {} };
    }
  }

  function installMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "RATINGS_ADJUSTER_SETTINGS_UPDATED") {
        state.settings = mergeSettings(message.settings || {});
        applyFiltering();
        sendResponse({ ok: true });
        return true;
      }

      if (message?.type === "RATINGS_ADJUSTER_GET_STATUS") {
        updateVideoState();
        sendResponse(getStatus());
        return true;
      }

      return false;
    });
  }

  function installUrlWatcher() {
    const notifyUrlChanged = () => {
      window.dispatchEvent(new Event("ratings-adjuster-url-change"));
    };

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      notifyUrlChanged();
      return result;
    };

    history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      notifyUrlChanged();
      return result;
    };

    window.addEventListener("popstate", notifyUrlChanged);
    window.addEventListener("ratings-adjuster-url-change", () => {
      state.lastUrl = location.href;
      state.videoKey = "";
      state.activeMuteSegmentId = "";
      state.lastAction = null;
      state.lastNoDataKey = "";
      window.setTimeout(tick, 300);
    });
  }

  function tick() {
    if (location.href !== state.lastUrl) {
      window.dispatchEvent(new Event("ratings-adjuster-url-change"));
    }
    updateVideoState();
    applyFiltering();
  }

  function updateVideoState() {
    const video = findPrimaryVideo();
    state.video = video;
    state.videoKey = normalizeVideoUrl(location.href);
  }

  function findPrimaryVideo() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (!videos.length) return null;

    return videos
      .filter((video) => Number.isFinite(video.duration) && video.duration > 0)
      .sort((a, b) => visibleArea(b) - visibleArea(a))[0] || videos[0];
  }

  function visibleArea(element) {
    const rect = element.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    return width * height;
  }

  function applyFiltering() {
    const video = state.video;
    if (!video || !state.videoKey) return;

    const entry = state.database?.videos?.[state.videoKey];
    if (!entry) {
      maybeShowNoDataToast();
      restoreMuteIfNeeded();
      return;
    }

    if (!isFilteringEnabled()) {
      restoreMuteIfNeeded();
      return;
    }

    const matchingSegments = getMatchingSegments(entry.segments || [], video.currentTime);
    const skipSegment = matchingSegments.find((segment) => segment.action === "skip");

    if (skipSegment) {
      restoreMuteIfNeeded();
      video.currentTime = Math.min(skipSegment.end + 0.35, video.duration || skipSegment.end + 0.35);
      showToast({
        title: `Skipped: ${formatCategories(skipSegment.categories)}`,
        detail: formatRange(skipSegment.start, skipSegment.end),
        tone: "skip"
      });
      state.lastAction = {
        label: `Skipped ${formatCategories(skipSegment.categories).toLowerCase()}`,
        detail: `${formatRange(skipSegment.start, skipSegment.end)} because it exceeds ${state.settings.selectedRating}.`
      };
      return;
    }

    const muteSegment = matchingSegments.find((segment) => segment.action === "mute");
    if (muteSegment) {
      if (state.activeMuteSegmentId !== muteSegment.id) {
        state.previousMuted = video.muted;
      }
      state.activeMuteSegmentId = muteSegment.id;
      video.muted = true;
      const remaining = Math.max(0, muteSegment.end - video.currentTime);
      showToast({
        title: `Muted: ${formatCategories(muteSegment.categories)}`,
        detail: `${Math.ceil(remaining)}s remaining`,
        tone: "mute",
        transient: true
      });
      state.lastAction = {
        label: `Muted ${formatCategories(muteSegment.categories).toLowerCase()}`,
        detail: `${formatRange(muteSegment.start, muteSegment.end)} because it exceeds ${state.settings.selectedRating}.`
      };
      return;
    }

    restoreMuteIfNeeded();
  }

  function getMatchingSegments(segments, currentTime) {
    return segments.filter((segment) => {
      const inRange = currentTime >= segment.start && currentTime < segment.end;
      if (!inRange) return false;
      if (!isRatingBlocked(segment.rating)) return false;
      return (segment.categories || []).some((category) => state.settings.enabledCategories[category]);
    });
  }

  function isRatingBlocked(segmentRating) {
    const selectedIndex = RATINGS.indexOf(state.settings.selectedRating);
    const segmentIndex = RATINGS.indexOf(segmentRating);
    if (selectedIndex < 0 || segmentIndex < 0) return true;
    return segmentIndex > selectedIndex;
  }

  function isFilteringEnabled() {
    const hostEnabled = state.settings.siteEnabled?.[location.hostname] !== false;
    const videoPaused = Boolean(state.settings.pausedVideos?.[state.videoKey]);
    return hostEnabled && !videoPaused;
  }

  function restoreMuteIfNeeded() {
    if (!state.video || !state.activeMuteSegmentId) return;
    state.video.muted = state.previousMuted;
    state.activeMuteSegmentId = "";
  }

  function maybeShowNoDataToast() {
    if (state.lastNoDataKey === state.videoKey) return;
    state.lastNoDataKey = state.videoKey;
    showToast({
      title: "No filtering data available",
      detail: "This URL is not in the local demo database yet.",
      tone: "neutral"
    });
  }

  function showToast({ title, detail, tone, transient = false }) {
    const root = ensureToastRoot();
    const toast = root.querySelector(".ra-toast");
    const progress = root.querySelector(".ra-progress");

    toast.dataset.tone = tone || "neutral";
    toast.querySelector(".ra-title").textContent = title;
    toast.querySelector(".ra-detail").textContent = detail || "";
    toast.classList.add("visible");
    progress.classList.toggle("is-live", transient);

    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      toast.classList.remove("visible");
      progress.classList.remove("is-live");
    }, transient ? 900 : 2600);
  }

  function ensureToastRoot() {
    if (state.toastRoot?.isConnected) return state.toastRoot;

    const host = document.createElement("div");
    host.id = "ratings-adjuster-overlay";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: 76px;
          right: 28px;
          z-index: 2147483647;
          pointer-events: none;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .ra-toast {
          min-width: 220px;
          max-width: 320px;
          overflow: hidden;
          color: #f8fafc;
          background: rgba(13, 18, 28, 0.94);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.38);
          opacity: 0;
          transform: translateY(-8px) scale(0.98);
          transition: opacity 160ms ease, transform 160ms ease;
          backdrop-filter: blur(12px);
        }

        .ra-toast.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .ra-body {
          display: flex;
          gap: 10px;
          padding: 12px 13px 10px;
        }

        .ra-dot {
          flex: 0 0 auto;
          width: 10px;
          height: 10px;
          margin-top: 5px;
          border-radius: 999px;
          background: #f8fafc;
          box-shadow: 0 0 0 4px rgba(248, 250, 252, 0.16);
        }

        .ra-toast[data-tone="skip"] .ra-dot {
          background: #f59e0b;
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.22);
        }

        .ra-toast[data-tone="neutral"] .ra-dot {
          background: #94a3b8;
          box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.2);
        }

        .ra-title {
          margin: 0;
          font-size: 13px;
          font-weight: 760;
          line-height: 1.25;
          letter-spacing: 0;
        }

        .ra-detail {
          margin: 3px 0 0;
          color: #cbd5e1;
          font-size: 12px;
          line-height: 1.35;
        }

        .ra-progress {
          height: 2px;
          background: linear-gradient(90deg, #f8fafc, #f59e0b);
          transform-origin: left center;
          opacity: 0.9;
        }

        .ra-progress.is-live {
          animation: ra-countdown 900ms linear both;
        }

        @keyframes ra-countdown {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ra-toast,
          .ra-progress {
            transition: none;
            animation: none;
          }
        }
      </style>
      <div class="ra-toast" data-tone="neutral" role="status" aria-live="polite">
        <div class="ra-body">
          <div class="ra-dot" aria-hidden="true"></div>
          <div>
            <p class="ra-title"></p>
            <p class="ra-detail"></p>
          </div>
        </div>
        <div class="ra-progress"></div>
      </div>
    `;

    document.documentElement.appendChild(host);
    state.toastRoot = shadow;
    return shadow;
  }

  function getStatus() {
    const entry = state.database?.videos?.[state.videoKey];
    return {
      hasPlayer: Boolean(state.video),
      hasData: Boolean(entry),
      videoKey: state.videoKey,
      title: getPageTitle(entry),
      currentTime: state.video?.currentTime || 0,
      duration: state.video?.duration || 0,
      segmentCount: entry?.segments?.length || 0,
      filteringEnabled: isFilteringEnabled(),
      lastAction: state.lastAction
    };
  }

  function getPageTitle(entry) {
    if (entry?.title) return entry.title;
    const ytTitle = document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim();
    if (ytTitle) return ytTitle;
    return document.title.replace(/ - YouTube$/, "").trim();
  }

  function normalizeVideoUrl(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      return "";
    }

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

  function mergeSettings(stored) {
    return {
      selectedRating: stored.selectedRating || DEFAULT_SETTINGS.selectedRating,
      enabledCategories: {
        ...DEFAULT_SETTINGS.enabledCategories,
        ...(stored.enabledCategories || {})
      },
      siteEnabled: stored.siteEnabled || {},
      pausedVideos: stored.pausedVideos || {}
    };
  }

  function formatCategories(categories = []) {
    if (!categories.length) return "Filtered content";
    return categories.map((category) => CATEGORY_LABELS[category] || category).join(" + ");
  }

  function formatRange(start, end) {
    return `${formatTime(start)}-${formatTime(end)}`;
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }
})();
