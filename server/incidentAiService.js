// FIX: Was reading env vars via globalThis.process?.env directly, bypassing
// the centralized config.js. Also incorrectly referenced VITE_GEMINI_API_KEY
// (a client-side Vite prefix that should never appear in server code).
import config from './config.js';

const CLAUDE_API_KEY = config.claudeApiKey;
const CLAUDE_MODEL = config.claudeModel;
const GEMINI_API_KEY = config.geminiApiKey;
const GEMINI_MODEL = config.geminiModel;
const OPENAI_API_KEY = config.openaiApiKey;
const OPENAI_MODEL = config.openaiModel;

function cleanJsonPayload(text = "") {
  return text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeResult(raw = {}) {
  const category = String(raw?.classification?.category || "other").trim().toLowerCase();
  const severityScore = clamp(Number(raw?.classification?.severityScore || 1), 1, 10);
  const location = raw?.extraction?.location ? String(raw.extraction.location).trim() : null;
  const urgencyLevel = String(raw?.extraction?.urgencyLevel || "medium").trim().toLowerCase();
  const resourceNeeded = raw?.extraction?.resourceNeeded
    ? String(raw.extraction.resourceNeeded).trim()
    : "general support";
  const summary = String(raw?.summary || "No summary generated.").trim();
  const riskScore = clamp(Number(raw?.riskScore || severityScore), 1, 10);
  const tags = Array.isArray(raw?.tags)
    ? raw.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6)
    : [];

  return {
    classification: {
      category,
      severityScore,
    },
    extraction: {
      location,
      urgencyLevel,
      resourceNeeded,
    },
    summary,
    riskScore,
    tags,
  };
}

function fallbackHeuristicAnalysis(reportText = "") {
  const text = reportText.toLowerCase();
  const categoryMap = [
    ["flood", "flood"],
    ["water", "flood"],
    ["fire", "fire"],
    ["burn", "fire"],
    ["medical", "medical"],
    ["injury", "medical"],
    ["ambulance", "medical"],
    ["food", "food"],
    ["shelter", "shelter"],
    ["earthquake", "earthquake"],
    ["landslide", "landslide"],
  ];
  const urgencyLevel =
    /critical|immediate|urgent|life[- ]threat|trapped|severe/.test(text)
      ? "critical"
      : /high|asap|quick|soon|serious/.test(text)
      ? "high"
      : /low|minor|stable/.test(text)
      ? "low"
      : "medium";
  const severityBase = urgencyLevel === "critical" ? 9 : urgencyLevel === "high" ? 7 : urgencyLevel === "low" ? 3 : 5;

  const matchedCategory = categoryMap.find(([k]) => text.includes(k))?.[1] || "other";
  const locationMatch =
    reportText.match(/\b(?:at|in|near)\s+([A-Za-z0-9,\- ]{3,60})/i)?.[1]?.trim() || null;
  const resourceNeeded =
    reportText.match(/\b(ambulance|boat|food|water|medicine|doctor|shelter|blanket|rescue team)s?\b/i)?.[1] ||
    "general support";
  const riskBoost = /(children|elderly|pregnant|night|blocked road|no power|collapsed|overflow)/.test(text) ? 1 : 0;
  const riskScore = clamp(severityBase + riskBoost, 1, 10);
  const summary = reportText.length > 160 ? `${reportText.slice(0, 157)}...` : reportText;

  return normalizeResult({
    classification: { category: matchedCategory, severityScore: severityBase },
    extraction: { location: locationMatch, urgencyLevel, resourceNeeded },
    summary: summary || "Incident reported. Action required.",
    riskScore,
    tags: [matchedCategory, urgencyLevel, resourceNeeded].filter(Boolean),
  });
}

function buildSystemPrompt() {
  return `
You are an emergency incident analysis engine for crisis response operations.
Return STRICT JSON only with this shape:
{
  "classification": {
    "category": "flood | medical | fire | earthquake | landslide | food | shelter | other",
    "severityScore": 1-10
  },
  "extraction": {
    "location": "string or null",
    "urgencyLevel": "critical | high | medium | low",
    "resourceNeeded": "string"
  },
  "summary": "short actionable summary, max 180 chars",
  "riskScore": 1-10,
  "tags": ["max 6 short tags"]
}

Rules:
- Infer best possible values from incomplete text.
- Severity/risk must reflect immediate danger and vulnerable population signals.
- Keep summary concise and operational for field teams.
- Output valid JSON only, no markdown.
`.trim();
}

async function callClaude(reportText, context = {}) {
  if (!CLAUDE_API_KEY) throw new Error("Missing Claude key");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: JSON.stringify({ reportText, context }, null, 2),
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Claude failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  const raw = data?.content?.[0]?.text || "{}";
  return normalizeResult(JSON.parse(cleanJsonPayload(raw)));
}

async function callGemini(reportText, context = {}) {
  if (!GEMINI_API_KEY) throw new Error("Missing Gemini key");
  const prompt = JSON.stringify({ reportText, context }, null, 2);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${buildSystemPrompt()}\n\nINPUT:\n${prompt}` }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
        },
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Gemini failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return normalizeResult(JSON.parse(cleanJsonPayload(raw)));
}

async function callOpenAI(reportText, context = {}) {
  if (!OPENAI_API_KEY) throw new Error("Missing OpenAI key");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: JSON.stringify({ reportText, context }, null, 2) },
      ],
      temperature: 0.1,
      max_output_tokens: 500,
      text: { format: { type: "json_object" } },
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI failed (${response.status}): ${await response.text()}`);
  }
  const data = await response.json();
  // FIX: output_text is an SDK-only convenience; raw API returns output[].content[].text
  const raw = data?.output?.[0]?.content?.[0]?.text || "{}";
  return normalizeResult(JSON.parse(cleanJsonPayload(raw)));
}

export async function analyzeIncidentReport(reportText, options = {}) {
  const provider = String(options.provider || process.env.AI_PROVIDER || "auto").toLowerCase();
  const context = options.context || {};

  // Explicit provider selection
  try {
    if (provider === "claude") return await callClaude(reportText, context);
    if (provider === "openai") return await callOpenAI(reportText, context);
    if (provider === "gemini") return await callGemini(reportText, context);
  } catch (err) {
    console.warn(`[incidentAI] Explicit provider "${provider}" failed:`, err.message);
  }

  // Auto mode: Claude → Gemini → OpenAI → keyword fallback
  if (CLAUDE_API_KEY) {
    try { return await callClaude(reportText, context); } catch (e) {
      console.warn("[incidentAI] Claude failed, trying Gemini:", e.message);
    }
  }
  if (GEMINI_API_KEY) {
    try { return await callGemini(reportText, context); } catch (e) {
      console.warn("[incidentAI] Gemini failed, trying OpenAI:", e.message);
    }
  }
  if (OPENAI_API_KEY) {
    try { return await callOpenAI(reportText, context); } catch (e) {
      console.warn("[incidentAI] OpenAI failed, using keyword fallback:", e.message);
    }
  }
  return fallbackHeuristicAnalysis(reportText);
}
