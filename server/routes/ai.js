import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sanitizeBody, validateBody, required, isString, isObject } from '../middleware/validate.js';
import { parseDocument } from '../services/geminiProxy.js';
import { analyzeIncidentReport } from '../incidentAiService.js';
import { analyzeReport, analyzeReportsBatch } from '../services/reportAnalyzer.js';
import { calculatePriorityScore, rankIssues, getPriorityCategory } from '../services/priorityScoring.js';
import { calculateMatch, findMatchesForTask, matchTasksToVolunteers, getMatchQuality } from '../services/volunteerMatching.js';
import config from '../config.js';

const router = Router();

const MODE_INSTRUCTIONS = {
  responder: 'Prioritize immediate field action steps and scene safety.',
  coordinator: 'Prioritize triage, resource balancing, and command-center decisions.',
  citizen: 'Use non-technical language and personal safety guidance.',
};

function cleanJsonPayload(text = '') {
  return text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
}

// ── POST /api/ai/parse-document ─────────────────────────────────
// Secure Gemini proxy for document parsing.
// Auth required. 10 MB body limit set at route level.

const parseDocSchema = {
  fileContent: required('fileContent'),
  fileName: isString('fileName', 256),
};

router.post(
  '/parse-document',
  requireAuth,
  sanitizeBody,
  validateBody(parseDocSchema),
  async (req, res) => {
    try {
      const { fileContent, fileType, fileName } = req.body;
      const result = await parseDocument(fileContent, fileType || 'text', fileName);

      console.log(`[AI] parse-document by=${req.user.email} file=${fileName}`);
      return res.json(result);
    } catch (error) {
      console.error('[AI] parse-document error:', error.message);
      return res.status(502).json({
        error: 'Document parsing failed.',
        details: error.message,
      });
    }
  },
);

// ── POST /api/ai/incident-analyze ───────────────────────────────
// Incident report analysis (preserved from original server).

router.post(
  '/incident-analyze',
  requireAuth,
  sanitizeBody,
  async (req, res) => {
    try {
      const { reportText, provider = 'gemini', context = {} } = req.body || {};
      if (!reportText || typeof reportText !== 'string' || !reportText.trim()) {
        return res.status(400).json({ error: "A non-empty 'reportText' field is required." });
      }
      const analysis = await analyzeIncidentReport(reportText, { provider, context });

      console.log(`[AI] incident-analyze by=${req.user.email} provider=${provider}`);
      return res.json(analysis);
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to analyze incident report.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

// ── POST /api/ai/chat ───────────────────────────────────────────
// Chat endpoint (preserved from original server).

router.post(
  '/chat',
  requireAuth,
  sanitizeBody,
  async (req, res) => {
    try {
      const { message, mode = 'coordinator', context = {} } = req.body || {};
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: "A non-empty 'message' field is required." });
      }

      if (!config.geminiApiKey) {
        return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' });
      }

      const systemPrompt = `
You are an AI operations assistant for an NGO crisis response system.
Analyze each incoming user message and return a structured decision payload.

Output STRICT JSON only:
{
  "classification": "emergency | resource_request | report | other",
  "details": {
    "location": "string or null",
    "urgency": "critical | high | medium | low | unknown",
    "type": "brief category label"
  },
  "response": "Clear, actionable response in plain language with immediate next steps."
}

Rules:
- emergency: active risk to life/safety, urgent incident, disaster escalation.
- resource_request: asks for supplies, volunteers, transport, medicine, shelter, etc.
- report: status updates, observations, incident notes, field updates.
- Extract the best possible location/urgency/type even if partial.
- Keep response concise and practical for NGO operators.
- Mode instruction: ${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.coordinator}
`.trim();

      const userPrompt = JSON.stringify(
        {
          userMessage: message,
          context: {
            mode,
            emergencyMode: Boolean(context.emergencyMode),
            riskScore: Number(context.riskScore ?? 0),
            aiSnapshot: context.aiSnapshot || null,
          },
        },
        null,
        2,
      );

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nINPUT:\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 600,
              responseMimeType: 'application/json',
            },
          }),
        },
      );

      if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        return res.status(502).json({ error: `Gemini request failed (${geminiResponse.status}).`, details: errorBody });
      }

      const data = await geminiResponse.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(cleanJsonPayload(raw));

      console.log(`[AI] chat by=${req.user.email} mode=${mode} class=${parsed.classification}`);

      return res.json({
        classification: parsed.classification || 'other',
        details: parsed.details || { location: null, urgency: 'unknown', type: 'unknown' },
        response: parsed.response || 'Unable to generate response.',
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to process chat request.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

// ── POST /api/ai/explain-match ──────────────────────────────────
// AI-powered natural-language explanation of volunteer-task match quality.
// Auth required. Returns a concise 2-3 sentence explanation.

const explainMatchSchema = {
  volunteer: isObject('volunteer'),
  task: isObject('task'),
};

router.post(
  '/explain-match',
  requireAuth,
  sanitizeBody,
  validateBody(explainMatchSchema),
  async (req, res) => {
    try {
      const { volunteer, task } = req.body;

      const prompt = `
You are a disaster relief coordinator AI.

Task: "${task.title || task.category || 'Relief Task'}" in ${task.location || task.region || 'unknown location'}
Required skills: ${(task.requiredSkills || [task.category]).filter(Boolean).join(', ')}
Urgency: ${task.priority || 'medium'}, Affected people: ${task.affectedPeople || 'unknown'}

Volunteer: ${volunteer.name || 'Unknown'}
Skills: ${[volunteer.skill, ...(volunteer.skills || [])].filter(Boolean).join(', ') || 'none listed'}
Distance: ${volunteer.distanceKm != null ? Number(volunteer.distanceKm).toFixed(1) + ' km away' : 'unknown distance'}
Completed tasks: ${volunteer.tasks || 0}, Rating: ${volunteer.rating || 'N/A'}/5
Match score: ${volunteer.matchScore || 'N/A'}/100
Availability: ${volunteer.available === false ? 'Busy' : 'Available'}

In 2-3 sentences, explain WHY this volunteer is or isn't a good match.
Be specific. Mention the most critical factor.
Do NOT use markdown formatting. Return plain text only.
      `.trim();

      // ── Claude (primary) ──────────────────────────────────────
      if (config.claudeApiKey) {
        try {
          const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': config.claudeApiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: config.claudeModel,
              max_tokens: 200,
              system: 'You are a disaster relief volunteer coordinator. Explain match quality in 2-3 clear, specific sentences. Plain text only, no markdown.',
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          if (claudeResponse.ok) {
            const data = await claudeResponse.json();
            const explanation = data.content?.[0]?.text?.trim();
            if (explanation) {
              console.log(`[AI] explain-match by=${req.user.email} vol=${volunteer.name || volunteer.id} provider=claude`);
              return res.json({ explanation, provider: 'claude' });
            }
          }
          console.warn('[AI] explain-match Claude failed, trying Gemini');
        } catch (e) {
          console.warn('[AI] explain-match Claude error:', e.message);
        }
      }

      // ── Gemini (fallback) ──────────────────────────────────────
      if (!config.geminiApiKey) {
        return res.status(500).json({ error: 'No AI provider configured.' });
      }

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
          }),
        },
      );

      if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        return res.status(502).json({ error: `Gemini request failed (${geminiResponse.status}).`, details: errorBody });
      }

      const gemData = await geminiResponse.json();
      const gemExplanation = gemData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Unable to generate explanation.';

      console.log(`[AI] explain-match by=${req.user.email} vol=${volunteer.name || volunteer.id} provider=gemini`);
      return res.json({ explanation: gemExplanation, provider: 'gemini' });
    } catch (error) {
      console.error('[AI] explain-match error:', error.message);
      return res.status(500).json({
        error: 'Failed to generate match explanation.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

// ── POST /api/ai/analyze-report ─────────────────────────────────
// Extract structured community needs from unstructured NGO reports.
// Auth required. Supports single report or batch processing.

const analyzeReportSchema = {
  reportText: isString('reportText', 50000),
};

router.post(
  '/analyze-report',
  requireAuth,
  sanitizeBody,
  validateBody(analyzeReportSchema),
  async (req, res) => {
    try {
      const { reportText, useLLM } = req.body;
      const result = await analyzeReport(reportText, { useLLM });

      console.log(`[AI] analyze-report by=${req.user.email} method=${result._extraction_method}`);
      return res.json(result);
    } catch (error) {
      console.error('[AI] analyze-report error:', error.message);
      return res.status(400).json({
        error: 'Failed to analyze report.',
        details: error.message,
      });
    }
  },
);

// ── POST /api/ai/analyze-reports-batch ──────────────────────────
// Batch process multiple reports at once.
// Auth required. Max 50 reports per batch.

router.post(
  '/analyze-reports-batch',
  requireAuth,
  sanitizeBody,
  async (req, res) => {
    try {
      const { reports } = req.body || {};

      if (!Array.isArray(reports)) {
        return res.status(400).json({ error: "'reports' must be an array of {id, text} objects." });
      }

      if (reports.length === 0) {
        return res.status(400).json({ error: 'No reports provided.' });
      }

      if (reports.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 reports allowed per batch.' });
      }

      // Validate each report
      for (const report of reports) {
        if (!report.id || typeof report.id !== 'string') {
          return res.status(400).json({ error: 'Each report must have a string id.' });
        }
        if (!report.text || typeof report.text !== 'string') {
          return res.status(400).json({ error: `Report ${report.id} must have a text field.` });
        }
      }

      const results = await analyzeReportsBatch(reports);

      const successCount = results.filter(r => r.error === null).length;
      console.log(`[AI] analyze-reports-batch by=${req.user.email} success=${successCount}/${reports.length}`);

      return res.json({
        total: reports.length,
        successful: successCount,
        failed: reports.length - successCount,
        results,
      });
    } catch (error) {
      console.error('[AI] analyze-reports-batch error:', error.message);
      return res.status(500).json({
        error: 'Failed to process batch.',
        details: error.message,
      });
    }
  },
);

// ── POST /api/ai/priority-score ─────────────────────────────────
// Calculate priority score for a single issue.
// Auth required. Returns numerical priority score (0-100).

router.post(
  '/priority-score',
  requireAuth,
  sanitizeBody,
  async (req, res) => {
    try {
      const { issue } = req.body || {};

      if (!issue || typeof issue !== 'object') {
        return res.status(400).json({ error: "'issue' object is required." });
      }

      const scored = calculatePriorityScore(issue);

      console.log(`[AI] priority-score by=${req.user.email} score=${scored.priority_score}`);
      return res.json({
        priority_score: scored.priority_score,
        priority_category: getPriorityCategory(scored.priority_score),
        breakdown: scored._scoring_breakdown,
      });
    } catch (error) {
      console.error('[AI] priority-score error:', error.message);
      return res.status(500).json({
        error: 'Failed to calculate priority score.',
        details: error.message,
      });
    }
  },
);

// ── POST /api/ai/priority-rank ──────────────────────────────────
// Rank multiple issues by priority and return top N.
// Auth required. Returns sorted list with priority scores.

router.post(
  '/priority-rank',
  requireAuth,
  sanitizeBody,
  async (req, res) => {
    try {
      const { issues, topN = 5, includeBreakdown = false } = req.body || {};

      if (!Array.isArray(issues)) {
        return res.status(400).json({ error: "'issues' must be an array." });
      }

      if (issues.length === 0) {
        return res.status(400).json({ error: 'No issues provided.' });
      }

      if (issues.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 issues allowed per request.' });
      }

      const result = rankIssues(issues, { topN, includeBreakdown });

      console.log(`[AI] priority-rank by=${req.user.email} total=${result.total} returned=${result.returned}`);
      return res.json(result);
    } catch (error) {
      console.error('[AI] priority-rank error:', error.message);
      return res.status(500).json({
        error: 'Failed to rank issues.',
        details: error.message,
      });
    }
  },
);

// ── POST /api/ai/match-volunteers ───────────────────────────────
// Find best matching volunteers for a task.
// Auth required. Returns ranked volunteer matches.

router.post(
  '/match-volunteers',
  requireAuth,
  sanitizeBody,
  async (req, res) => {
    try {
      const { task, volunteers, topN = 3 } = req.body || {};

      if (!task || typeof task !== 'object') {
        return res.status(400).json({ error: "'task' object is required." });
      }

      if (!Array.isArray(volunteers)) {
        return res.status(400).json({ error: "'volunteers' must be an array." });
      }

      if (volunteers.length === 0) {
        return res.status(400).json({ error: 'No volunteers provided.' });
      }

      if (volunteers.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 volunteers allowed per request.' });
      }

      const matches = findMatchesForTask(task, volunteers, topN);

      console.log(`[AI] match-volunteers by=${req.user.email} task_needs=${task.needs?.join(',')} matches=${matches.length}`);
      return res.json({
        task: {
          location: task.location,
          needs: task.needs,
          priority_score: task.priority_score,
        },
        match_count: matches.length,
        top_matches: matches,
      });
    } catch (error) {
      console.error('[AI] match-volunteers error:', error.message);
      return res.status(500).json({
        error: 'Failed to match volunteers.',
        details: error.message,
      });
    }
  },
);

// ── POST /api/ai/match-batch ────────────────────────────────────
// Batch match multiple tasks to volunteers.
// Auth required. Returns matches for all tasks.

router.post(
  '/match-batch',
  requireAuth,
  sanitizeBody,
  async (req, res) => {
    try {
      const { tasks, volunteers, topN = 3 } = req.body || {};

      if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: "'tasks' must be an array." });
      }

      if (!Array.isArray(volunteers)) {
        return res.status(400).json({ error: "'volunteers' must be an array." });
      }

      if (tasks.length === 0) {
        return res.status(400).json({ error: 'No tasks provided.' });
      }

      if (tasks.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 tasks allowed per request.' });
      }

      if (volunteers.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 volunteers allowed per request.' });
      }

      const result = matchTasksToVolunteers(tasks, volunteers, topN);

      console.log(`[AI] match-batch by=${req.user.email} tasks=${result.total_tasks} matched=${result.matched_tasks}`);
      return res.json(result);
    } catch (error) {
      console.error('[AI] match-batch error:', error.message);
      return res.status(500).json({
        error: 'Failed to process batch matching.',
        details: error.message,
      });
    }
  },
);

// ── POST /api/ai/match-score ────────────────────────────────────
// Calculate match score for a single volunteer-task pair.
// Auth required. Returns detailed match analysis.

router.post(
  '/match-score',
  requireAuth,
  sanitizeBody,
  async (req, res) => {
    try {
      const { volunteer, task } = req.body || {};

      if (!volunteer || typeof volunteer !== 'object') {
        return res.status(400).json({ error: "'volunteer' object is required." });
      }

      if (!task || typeof task !== 'object') {
        return res.status(400).json({ error: "'task' object is required." });
      }

      const match = calculateMatch(volunteer, task);

      console.log(`[AI] match-score by=${req.user.email} score=${match.match_score} quality=${getMatchQuality(match.match_score)}`);
      return res.json({
        match_score: match.match_score,
        match_quality: getMatchQuality(match.match_score),
        is_viable: match.is_match,
        breakdown: match.breakdown,
      });
    } catch (error) {
      console.error('[AI] match-score error:', error.message);
      return res.status(500).json({
        error: 'Failed to calculate match score.',
        details: error.message,
      });
    }
  },
);

// ── POST /api/ai/process-report ───────────────────────────────
// End-to-end pipeline: analyze report → score priority → match volunteers.
// Auth required. Accepts report text + optional volunteer pool.

router.post(
  '/process-report',
  requireAuth,
  sanitizeBody,
  async (req, res) => {
    try {
      const { reportText, volunteers = [], useLLM } = req.body || {};

      if (!reportText || typeof reportText !== 'string' || !reportText.trim()) {
        return res.status(400).json({ error: "A non-empty 'reportText' field is required." });
      }

      // Step 1: Analyze report (NLP)
      const analysis = await analyzeReport(reportText, { useLLM });

      // Step 2: Assign priority score
      const scored = calculatePriorityScore(analysis);

      // Step 3: Match volunteers (if pool provided)
      let volunteerMatches = [];
      let matchSummary = null;
      if (Array.isArray(volunteers) && volunteers.length > 0) {
        const task = {
          location: scored.location || '',
          needs: scored.needs.map(n => n.type),
          priority_score: scored.priority_score,
        };
        volunteerMatches = findMatchesForTask(task, volunteers, 5);
        matchSummary = {
          total_candidates: volunteers.length,
          matched: volunteerMatches.length,
          best_score: volunteerMatches[0]?.match_score ?? 0,
          best_quality: volunteerMatches[0] ? getMatchQuality(volunteerMatches[0].match_score) : 'none',
        };
      }

      // Step 4: Build pipeline result
      const result = {
        pipeline: 'analyze → score → match',
        report: {
          location: scored.location,
          urgency_level: scored.urgency_level,
          needs: scored.needs,
          affected_people_estimate: scored.affected_people_estimate,
          summary: scored.summary,
          confidence_score: scored.confidence_score,
          _extraction_method: scored._extraction_method,
          _reasoning: scored._reasoning,
        },
        priority: {
          score: scored.priority_score,
          category: getPriorityCategory(scored.priority_score),
          breakdown: scored._scoring_breakdown,
        },
        matches: matchSummary
          ? { ...matchSummary, top_volunteers: volunteerMatches }
          : { total_candidates: 0, matched: 0, top_volunteers: [] },
      };

      console.log(
        `[AI] process-report by=${req.user.email} method=${scored._extraction_method} score=${scored.priority_score} matches=${volunteerMatches.length}`,
      );
      return res.json(result);
    } catch (error) {
      console.error('[AI] process-report error:', error.message);
      return res.status(400).json({
        error: 'Failed to process report.',
        details: error.message,
      });
    }
  },
);

export default router;
