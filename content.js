console.log("CONTENT SCRIPT LOADED");

let metrics = resetMetrics();
let lastInteractionTime = Date.now();
let isTabActive = true;
let sessionActive = true;

// Scroll tracking
let lastScrollPosition = window.scrollY;
let lastScrollTime = Date.now();
let scrollIntervals = [];
let scrollDirectionChanges = 0;
let lastScrollDirection = null;

// Keystroke tracking
let lastKeystrokeTime = Date.now();
let keystrokeIntervals = [];

const BATCH_INTERVAL = 3000;
const MAX_INTERVALS = 20;

// Check session state on load
chrome.runtime.sendMessage({ action: "getSessionState" }, (response) => {
  if (response) {
    sessionActive = response.sessionActive;
    console.log("Session active:", sessionActive);
  }
});

function resetMetrics() {
  return {
    keystrokes: 0,
    backspaces: 0,
    scrollEvents: 0,
    scrollDirectionChanges: 0,
    scrollIntervals: [],
    keystrokeIntervals: [],
    clicks: 0,
    mouseMoves: 0,
    activeTime: 0,
    idleTime: 0,
    tabSwitches: 0
  };
}

function safeSendMessage(message) {
  try {
    chrome.runtime.sendMessage(message, () => {
      if (chrome.runtime.lastError) {
        console.log("Message error:", chrome.runtime.lastError.message);
      }
    });
  } catch (e) {
    console.log(e);
  }
}

function updateInteraction() {
  const now = Date.now();
  const delta = now - lastInteractionTime;

  if (delta > 15000) {
    metrics.idleTime += delta;
  } else {
    metrics.activeTime += delta;
  }
  lastInteractionTime = now;
}

// Track keystrokes with timing
document.addEventListener("keydown", (e) => {
  if (!sessionActive) return;

  updateInteraction();
  metrics.keystrokes++;

  // Track keystroke intervals
  const now = Date.now();
  const interval = now - lastKeystrokeTime;
  if (interval > 50 && interval < 2000) { // Ignore very long pauses
    keystrokeIntervals.push(interval);
    if (keystrokeIntervals.length > MAX_INTERVALS) keystrokeIntervals.shift();
  }
  lastKeystrokeTime = now;
  metrics.keystrokeIntervals = [...keystrokeIntervals];

  if (e.key === "Backspace") {
    metrics.backspaces++;
  }
});

// Track scroll with direction changes and intervals
document.addEventListener("scroll", () => {
  if (!sessionActive) return;

  updateInteraction();
  metrics.scrollEvents++;

  const now = Date.now();
  const currentPosition = window.scrollY;
  const scrollDelta = currentPosition - lastScrollPosition;

  // Track scroll intervals (time between scroll events)
  const interval = now - lastScrollTime;
  if (interval > 16 && interval < 1000) {
    scrollIntervals.push(interval);
    if (scrollIntervals.length > MAX_INTERVALS) scrollIntervals.shift();
  }
  lastScrollTime = now;
  metrics.scrollIntervals = [...scrollIntervals];

  // Track direction changes
  const currentDirection = scrollDelta > 0 ? "down" : (scrollDelta < 0 ? "up" : null);
  if (currentDirection && lastScrollDirection && currentDirection !== lastScrollDirection) {
    metrics.scrollDirectionChanges++;
  }
  lastScrollDirection = currentDirection;
  lastScrollPosition = currentPosition;
});

document.addEventListener("mousemove", () => {
  if (!sessionActive) return;
  updateInteraction();
  metrics.mouseMoves++;
});

document.addEventListener("click", () => {
  if (!sessionActive) return;
  updateInteraction();
  metrics.clicks++;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    metrics.tabSwitches++;
  }
  isTabActive = !document.hidden;
});

// Send metrics periodically
setInterval(() => {
  if (!isTabActive || !sessionActive) return;

  updateInteraction();

  // Copy metrics and reset
  const metricsToSend = { ...metrics };

  safeSendMessage({
    action: "logMetrics",
    metrics: metricsToSend
  });

  metrics = resetMetrics();
  keystrokeIntervals = [];
  scrollIntervals = [];
  scrollDirectionChanges = 0;

}, BATCH_INTERVAL);

// Floating orb
const indicator = document.createElement("div");
indicator.id = "focus-assistant-indicator";
indicator.classList.add("focused");

window.addEventListener("load", () => {
  document.body.appendChild(indicator);
});

function updateIndicator(state) {
  console.log("STATE RECEIVED:", state);
  indicator.className = "";
  indicator.id = "focus-assistant-indicator";
  indicator.classList.add(state);
}

// Listen for session toggle from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("MESSAGE FROM BACKGROUND:", message);

  if (message.action === "updateState") {
    updateIndicator(message.state);
  }

  if (message.action === "triggerIntervention") {
    showOverlay(message.type);
  }

  if (message.action === "toggleSession") {
    sessionActive = message.enabled;
    console.log("Session active toggled:", sessionActive);
    if (!sessionActive) {
      // Reset indicators when session stops
      updateIndicator("focused");
    }
    sendResponse({ sessionActive });
    return true;
  }
});

function closeOverlay() {
  const oldOverlay = document.getElementById("focus-assistant-overlay");
  if (oldOverlay) oldOverlay.remove();
}

function showOverlay(type) {
  closeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "focus-assistant-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.background = "rgba(0,0,0,0.65)";
  overlay.style.backdropFilter = "blur(4px)";
  overlay.style.zIndex = "2147483647";

  const modal = document.createElement("div");
  modal.style.background = "white";
  modal.style.borderRadius = "20px";
  modal.style.padding = "28px";
  modal.style.maxWidth = "420px";
  modal.style.width = "90%";
  modal.style.boxShadow = "0 20px 40px rgba(0,0,0,0.3)";
  modal.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // SUMMARY INTERVENTION (with Got it / Not really buttons)
  if (type === "summary") {
    modal.innerHTML = `
      <h2 style="margin:0 0 12px 0; color:#333;">🧠 Focus Check</h2>
      <p style="margin:0 0 20px 0; color:#666; line-height:1.5;">
        Your attention seems to be drifting. Can you summarize what you just read?
      </p>
      <textarea id="fa-summary-input" placeholder="Write a brief summary (minimum 25 characters)..." style="
        width:100%;
        height:100px;
        padding:12px;
        border-radius:12px;
        border:1px solid #ddd;
        resize:none;
        font-size:14px;
        box-sizing:border-box;
        font-family:inherit;
      "></textarea>
      <p id="fa-summary-warning" style="color:#e74c3c; display:none; margin-top:10px; font-size:13px;">
        ✨ Please write a slightly longer summary (at least 25 characters).
      </p>
      <div style="display:flex; gap:12px; margin-top:24px;">
        <button id="fa-got-it" style="
          flex:1;
          padding:12px;
          background:#4CAF50;
          color:white;
          border:none;
          border-radius:10px;
          cursor:pointer;
          font-weight:600;
          font-size:14px;
        ">✓ Got it, I'm focused</button>
        <button id="fa-not-really" style="
          flex:1;
          padding:12px;
          background:#ff9800;
          color:white;
          border:none;
          border-radius:10px;
          cursor:pointer;
          font-weight:600;
          font-size:14px;
        ">🔄 Not really, let me reread</button>
      </div>
    `;
  }

  // FATIGUE INTERVENTION
  if (type === "break") {
    modal.innerHTML = `
      <h2 style="margin:0 0 12px 0; color:#333;">😴 Mental Fatigue Detected</h2>
      <p style="margin:0 0 12px 0; color:#666; line-height:1.5;">
        Take a short break and look away from the screen for 30 seconds.
      </p>
      <div style="
        background:#e8f5e9;
        padding:15px;
        border-radius:12px;
        margin:15px 0;
        text-align:center;
      ">
        <span id="break-timer" style="font-size:48px; font-weight:bold; color:#2e7d32;">30</span>
        <span style="font-size:18px; color:#2e7d32;"> seconds</span>
      </div>
      <div style="display:flex; gap:12px;">
        <button id="fa-ok-break" style="
          flex:1;
          padding:12px;
          background:#4CAF50;
          color:white;
          border:none;
          border-radius:10px;
          cursor:pointer;
          font-weight:600;
        ">Okay, taking a break</button>
      </div>
    `;

    // Add countdown timer
    let seconds = 30;
    const timerSpan = modal.querySelector("#break-timer");
    const interval = setInterval(() => {
      seconds--;
      if (timerSpan) timerSpan.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(interval);
        closeOverlay();
      }
    }, 1000);

    modal.querySelector("#fa-ok-break").addEventListener("click", () => {
      clearInterval(interval);
      closeOverlay();
    });
  }

  // CRICKET INTERVENTION
  if (type === "cricket") {
    modal.innerHTML = `
      <h2 style="margin:0 0 8px 0; color:#333;">🏏 Quick Cognitive Reset</h2>
      <p style="margin:0 0 20px 0; color:#666;">Hit the cricket ball at the right time!</p>
      <canvas id="fa-cricket-canvas" width="400" height="200" style="
        width:100%;
        height:auto;
        background:#1a472a;
        border-radius:12px;
        cursor:pointer;
      "></canvas>
      <button id="fa-close-cricket" style="
        width:100%;
        margin-top:16px;
        padding:10px;
        background:#666;
        color:white;
        border:none;
        border-radius:10px;
        cursor:pointer;
      ">Skip (I'm focused now)</button>
    `;
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // SUMMARY HANDLERS
  if (type === "summary") {
    document.getElementById("fa-got-it")?.addEventListener("click", () => {
      const input = document.getElementById("fa-summary-input");
      const warning = document.getElementById("fa-summary-warning");
      const text = input?.value.trim() || "";

      if (text.length < 25 && text.length > 0) {
        warning.style.display = "block";
        return;
      }

      console.log("User acknowledged - staying focused");
      closeOverlay();
    });

    document.getElementById("fa-not-really")?.addEventListener("click", () => {
      console.log("User needs to reread");
      closeOverlay();
      // Optional: Show a quick tip about re-reading
      const tip = document.createElement("div");
      tip.textContent = "💡 Take a moment to re-read the last section carefully.";
      tip.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 24px;
        background: #ff9800;
        color: white;
        padding: 12px 20px;
        border-radius: 30px;
        font-size: 14px;
        z-index: 2147483647;
        animation: fadeOut 3s forwards;
      `;
      document.body.appendChild(tip);
      setTimeout(() => tip.remove(), 3000);
    });
  }

  // CRICKET HANDLER
  if (type === "cricket" && typeof startCricketGame === "function") {
    const canvas = document.getElementById("fa-cricket-canvas");
    startCricketGame(canvas, () => closeOverlay());

    document.getElementById("fa-close-cricket")?.addEventListener("click", () => {
      closeOverlay();
    });
  }
}

// Add fade-out animation
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeOut {
    0% { opacity: 1; transform: translateY(0); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-20px); visibility: hidden; }
  }
`;
document.head.appendChild(style);