import { haversineDistanceKm } from '../../utils/geo';
import {
  DEFAULT_WEIGHTS,
  calculateSkillScore,
  calculateProximityScore,
  calculateAvailabilityScore,
  calculateExperienceScore,
  calculatePerformanceScore,
  getMatchLabel,
  getMatchQualityLabel,
} from './scoring';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const toPoint = (item) => {
  const lat = Number(item?.location?.lat ?? item?.lat);
  const lng = Number(item?.location?.lng ?? item?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

function scoreVolunteerForTask(task, volunteer, weights) {
  const taskPoint = toPoint(task);
  const volunteerPoint = toPoint(volunteer);

  const requiredSkillsRaw = task.requiredSkills
    ? task.requiredSkills
    : String(task.category || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);

  const skillScore = calculateSkillScore([volunteer.skill, ...(volunteer.skills || [])], requiredSkillsRaw);
  
  const distanceKm = (taskPoint && volunteerPoint) ? haversineDistanceKm(volunteerPoint, taskPoint) : null;
  const distanceScore = calculateProximityScore(volunteer.location, task.location);
  
  const availabilityScore = calculateAvailabilityScore(volunteer.status, volunteer.available);
  const experienceScore = calculateExperienceScore(volunteer.tasks);
  const performanceScore = calculatePerformanceScore(volunteer.rating);

  const weightedScore =
    skillScore * weights.skill +
    distanceScore * weights.distance +
    availabilityScore * weights.availability +
    experienceScore * weights.experience +
    performanceScore * weights.performance;

  const matchScore = clamp(Math.round(weightedScore), 0, 100);
  const assignmentScore = matchScore / 100;
  const aiMatchLabel = getMatchLabel(matchScore);
  
  const reasons = [];
  if (distanceScore <= 30) reasons.push('Too far from location');
  if (requiredSkillsRaw.length > 0 && skillScore < 100) reasons.push('Missing required skills');
  if (availabilityScore < 100) reasons.push('Low availability');
  if (experienceScore < 80) reasons.push('Low experience');

  const explanation = [
    `Skill fit ${Math.round(skillScore)}% for "${task.category}".`,
    distanceKm == null
      ? 'Location data limited, proximity estimated conservatively.'
      : `Approx. ${distanceKm.toFixed(1)} km from task location.`,
    volunteer.available === false ? 'Currently busy; kept as fallback option.' : 'Available for immediate assignment.',
    `Performance score ${Math.round(performanceScore)}% based on completed tasks and rating.`,
  ];

  return {
    ...volunteer,
    matchScore,
    assignmentScore,
    skillScore: skillScore / 100,
    distanceKm,
    aiMatchLabel,
    aiMatchReasons: reasons,
    explanation,
  };
}

/**
 * Rank volunteers for a single task
 * @param {Object} task - Task with location, category, requiredSkills
 * @param {Array} volunteers - Array of volunteer objects
 * @param {Object} options - Optional weights and filters
 * @returns {Array} Volunteers sorted by match score (descending)
 */
export function rankVolunteersForTask(task, volunteers = [], options = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  
  return volunteers
    .map((volunteer) => scoreVolunteerForTask(task, volunteer, weights))
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Generate volunteer recommendations for multiple tasks
 * @param {Array} tasks - Array of task objects
 * @param {Array} volunteers - Array of volunteer objects
 * @param {boolean} autoAssign - Whether to auto-assign top candidates
 * @returns {Array} Recommendations per task
 */
export function generateVolunteerRecommendations(tasks = [], volunteers = [], autoAssign = false) {
  return tasks.map((task) => {
    const ranked = rankVolunteersForTask(task, volunteers);
    const topCandidate = ranked[0] || null;
    const availableRanked = ranked.filter((item) => item.available !== false);
    const slots = Math.max(1, Math.min(3, (task.volunteers || 1) - (task.assigned || 0)));
    const recommendedAssignees = availableRanked.slice(0, slots);

    return {
      taskId: task.id,
      autoAssigned: autoAssign && !!topCandidate,
      assignedVolunteerId: autoAssign && topCandidate ? topCandidate.id : null,
      rankedVolunteers: ranked.slice(0, 5).map((item) => ({
        id: item.id,
        name: item.name || `Volunteer ${item.id}`,
        matchScore: item.matchScore,
        distanceKm: item.distanceKm == null ? null : Number(item.distanceKm.toFixed(2)),
        explanation: item.explanation,
      })),
      recommendedAssignees: recommendedAssignees.map((item) => item.id),
      recommendationSummary: topCandidate
        ? `Top match: ${topCandidate.name || `Volunteer ${topCandidate.id}`} (${topCandidate.matchScore}/100).`
        : 'No viable volunteer recommendation yet.',
    };
  });
}

/**
 * Find best match for a single task (simplified API)
 * @param {Object} task - Task requirements
 * @param {Array} volunteers - Available volunteers
 * @returns {Object|null} Best matching volunteer or null
 */
export function findBestMatch(task, volunteers = []) {
  const ranked = rankVolunteersForTask(task, volunteers);
  return ranked[0] || null;
}

/**
 * Calculate match score for a single volunteer-task pair
 * @param {Object} volunteer - Volunteer data
 * @param {Object} task - Task data
 * @returns {Object} Match result with score and breakdown
 */
export function calculateMatch(volunteer, task) {
  const scored = scoreVolunteerForTask(task, volunteer, DEFAULT_WEIGHTS);
  
  return {
    volunteer: {
      id: volunteer.id,
      name: volunteer.name,
      matchScore: scored.matchScore,
      matchQuality: getMatchQualityLabel(scored.matchScore),
    },
    matchScore: scored.matchScore,
    isMatch: scored.matchScore >= 50 && volunteer.available !== false,
    breakdown: {
      skill: Math.round(scored.skillScore * 100),
      distance: scored.distanceKm,
      availability: volunteer.available !== false ? 100 : 0,
    },
    explanation: scored.explanation,
  };
}
