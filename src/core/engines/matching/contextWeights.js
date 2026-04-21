/**
 * Context-Aware Weight Adapter
 *
 * The hardcoded weights (skill 0.40, distance 0.25 …) are wrong for every
 * specific crisis.  A flood rescue needs proximity first; a surgical emergency
 * needs skill first; a food-distribution drive needs availability first.
 *
 * This module derives weights from crisis context — either deterministically
 * (fast, offline) or via an LLM call (richer, async).
 *
 * Usage:
 *   const weights = adaptWeightsForContext(task, { urgency: 'critical', crisisType: 'flood' });
 *   const weights = await adaptWeightsViaLLM(task, crisisContext, apiBase);
 */

export const DEFAULT_WEIGHTS = {
    skill: 0.40,
    distance: 0.25,
    availability: 0.15,
    experience: 0.10,
    performance: 0.10,
};

/**
 * Crisis profiles — deterministic weight templates.
 * Each profile is derived from humanitarian response doctrine
 * (SPHERE standards, OCHA cluster guidelines).
 */
const CRISIS_PROFILES = {
    flood: {
        skill: 0.30,       // Rescue > specialization in floods
        distance: 0.40,    // Proximity is critical — roads may be cut
        availability: 0.20,
        experience: 0.05,
        performance: 0.05,
        label: 'Flood response',
    },
    fire: {
        skill: 0.35,
        distance: 0.35,    // Minutes matter
        availability: 0.20,
        experience: 0.07,
        performance: 0.03,
        label: 'Fire emergency',
    },
    medical: {
        skill: 0.60,       // Wrong skill = patient harm
        distance: 0.15,
        availability: 0.15,
        experience: 0.07,
        performance: 0.03,
        label: 'Medical emergency',
    },
    earthquake: {
        skill: 0.35,
        distance: 0.30,
        availability: 0.15,
        experience: 0.15,  // Debris clearance experience matters
        performance: 0.05,
        label: 'Earthquake response',
    },
    drought: {
        skill: 0.35,       // Logistics + WASH expertise
        distance: 0.20,
        availability: 0.25, // Long-duration operations
        experience: 0.12,
        performance: 0.08,
        label: 'Drought / food security',
    },
    food_distribution: {
        skill: 0.25,
        distance: 0.25,
        availability: 0.35, // High availability = faster throughput
        experience: 0.10,
        performance: 0.05,
        label: 'Food distribution',
    },
    mental_health: {
        skill: 0.65,       // Psychosocial support requires certified skills
        distance: 0.10,
        availability: 0.15,
        experience: 0.07,
        performance: 0.03,
        label: 'Psychosocial support',
    },
    shelter: {
        skill: 0.30,
        distance: 0.25,
        availability: 0.25,
        experience: 0.12,
        performance: 0.08,
        label: 'Shelter / NFI',
    },
    rescue: {
        skill: 0.40,
        distance: 0.35,
        availability: 0.20,
        experience: 0.03,
        performance: 0.02,
        label: 'Search & rescue',
    },
    default: DEFAULT_WEIGHTS,
};

/**
 * Urgency multipliers — shift weights toward immediacy on critical tasks.
 * On a critical task, distance and availability are more important; experience less so.
 */
const URGENCY_MODIFIERS = {
    critical: { distance: +0.07, availability: +0.05, experience: -0.07, performance: -0.05 },
    high: { distance: +0.03, availability: +0.02, experience: -0.03, performance: -0.02 },
    medium: {},
    low: { skill: +0.05, experience: +0.03, performance: +0.02, distance: -0.05, availability: -0.05 },
};

function sumToOne(w) {
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    if (total === 0) return { ...DEFAULT_WEIGHTS };
    const result = {};
    for (const [k, v] of Object.entries(w)) result[k] = Math.max(0, v / total);
    return result;
}

/**
 * Detect crisis type from task fields (category, title, description).
 */
function detectCrisisType(task) {
    const text = [task.category, task.title, task.description, task.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (/flood|water|inundat|overflow/.test(text)) return 'flood';
    if (/fire|burn|blaze|arson/.test(text)) return 'fire';
    if (/medical|health|injury|hospital|nurse|doctor|wound/.test(text)) return 'medical';
    if (/earthquake|tremor|quake|seismic|rubble|debris/.test(text)) return 'earthquake';
    if (/drought|food|hunger|famine|malnutrition/.test(text)) return 'drought';
    if (/distribut|supply|ration/.test(text)) return 'food_distribution';
    if (/mental|psycho|grief|trauma|counseling|stress/.test(text)) return 'mental_health';
    if (/shelter|camp|nfi|settlement|housing/.test(text)) return 'shelter';
    if (/rescue|search|sar|trapped|missing/.test(text)) return 'rescue';
    return 'default';
}

/**
 * Deterministic context-aware weight adaptation.
 *
 * Fast, offline, zero API calls.  Used as the default and fallback.
 *
 * @param {Object} task     - Task object with category/description
 * @param {Object} ctx      - Optional override: { crisisType, urgency }
 * @returns {{ weights, crisisType, urgency, source: 'deterministic' }}
 */
export function adaptWeightsForContext(task = {}, ctx = {}) {
    const crisisType = ctx.crisisType || detectCrisisType(task);
    const urgency = ctx.urgency || task.urgency || task.priority || 'medium';

    const profile = { ...(CRISIS_PROFILES[crisisType] || CRISIS_PROFILES.default) };
    const { label: _label, ...baseWeights } = profile;

    // Apply urgency modifier
    const modifier = URGENCY_MODIFIERS[urgency] || {};
    const adjusted = { ...baseWeights };
    for (const [key, delta] of Object.entries(modifier)) {
        if (key in adjusted) adjusted[key] = adjusted[key] + delta;
    }

    return {
        weights: sumToOne(adjusted),
        crisisType,
        urgency,
        source: 'deterministic',
    };
}

/**
 * LLM-driven weight adaptation.
 *
 * Sends crisis context to the AI endpoint and receives dynamic weights
 * with a natural-language rationale. Falls back to deterministic if the
 * call fails or times out (>3 s).
 *
 * @param {Object} task       - Task object
 * @param {Object} crisisCtx  - Additional context: { activeIncidents, volunteerPool, weatherData }
 * @param {string} apiBase    - Backend base URL (e.g. 'http://localhost:8787')
 * @param {string} token      - JWT auth token
 * @returns {Promise<{ weights, crisisType, urgency, rationale, source }>}
 */
export async function adaptWeightsViaLLM(task, crisisCtx = {}, apiBase = '', token = '') {
    const fallback = adaptWeightsForContext(task, crisisCtx);

    const prompt = `
You are a crisis-response resource coordinator AI.
Given the task and situational context below, output ONLY a JSON object (no markdown, no explanation) with:
- weights: { skill, distance, availability, experience, performance }  (must sum to 1.00, each 0–1)
- rationale: one sentence explaining the weight choices
- urgency: "critical" | "high" | "medium" | "low"
- crisisType: single word label

Task:
${JSON.stringify({
        category: task.category,
        title: task.title,
        description: task.description,
        priority: task.priority,
        requiredSkills: task.requiredSkills,
        location: task.location,
    }, null, 2)}

Situational context:
${JSON.stringify({
        activeUrgentIncidents: crisisCtx.activeIncidents ?? 0,
        volunteerPoolSize: crisisCtx.volunteerPool ?? 0,
        weatherAlert: crisisCtx.weatherAlert ?? null,
        broadCrisisType: crisisCtx.crisisType ?? null,
    }, null, 2)}

Rules:
- Skill weight should be highest (>0.5) only for tasks requiring certified/specialised skills (medical, mental health, engineering).
- Distance weight should be highest for time-critical field emergencies (fire, flood, rescue).
- Availability weight should be highest for long-duration operations (drought, shelter, logistics).
- All weights must sum to exactly 1.00.
- Return only valid JSON.
`.trim();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(`${apiBase}/api/ai/match-volunteers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ prompt, task, context: crisisCtx }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) return fallback;

        const data = await res.json();
        const text = (data?.text || data?.result || '').replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text);

        const w = parsed.weights;
        if (!w || typeof w.skill !== 'number') return fallback;

        return {
            weights: sumToOne(w),
            crisisType: parsed.crisisType || fallback.crisisType,
            urgency: parsed.urgency || fallback.urgency,
            rationale: parsed.rationale || '',
            source: 'llm',
        };
    } catch {
        return { ...fallback, source: 'deterministic_fallback' };
    }
}