// dashboard.js - Complete Analytics Dashboard (No Export)

let distributionChart = null;
let anomalyChart = null;
let autoRefreshInterval = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadLearningStatus();

  // Setup event listeners
  const refreshBtn = document.getElementById('refreshBtn');
  const resetBtn = document.getElementById('resetBtn');
  const autoRefreshCheckbox = document.getElementById('autoRefreshCheckbox');

  if (refreshBtn) refreshBtn.addEventListener('click', () => loadDashboard());
  if (resetBtn) resetBtn.addEventListener('click', () => showConfirmModal('Reset Data', 'Are you sure you want to reset all focus data? This cannot be undone.', resetAllData));

  startAutoRefresh();
});

function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(() => {
    loadDashboard();
  }, 30000);
}

function loadLearningStatus() {
  chrome.runtime.sendMessage({ action: "getSessionState" }, (response) => {
    if (response) {
      const samples = response.baselineSamples || 0;
      const isStable = response.isStable;
      const badge = document.getElementById('learningBadge');

      if (badge) {
        if (samples < 15) {
          badge.textContent = `📚 Learning (${samples}/15)`;
          badge.style.background = '#ff9800';
        } else if (samples < 50) {
          badge.textContent = `🎯 Personalized (${samples} samples)`;
          badge.style.background = '#4caf50';
        } else {
          badge.textContent = `🌟 Fully trained`;
          badge.style.background = '#2196f3';
        }
      }
    }
  });
}

function loadDashboard() {
  chrome.storage.local.get(["stats", "timeline", "sessions", "anomalyHistory"], (data) => {
    const stats = data.stats || { focused: 0, distracted: 0, fatigued: 0 };
    const timeline = data.timeline || [];
    const sessions = data.sessions || [];
    const anomalyHistory = data.anomalyHistory || [];

    updateStatsGrid(stats, timeline);
    updateCharts(stats, timeline, anomalyHistory);
    updateTimeline(timeline);
    updateSessionsList(sessions);
    updateInsights(stats, timeline, anomalyHistory);
  });
}

function updateStatsGrid(stats, timeline) {
  const total = (stats.focused || 0) + (stats.distracted || 0) + (stats.fatigued || 0);
  const focusPercent = total ? ((stats.focused || 0) / total * 100).toFixed(1) : 0;
  const productivityScore = calculateProductivityScore(timeline);

  const recentTrend = calculateTrend(timeline);

  const statsGrid = document.getElementById('statsGrid');
  if (!statsGrid) return;

  statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-title">🎯 Focused Time</div>
            <div class="stat-value">${stats.focused || 0}<span class="stat-unit">min</span></div>
            <div class="stat-trend ${recentTrend.focusTrend >= 0 ? 'trend-up' : 'trend-down'}">
                ${recentTrend.focusTrend >= 0 ? '↑' : '↓'} ${Math.abs(recentTrend.focusTrend).toFixed(1)}% trend
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-title">⚠️ Distracted Time</div>
            <div class="stat-value">${stats.distracted || 0}<span class="stat-unit">min</span></div>
            <div class="stat-trend ${recentTrend.distractedTrend <= 0 ? 'trend-up' : 'trend-down'}">
                ${recentTrend.distractedTrend <= 0 ? '↓' : '↑'} ${Math.abs(recentTrend.distractedTrend).toFixed(1)}%
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-title">😴 Fatigue Time</div>
            <div class="stat-value">${stats.fatigued || 0}<span class="stat-unit">min</span></div>
            <div class="stat-trend ${recentTrend.fatigueTrend <= 0 ? 'trend-up' : 'trend-down'}">
                ${recentTrend.fatigueTrend <= 0 ? '↓' : '↑'} ${Math.abs(recentTrend.fatigueTrend).toFixed(1)}%
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-title">📊 Productivity Score</div>
            <div class="stat-value">${productivityScore}<span class="stat-unit">/100</span></div>
            <div class="stat-trend">${getProductivityGrade(productivityScore)}</div>
        </div>
    `;
}

function calculateProductivityScore(timeline) {
  if (!timeline || timeline.length === 0) return 0;

  let score = 0;
  let weightSum = 0;

  timeline.forEach((entry, index) => {
    const weight = index + 1;
    weightSum += weight;

    if (entry.state === 'focused') score += 100 * weight;
    else if (entry.state === 'distracted') score += 40 * weight;
    else if (entry.state === 'fatigued') score += 20 * weight;
  });

  return Math.round(score / weightSum);
}

function getProductivityGrade(score) {
  if (score >= 80) return '🏆 Excellent';
  if (score >= 60) return '👍 Good';
  if (score >= 40) return '⚠️ Needs Improvement';
  return '🔴 Poor';
}

function calculateTrend(timeline) {
  if (!timeline || timeline.length < 20) return { focusTrend: 0, distractedTrend: 0, fatigueTrend: 0 };

  const half = Math.floor(timeline.length / 2);
  const firstHalf = timeline.slice(0, half);
  const secondHalf = timeline.slice(half);

  const firstFocus = firstHalf.filter(s => s.state === 'focused').length / firstHalf.length;
  const secondFocus = secondHalf.filter(s => s.state === 'focused').length / secondHalf.length;
  const firstDistracted = firstHalf.filter(s => s.state === 'distracted').length / firstHalf.length;
  const secondDistracted = secondHalf.filter(s => s.state === 'distracted').length / secondHalf.length;
  const firstFatigue = firstHalf.filter(s => s.state === 'fatigued').length / firstHalf.length;
  const secondFatigue = secondHalf.filter(s => s.state === 'fatigued').length / secondHalf.length;

  return {
    focusTrend: (secondFocus - firstFocus) * 100,
    distractedTrend: (secondDistracted - firstDistracted) * 100,
    fatigueTrend: (secondFatigue - firstFatigue) * 100
  };
}

function updateCharts(stats, timeline, anomalyHistory) {
  // Distribution Chart (Pie)
  const ctx1 = document.getElementById('distributionChart');
  if (!ctx1) return;

  const context1 = ctx1.getContext('2d');
  if (distributionChart) distributionChart.destroy();

  distributionChart = new Chart(context1, {
    type: 'doughnut',
    data: {
      labels: ['Focused', 'Distracted', 'Fatigued'],
      datasets: [{
        data: [stats.focused || 0, stats.distracted || 0, stats.fatigued || 0],
        backgroundColor: ['#4caf50', '#ff9800', '#f44336'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  // Anomaly Chart (Line)
  const ctx2 = document.getElementById('anomalyChart');
  if (!ctx2) return;

  const context2 = ctx2.getContext('2d');
  if (anomalyChart) anomalyChart.destroy();

  const recentAnomalies = anomalyHistory.slice(-60);
  const anomalyData = recentAnomalies.map(a => a.score);
  const labels = recentAnomalies.map((_, i) => i + 1);

  anomalyChart = new Chart(context2, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Anomaly Score',
        data: anomalyData,
        borderColor: '#f44336',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        tension: 0.3,
        fill: true
      }, {
        label: 'Distraction Threshold',
        data: Array(labels.length).fill(0.45),
        borderColor: '#ff9800',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          min: 0,
          max: 1,
          title: { display: true, text: 'Anomaly Score' }
        },
        x: {
          title: { display: true, text: 'Time (readings)' }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              return `Anomaly: ${context.raw.toFixed(3)}`;
            }
          }
        }
      }
    }
  });
}

function updateTimeline(timeline) {
  const container = document.getElementById('timelineVisual');
  if (!container) return;

  container.innerHTML = '';

  if (!timeline || timeline.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No data yet. Start a session to see your focus timeline.</div>';
    return;
  }

  const displayTimeline = timeline.slice(-100);

  displayTimeline.forEach((entry) => {
    const dot = document.createElement('div');
    dot.className = 'timeline-dot';

    let color = '#4caf50';
    if (entry.state === 'distracted') color = '#ff9800';
    if (entry.state === 'fatigued') color = '#f44336';

    dot.style.background = color;
    const time = new Date(entry.time).toLocaleTimeString();
    dot.title = `${entry.state} at ${time} | Anomaly: ${(entry.anomalyScore || 0).toFixed(3)}`;

    container.appendChild(dot);
  });
}

function updateSessionsList(sessions) {
  const container = document.getElementById('sessionsList');
  if (!container) return;

  if (!sessions || sessions.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No sessions recorded yet. Click "Start Session" in the extension popup to begin tracking.</div>';
    return;
  }

  const recentSessions = sessions.slice(-10).reverse();
  container.innerHTML = recentSessions.map(session => `
        <div class="session-item">
            <div class="session-date">${new Date(session.startTime).toLocaleDateString()} ${new Date(session.startTime).toLocaleTimeString()}</div>
            <div class="session-stats">
                <div class="session-stat"><span class="focused-dot">●</span> ${session.focused || 0}m</div>
                <div class="session-stat"><span class="distracted-dot">●</span> ${session.distracted || 0}m</div>
                <div class="session-stat"><span class="fatigued-dot">●</span> ${session.fatigue || 0}m</div>
                <div class="session-stat"><strong>${session.score || 0}%</strong></div>
            </div>
        </div>
    `).join('');
}

function updateInsights(stats, timeline, anomalyHistory) {
  const insights = [];
  const total = (stats.focused || 0) + (stats.distracted || 0) + (stats.fatigued || 0);
  const focusPercent = total ? ((stats.focused || 0) / total * 100) : 0;

  // Productivity insights
  if (focusPercent >= 75) {
    insights.push('🌟 Exceptional focus! You\'re in the top tier of productivity. Keep maintaining these habits.');
  } else if (focusPercent >= 55) {
    insights.push('👍 Good focus levels. A few small improvements could make a big difference.');
  } else if (focusPercent >= 35) {
    insights.push('⚠️ Your focus could use improvement. Try reducing distractions like tab switching.');
  } else if (focusPercent > 0) {
    insights.push('🔴 Low focus detected. Consider taking breaks and using Deep Work mode.');
  } else {
    insights.push('📊 Start a session to get personalized productivity insights!');
  }

  // Anomaly insights
  if (anomalyHistory && anomalyHistory.length > 10) {
    const recentAnomalies = anomalyHistory.slice(-20);
    const avgAnomaly = recentAnomalies.reduce((a, b) => a + b.score, 0) / recentAnomalies.length;

    if (avgAnomaly > 0.55) {
      insights.push('⚠️ Unusual behavior patterns detected recently. Consider what might be causing distractions.');
    } else if (avgAnomaly < 0.25) {
      insights.push('🎯 Very consistent behavior! Your focus patterns are stable and productive.');
    }
  }

  // Fatigue insights
  if (timeline && timeline.length > 0) {
    const recentFatigue = timeline.slice(-20).filter(s => s.state === 'fatigued').length;
    if (recentFatigue > 8) {
      insights.push('😴 High fatigue detected. Make sure you\'re taking regular breaks and getting enough sleep.');
    }
  }

  // Focus streak insight
  const focusStreak = calculateFocusStreak(timeline);
  if (focusStreak > 5) {
    insights.push(`🔥 You're on a ${focusStreak}-state focus streak! Excellent concentration.`);
  }

  // Best time insight
  const bestHour = getBestHour(timeline);
  if (bestHour) {
    insights.push(`⏰ Your most productive time is around ${bestHour}:00. Schedule important work during this period.`);
  }

  const insightsContainer = document.getElementById('insights');
  if (insightsContainer) {
    insightsContainer.innerHTML = insights.slice(0, 5).map(i => `<div class="insight-item">${i}</div>`).join('');
  }
}

function calculateFocusStreak(timeline) {
  if (!timeline || timeline.length === 0) return 0;

  let streak = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i].state === 'focused') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function getBestHour(timeline) {
  if (!timeline || timeline.length < 20) return null;

  const hourStats = {};
  timeline.forEach(entry => {
    const hour = new Date(entry.time).getHours();
    if (!hourStats[hour]) hourStats[hour] = { focused: 0, total: 0 };
    hourStats[hour].total++;
    if (entry.state === 'focused') hourStats[hour].focused++;
  });

  let bestHour = null;
  let bestRatio = 0;
  for (const [hour, stats] of Object.entries(hourStats)) {
    const ratio = stats.focused / stats.total;
    if (ratio > bestRatio && stats.total > 3) {
      bestRatio = ratio;
      bestHour = hour;
    }
  }

  return bestHour;
}

function resetAllData() {
  chrome.runtime.sendMessage({ action: "resetUserData" }, (response) => {
    if (response && response.success) {
      loadDashboard();
      loadLearningStatus();
    }
  });
}

function showConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('modal');
  if (!modal) return;

  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const confirmBtn = document.getElementById('modalConfirm');
  const cancelBtn = document.getElementById('modalCancel');

  if (modalTitle) modalTitle.textContent = title;
  if (modalMessage) modalMessage.textContent = message;

  const handleConfirm = () => {
    onConfirm();
    modal.style.display = 'none';
    cleanup();
  };

  const handleCancel = () => {
    modal.style.display = 'none';
    cleanup();
  };

  const cleanup = () => {
    if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
    if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
  };

  if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
  if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);

  modal.style.display = 'flex';
}