/**
 * Server-side matching engine.
 *
 * Ported from src/engine/matchingEngine.js so that ranking
 * can run on the server behind /api/match — keeping the
 * algorithm (weights, scoring) consistent with the client
 * while allowing future enhancements (ML models, precomputation)
 * without shipping them to the browser.
 *
 * Includes an embedded Haversine implementation so the server
 * module has zero dependency on client source.
 */

// ── Haversine (self-contained) ──────────────────────────────────

const EARTH_RADIUS_KM = 6371;

function toRadians(deg) { return (Number(deg) * Math.PI) / 180; }

function haversineDistanceKm(a, b) {
  const lat1 = Number(a?.lat), lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat), lng2 = Number(b?.lng);
  if ([lat1, lng1, lat2, lng2].some((v) => !Number.isFinite(v))) return Infinity;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ── Weights ─────────────────────────────────────────────────────

const WEIGHTS = {
  skill: 0.4,
  distance: 0.25,
  availability: 0.15,
  experience: 0.1,
  performance: 0.1,
};

// ── Helpers ─────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const toFinite = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

const normalizeToken = (v) =>
  String(v || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');

const normalizeList = (arr) => {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map(normalizeToken).filter(Boolean))];
};

const toPoint = (item) => {
  const lat = Number(item?.location?.lat ?? item?.lat);
  const lng = Number(item?.location?.lng ?? item?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

// ── Individual scores ───────────────────────────────────────────

function distanceScore(km) {
  if (!Number.isFinite(km)) return 30;
  if (km < 1) return 100;
  if (km < 5) return 80;
  if (km < 10) return 60;
  return 30;
}

function availabilityScore(status, available) {
  if (available === false || String(status || '').toLowerCase() === 'busy') return 30;
  if (String(status || '').toLowerCase() === 'soon') return 70;
  return 100;
}

function experienceScore(completed = 0) {
  const safe = Math.max(0, toFinite(completed, 0));
  if (safe > 50) return 100;
  if (safe >= 20) return 80;
  if (safe >= 5) return 60;
  return 40;
}

function performanceScore(rating = 0) {
  return (clamp(toFinite(rating, 3), 0, 5) / 5) * 100;
}

function skillScore(volSkillsRaw, reqSkillsRaw) {
  const volSkills = normalizeList(volSkillsRaw);
  const reqSkills = normalizeList(reqSkillsRaw);
  if (reqSkills.length === 0) return 50;
  if (volSkills.length === 0) return 0;
  const matched = reqSkills.reduce((c, req) => {
    return volSkills.some((v) => v === req || v.includes(req) || req.includes(v)) ? c + 1 : c;
  }, 0);
  return (matched / reqSkills.length) * 100;
}

function matchLabel(score) {
  if (score >= 90) return 'Perfect Match';
  if (score >= 70) return 'Strong Match';
  if (score >= 50) return 'Moderate Match';
  return 'Low Match';
}

// ── Core scoring ────────────────────────────────────────────────

function scoreOne(task, vol) {
  const tPt = toPoint(task);
  const vPt = toPoint(vol);

  const reqRaw = task.requiredSkills
    ? task.requiredSkills
    : String(task.category || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);

  const sSkill = skillScore([vol.skill, ...(vol.skills || [])], reqRaw);
  const km = (tPt && vPt) ? haversineDistanceKm(vPt, tPt) : null;
  const sDist = distanceScore(km);
  const sAvail = availabilityScore(vol.status, vol.available);
  const sExp = experienceScore(vol.tasks);
  const sPerf = performanceScore(vol.rating);

  const weighted =
    sSkill * WEIGHTS.skill +
    sDist * WEIGHTS.distance +
    sAvail * WEIGHTS.availability +
    sExp * WEIGHTS.experience +
    sPerf * WEIGHTS.performance;

  const ms = clamp(Math.round(weighted), 0, 100);

  const reasons = [];
  if (sDist <= 30) reasons.push('Too far from location');
  if (reqRaw.length > 0 && sSkill < 100) reasons.push('Missing required skills');
  if (sAvail < 100) reasons.push('Low availability');
  if (sExp < 80) reasons.push('Low experience');

  return {
    ...vol,
    matchScore: ms,
    assignmentScore: ms / 100,
    skillScore: sSkill / 100,
    distanceKm: km,
    aiMatchLabel: matchLabel(ms),
    aiMatchReasons: reasons,
    explanation: [
      `Skill fit ${Math.round(sSkill)}% for "${task.category}".`,
      km == null
        ? 'Location data limited, proximity estimated conservatively.'
        : `Approx. ${km.toFixed(1)} km from task location.`,
      vol.available === false ? 'Currently busy; kept as fallback.' : 'Available for immediate assignment.',
      `Performance score ${Math.round(sPerf)}% based on completed tasks and rating.`,
    ],
  };
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Rank a set of volunteers against a single task.
 * Optionally accepts a `regionFilter` to pre-filter before scoring
 * (avoids full-dataset scans when the dataset is large).
 */
export function rankVolunteersForTask(task, volunteers = [], { regionFilter } = {}) {
  let pool = volunteers;

  // Pre-filter by region to reduce computation on large datasets
  if (regionFilter && task.region) {
    const regionLower = task.region.toLowerCase();
    pool = volunteers.filter(
      (v) => (v.region || '').toLowerCase() === regionLower,
    );
    // If no volunteers in that region, fall back to full pool
    if (pool.length === 0) pool = volunteers;
  }

  return pool
    .map((v) => scoreOne(task, v))
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Generate recommendations for multiple tasks.
 */
export function generateRecommendations(tasks = [], volunteers = [], autoAssign = false) {
  return tasks.map((task) => {
    const ranked = rankVolunteersForTask(task, volunteers);
    const top = ranked[0] || null;
    const available = ranked.filter((v) => v.available !== false);
    const slots = Math.max(1, Math.min(3, (task.volunteers || 1) - (task.assigned || 0)));

    return {
      taskId: task.id,
      autoAssigned: autoAssign && !!top,
      assignedVolunteerId: autoAssign && top ? top.id : null,
      rankedVolunteers: ranked.slice(0, 5).map((v) => ({
        id: v.id,
        name: v.name || `Volunteer ${v.id}`,
        matchScore: v.matchScore,
        distanceKm: v.distanceKm == null ? null : Number(v.distanceKm.toFixed(2)),
        explanation: v.explanation,
      })),
      recommendedAssignees: available.slice(0, slots).map((v) => v.id),
      recommendationSummary: top
        ? `Top match: ${top.name || `Volunteer ${top.id}`} (${top.matchScore}/100).`
        : 'No viable volunteer recommendation yet.',
    };
  });
}

// ── Missing exports that routes/match.js depends on ─────────────
//
// FIX: routes/match.js imported these names but they were never
// exported, causing a runtime crash on first request.

/**
 * Alias – routes/match.js imports this name.
 */
export { generateRecommendations as generateVolunteerRecommendations };

/**
 * FIX: AI-augmented ranking wrapper.
 *
 * routes/match.js calls `rankVolunteersWithAI` and expects the return
 * shape `{ ranked, weightMeta, llmRationale, matchingSource }`.
 *
 * For now this wraps `rankVolunteersForTask` deterministically.
 * Drop-in LLM re-ranking (Stage 3) can be added here later by calling
 * the /api/ai/explain-match endpoint per candidate.
 *
 * @param {object}   task
 * @param {object[]} volunteers
 * @param {object}   opts
 * @param {object}   [opts.crisisCtx]      Crisis context from the request body
 * @param {boolean}  [opts.useLLM]         Reserved for future LLM re-rank pass
 * @param {boolean}  [opts.useLLMWeights]  Reserved for future LLM weight derivation
 * @returns {Promise<{ ranked, weightMeta, llmRationale, matchingSource }>}
 */
export async function rankVolunteersWithAI(
  task,
  volunteers = [],
  { crisisCtx = {}, useLLM = false, useLLMWeights = false } = {},
) {
  const ranked = rankVolunteersForTask(task, volunteers, {
    regionFilter: crisisCtx?.region,
  });

  const weightMeta = {
    crisisType: crisisCtx?.type || task.crisisType || 'general',
    urgency: task.priority || crisisCtx?.urgency || 'medium',
    weights: { ...WEIGHTS },
    source: useLLMWeights ? 'llm-weights-pending' : 'deterministic',
  };

  return {
    ranked,
    weightMeta,
    llmRationale: useLLM
      ? 'LLM holistic re-ranking is not yet implemented; deterministic scores used.'
      : null,
    matchingSource: 'deterministic',
  };
}
