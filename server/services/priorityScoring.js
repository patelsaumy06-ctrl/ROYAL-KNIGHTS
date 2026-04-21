/**
 * Priority Scoring System for Community Issues
 * 
 * Calculates numerical priority scores (0-100) based on:
 * - Urgency level (low/medium/high)
 * - Affected population size
 * - Need types (medical > food > others)
 * 
 * Provides sorting and ranking functionality for issue lists.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Weight multipliers for urgency levels
 * Higher urgency = higher base weight
 */
const URGENCY_WEIGHTS = {
  low: 10,
  medium: 35,
  high: 60,
};

/**
 * Priority multipliers for different need types
 * Medical emergencies get highest priority
 */
const NEED_TYPE_WEIGHTS = {
  medical: 25,      // Life-threatening, highest priority
  shelter: 15,      // Critical for survival
  water: 15,        // Essential for life
  food: 12,         // Important but less immediate than medical
  logistics: 8,     // Support function
  clothing: 5,      // Important but not life-threatening
  communication: 5, // Coordination needs
  electricity: 5,   // Infrastructure
  transport: 4,     // Access needs
  education: 3,     // Long-term development
  financial: 3,     // Resource support
  other: 2,         // Uncategorized
};

/**
 * Population impact thresholds and scores
 * More people affected = higher score
 */
const POPULATION_THRESHOLDS = [
  { max: 0, score: 0 },           // Unknown/no data
  { max: 50, score: 5 },          // Small group
  { max: 200, score: 10 },        // Medium group
  { max: 500, score: 15 },        // Large group
  { max: 1000, score: 20 },       // Very large group
  { max: 5000, score: 25 },       // Community scale
  { max: Infinity, score: 30 },   // Mass casualty/event
];

/**
 * Maximum possible score (for normalization)
 */
const MAX_POSSIBLE_SCORE = 100;

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate population impact score based on affected people estimate
 * 
 * @param {number} affectedPeople - Estimated number of affected people
 * @returns {number} Population impact score (0-30)
 */
function calculatePopulationScore(affectedPeople) {
  const count = typeof affectedPeople === 'number' && affectedPeople >= 0 
    ? affectedPeople 
    : 0;
  
  for (const threshold of POPULATION_THRESHOLDS) {
    if (count <= threshold.max) {
      return threshold.score;
    }
  }
  return 0;
}

/**
 * Calculate need type score based on highest priority need
 * 
 * @param {Array<string>} needs - Array of need types
 * @returns {number} Need type score (0-25)
 */
function calculateNeedTypeScore(needs) {
  if (!Array.isArray(needs) || needs.length === 0) {
    return 0;
  }

  // FIX: needs can be either plain strings (old format) or {type, priority} objects
  // (format returned by reportAnalyzer). Handle both so the process-report pipeline
  // doesn't silently score 0 for every need type.
  let maxScore = 0;
  for (const need of needs) {
    let normalizedNeed;
    if (typeof need === 'string') {
      normalizedNeed = need.toLowerCase().trim();
    } else if (need !== null && typeof need === 'object') {
      normalizedNeed = String(need.type || 'other').toLowerCase().trim();
    } else {
      normalizedNeed = 'other';
    }
    const weight = NEED_TYPE_WEIGHTS[normalizedNeed] || NEED_TYPE_WEIGHTS.other;
    maxScore = Math.max(maxScore, weight);
  }

  return maxScore;
}

/**
 * Calculate urgency base score
 * 
 * @param {string} urgencyLevel - 'low', 'medium', or 'high'
 * @returns {number} Urgency base score (10-60)
 */
function calculateUrgencyScore(urgencyLevel) {
  const normalized = typeof urgencyLevel === 'string' 
    ? urgencyLevel.toLowerCase().trim() 
    : 'medium';
  
  return URGENCY_WEIGHTS[normalized] || URGENCY_WEIGHTS.medium;
}

/**
 * Calculate composite priority score for a single issue
 * 
 * Formula: urgency_score + need_score + population_score
 * Normalized to 0-100 range
 * 
 * @param {Object} issue - Issue data
 * @param {string} issue.urgency_level - 'low', 'medium', or 'high'
 * @param {number} issue.affected_people_estimate - Number of affected people
 * @param {Array<string>} issue.needs - Array of need types
 * @returns {Object} Scored issue with priority details
 */
export function calculatePriorityScore(issue) {
  if (!issue || typeof issue !== 'object') {
    return {
      ...issue,
      priority_score: 0,
      _scoring_breakdown: {
        urgency_score: 0,
        need_score: 0,
        population_score: 0,
        total: 0,
      },
    };
  }

  // Calculate component scores
  const urgencyScore = calculateUrgencyScore(issue.urgency_level);
  const needScore = calculateNeedTypeScore(issue.needs);
  const populationScore = calculatePopulationScore(issue.affected_people_estimate);

  // Calculate total score (capped at 100)
  const totalScore = Math.min(
    MAX_POSSIBLE_SCORE,
    urgencyScore + needScore + populationScore
  );

  return {
    ...issue,
    priority_score: Math.round(totalScore),
    _scoring_breakdown: {
      urgency_score: urgencyScore,
      need_score: needScore,
      population_score: populationScore,
      total: Math.round(totalScore),
    },
  };
}

// ============================================================================
// SORTING AND RANKING FUNCTIONS
// ============================================================================

/**
 * Sort issues by priority score (highest first)
 * Secondary sort by affected people (more people = higher priority)
 * Tertiary sort by medical needs (medical = higher priority)
 * 
 * @param {Array<Object>} issues - Array of issues to sort
 * @returns {Array<Object>} Sorted array (descending by priority)
 */
export function sortByPriority(issues) {
  if (!Array.isArray(issues)) {
    return [];
  }

  // Calculate scores for all issues first
  const scoredIssues = issues.map(calculatePriorityScore);

  // Sort by priority score (desc), then affected people (desc), then medical needs
  return scoredIssues.sort((a, b) => {
    // Primary: Priority score (higher first)
    const scoreDiff = b.priority_score - a.priority_score;
    if (scoreDiff !== 0) return scoreDiff;

    // Secondary: Affected people (more first)
    const affectedA = a.affected_people_estimate || 0;
    const affectedB = b.affected_people_estimate || 0;
    if (affectedB !== affectedA) return affectedB - affectedA;

    // Tertiary: Medical needs (medical = higher priority)
    // FIX: needs can be {type, priority} objects, not just strings.
    const needType = (n) => (typeof n === 'string' ? n : n?.type) || '';
    const hasMedicalA = Array.isArray(a.needs) && a.needs.some(n => needType(n) === 'medical');
    const hasMedicalB = Array.isArray(b.needs) && b.needs.some(n => needType(n) === 'medical');
    if (hasMedicalB !== hasMedicalA) return hasMedicalB ? 1 : -1;

    return 0;
  });
}

/**
 * Get top N most urgent issues
 * 
 * @param {Array<Object>} issues - Array of issues
 * @param {number} n - Number of top issues to return (default: 5)
 * @returns {Array<Object>} Top N issues with priority scores
 */
export function getTopUrgentIssues(issues, n = 5) {
  if (!Array.isArray(issues)) {
    return [];
  }

  const limit = Math.max(1, Math.min(n, issues.length));
  const sorted = sortByPriority(issues);
  
  return sorted.slice(0, limit);
}

/**
 * Batch process and rank multiple issues
 * Useful for API endpoints
 * 
 * @param {Array<Object>} issues - Array of issues to process
 * @param {Object} options - Processing options
 * @param {number} options.topN - Number of top issues to return (default: all)
 * @param {boolean} options.includeBreakdown - Include scoring breakdown (default: true)
 * @returns {Object} Ranked results with metadata
 */
export function rankIssues(issues, options = {}) {
  const { topN = null, includeBreakdown = true } = options;

  if (!Array.isArray(issues)) {
    return {
      total: 0,
      returned: 0,
      issues: [],
    };
  }

  // Score and sort all issues
  let scoredIssues = sortByPriority(issues);

  // Apply limit if specified
  const total = scoredIssues.length;
  if (topN && topN > 0) {
    scoredIssues = scoredIssues.slice(0, topN);
  }

  // Remove breakdown if not requested
  if (!includeBreakdown) {
    scoredIssues = scoredIssues.map(issue => {
      const { _scoring_breakdown, ...rest } = issue;
      return rest;
    });
  }

  return {
    total,
    returned: scoredIssues.length,
    issues: scoredIssues,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get priority category based on score
 * 
 * @param {number} score - Priority score (0-100)
 * @returns {string} Priority category
 */
export function getPriorityCategory(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'minimal';
}

/**
 * Format priority score for display
 * 
 * @param {number} score - Priority score
 * @returns {string} Formatted string with category
 */
export function formatPriority(score) {
  const category = getPriorityCategory(score);
  return `${score}/100 (${category})`;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  calculatePriorityScore,
  sortByPriority,
  getTopUrgentIssues,
  rankIssues,
  getPriorityCategory,
  formatPriority,
  // Constants for external use
  URGENCY_WEIGHTS,
  NEED_TYPE_WEIGHTS,
};
