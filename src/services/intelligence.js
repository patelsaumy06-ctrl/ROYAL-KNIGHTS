import {
  predictNeeds,
  prioritizeTasks,
  generateVolunteerRecommendations,
  computeImpactMetrics,
} from '../core';

const normalize = (value) => String(value || '').trim().toLowerCase();
const FINGERPRINT_LIMIT = 120;
let lastSnapshotCache = { key: '', value: null };

const buildFingerprint = (needs = [], notifications = [], volunteers = [], smartMode = false) => {
  const needsKey = needs
    .slice(0, FINGERPRINT_LIMIT)
    .map((item) => `${item.id}:${item.status}:${item.priority}:${item.assigned}:${item.volunteers}`)
    .join('|');
  const notificationsKey = notifications
    .slice(0, FINGERPRINT_LIMIT)
    .map((item) => `${item.id}:${item.read ? 1 : 0}:${item.type}`)
    .join('|');
  const volunteersKey = volunteers
    .slice(0, FINGERPRINT_LIMIT)
    .map((item) => `${item.id}:${item.available ? 1 : 0}:${item.tasks}:${item.rating}`)
    .join('|');
  return `${smartMode ? 1 : 0}#${needs.length}#${notifications.length}#${volunteers.length}#${needsKey}#${notificationsKey}#${volunteersKey}`;
};

const deriveHotspots = (predictions = [], prioritizedTasks = []) => {
  const byRegion = new Map();

  predictions.forEach((prediction) => {
    const key = prediction.region || prediction.location || 'Unknown';
    const row = byRegion.get(key) || { region: key, score: 0, alerts: 0, tasks: 0 };
    row.score += prediction.confidenceScore * (prediction.urgencyLevel === 'critical' ? 1.15 : 1);
    row.alerts += 1;
    byRegion.set(key, row);
  });

  prioritizedTasks.forEach((task) => {
    const key = task.region || task.location || 'Unknown';
    const row = byRegion.get(key) || { region: key, score: 0, alerts: 0, tasks: 0 };
    row.score += task.priorityScore * 0.55;
    row.tasks += 1;
    byRegion.set(key, row);
  });

  return [...byRegion.values()]
    .map((row) => ({ ...row, score: Math.round(row.score) }))
    .sort((a, b) => b.score - a.score);
};

export function buildIntelligenceSnapshot({
  needs = [],
  notifications = [],
  volunteers = [],
  smartMode = false,
}) {
  const fingerprint = buildFingerprint(needs, notifications, volunteers, smartMode);
  if (lastSnapshotCache.key === fingerprint && lastSnapshotCache.value) return lastSnapshotCache.value;

  const reports = [
    ...needs.map((need) => ({
      ...need,
      title: need.category,
      description: `${need.category} at ${need.location}`,
      createdAt: need.createdAt || need.updatedAt,
    })),
    ...notifications.map((notification) => ({
      id: `notif-${notification.id}`,
      region: notification.region || 'Unknown',
      location: notification.location || notification.region || 'Unknown',
      category: notification.type || 'signal',
      priority: normalize(notification.type) === 'urgent' ? 'urgent' : 'medium',
      status: notification.read ? 'resolved' : 'active',
      title: notification.title,
      description: notification.body,
      createdAt: notification.createdAt || notification.updatedAt,
    })),
  ];

  const predictions = smartMode ? predictNeeds(reports) : [];
  const prioritizedTasks = smartMode ? prioritizeTasks(needs) : [...needs];
  const recommendations = smartMode
    ? generateVolunteerRecommendations(prioritizedTasks, volunteers, false)
    : [];
  const hotspotList = smartMode ? deriveHotspots(predictions, prioritizedTasks) : [];
  const { impact, impactTrend } = computeImpactMetrics(needs, volunteers, predictions);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    smartMode,
    predictions,
    prioritizedTasks,
    recommendations,
    hotspotList,
    impact,
    impactTrend,
    coordination: {
      activeVolunteers: impact.activeVolunteers,
      activeTasks: impact.activeTasks,
      geographicDistribution: impact.geographicDistribution,
    },
  };
  lastSnapshotCache = { key: fingerprint, value: snapshot };
  return snapshot;
}
