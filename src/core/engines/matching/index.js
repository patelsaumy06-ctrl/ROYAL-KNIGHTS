/**
 * Matching Engine — AI-Augmented Volunteer-to-Task Matching
 *
 * Three-stage pipeline:
 *
 *  Stage 1 — Semantic Scoring (replaces naive weighted arithmetic)
 *    - Semantic skill matching via ontology (synonym expansion + IDF weights)
 *    - Continuous distance decay curve (not step-function buckets)
 *    - Crisis-context-aware weights (flood → proximity-first; medical → skill-first)
 *
 *  Stage 2 — Deterministic Ranking
 *    - Sort all candidates by composite score
 *    - Flags: hard blockers (no location, no skills, busy) are penalised but kept
 *
 *  Stage 3 — LLM Re-ranking (top-K only, optional, async)
 *    - The algorithm may miss: soft factors, volunteer fatigue, cultural fit
 *    - LLM reviews top-5 candidates holistically and may reorder them
 *    - Falls back gracefully to Stage 2 order if API is unavailable
 *
 * @module MatchingEngine
 */

import { haversineDistanceKm } from '../../../utils/geo';
import {
  calculateSkillScore,
  calculateProximityScore,
  calculateAvailabilityScore,
  calculateExperienceScore,
  calculatePerformanceScore,
  calculateDistanceScore,
  getMatchLabel,
  getMatchQualityLabel,
  calculateCompositeScore,
} from './scoring';
import {
  DEFAULT_WEIGHTS,
  adaptWeightsForContext,
  adaptWeightsViaLLM,
} from './contextWeights';

export {
  DEFAULT_WEIGHTS,
  calculateSkillScore,
  calculateProximityScore,
  calculateAvailabilityScore,
  calculateExperienceScore,
  calculatePerformanceScore,
  calculateDistanceScore,
  getMatchLabel,
  getMatchQualityLabel,
  calculateCompositeScore,
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const toPoint = (item) => {
  const lat = Number(item?.location?.lat ?? item?.lat);
  const lng = Number(item?.location?.lng ?? item?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

// ─── Stage 1: Score a single volunteer for a task ──────────────────────────

function scoreVolunteerForTask(task, volunteer, weights) {
  const taskPoint = toPoint(task);
  const volunteerPoint = toPoint(volunteer);

  const requiredSkillsRaw = task.requiredSkills
    ? task.requiredSkills
    : String(task.category || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);

  const volSkills = [volunteer.skill, ...(volunteer.skills || [])].filter(Boolean);

  // Stage 1a: Semantic skill score
  const skillScore = calculateSkillScore(volSkills, requiredSkillsRaw);

  // Stage 1b: Continuous distance decay
  const distanceKm = (taskPoint && volunteerPoint)
    ? haversineDistanceKm(volunteerPoint, taskPoint)
    : null;
  const distanceScore = distanceKm !== null
    ? calculateDistanceScore(distanceKm)
    : calculateProximityScore(volunteer.location, task.location);

  // Stage 1c: Other dimensions
  const availabilityScore = calculateAvailabilityScore(volunteer.status, volunteer.available);
  const experienceScore = calculateExperienceScore(volunteer.tasks);
  const performanceScore = calculatePerformanceScore(volunteer.rating);

  const rawScores = {
    skill: skillScore,
    distance: distanceScore,
    availability: availabilityScore,
    experience: experienceScore,
    performance: performanceScore,
  };

  const matchScore = clamp(calculateCompositeScore(rawScores, weights), 0, 100);

  // Build human-readable explanation
  const explanation = [
    `Semantic skill match: ${Math.round(skillScore)}% for "${task.category}" (using skill ontology).`,
    distanceKm == null
      ? 'Location data unavailable — proximity estimated conservatively.'
      : `${distanceKm.toFixed(1)} km from task (continuous decay score: ${distanceScore}/100).`,
    volunteer.available === false
      ? 'Currently busy — kept as fallback only.'
      : 'Available for immediate assignment.',
    `Experience score: ${Math.round(experienceScore)}/100 (log-scale, ${volunteer.tasks ?? 0} tasks completed).`,
    `Performance rating: ${volunteer.rating ?? 'N/A'}/5 → ${Math.round(performanceScore)}/100.`,
  ];

  const flags = [];
  if (distanceScore <= 30) flags.push('far_from_location');
  if (skillScore < 40) flags.push('skill_gap');
  if (availabilityScore < 50) flags.push('low_availability');

  return {
    ...volunteer,
    matchScore,
    assignmentScore: matchScore / 100,
    skillScore: skillScore / 100,
    distanceKm,
    aiMatchLabel: getMatchLabel(matchScore),
    aiMatchQuality: getMatchQualityLabel(matchScore),
    aiMatchReasons: flags,
    explanation,
    _scoring: rawScores,
  };
}

// ─── Stage 2: Rank all candidates ─────────────────────────────────────────

/**
 * Rank volunteers for a task using context-aware weights + semantic scoring.
 *
 * @param {Object} task
 * @param {Array}  volunteers
 * @param {Object} options
 * @param {Object} options.weights      - Override weights (skips contextual adaptation)
 * @param {Object} options.crisisCtx   - { crisisType, urgency, activeIncidents, ... }
 * @param {boolean} options.availableOnly
 * @returns {{ ranked: Array, weightMeta: Object }}
 */
export function rankVolunteersForTask(task, volunteers = [], options = {}) {
  // Adapt weights to crisis context (deterministic, instant)
  const weightResult = options.weights
    ? { weights: { ...DEFAULT_WEIGHTS, ...options.weights }, source: 'override', crisisType: 'custom', urgency: 'unknown' }
    : adaptWeightsForContext(task, options.crisisCtx || {});

  const { weights } = weightResult;

  let candidates = volunteers;
  if (options.availableOnly) {
    candidates = volunteers.filter((v) => v.available !== false);
  }

  const ranked = candidates
    .map((v) => scoreVolunteerForTask(task, v, weights))
    .sort((a, b) => b.matchScore - a.matchScore);

  return { ranked, weightMeta: weightResult };
}

// ─── Stage 3: LLM re-ranking ───────────────────────────────────────────────

/**
 * LLM re-ranking of the top-K algorithmic candidates.
 *
 * The algorithm scores dimensions independently.  The LLM can reason holistically:
 * "Volunteer #3 scored 72 algorithmically but their profile mentions flood rescue
 *  experience specifically relevant to this task — they should rank #1."
 *
 * Prompt design:
 * - Gives LLM the task context + top-K candidate summaries
 * - Asks for a re-ranked list with per-candidate reasoning
 * - Strict JSON output enforced
 * - 4-second timeout; falls back to algorithmic order on failure
 *
 * @param {Object}   task
 * @param {Array}    topCandidates   - Already scored & ranked by Stage 2 (top 5)
 * @param {Object}   weightMeta      - From Stage 2 (crisisType, urgency, weights)
 * @param {string}   apiBase         - Backend URL
 * @param {string}   token           - JWT token
 * @returns {Promise<{ reranked: Array, llmRationale: string, source: 'llm'|'algorithm' }>}
 */
export async function llmRerank(task, topCandidates, weightMeta, apiBase = '', token = '') {
  if (!topCandidates?.length) return { reranked: topCandidates, llmRationale: '', source: 'algorithm' };

  const candidateSummaries = topCandidates.slice(0, 5).map((v, i) => ({
    rank: i + 1,
    id: v.id,
    name: v.name || `Volunteer ${v.id}`,
    algorithmScore: v.matchScore,
    distanceKm: v.distanceKm?.toFixed(1) ?? 'unknown',
    skills: [v.skill, ...(v.skills || [])].filter(Boolean).join(', '),
    tasksCompleted: v.tasks ?? 0,
    rating: v.rating ?? 'N/A',
    status: v.status || 'unknown',
    scoringBreakdown: v._scoring,
    flags: v.aiMatchReasons,
  }));

  const prompt = `
You are a senior crisis-response coordinator AI.
The matching algorithm has pre-scored and ranked the top volunteers for a task.
Your job is to holistically re-rank them, catching factors the algorithm cannot quantify.

Task:
${JSON.stringify({ category: task.category, title: task.title, description: task.description, priority: task.priority, requiredSkills: task.requiredSkills }, null, 2)}

Crisis context detected by algorithm:
- Crisis type: ${weightMeta.crisisType}
- Urgency: ${weightMeta.urgency}
- Weight rationale: ${weightMeta.rationale || 'Deterministic profile for ' + weightMeta.crisisType}

Algorithm's top candidates (pre-scored):
${JSON.stringify(candidateSummaries, null, 2)}

Re-rank these candidates. Consider:
1. Is the skill match genuinely adequate for this specific emergency?
2. Are there any red flags (busy status, very low score on a critical dimension)?
3. Holistic profile fit — does this volunteer's overall background suit the task?
4. Volunteer fatigue risk — very experienced volunteers (many tasks) may be overloaded.

Return ONLY valid JSON, no markdown:
{
  "reranked": [
    { "id": "<id>", "finalRank": 1, "confidence": 0-100, "reasoning": "one sentence" },
    ...
  ],
  "overallRationale": "one sentence about the key re-ranking decision"
}
`.trim();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${apiBase}/api/ai/match-volunteers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ prompt, task, candidates: candidateSummaries }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error('AI endpoint error');

    const data = await res.json();
    const text = (data?.text || data?.result || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed?.reranked)) throw new Error('Invalid LLM response shape');

    // Build a rank lookup from LLM output
    const rankMap = new Map(parsed.reranked.map((r) => [r.id, r]));

    const reranked = [...topCandidates]
      .map((v) => ({
        ...v,
        llmRank: rankMap.get(v.id)?.finalRank ?? 99,
        llmConfidence: rankMap.get(v.id)?.confidence ?? null,
        llmReasoning: rankMap.get(v.id)?.reasoning ?? null,
      }))
      .sort((a, b) => a.llmRank - b.llmRank);

    return {
      reranked,
      llmRationale: parsed.overallRationale || '',
      source: 'llm',
    };
  } catch {
    return {
      reranked: topCandidates,
      llmRationale: '',
      source: 'algorithm',
    };
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Full 3-stage matching pipeline (async, includes LLM re-ranking).
 *
 * @param {Object} task
 * @param {Array}  volunteers
 * @param {Object} options
 * @param {Object} options.crisisCtx    - Crisis context for weight adaptation
 * @param {boolean} options.useLLM      - Enable LLM re-ranking (default: true)
 * @param {boolean} options.useLLMWeights - Use LLM weight adaptation (default: false, slower)
 * @param {string}  options.apiBase     - Backend URL for LLM calls
 * @param {string}  options.token       - JWT token
 * @returns {Promise<{ ranked, weightMeta, llmRationale, matchingSource }>}
 */
export async function rankVolunteersWithAI(task, volunteers = [], options = {}) {
  const { crisisCtx = {}, useLLM = true, useLLMWeights = false, apiBase = '', token = '' } = options;

  // Stage 1 + 2: semantic scoring + deterministic ranking
  let weightResult;
  if (useLLMWeights && apiBase) {
    weightResult = await adaptWeightsViaLLM(task, crisisCtx, apiBase, token);
  } else {
    weightResult = adaptWeightsForContext(task, crisisCtx);
  }

  const { ranked, weightMeta } = rankVolunteersForTask(task, volunteers, {
    weights: weightResult.weights,
    crisisCtx,
  });

  if (!useLLM || !apiBase || ranked.length === 0) {
    return {
      ranked,
      weightMeta: weightResult,
      llmRationale: '',
      matchingSource: 'semantic_algorithm',
    };
  }

  // Stage 3: LLM re-ranking of top-5
  const { reranked, llmRationale, source } = await llmRerank(
    task,
    ranked.slice(0, 5),
    weightResult,
    apiBase,
    token,
  );

  // Merge: LLM-reranked top-5 + remaining algorithmically ranked
  const finalRanked = [...reranked, ...ranked.slice(5)];

  return {
    ranked: finalRanked,
    weightMeta: weightResult,
    llmRationale,
    matchingSource: source === 'llm' ? 'semantic_algorithm+llm_rerank' : 'semantic_algorithm',
  };
}

/**
 * Sync wrapper — semantic scoring + context weights only (no LLM, instant).
 * Use this for real-time UI previews.
 */
export function rankVolunteersForTaskSync(task, volunteers = [], options = {}) {
  const { ranked, weightMeta } = rankVolunteersForTask(task, volunteers, options);
  return { ranked, weightMeta };
}

/**
 * Generate recommendations for multiple tasks (batch, sync).
 */
export function generateVolunteerRecommendations(tasks = [], volunteers = [], autoAssign = false) {
  return tasks.map((task) => {
    const { ranked, weightMeta } = rankVolunteersForTask(task, volunteers);
    const availableRanked = ranked.filter((item) => item.available !== false);
    const slots = Math.max(1, Math.min(3, (task.volunteers || 1) - (task.assigned || 0)));
    const top = ranked[0] || null;

    return {
      taskId: task.id,
      crisisType: weightMeta.crisisType,
      urgency: weightMeta.urgency,
      weightSource: weightMeta.source,
      autoAssigned: autoAssign && !!top,
      assignedVolunteerId: autoAssign && top ? top.id : null,
      rankedVolunteers: ranked.slice(0, 5).map((item) => ({
        id: item.id,
        name: item.name || `Volunteer ${item.id}`,
        matchScore: item.matchScore,
        distanceKm: item.distanceKm == null ? null : Number(item.distanceKm.toFixed(2)),
        explanation: item.explanation,
        flags: item.aiMatchReasons,
      })),
      recommendedAssignees: availableRanked.slice(0, slots).map((item) => item.id),
      recommendationSummary: top
        ? `Top match: ${top.name || `Volunteer ${top.id}`} (${top.matchScore}/100) — ${top.aiMatchLabel}.`
        : 'No viable volunteer recommendation.',
    };
  });
}

export function generateRecommendations(tasks = [], volunteers = [], autoAssign = false) {
  return generateVolunteerRecommendations(tasks, volunteers, autoAssign);
}

/** Find best match for a single task (sync) */
export function findBestMatch(task, volunteers = []) {
  const { ranked } = rankVolunteersForTask(task, volunteers);
  return ranked[0] || null;
}

/** Calculate match for a single volunteer-task pair */
export function calculateMatch(volunteer, task) {
  const weightResult = adaptWeightsForContext(task);
  const scored = scoreVolunteerForTask(task, volunteer, weightResult.weights);
  return {
    volunteer: { id: volunteer.id, name: volunteer.name, matchScore: scored.matchScore, matchQuality: getMatchQualityLabel(scored.matchScore) },
    matchScore: scored.matchScore,
    isMatch: scored.matchScore >= 50 && volunteer.available !== false,
    breakdown: { skill: Math.round(scored.skillScore * 100), distance: scored.distanceKm, availability: scored._scoring.availability },
    explanation: scored.explanation,
    scoring: scored._scoring,
    weightMeta: { crisisType: weightResult.crisisType, urgency: weightResult.urgency, source: weightResult.source },
  };
}

export function batchCalculateMatches(task, volunteers = []) {
  return volunteers.map((v) => calculateMatch(v, task));
}

export function getMatchingStats(task, volunteers = []) {
  const matches = batchCalculateMatches(task, volunteers);
  const scores = matches.map((m) => m.matchScore);
  return {
    totalCandidates: volunteers.length,
    viableMatches: matches.filter((m) => m.isMatch).length,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    highestScore: scores.length ? Math.max(...scores) : 0,
    lowestScore: scores.length ? Math.min(...scores) : 0,
    qualityDistribution: {
      excellent: matches.filter((m) => m.matchScore >= 90).length,
      veryGood: matches.filter((m) => m.matchScore >= 75 && m.matchScore < 90).length,
      good: matches.filter((m) => m.matchScore >= 60 && m.matchScore < 75).length,
      fair: matches.filter((m) => m.matchScore >= 40 && m.matchScore < 60).length,
      poor: matches.filter((m) => m.matchScore < 40).length,
    },
  };
}