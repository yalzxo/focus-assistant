// popup.js
const sessionBtn = document.getElementById("session-btn");
const deepCheckbox = document.getElementById("deep");

// Function to update button UI
function updateButton(active) {
    if (sessionBtn) {
        sessionBtn.innerText = active ? "⏹️ Stop Session" : "▶️ Start Session";
        sessionBtn.style.background = active ? "#f44336" : "#4CAF50";
        sessionBtn.style.color = "white";
    }
}

// Load initial states from storage
function loadStates() {
    chrome.storage.local.get(["sessionActive", "deepWorkMode"], (data) => {
        console.log("Loaded from storage:", data);
        const isActive = data.sessionActive === true;
        updateButton(isActive);
        if (deepCheckbox) {
            deepCheckbox.checked = data.deepWorkMode === true;
        }
    });
}

// Also try to get from background
chrome.runtime.sendMessage({ action: "getSessionState" }, (response) => {
    console.log("Background response:", response);
    if (response && response.sessionActive !== undefined) {
        updateButton(response.sessionActive);
    }
    if (response && deepCheckbox) {
        deepCheckbox.checked = response.deepWorkMode === true;
    }
});

// Session toggle
if (sessionBtn) {
    sessionBtn.addEventListener("click", () => {
        console.log("Session button clicked");

        chrome.storage.local.get(["sessionActive"], (data) => {
            const currentState = data.sessionActive === true;
            const next = !currentState;

            console.log("Toggling session to:", next);

            // Save to storage
            chrome.storage.local.set({ sessionActive: next }, () => {
                console.log("Saved to storage");
            });

            // Notify background script
            chrome.runtime.sendMessage({
                action: "toggleSession",
                enabled: next
            }, (response) => {
                console.log("Background response:", response);
                updateButton(next);
            });

            // Also notify all content scripts
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "toggleSession",
                        enabled: next
                    }).catch(() => { });
                });
            });
        });
    });
}

// Deep work mode toggle
if (deepCheckbox) {
    deepCheckbox.addEventListener("change", (e) => {
        console.log("Deep work mode changed:", e.target.checked);

        // Save to storage
        chrome.storage.local.set({ deepWorkMode: e.target.checked });

        // Notify background
        chrome.runtime.sendMessage({
            action: "toggleDeepWork",
            enabled: e.target.checked
        });
    });
}

// Dashboard button
const dashboardBtn = document.getElementById("dashboard-btn");
if (dashboardBtn) {
    dashboardBtn.addEventListener("click", () => {
        console.log("Dashboard button clicked");
        chrome.tabs.create({
            url: chrome.runtime.getURL("dashboard.html")
        });
    });
}

// Load states on popup open
loadStates();