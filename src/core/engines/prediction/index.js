/**
 * Prediction Engine - Crisis Prediction & Risk Analysis
 * 
 * Analyzes patterns in community reports to predict emerging needs
 * and detect crisis situations before they escalate.
 * 
 * @module PredictionEngine
 */

const normalize = (value) => String(value || '').trim().toLowerCase();

const hoursSince = (inputDate) => {
  if (!inputDate) return null;
  const ts = new Date(inputDate).getTime();
  if (!Number.isFinite(ts)) return null;
  return (Date.now() - ts) / (1000 * 60 * 60);
};

const urgencyByPressure = (pressureScore) => {
  if (pressureScore >= 0.8) return 'critical';
  if (pressureScore >= 0.62) return 'high';
  if (pressureScore >= 0.45) return 'medium';
  return 'low';
};

const clampPct = (value) => Math.max(0, Math.min(100, Math.round(value)));

const inferNeedType = (reports) => {
  const tokens = reports
    .map((report) => `${report.category || ''} ${report.title || ''} ${report.description || ''}`)
    .join(' ')
    .toLowerCase();

  if (tokens.includes('water') || tokens.includes('drought')) return 'Water shortage';
  if (tokens.includes('food') || tokens.includes('ration')) return 'Food shortage';
  if (tokens.includes('medical') || tokens.includes('health')) return 'Medical support';
  if (tokens.includes('flood')) return 'Flood response';
  if (tokens.includes('shelter')) return 'Temporary shelter';
  return reports[0]?.category || 'General relief';
};

const buildRegionBuckets = (reports = []) => {
  const buckets = new Map();
  reports.forEach((report) => {
    const region = report.region || report.location || 'Unknown';
    const existing = buckets.get(region) || [];
    existing.push(report);
    buckets.set(region, existing);
  });
  return buckets;
};

const hasEmergingPattern = (reports) => {
  const recent = reports.filter((report) => {
    const ageHours = hoursSince(report.createdAt || report.updatedAt || report.timestamp);
    return ageHours != null && ageHours <= 24;
  });

  if (reports.length < 3) return false;
  if (recent.length >= Math.ceil(reports.length * 0.5) && recent.length >= 3) return true;
  return false;
};

/**
 * Predict emerging needs based on report patterns
 * @param {Array} reports - Array of community reports/needs
 * @returns {Array} Predictions sorted by confidence
 */
export function predictNeeds(reports = []) {
  const regionBuckets = buildRegionBuckets(reports);
  const predictions = [];

  regionBuckets.forEach((regionReports, region) => {
    const totalReports = regionReports.length;
    const openReports = regionReports.filter((item) => item.status !== 'resolved');
    const urgentReports = openReports.filter((item) => normalize(item.priority) === 'urgent');
    const repeatedCategoryCount = {};

    openReports.forEach((item) => {
      const key = normalize(item.category || 'general');
      repeatedCategoryCount[key] = (repeatedCategoryCount[key] || 0) + 1;
    });

    const strongestCategoryCount = Object.values(repeatedCategoryCount).sort((a, b) => b - a)[0] || 0;
    const repeatedResourceRequests = strongestCategoryCount >= 3;
    const emergingCrisis = hasEmergingPattern(regionReports);
    const unresolvedPressure = openReports.length / Math.max(1, totalReports);
    const urgencyPressure = urgentReports.length / Math.max(1, openReports.length);
    const patternPressure = emergingCrisis ? 0.85 : repeatedResourceRequests ? 0.62 : 0.35;
    const pressureScore = Math.min(1, unresolvedPressure * 0.35 + urgencyPressure * 0.35 + patternPressure * 0.3);

    predictions.push({
      id: `pred-${region}-${totalReports}`,
      location: region,
      region,
      predictedNeedType: inferNeedType(openReports.length ? openReports : regionReports),
      urgencyLevel: urgencyByPressure(pressureScore),
      confidenceScore: clampPct(48 + pressureScore * 42 + Math.min(10, totalReports * 1.8)),
      trendSignal: emergingCrisis ? 'emerging_crisis' : repeatedResourceRequests ? 'resource_shortage' : 'stable_watch',
      reason: emergingCrisis
        ? 'Report volume is increasing rapidly in the last 24h.'
        : repeatedResourceRequests
          ? 'Repeated requests suggest an upcoming resource shortage.'
          : 'Monitor area for elevated but stable demand.',
      reportCount: totalReports,
      unresolvedCount: openReports.length,
      metrics: {
        pressureScore: Math.round(pressureScore * 100),
        unresolvedRatio: Math.round(unresolvedPressure * 100),
        urgencyRatio: Math.round(urgencyPressure * 100),
      },
    });
  });

  return predictions.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * Detect emerging crisis patterns from needs and notifications
 * @param {Array} needs - Active community needs
 * @param {Array} notifications - System notifications/alerts
 * @returns {Array} Crisis predictions
 */
export function detectEmergingCrisis(needs = [], notifications = []) {
  const severityKeywords = ['flood', 'medical', 'fire', 'dengue', 'rescue', 'shortage', 'outbreak'];
  const toBucketKey = (item) => `${item.region || 'Unknown'}::${item.location || 'Unknown'}`;
  const normalizeNeedSignal = (need) =>
    `${need.category || ''} ${need.location || ''} ${need.region || ''}`.toLowerCase();

  const getUrgencyLabel = (score) => {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
  };

  const activeNeeds = needs.filter((n) => n.status !== 'resolved');
  const grouped = new Map();

  activeNeeds.forEach((need) => {
    const key = toBucketKey(need);
    const prev = grouped.get(key) || { count: 0, urgentCount: 0, resourceMentions: 0, sample: need };
    const signalText = normalizeNeedSignal(need);
    const resourceMentions = /water|food|medicine|shelter|sanitation|fuel/.test(signalText) ? 1 : 0;
    grouped.set(key, {
      count: prev.count + 1,
      urgentCount: prev.urgentCount + (need.priority === 'urgent' ? 1 : 0),
      resourceMentions: prev.resourceMentions + resourceMentions,
      sample: prev.sample,
    });
  });

  const alertSignals = notifications
    .slice(0, 25)
    .map((n) => `${n.title || ''} ${n.body || ''}`.toLowerCase());

  return Array.from(grouped.values())
    .map((bucket) => {
      const keywordHits = alertSignals.reduce((sum, text) => {
        const hits = severityKeywords.filter((word) => text.includes(word)).length;
        return sum + hits;
      }, 0);

      const trendSpikeScore = Math.min(40, bucket.count * 8);
      const urgencySignal = Math.min(30, bucket.urgentCount * 10);
      const resourceShortageSignal = Math.min(20, bucket.resourceMentions * 6);
      const incidentKeywordSignal = Math.min(10, keywordHits * 2);
      const confidence = Math.min(100, trendSpikeScore + urgencySignal + resourceShortageSignal + incidentKeywordSignal);

      return {
        id: `pred-${toBucketKey(bucket.sample)}`,
        location: bucket.sample.location,
        region: bucket.sample.region,
        urgencyLevel: getUrgencyLabel(confidence),
        confidenceScore: confidence,
        reason: bucket.resourceMentions > 1
          ? 'Repeated resource requests indicate probable shortage'
          : 'Rapid increase in incident reports indicates emerging crisis',
        predictedNeedType: bucket.sample.category || 'General Support',
        metrics: {
          trendSpikeScore,
          urgencySignal,
          resourceShortageSignal,
          incidentKeywordSignal,
        },
      };
    })
    .filter((item) => item.confidenceScore >= 35)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * Calculate risk score based on reports, keywords, and weather
 * @param {Object} params - Risk calculation parameters
 * @param {number} params.reportCount - Number of reports
 * @param {string[]} params.keywords - Detected keywords
 * @param {Object} params.weather - Weather data
 * @returns {Object} Risk score and level
 */
export function calculateRiskScore({ reportCount = 0, keywords = [], weather = {} }) {
  const KEYWORD_WEIGHTS = {
    flood: 26,
    dengue: 22,
    fire: 24,
    rescue: 18,
    medical: 16,
    outbreak: 20,
  };

  const keywordScore = keywords.reduce((sum, kw) => {
    const key = String(kw || '').toLowerCase();
    return sum + (KEYWORD_WEIGHTS[key] || 4);
  }, 0);

  const weatherScore =
    (weather.rainfallMm || 0) * 0.8 +
    Math.max(0, (weather.windKph || 0) - 20) * 0.6 +
    (weather.temperatureC != null && weather.temperatureC > 38 ? 10 : 0);

  const reportScore = Math.min(45, reportCount * 3.5);
  const raw = reportScore + keywordScore + weatherScore;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    level: score >= 70 ? 'critical' : score >= 45 ? 'elevated' : 'stable',
    autoEmergency: score >= 70,
    breakdown: {
      reportScore,
      keywordScore,
      weatherScore,
    },
  };
}

/**
 * Analyze trend direction from historical data
 * @param {Array} dataPoints - Historical data points
 * @returns {Object} Trend analysis
 */
export function analyzeTrend(dataPoints = []) {
  if (dataPoints.length < 2) {
    return { direction: 'stable', change: 0 };
  }
  
  const recent = dataPoints.slice(-7);
  const first = recent[0];
  const last = recent[recent.length - 1];
  
  const change = ((last - first) / Math.max(1, first)) * 100;
  
  let direction = 'stable';
  if (change > 15) direction = 'increasing';
  else if (change < -15) direction = 'decreasing';
  
  return {
    direction,
    change: Math.round(change),
    volatility: Math.round(calculateVolatility(recent)),
  };
}

function calculateVolatility(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}
