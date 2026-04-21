/**
 * Volunteer-to-Task Matching System
 * 
 * Matches volunteers to tasks based on:
 * - Skill match (highest priority)
 * - Location proximity
 * - Availability
 * 
 * Returns ranked matches with relevance scores.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Weight configuration for match scoring
 */
const MATCH_WEIGHTS = {
  skill: 50,        // Highest priority - skill match is critical
  location: 30,     // Second priority - proximity matters
  availability: 20, // Third priority - must be available
};

/**
 * Maximum possible score
 */
const MAX_SCORE = 100;

/**
 * Distance thresholds (in kilometers) for location scoring
 */
const DISTANCE_THRESHOLDS = [
  { max: 5, score: 30 },      // Very close - excellent
  { max: 15, score: 25 },     // Close - good
  { max: 30, score: 20 },     // Moderate - acceptable
  { max: 50, score: 15 },     // Far - less ideal
  { max: 100, score: 10 },    // Very far - minimal
  { max: Infinity, score: 5 }, // Extremely far - marginal
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate skill match score between volunteer and task
 * 
 * @param {Array<string>} volunteerSkills - Volunteer skills
 * @param {Array<string>} taskNeeds - Task needs
 * @returns {number} Skill match score (0-50)
 */
function calculateSkillMatch(volunteerSkills, taskNeeds) {
  if (!Array.isArray(volunteerSkills) || !Array.isArray(taskNeeds)) {
    return 0;
  }

  if (taskNeeds.length === 0) {
    return MATCH_WEIGHTS.skill; // No specific needs = any volunteer acceptable
  }

  const normalizedVolunteerSkills = volunteerSkills.map(s => s.toLowerCase().trim());
  const normalizedTaskNeeds = taskNeeds.map(n => n.toLowerCase().trim());

  // Count matching skills
  let matches = 0;
  for (const need of normalizedTaskNeeds) {
    if (normalizedVolunteerSkills.includes(need)) {
      matches++;
    }
  }

  // Calculate percentage of task needs that are met
  const matchPercentage = matches / normalizedTaskNeeds.length;
  
  // Score based on percentage (full points for 100% match, partial for partial)
  return Math.round(MATCH_WEIGHTS.skill * matchPercentage);
}

/**
 * Calculate distance between two locations using Haversine formula
 * 
 * @param {Object} loc1 - Location 1 {lat, lng}
 * @param {Object} loc2 - Location 2 {lat, lng}
 * @returns {number} Distance in kilometers
 */
function calculateDistance(loc1, loc2) {
  if (!loc1 || !loc2 || typeof loc1.lat !== 'number' || typeof loc2.lat !== 'number') {
    return Infinity;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(loc2.lat - loc1.lat);
  const dLng = toRadians(loc2.lng - loc1.lng);

  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(loc1.lat)) * Math.cos(toRadians(loc2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate location proximity score
 * 
 * @param {Object} volunteerLoc - Volunteer location {lat, lng}
 * @param {Object} taskLoc - Task location {lat, lng}
 * @returns {number} Location score (0-30)
 */
function calculateLocationScore(volunteerLoc, taskLoc) {
  // If no coordinates provided, check for string location match
  if (!volunteerLoc || !taskLoc) {
    return 0;
  }

  // If both have coordinates, calculate distance
  if (typeof volunteerLoc.lat === 'number' && typeof taskLoc.lat === 'number') {
    const distance = calculateDistance(volunteerLoc, taskLoc);
    
    for (const threshold of DISTANCE_THRESHOLDS) {
      if (distance <= threshold.max) {
        return threshold.score;
      }
    }
    return 0;
  }

  // If string locations provided, check for exact match
  if (typeof volunteerLoc === 'string' && typeof taskLoc === 'string') {
    const vLoc = volunteerLoc.toLowerCase().trim();
    const tLoc = taskLoc.toLowerCase().trim();
    
    if (vLoc === tLoc) {
      return MATCH_WEIGHTS.location; // Exact match
    }
    
    // Partial match (e.g., same city/district name)
    if (vLoc.includes(tLoc) || tLoc.includes(vLoc)) {
      return Math.round(MATCH_WEIGHTS.location * 0.7);
    }
    
    return 0;
  }

  return 0;
}

/**
 * Calculate availability score
 * 
 * @param {boolean} isAvailable - Volunteer availability
 * @returns {number} Availability score (0 or 20)
 */
function calculateAvailabilityScore(isAvailable) {
  return isAvailable === true ? MATCH_WEIGHTS.availability : 0;
}

// ============================================================================
// MATCHING FUNCTIONS
// ============================================================================

/**
 * Calculate match score for a single volunteer-task pair
 * 
 * @param {Object} volunteer - Volunteer data
 * @param {Object} task - Task data
 * @returns {Object} Match result with score and details
 */
export function calculateMatch(volunteer, task) {
  if (!volunteer || !task) {
    return {
      volunteer: volunteer || null,
      task: task || null,
      match_score: 0,
      is_match: false,
      breakdown: {
        skill_score: 0,
        location_score: 0,
        availability_score: 0,
        total: 0,
      },
    };
  }

  // Calculate component scores
  const skillScore = calculateSkillMatch(volunteer.skills, task.needs);
  const locationScore = calculateLocationScore(volunteer.location, task.location);
  const availabilityScore = calculateAvailabilityScore(volunteer.availability);

  // Calculate total score
  const totalScore = skillScore + locationScore + availabilityScore;

  // Determine if this is a viable match (minimum threshold)
  // Must have at least some skill match AND be available
  const isMatch = availabilityScore > 0 && skillScore > 0;

  return {
    volunteer: {
      name: volunteer.name,
      location: volunteer.location,
      skills: volunteer.skills,
      availability: volunteer.availability,
    },
    task: {
      location: task.location,
      needs: task.needs,
      priority_score: task.priority_score,
    },
    match_score: totalScore,
    is_match: isMatch,
    breakdown: {
      skill_score: skillScore,
      location_score: locationScore,
      availability_score: availabilityScore,
      total: totalScore,
    },
  };
}

/**
 * Find best matches for a single task
 * 
 * @param {Object} task - Task to match
 * @param {Array<Object>} volunteers - Available volunteers
 * @param {number} topN - Number of top matches to return (default: 3)
 * @returns {Array<Object>} Ranked matches
 */
export function findMatchesForTask(task, volunteers, topN = 3) {
  if (!task || !Array.isArray(volunteers)) {
    return [];
  }

  // Calculate match scores for all volunteers
  const matches = volunteers
    .map(volunteer => calculateMatch(volunteer, task))
    .filter(match => match.is_match); // Only include viable matches

  // Sort by match score (descending), then by volunteer name
  matches.sort((a, b) => {
    const scoreDiff = b.match_score - a.match_score;
    if (scoreDiff !== 0) return scoreDiff;
    // FIX: volunteer.name can be undefined — calling .localeCompare() on undefined throws.
    return (a.volunteer.name || '').localeCompare(b.volunteer.name || '');
  });

  // Return top N matches
  return matches.slice(0, topN);
}

/**
 * Match multiple tasks to volunteers
 * 
 * @param {Array<Object>} tasks - Tasks to match
 * @param {Array<Object>} volunteers - Available volunteers
 * @param {number} topN - Number of top matches per task (default: 3)
 * @returns {Object} Match results for all tasks
 */
export function matchTasksToVolunteers(tasks, volunteers, topN = 3) {
  if (!Array.isArray(tasks) || !Array.isArray(volunteers)) {
    return {
      total_tasks: 0,
      matched_tasks: 0,
      results: [],
    };
  }

  const results = tasks.map(task => {
    const matches = findMatchesForTask(task, volunteers, topN);
    return {
      task: {
        location: task.location,
        needs: task.needs,
        priority_score: task.priority_score,
      },
      match_count: matches.length,
      top_matches: matches,
    };
  });

  const matchedTasks = results.filter(r => r.match_count > 0).length;

  return {
    total_tasks: tasks.length,
    matched_tasks: matchedTasks,
    unmatched_tasks: tasks.length - matchedTasks,
    results,
  };
}

/**
 * Get match quality label
 * 
 * @param {number} score - Match score (0-100)
 * @returns {string} Quality label
 */
export function getMatchQuality(score) {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'very_good';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/**
 * Format match result for display
 * 
 * @param {Object} match - Match result
 * @returns {string} Formatted string
 */
export function formatMatch(match) {
  if (!match || !match.is_match) {
    return 'No viable match';
  }
  
  const quality = getMatchQuality(match.match_score);
  return `${match.volunteer.name}: ${match.match_score}/100 (${quality})`;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  calculateMatch,
  findMatchesForTask,
  matchTasksToVolunteers,
  getMatchQuality,
  formatMatch,
  // Constants
  MATCH_WEIGHTS,
  MAX_SCORE,
};
