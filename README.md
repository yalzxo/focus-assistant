## Focus Assistant

A privacy-first Chrome extension that detects focus, distraction, and fatigue using real-time behavioral interaction patterns instead of fixed productivity timers.

The extension continuously analyzes interaction signals such as typing rhythm, scrolling behavior, idle time, tab switching, mouse movement, and click activity to infer the user’s cognitive state and provide adaptive, context-aware interventions.

Unlike traditional productivity tools, the system does not rely on timers or content tracking. Instead, it uses adaptive behavioral anomaly detection and personalized baselines to understand how a user normally interacts with the browser and detect cognitive drift in real time.

---

# ✨ Features

## 🎯 Real-Time Cognitive State Detection
Detects:
- 🟢 Focused
- 🟡 Distracted
- 🔴 Fatigued

using:
- adaptive behavioral modeling
- anomaly detection
- temporal smoothing
- personalized baselines

---

## 🔒 Privacy-First Design

The extension:
- does NOT store typed text
- does NOT track page content
- does NOT capture screenshots
- does NOT send data externally

Only behavioral metadata and derived interaction metrics are processed locally.

---

## 📊 Behavioral Signal Tracking

Tracks:
- typing speed
- backspace frequency
- scroll behavior
- scroll direction changes
- idle time
- tab switching
- click activity
- mouse movement

without collecting sensitive user data.

---

## 🧠 Adaptive Baseline Learning

The system continuously learns each user’s normal interaction behavior using adaptive baselines and behavioral anomaly scoring.

This allows the extension to:
- personalize focus detection
- reduce false positives
- adapt to different browsing and working styles

---

## 🎮 Intelligent Interventions

### 📝 Summary Recall Prompt
Encourages active recall when distraction is detected.

### 🏏 Cricket Reset Game
A short timing-based cognitive reset game built using the Canvas API.

### 😴 Fatigue Recovery Prompt
Suggests short breaks during sustained fatigue.

---

## 📈 Dashboard Analytics

The dashboard provides:
- focus distribution
- anomaly score trends
- cognitive timeline
- productivity score
- focus streaks
- behavioral insights

---

# 🛠️ Tech Stack

- JavaScript
- Chrome Extension Manifest V3
- HTML/CSS
- Canvas API
- Chart.js
- Chrome Storage API

---

# 🚀 Installation

1. Clone the repository

```bash id="vvz0yz"
git clone <repo-url>
Open Chrome and navigate to:
chrome://extensions
Enable Developer Mode
Click Load unpacked
Select the project folder
📌 Highlights

✅ Real-time cognitive inference
✅ Adaptive behavioral anomaly detection
✅ Privacy-first architecture
✅ Intelligent interventions
✅ Lightweight local processing
✅ No content tracking

🔮 Future Improvements
predictive fatigue detection
website context awareness
adaptive threshold learning
enhanced analytics dashboard
deeper anomaly modeling
