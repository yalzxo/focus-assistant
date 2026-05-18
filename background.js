// background.js - Complete Behavioral Anomaly Detection Engine with Adaptive Thresholds
// Version 3.1 - Fully adaptive

// ============== BASELINE ENGINE ==============

class BaselineEngine {
  constructor() {
    this.baseline = {
      typingSpeed: null,
      errorRate: null,
      scrollRate: null,
      idleRatio: null,
      mouseActivity: null,
      clickRate: null,
      tabSwitchRate: null,
      samples: 0
    };

    this.baseAlpha = 0.25;
    this.minAlpha = 0.08;

    this.variance = {
      typingSpeed: 0,
      errorRate: 0,
      scrollRate: 0,
      idleRatio: 0,
      mouseActivity: 0,
      clickRate: 0,
      tabSwitchRate: 0
    };

    this.metricHistory = {
      typingSpeed: [],
      errorRate: [],
      scrollRate: [],
      idleRatio: [],
      mouseActivity: [],
      clickRate: [],
      tabSwitchRate: []
    };

    this.maxHistorySize = 20;
  }

  getAlpha() {
    if (this.baseline.samples < 30) return this.baseAlpha;
    return Math.max(this.minAlpha, this.baseAlpha * (1 - Math.min(0.7, this.baseline.samples / 200)));
  }

  update(metrics) {
    const alpha = this.getAlpha();
    const isFirstSample = this.baseline.samples === 0;

    Object.keys(this.metricHistory).forEach(key => {
      if (metrics[key] !== undefined && metrics[key] !== null) {
        this.metricHistory[key].push(metrics[key]);
        if (this.metricHistory[key].length > this.maxHistorySize) {
          this.metricHistory[key].shift();
        }
        this.variance[key] = this.calculateVariance(this.metricHistory[key]);
      }
    });

    Object.keys(this.baseline).forEach(key => {
      if (key !== 'samples' && metrics[key] !== undefined && metrics[key] !== null) {
        if (isFirstSample || this.baseline[key] === null) {
          this.baseline[key] = metrics[key];
        } else {
          this.baseline[key] = alpha * metrics[key] + (1 - alpha) * this.baseline[key];
        }
      }
    });

    this.baseline.samples++;

    if (this.baseline.samples % 20 === 0 || this.baseline.samples === 1) {
      console.log("📊 Baseline:", {
        samples: this.baseline.samples,
        typingSpeed: this.baseline.typingSpeed?.toFixed(2),
        errorRate: (this.baseline.errorRate * 100)?.toFixed(1) + '%'
      });
    }

    return this.baseline;
  }

  calculateVariance(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  getConfidence() {
    if (this.baseline.samples < 10) return this.baseline.samples / 10;
    if (this.baseline.samples < 50) return 0.7 + (this.baseline.samples - 10) / 133;
    return Math.min(0.95, 0.85 + (this.baseline.samples - 50) / 500);
  }

  isStable() {
    return this.baseline.samples >= 15;
  }

  getBaselineVector() {
    return {
      typingSpeed: this.baseline.typingSpeed || 2.0,
      errorRate: this.baseline.errorRate || 0.05,
      scrollRate: this.baseline.scrollRate || 1.0,
      idleRatio: this.baseline.idleRatio || 0.3,
      mouseActivity: this.baseline.mouseActivity || 10,
      clickRate: this.baseline.clickRate || 0.5,
      tabSwitchRate: this.baseline.tabSwitchRate || 0.1
    };
  }

  getVariability() {
    const variability = {};
    Object.keys(this.variance).forEach(key => {
      const baseline = this.baseline[key];
      if (baseline && baseline > 0) {
        variability[key] = Math.min(1, this.variance[key] / baseline);
      } else {
        variability[key] = 0.3;
      }
    });
    return variability;
  }

  save() {
    return {
      baseline: this.baseline,
      variance: this.variance,
      samples: this.baseline.samples
    };
  }

  load(data) {
    if (data) {
      this.baseline = data.baseline || this.baseline;
      this.variance = data.variance || this.variance;
      if (data.samples) this.baseline.samples = data.samples;
    }
  }
}

// ============== ANOMALY ENGINE ==============

class AnomalyEngine {
  constructor() {
    this.anomalyScores = [];
    this.maxScoreHistory = 30;

    this.weights = {
      typingSpeed: 1.0,
      errorRate: 1.2,
      scrollRate: 0.8,
      idleRatio: 1.0,
      mouseActivity: 0.7,
      clickRate: 0.6,
      tabSwitchRate: 1.3
    };

    this.fatigueIndicators = {
      typingSlowdown: 0,
      errorSpike: 0,
      erraticScrolling: 0
    };
  }

  normalizeMetrics(current, baseline, variability) {
    const normalized = {};

    Object.keys(baseline).forEach(key => {
      const currentVal = current[key] || 0;
      const baselineVal = baseline[key] || 1;

      let normalizedVal;
      if (key === 'errorRate') {
        normalizedVal = Math.min(2, currentVal / Math.max(0.01, baselineVal));
      } else if (key === 'idleRatio') {
        normalizedVal = Math.min(2, currentVal / Math.max(0.1, baselineVal));
      } else {
        normalizedVal = currentVal / Math.max(0.1, baselineVal);
      }

      const variabilityTolerance = 1 + (variability[key] || 0.3);
      normalized[key] = normalizedVal / variabilityTolerance;
    });

    return normalized;
  }

  calculateAnomalyScore(normalized) {
    let squaredSum = 0;
    let totalWeight = 0;

    Object.keys(normalized).forEach(key => {
      const weight = this.weights[key] || 1.0;
      const deviation = Math.abs(normalized[key] - 1.0);
      squaredSum += weight * Math.pow(deviation, 2);
      totalWeight += weight;
    });

    const rawDistance = Math.sqrt(squaredSum / totalWeight);
    const anomalyScore = 1 - Math.exp(-rawDistance * 1.5);

    return Math.min(0.95, Math.max(0.05, anomalyScore));
  }

  detectFatigue(current, baseline, normalized) {
    let fatigueScore = 0;

    if (normalized.typingSpeed < 0.7 && current.keystrokes > 20) {
      const severity = (0.7 - normalized.typingSpeed) / 0.7;
      fatigueScore += Math.min(0.4, severity * 0.5);
      this.fatigueIndicators.typingSlowdown = severity;
    }

    const errorRatio = normalized.errorRate;
    if (errorRatio > 1.8) {
      fatigueScore += Math.min(0.35, (errorRatio - 1) * 0.2);
      this.fatigueIndicators.errorSpike = errorRatio;
    }

    if (current.scrollRate > 3 && current.scrollDirectionChanges > 3) {
      fatigueScore += 0.2;
      this.fatigueIndicators.erraticScrolling = 1;
    }

    let indicatorCount = 0;
    Object.values(this.fatigueIndicators).forEach(v => {
      if (v > 0) indicatorCount++;
    });

    if (indicatorCount >= 2) {
      fatigueScore = Math.min(0.8, fatigueScore * 1.3);
    }

    return Math.min(0.9, fatigueScore);
  }

  computeState(anomalyScore, fatigueScore, baselineConfidence, adaptiveThresholds) {
    // Get adaptive thresholds
    const thresholds = adaptiveThresholds.getCurrentThresholds();

    let state = 'focused';
    let confidence = 0.5;

    // Use adaptive thresholds
    if (fatigueScore > thresholds.fatigue.high) {
      state = 'fatigued';
      confidence = 0.6 + (fatigueScore - thresholds.fatigue.high) * 0.8;
    }
    else if (anomalyScore > thresholds.anomaly.high && fatigueScore > thresholds.fatigue.mild) {
      state = 'fatigued';
      confidence = 0.65;
    }
    else if (anomalyScore > thresholds.anomaly.medium) {
      state = 'distracted';
      confidence = 0.55 + (anomalyScore - thresholds.anomaly.medium) * 1.2;
    }
    else if (anomalyScore < thresholds.anomaly.low) {
      state = 'focused';
      confidence = 0.7 + (thresholds.anomaly.low - anomalyScore) * 1.5;
    }
    else {
      state = 'distracted';
      confidence = 0.55;
    }

    confidence = Math.min(0.95, Math.max(0.5, confidence));

    if (baselineConfidence < 0.7) {
      confidence *= baselineConfidence;
    }

    return { state, confidence, anomalyScore, fatigueScore };
  }

  updateHistory(anomalyScore) {
    this.anomalyScores.push(anomalyScore);
    if (this.anomalyScores.length > this.maxScoreHistory) {
      this.anomalyScores.shift();
    }
  }

  getSmoothedAnomaly() {
    if (this.anomalyScores.length === 0) return 0.3;
    const sum = this.anomalyScores.reduce((a, b) => a + b, 0);
    return sum / this.anomalyScores.length;
  }

  resetFatigueIndicators() {
    this.fatigueIndicators = {
      typingSlowdown: 0,
      errorSpike: 0,
      erraticScrolling: 0
    };
  }
}

// ============== STATE ENGINE ==============

class StateEngine {
  constructor() {
    this.stateHistory = [];
    this.maxHistory = 10;

    this.stateConfidence = {
      focused: 0,
      distracted: 0,
      fatigued: 0
    };

    this.smoothingWindow = 5;
    this.minStateDuration = 10000;
    this.lastStateChange = Date.now();

    this.focusStreak = {
      current: 0,
      longest: 0,
      lastFocusTime: null
    };
  }

  updateState(newState, confidence, anomalyScore, fatigueScore) {
    const now = Date.now();
    const timeSinceLastChange = now - this.lastStateChange;
    const currentState = this.getCurrentState();

    this.updateConfidence(newState, confidence);

    let finalState = currentState;
    let finalConfidence = this.stateConfidence[finalState];

    const newStateConfidence = this.stateConfidence[newState];
    const canChange = (
      (newStateConfidence > finalConfidence + 0.15) ||
      (timeSinceLastChange > this.minStateDuration) ||
      (confidence > 0.8)
    );

    if (canChange && newState !== currentState) {
      finalState = newState;
      finalConfidence = newStateConfidence;
      this.lastStateChange = now;
      console.log(`🔄 State: ${currentState} → ${finalState} (${finalConfidence.toFixed(2)})`);
    }

    this.updateFocusStreak(finalState, now);

    this.stateHistory.push({
      state: finalState,
      confidence: finalConfidence,
      anomalyScore: anomalyScore,
      fatigueScore: fatigueScore,
      timestamp: now
    });

    if (this.stateHistory.length > this.maxHistory) {
      this.stateHistory.shift();
    }

    return {
      state: finalState,
      confidence: finalConfidence,
      anomalyScore: anomalyScore,
      fatigueScore: fatigueScore,
      focusStreak: this.focusStreak.current
    };
  }

  updateConfidence(state, confidence) {
    Object.keys(this.stateConfidence).forEach(s => {
      this.stateConfidence[s] *= 0.85;
    });
    this.stateConfidence[state] = Math.min(1, this.stateConfidence[state] + confidence);
  }

  getCurrentState() {
    if (this.stateHistory.length === 0) return 'focused';

    const weights = [0.35, 0.25, 0.2, 0.12, 0.08];
    const stateScores = { focused: 0, distracted: 0, fatigued: 0 };

    const recentStates = this.stateHistory.slice(-this.smoothingWindow);
    recentStates.forEach((entry, index) => {
      const weight = weights[index] || 0.05;
      stateScores[entry.state] += weight;
    });

    let maxState = 'focused';
    let maxScore = 0;
    Object.entries(stateScores).forEach(([state, score]) => {
      if (score > maxScore) {
        maxScore = score;
        maxState = state;
      }
    });

    return maxState;
  }

  updateFocusStreak(state, timestamp) {
    if (state === 'focused') {
      if (this.focusStreak.lastFocusTime) {
        const timeSinceLastFocus = timestamp - this.focusStreak.lastFocusTime;
        if (timeSinceLastFocus < 60000) {
          this.focusStreak.current++;
        } else {
          this.focusStreak.current = 1;
        }
      } else {
        this.focusStreak.current = 1;
      }
      this.focusStreak.lastFocusTime = timestamp;
      this.focusStreak.longest = Math.max(this.focusStreak.longest, this.focusStreak.current);
    } else {
      this.focusStreak.current = Math.max(0, this.focusStreak.current - 0.5);
    }
  }

  getStateSummary() {
    if (this.stateHistory.length === 0) return null;

    const lastHour = this.stateHistory.filter(s =>
      s.timestamp > Date.now() - 3600000
    );

    const stateCounts = {
      focused: lastHour.filter(s => s.state === 'focused').length,
      distracted: lastHour.filter(s => s.state === 'distracted').length,
      fatigued: lastHour.filter(s => s.state === 'fatigued').length
    };

    return {
      currentState: this.getCurrentState(),
      currentConfidence: this.stateConfidence[this.getCurrentState()],
      focusStreak: this.focusStreak.current,
      longestFocusStreak: this.focusStreak.longest,
      lastHourSummary: stateCounts
    };
  }

  reset() {
    this.stateHistory = [];
    this.stateConfidence = { focused: 0, distracted: 0, fatigued: 0 };
    this.lastStateChange = Date.now();
    this.focusStreak = {
      current: 0,
      longest: 0,
      lastFocusTime: null
    };
  }
}

// ============== INTERVENTION ENGINE ==============

class InterventionEngine {
  constructor() {
    this.lastInterventionTime = 0;
    this.cooldownPeriod = 60000;
    this.interventionHistory = [];
    this.maxHistory = 20;

    this.stateStartTime = {
      distracted: null,
      fatigued: null
    };
  }

  shouldIntervene(state, scores, stateConfidence, isDeepWorkMode, adaptiveThresholds) {
    const now = Date.now();

    if (now - this.lastInterventionTime < this.cooldownPeriod) {
      return null;
    }

    if (state === 'distracted') {
      if (!this.stateStartTime.distracted) {
        this.stateStartTime.distracted = now;
      }
    } else {
      this.stateStartTime.distracted = null;
    }

    if (state === 'fatigued') {
      if (!this.stateStartTime.fatigued) {
        this.stateStartTime.fatigued = now;
      }
    } else {
      this.stateStartTime.fatigued = null;
    }

    // Get adaptive thresholds
    const thresholds = adaptiveThresholds.getCurrentThresholds();

    if (state === 'distracted') {
      const duration = this.stateStartTime.distracted ?
        now - this.stateStartTime.distracted : 0;

      const minAnomaly = thresholds.anomaly.intervention;
      const minConfidence = thresholds.confidence.min;
      const minDuration = isDeepWorkMode ? 10000 : 15000;

      if (scores.anomalyScore >= minAnomaly &&
        stateConfidence >= minConfidence &&
        duration >= minDuration) {

        return {
          type: isDeepWorkMode ? 'cricket' : 'summary',
          reason: 'anomaly_detected',
          threshold: minAnomaly
        };
      }
    }

    if (state === 'fatigued') {
      const duration = this.stateStartTime.fatigued ?
        now - this.stateStartTime.fatigued : 0;

      const minFatigue = thresholds.fatigue.intervention;
      const minConfidence = thresholds.confidence.min;

      if (scores.fatigueScore >= minFatigue &&
        stateConfidence >= minConfidence &&
        duration >= 20000) {

        return {
          type: 'break',
          reason: 'fatigue_detected',
          threshold: minFatigue
        };
      }
    }

    return null;
  }

  recordIntervention(type, reason) {
    this.lastInterventionTime = Date.now();
    this.interventionHistory.push({
      type: type,
      reason: reason,
      timestamp: this.lastInterventionTime
    });

    if (this.interventionHistory.length > this.maxHistory) {
      this.interventionHistory.shift();
    }

    console.log(`💡 Intervention: ${type}`);
  }

  reset() {
    this.lastInterventionTime = 0;
    this.stateStartTime = {
      distracted: null,
      fatigued: null
    };
  }
}

// ============== ADAPTIVE THRESHOLDS ENGINE ==============

class AdaptiveThresholds {
  constructor() {
    // Dynamic thresholds that evolve with user
    this.thresholds = {
      // Anomaly thresholds
      lowAnomaly: 0.25,
      mediumAnomaly: 0.45,
      highAnomaly: 0.65,

      // Fatigue thresholds
      mildFatigue: 0.30,
      highFatigue: 0.45,

      // Confidence requirements
      minConfidence: 0.55,
      highConfidence: 0.75,

      // Intervention thresholds
      interventionAnomaly: 0.45,
      interventionFatigue: 0.40
    };

    // Historical performance tracking
    this.performanceHistory = {
      interventions: [],
      focusPatterns: [],
      timeOfDayPatterns: {}
    };

    // Adaptation parameters
    this.adaptationRate = 0.08;
    this.minThreshold = 0.20;
    this.maxThreshold = 0.70;

    // Temporary time-based adjustment
    this.tempTimeAdjustment = null;

    this.maxHistorySize = 100;

    // Load saved thresholds
    this.load();
  }

  adapt(anomalyScore, fatigueScore, userState, actualOutcome, context) {
    // 1. Adapt anomaly thresholds
    this.adaptAnomalyThresholds(anomalyScore, userState);

    // 2. Adapt fatigue thresholds
    this.adaptFatigueThresholds(fatigueScore, userState);

    // 3. Adapt based on time of day
    this.adaptTimeOfDayThresholds(context);

    // 4. Smooth thresholds
    this.smoothThresholds();

    // Log occasionally
    if (Math.random() < 0.05) {
      console.log("🎯 Adaptive Thresholds:", {
        lowAnomaly: this.thresholds.lowAnomaly.toFixed(3),
        mediumAnomaly: this.thresholds.mediumAnomaly.toFixed(3),
        interventionAnomaly: this.thresholds.interventionAnomaly.toFixed(3)
      });
    }

    this.save();
  }

  adaptAnomalyThresholds(currentAnomaly, userState) {
    this.performanceHistory.focusPatterns.push({
      anomaly: currentAnomaly,
      state: userState,
      timestamp: Date.now()
    });

    if (this.performanceHistory.focusPatterns.length > this.maxHistorySize) {
      this.performanceHistory.focusPatterns.shift();
    }

    if (this.performanceHistory.focusPatterns.length > 30) {
      const recentPatterns = this.performanceHistory.focusPatterns.slice(-50);
      const anomalies = recentPatterns.map(p => p.anomaly);
      anomalies.sort((a, b) => a - b);

      const p50 = anomalies[Math.floor(anomalies.length * 0.50)];
      const naturalBaseline = p50;
      const adjustment = (naturalBaseline - 0.35) * this.adaptationRate;

      this.thresholds.lowAnomaly = this.clamp(
        this.thresholds.lowAnomaly + adjustment * 0.5,
        0.20, 0.50
      );

      this.thresholds.mediumAnomaly = this.clamp(
        this.thresholds.mediumAnomaly + adjustment,
        0.35, 0.65
      );

      this.thresholds.highAnomaly = this.clamp(
        this.thresholds.highAnomaly + adjustment * 1.5,
        0.50, 0.85
      );
    }
  }

  adaptFatigueThresholds(currentFatigue, userState) {
    if (userState === 'fatigued' && currentFatigue > 0) {
      if (currentFatigue < this.thresholds.highFatigue) {
        this.thresholds.highFatigue = this.clamp(
          this.thresholds.highFatigue - 0.02,
          0.30, 0.60
        );
        this.thresholds.mildFatigue = this.clamp(
          this.thresholds.mildFatigue - 0.015,
          0.20, 0.50
        );
      }
    } else if (userState === 'focused' && currentFatigue > this.thresholds.mildFatigue) {
      this.thresholds.highFatigue = this.clamp(
        this.thresholds.highFatigue + 0.015,
        0.30, 0.65
      );
      this.thresholds.mildFatigue = this.clamp(
        this.thresholds.mildFatigue + 0.01,
        0.20, 0.55
      );
    }
  }

  adaptTimeOfDayThresholds(context) {
    if (!context || !context.hour) return;

    const hour = context.hour;

    if (!this.performanceHistory.timeOfDayPatterns[hour]) {
      this.performanceHistory.timeOfDayPatterns[hour] = {
        anomalyScores: [],
        fatigueScores: []
      };
    }

    if (context.anomalyScore) {
      this.performanceHistory.timeOfDayPatterns[hour].anomalyScores.push(context.anomalyScore);
      if (this.performanceHistory.timeOfDayPatterns[hour].anomalyScores.length > 20) {
        this.performanceHistory.timeOfDayPatterns[hour].anomalyScores.shift();
      }
    }

    const hourData = this.performanceHistory.timeOfDayPatterns[hour];
    if (hourData.anomalyScores.length > 10) {
      const avgAnomaly = hourData.anomalyScores.reduce((a, b) => a + b, 0) / hourData.anomalyScores.length;
      const timeAdjustment = (avgAnomaly - 0.35) * 0.3;

      this.tempTimeAdjustment = {
        hour: hour,
        adjustment: this.clamp(timeAdjustment, -0.1, 0.15),
        expires: Date.now() + 3600000
      };
    }
  }

  getTimeAdjustedThreshold(baseThreshold) {
    if (this.tempTimeAdjustment && Date.now() < this.tempTimeAdjustment.expires) {
      const adjusted = baseThreshold + this.tempTimeAdjustment.adjustment;
      return this.clamp(adjusted, this.minThreshold, this.maxThreshold);
    }
    return baseThreshold;
  }

  getCurrentThresholds() {
    return {
      anomaly: {
        low: this.getTimeAdjustedThreshold(this.thresholds.lowAnomaly),
        medium: this.getTimeAdjustedThreshold(this.thresholds.mediumAnomaly),
        high: this.getTimeAdjustedThreshold(this.thresholds.highAnomaly),
        intervention: this.getTimeAdjustedThreshold(this.thresholds.interventionAnomaly)
      },
      fatigue: {
        mild: this.thresholds.mildFatigue,
        high: this.thresholds.highFatigue,
        intervention: this.thresholds.interventionFatigue
      },
      confidence: {
        min: this.thresholds.minConfidence,
        high: this.thresholds.highConfidence
      }
    };
  }

  smoothThresholds() {
    this.thresholds.lowAnomaly = Math.min(
      this.thresholds.lowAnomaly,
      this.thresholds.mediumAnomaly - 0.05
    );

    this.thresholds.mediumAnomaly = Math.min(
      this.thresholds.mediumAnomaly,
      this.thresholds.highAnomaly - 0.05
    );

    this.thresholds.highAnomaly = Math.max(
      this.thresholds.highAnomaly,
      this.thresholds.mediumAnomaly + 0.05
    );

    this.thresholds.lowAnomaly = this.clamp(this.thresholds.lowAnomaly, 0.15, 0.50);
    this.thresholds.mediumAnomaly = this.clamp(this.thresholds.mediumAnomaly, 0.30, 0.70);
    this.thresholds.highAnomaly = this.clamp(this.thresholds.highAnomaly, 0.50, 0.85);
    this.thresholds.interventionAnomaly = this.clamp(this.thresholds.interventionAnomaly, 0.35, 0.65);
    this.thresholds.mildFatigue = this.clamp(this.thresholds.mildFatigue, 0.20, 0.55);
    this.thresholds.highFatigue = this.clamp(this.thresholds.highFatigue, 0.30, 0.65);
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  save() {
    chrome.storage.local.set({
      adaptiveThresholds: {
        thresholds: this.thresholds,
        performanceHistory: this.performanceHistory
      }
    });
  }

  load() {
    chrome.storage.local.get(["adaptiveThresholds"], (data) => {
      if (data.adaptiveThresholds) {
        this.thresholds = data.adaptiveThresholds.thresholds || this.thresholds;
        this.performanceHistory = data.adaptiveThresholds.performanceHistory || this.performanceHistory;
        console.log("🎯 Loaded adaptive thresholds");
      }
    });
  }

  reset() {
    this.thresholds = {
      lowAnomaly: 0.25,
      mediumAnomaly: 0.45,
      highAnomaly: 0.65,
      mildFatigue: 0.30,
      highFatigue: 0.45,
      minConfidence: 0.55,
      highConfidence: 0.75,
      interventionAnomaly: 0.45,
      interventionFatigue: 0.40
    };
    this.performanceHistory = {
      interventions: [],
      focusPatterns: [],
      timeOfDayPatterns: {}
    };
    this.tempTimeAdjustment = null;
    this.save();
  }
}

// ============== MAIN BACKGROUND SCRIPT ==============

// Initialize all engines
let baselineEngine = new BaselineEngine();
let anomalyEngine = new AnomalyEngine();
let stateEngine = new StateEngine();
let interventionEngine = new InterventionEngine();
let adaptiveThresholds = new AdaptiveThresholds();

let history = [];
let MAX_HISTORY = 8;
let deepWorkMode = false;
let sessionActive = true;

// Load saved data
chrome.storage.local.get(["userBaseline", "deepWorkMode", "sessionActive"], (data) => {
  if (data.userBaseline) {
    baselineEngine.load(data.userBaseline);
    console.log("📚 Loaded baseline - Samples:", baselineEngine.baseline.samples);
  }
  if (data.deepWorkMode !== undefined) deepWorkMode = data.deepWorkMode;
  if (data.sessionActive !== undefined) sessionActive = data.sessionActive;
});

// Save baseline periodically
setInterval(() => {
  if (baselineEngine.baseline.samples > 0) {
    chrome.storage.local.set({ userBaseline: baselineEngine.save() });
  }
}, 60000);

function aggregateMetrics(history) {
  const total = {
    typingSpeed: 0,
    errorRate: 0,
    scrollRate: 0,
    idleRatio: 0,
    mouseActivity: 0,
    clickRate: 0,
    tabSwitchRate: 0,
    scrollDirectionChanges: 0,
    keystrokes: 0,
    activeTime: 0,
    count: 0
  };

  history.forEach((m) => {
    const activeSeconds = (m.activeTime / 1000) || 1;

    total.typingSpeed += (m.keystrokes || 0) / activeSeconds;
    total.errorRate += (m.backspaces || 0) / (m.keystrokes || 1);
    total.scrollRate += (m.scrollEvents || 0) / activeSeconds;
    total.idleRatio += (m.idleTime || 0) / ((m.activeTime + m.idleTime) || 1);
    total.mouseActivity += m.mouseMoves || 0;
    total.clickRate += (m.clicks || 0) / activeSeconds;
    total.tabSwitchRate += (m.tabSwitches || 0) / activeSeconds;
    total.scrollDirectionChanges += m.scrollDirectionChanges || 0;
    total.keystrokes += m.keystrokes || 0;
    total.activeTime += m.activeTime || 0;
    total.count++;
  });

  if (total.count > 0) {
    Object.keys(total).forEach(key => {
      if (key !== 'count' && key !== 'keystrokes' && key !== 'activeTime' && key !== 'scrollDirectionChanges') {
        total[key] /= total.count;
      }
    });
  }

  return total;
}

function extractBehavioralVector(metrics) {
  return {
    typingSpeed: metrics.typingSpeed || 0,
    errorRate: Math.min(0.5, metrics.errorRate || 0),
    scrollRate: metrics.scrollRate || 0,
    idleRatio: Math.min(0.95, metrics.idleRatio || 0),
    mouseActivity: Math.min(500, metrics.mouseActivity || 0),
    clickRate: metrics.clickRate || 0,
    tabSwitchRate: metrics.tabSwitchRate || 0,
    scrollDirectionChanges: metrics.scrollDirectionChanges || 0,
    keystrokes: metrics.keystrokes || 0,
    activeTime: metrics.activeTime || 0
  };
}

function processMetrics(aggregated, tabId) {
  if (!sessionActive || !tabId) return;

  const currentVector = extractBehavioralVector(aggregated);
  baselineEngine.update(currentVector);

  if (!baselineEngine.isStable()) {
    if (baselineEngine.baseline.samples % 5 === 1) {
      console.log(`📚 Learning baseline (${baselineEngine.baseline.samples}/15)...`);
    }
    return;
  }

  const baseline = baselineEngine.getBaselineVector();
  const variability = baselineEngine.getVariability();
  const baselineConfidence = baselineEngine.getConfidence();

  const normalized = anomalyEngine.normalizeMetrics(currentVector, baseline, variability);
  const anomalyScore = anomalyEngine.calculateAnomalyScore(normalized);
  anomalyEngine.updateHistory(anomalyScore);
  const smoothedAnomaly = anomalyEngine.getSmoothedAnomaly();

  const fatigueScore = anomalyEngine.detectFatigue(currentVector, baseline, normalized);

  // Use adaptive thresholds for state computation
  const stateResult = anomalyEngine.computeState(smoothedAnomaly, fatigueScore, baselineConfidence, adaptiveThresholds);
  const finalState = stateEngine.updateState(stateResult.state, stateResult.confidence, smoothedAnomaly, fatigueScore);

  // ADAPT THRESHOLDS based on this reading
  adaptiveThresholds.adapt(
    smoothedAnomaly,
    fatigueScore,
    finalState.state,
    null,
    { hour: new Date().getHours(), anomalyScore: smoothedAnomaly }
  );

  // Send to content script
  chrome.tabs.sendMessage(tabId, {
    action: "updateState",
    state: finalState.state,
    anomalyScore: smoothedAnomaly,
    confidence: finalState.confidence,
    focusStreak: finalState.focusStreak
  }).catch(() => { });

  // Store stats
  chrome.storage.local.get(["stats", "timeline", "anomalyHistory"], (data) => {
    const stats = data.stats || { focused: 0, distracted: 0, fatigued: 0 };
    stats[finalState.state] = (stats[finalState.state] || 0) + 1;

    const timeline = data.timeline || [];
    timeline.push({
      state: finalState.state,
      time: Date.now(),
      anomalyScore: smoothedAnomaly,
      confidence: finalState.confidence
    });

    if (timeline.length > 500) timeline.shift();

    let anomalyHistory = data.anomalyHistory || [];
    anomalyHistory.push({
      score: smoothedAnomaly,
      timestamp: Date.now()
    });
    if (anomalyHistory.length > 200) anomalyHistory.shift();

    chrome.storage.local.set({ stats, timeline, anomalyHistory });
  });

  // Check for intervention with adaptive thresholds
  const intervention = interventionEngine.shouldIntervene(
    finalState.state,
    { anomalyScore: smoothedAnomaly, fatigueScore: fatigueScore },
    finalState.confidence,
    deepWorkMode,
    adaptiveThresholds
  );

  if (intervention) {
    chrome.tabs.sendMessage(tabId, {
      action: "triggerIntervention",
      type: intervention.type
    }).catch(() => { });
    interventionEngine.recordIntervention(intervention.type, intervention.reason);
  }

  // Periodic logging
  if (baselineEngine.baseline.samples % 20 === 0) {
    const thresholds = adaptiveThresholds.getCurrentThresholds();
    console.log("\n=== ANOMALY DETECTION ===");
    console.log("Anomaly:", smoothedAnomaly.toFixed(3), "Fatigue:", fatigueScore.toFixed(3));
    console.log("State:", finalState.state, "Confidence:", finalState.confidence.toFixed(2));
    console.log("Adaptive Thresholds - Low:", thresholds.anomaly.low.toFixed(2),
      "Medium:", thresholds.anomaly.medium.toFixed(2),
      "Intervention:", thresholds.anomaly.intervention.toFixed(2));
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message.action);

  if (message.action === "logMetrics") {
    if (!sessionActive) return true;

    history.push(message.metrics);
    if (history.length > MAX_HISTORY) history.shift();

    const aggregated = aggregateMetrics(history);
    processMetrics(aggregated, sender.tab?.id);
    return true;
  }

  if (message.action === "toggleDeepWork") {
    deepWorkMode = message.enabled;
    chrome.storage.local.set({ deepWorkMode });
    sendResponse({ deepWorkMode });
    return true;
  }

  if (message.action === "toggleSession") {
    sessionActive = message.enabled;
    chrome.storage.local.set({ sessionActive });

    if (!sessionActive) {
      chrome.storage.local.set({ userBaseline: baselineEngine.save() });
      stateEngine.reset();
      interventionEngine.reset();
    }
    sendResponse({ sessionActive });
    return true;
  }

  if (message.action === "getSessionState") {
    sendResponse({
      sessionActive,
      deepWorkMode,
      baselineSamples: baselineEngine.baseline.samples,
      isStable: baselineEngine.isStable()
    });
    return true;
  }

  if (message.action === "getStateSummary") {
    const summary = stateEngine.getStateSummary();
    sendResponse(summary);
    return true;
  }

  if (message.action === "resetUserData") {
    // Reset all engines
    baselineEngine = new BaselineEngine();
    anomalyEngine = new AnomalyEngine();
    stateEngine = new StateEngine();
    interventionEngine = new InterventionEngine();
    adaptiveThresholds = new AdaptiveThresholds();  // Reset adaptive thresholds
    history = [];

    chrome.storage.local.set({
      userBaseline: baselineEngine.save(),
      adaptiveThresholds: null,  // Clear saved thresholds
      stats: { focused: 0, distracted: 0, fatigued: 0 },
      timeline: [],
      anomalyHistory: []
    });
    sendResponse({ success: true });
    return true;
  }

  return true;
});

console.log("🎯 Behavioral Anomaly Detection Engine Started with Adaptive Thresholds");