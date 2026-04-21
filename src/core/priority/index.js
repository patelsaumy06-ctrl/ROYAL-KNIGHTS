const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

const URGENCY_WEIGHTS = {
  urgent: 88,
  high: 70,
  medium: 58,
  low: 32,
};

const SEVERITY_WEIGHTS = {
  medical: 95,
  rescue: 95,
  flood: 90,
  fire: 90,
  water: 78,
  food: 78,
  shelter: 78,
};

const scoreUrgency = (task) => {
  const priority = normalize(task.priority);
  const createdAt = new Date(task.createdAt || task.updatedAt || Date.now()).getTime();
  const ageHours = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60));
  const base = URGENCY_WEIGHTS[priority] || 58;
  return Math.min(100, base + Math.min(12, ageHours * 0.7));
};

const scoreImpact = (task) => {
  const affectedPeople = toNumber(task.affectedPeople || task.peopleAffected, 0);
  const volunteersNeeded = toNumber(task.volunteers, 0);
  return clampScore(Math.max(affectedPeople / 25, volunteersNeeded * 7));
};

const scoreSeverity = (task) => {
  const category = normalize(task.category);
  for (const [key, weight] of Object.entries(SEVERITY_WEIGHTS)) {
    if (category.includes(key)) return weight;
  }
  return normalize(task.priority) === 'urgent' ? 74 : 48;
};

const scoreResourceRequirement = (task) => {
  const required = Math.max(0, toNumber(task.volunteers, 0));
  const assigned = Math.max(0, toNumber(task.assigned, 0));
  const gapRatio = required > 0 ? (required - assigned) / required : 0;
  return clampScore(38 + gapRatio * 62);
};

const labelFromScore = (score) => {
  if (score >= 85) return 'Critical';
  if (score >= 67) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
};

const categoryFromScore = (score) => {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

/**
 * Calculate priority score for a single task
 * @param {Object} task - Task data
 * @returns {Object} Task with priority score and label
 */
export function scoreTaskPriority(task) {
  const urgency = scoreUrgency(task);
  const impact = scoreImpact(task);
  const severity = scoreSeverity(task);
  const resources = scoreResourceRequirement(task);
  const score = clampScore(urgency * 0.34 + impact * 0.24 + severity * 0.24 + resources * 0.18);

  return {
    ...task,
    priorityScore: score,
    priorityLabel: labelFromScore(score),
    priorityCategory: categoryFromScore(score),
    factors: {
      urgency,
      impact,
      severity,
      resources,
    },
  };
}

/**
 * Sort tasks by priority (highest first)
 * @param {Array} tasks - Array of tasks
 * @returns {Array} Sorted tasks with priority scores
 */
export function prioritizeTasks(tasks = []) {
  return tasks
    .map((task) => scoreTaskPriority(task))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Get top N urgent tasks
 * @param {Array} tasks - Array of tasks
 * @param {number} n - Number of tasks to return
 * @returns {Array} Top N urgent tasks
 */
export function getTopUrgentTasks(tasks = [], n = 5) {
  return prioritizeTasks(tasks).slice(0, n);
}

/**
 * Filter tasks by minimum priority level
 * @param {Array} tasks - Array of tasks
 * @param {string} minLevel - Minimum priority level ('low', 'medium', 'high', 'critical')
 * @returns {Array} Filtered tasks
 */
export function filterByMinPriority(tasks = [], minLevel = 'medium') {
  const levels = { low: 0, medium: 40, high: 67, critical: 85 };
  const minScore = levels[minLevel] || 0;
  
  return prioritizeTasks(tasks).filter((t) => t.priorityScore >= minScore);
}
