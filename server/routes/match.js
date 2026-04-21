/**
 * Match Routes — AI-Augmented Volunteer Matching API
 *
 * Endpoints:
 *   POST /api/match           — Fast sync matching (semantic scoring + context weights)
 *   POST /api/match/ai-rank   — Full 3-stage pipeline with LLM re-ranking (async)
 *   POST /api/match/recommend — Batch recommendations for multiple tasks
 *   GET  /api/match/cache-stats
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sanitizeBody, validateBody, isObject, isArray } from '../middleware/validate.js';
import { MemoryCache } from '../services/cache.js';
import config from '../config.js';
import crypto from 'crypto';

// Import the upgraded matching engine
import { rankVolunteersForTask, generateRecommendations as generateVolunteerRecommendations } from '../services/matchingEngine.js';

const router = Router();

const matchCache = new MemoryCache({
  maxSize: config.matchCacheMaxSize,
  ttlMs: config.matchCacheTtlMs,
});

function cacheKey(task, volunteerIds, extra = '') {
  const data = `${task.id}:${task.category}:${task.priority}:${volunteerIds.sort().join(',')}:${extra}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

// ── POST /api/match ──────────────────────────────────────────────────────────
// Fast sync matching: semantic scoring + crisis-context weights. No LLM call.
// Returns in <50ms regardless of volunteer pool size.
//
// New response fields vs old:
//   ranked[].aiMatchQuality   — 'excellent'|'very_good'|'good'|'fair'|'poor'
//   ranked[].llmReasoning     — null (populated by /ai-rank)
//   ranked[].flags            — array of blocker flags
//   weightMeta                — { crisisType, urgency, weights, source }

router.post(
  '/',
  requireAuth,
  sanitizeBody,
  validateBody({ task: isObject('task'), volunteers: isArray('volunteers') }),
  (req, res) => {
    try {
      const { task, volunteers, crisisCtx, useCache = true } = req.body;

      const volIds = volunteers.map((v) => v.id || '');
      const key = cacheKey(task, volIds, JSON.stringify(crisisCtx || ''));

      if (useCache) {
        const cached = matchCache.get(key);
        if (cached) {
          console.log(`[MATCH] cache-hit key=${key.slice(0, 8)} by=${req.user.email}`);
          return res.json({ ...cached, fromCache: true });
        }
      }

      const { ranked, weightMeta } = rankVolunteersForTask(task, volunteers, { crisisCtx });

      const payload = {
        ranked,
        weightMeta,
        fromCache: false,
        cacheStats: matchCache.stats(),
      };

      matchCache.set(key, payload);

      console.log(
        `[MATCH] semantic task=${task.id || task.category} vols=${volunteers.length} ` +
        `top=${ranked[0]?.matchScore ?? '-'} crisis=${weightMeta.crisisType} ` +
        `urgency=${weightMeta.urgency} by=${req.user.email}`
      );

      return res.json(payload);
    } catch (error) {
      console.error('[MATCH] error:', error.message);
      return res.status(500).json({ error: 'Matching computation failed.', details: error.message });
    }
  }
);

// ── POST /api/match/ai-rank ──────────────────────────────────────────────────
// Full 3-stage AI pipeline:
//   Stage 1: Semantic scoring (ontology + IDF)
//   Stage 2: Context-aware weights (deterministic or LLM-derived)
//   Stage 3: LLM holistic re-ranking of top-5 candidates
//
// This endpoint is NOT cached (LLM output is non-deterministic).
// Rate-limited by the AI limiter in index.js.
//
// Body: { task, volunteers, crisisCtx?, useLLMWeights? }
// Returns: { ranked, weightMeta, llmRationale, matchingSource, processingMs }

router.post(
  '/ai-rank',
  requireAuth,
  sanitizeBody,
  validateBody({ task: isObject('task'), volunteers: isArray('volunteers') }),
  async (req, res) => {
    const start = Date.now();
    try {
      const { task, volunteers, crisisCtx = {}, useLLMWeights = false } = req.body;

      const result = await rankVolunteersWithAI(task, volunteers, {
        crisisCtx,
        useLLM: true,
        useLLMWeights,
        apiBase: `http://localhost:${config.port}`,
        token: req.headers.authorization?.replace('Bearer ', '') || '',
      });

      const processingMs = Date.now() - start;

      console.log(
        `[MATCH/AI] task=${task.id || task.category} vols=${volunteers.length} ` +
        `source=${result.matchingSource} crisis=${result.weightMeta.crisisType} ` +
        `ms=${processingMs} by=${req.user.email}`
      );

      return res.json({ ...result, processingMs });
    } catch (error) {
      console.error('[MATCH/AI] error:', error.message);
      return res.status(500).json({ error: 'AI ranking failed.', details: error.message });
    }
  }
);

// ── POST /api/match/recommend ────────────────────────────────────────────────

router.post(
  '/recommend',
  requireAuth,
  sanitizeBody,
  async (req, res) => {
    try {
      const { tasks, volunteers, autoAssign = false } = req.body || {};
      if (!Array.isArray(tasks) || !Array.isArray(volunteers)) {
        return res.status(400).json({ error: 'tasks and volunteers arrays required.' });
      }

      const recommendations = generateVolunteerRecommendations(tasks, volunteers, autoAssign);

      console.log(`[MATCH] recommendations tasks=${tasks.length} vols=${volunteers.length} by=${req.user.email}`);

      return res.json({ recommendations });
    } catch (error) {
      console.error('[MATCH] recommend error:', error.message);
      return res.status(500).json({ error: 'Recommendation generation failed.', details: error.message });
    }
  }
);

// ── GET /api/match/cache-stats ───────────────────────────────────────────────

router.get('/cache-stats', requireAuth, (_req, res) => {
  return res.json(matchCache.stats());
});

export default router;