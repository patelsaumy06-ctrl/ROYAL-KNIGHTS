/**
 * Thin HTTP client for the secure backend API.
 *
 * Handles JWT token management and provides typed methods
 * for all backend endpoints. The token is persisted in
 * sessionStorage so it survives page refreshes within a tab
 * but is cleared when the browser closes.
 */

const TOKEN_KEY = 'ReliefLink_api_token';

/**
 * Resolve the API base URL.
 * In development with the Vite proxy, this is empty (same origin).
 * In production, set VITE_API_URL to the backend domain.
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

function getStoredToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function storeToken(token) {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* noop */ }
}

function clearStoredToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
}

let _token = getStoredToken();

const isStaticDemo = import.meta.env.PROD && !API_BASE;

// Delay helper to make demo look realistic
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function simulateBackendResponse(path, options) {
  await delay(800 + Math.random() * 500); // 800-1300ms delay to simulate network/AI thinking

  if (path.includes('/auth/login')) {
    const body = options.body ? JSON.parse(options.body) : {};
    return { token: 'demo-jwt-token-123', user: { email: body.email } };
  }
  if (path.includes('/ai/explain-match')) {
    return { 
      explanation: "This volunteer provides an excellent fit for this crisis due to a strong overlap in required skills and their close geographic proximity.",
      provider: "demo-local" 
    };
  }
  if (path.includes('/ai/process-report')) {
    // Parse input text for basic keyword detection so demo results feel contextual
    const body = options.body ? JSON.parse(options.body) : {};
    const inputText = String(body.reportText || body.report || '').toLowerCase();

    const hasWater    = /water|borewell|flood|drinking|sanitation/.test(inputText);
    const hasMedical  = /medical|doctor|hospital|sick|injured|fever|diarrhea|ambulance/.test(inputText);
    const hasFood     = /food|hunger|starvation|ration|malnutrition/.test(inputText);
    const hasShelter  = /shelter|homeless|displaced|tent|roof|collapsed/.test(inputText);
    const hasEducation= /school|student|education|supplies|notebook|pencil|learning/.test(inputText);

    // Extract any numbers from the text
    const numbers = (inputText.match(/\d[\d,]*/g) || []).map(n => parseInt(n.replace(/,/g, ''), 10)).filter(n => n > 100);
    const topNumber   = numbers[0] || 4200;
    const secondNumber= numbers[1] || 1800;

    const demoNeeds = [];
    if (hasWater || (!hasMedical && !hasFood && !hasShelter && !hasEducation)) {
      demoNeeds.push({
        category: 'water',
        description: `Water supply disrupted — ${topNumber.toLocaleString()} residents without clean water (borewells non-functional).`,
        peopleAffected: topNumber,
        priority: 'critical',
        confidence: 0.93,
      });
    }
    if (hasMedical || !hasWater) {
      demoNeeds.push({
        category: 'medical',
        description: `${secondNumber.toLocaleString()} people need immediate medical attention — fever, diarrhea, untreated injuries.`,
        peopleAffected: secondNumber,
        priority: 'high',
        confidence: 0.90,
      });
    }
    if (hasFood) {
      demoNeeds.push({
        category: 'food',
        description: `Food ration shortage — families running critically low on supplies.`,
        peopleAffected: Math.round(topNumber * 0.4),
        priority: 'high',
        confidence: 0.85,
      });
    }
    if (hasShelter) {
      demoNeeds.push({
        category: 'shelter',
        description: `Displaced residents require emergency shelter — homes damaged or destroyed.`,
        peopleAffected: Math.round(topNumber * 0.3),
        priority: 'high',
        confidence: 0.82,
      });
    }
    if (hasEducation) {
      demoNeeds.push({
        category: 'education',
        description: `Primary school lacks basic learning materials — students unable to attend classes.`,
        peopleAffected: 180,
        priority: 'medium',
        confidence: 0.78,
      });
    }
    // Ensure at least one need is always present
    if (demoNeeds.length === 0) {
      demoNeeds.push({
        category: 'medical',
        description: 'Medical support needed for affected population.',
        peopleAffected: topNumber,
        priority: 'high',
        confidence: 0.70,
      });
    }

    const location = inputText.match(/\bin\s+([a-z]+(?:\s[a-z]+)?)\s*(?:village|district|town)?/i)?.[1] || 'Affected Area';

    console.log(`[Demo/Static Mode] process-report: returning ${demoNeeds.length} demo needs`);

    return {
      pipeline: 'demo-pipeline',
      // ── Top-level new contract ──
      needs: demoNeeds,
      meta: {
        location: location.charAt(0).toUpperCase() + location.slice(1),
        riskScore: 8.5,
      },
      // ── Legacy nested report block ──
      report: {
        location: location.charAt(0).toUpperCase() + location.slice(1),
        urgency_level: 'high',
        needs: demoNeeds,
        affected_people_estimate: topNumber,
        summary: `A high-severity incident has affected ${topNumber.toLocaleString()} residents. Immediate response needed for: ${demoNeeds.map(n => n.category).join(', ')}.`,
        confidence_score: 0.82,
        _extraction_method: 'demo-fallback',
        _reasoning: { needs: `Demo mode: detected ${demoNeeds.length} needs from keyword analysis of input text.` },
      },
      priority: { score: 85, category: 'Critical', breakdown: {} },
      matches: { total_candidates: 0, matched: 0, top_volunteers: [] },
    };
  }
  if (path.includes('/ai/analyze-report')) {
    return {
      location: "Demo Location",
      urgency_level: "High",
      needs: ["Medical Support", "Evacuation"],
      affected_people_estimate: 50,
      summary: "This is a simulated analysis since the backend is currently running in static demo mode.",
      confidence_score: 92,
      _extraction_method: "demo-fallback"
    };
  }
  if (path.includes('/ai/chat')) {
    return { reply: "[Demo Mode]: I am unable to connect to the live AI engine from the static GitHub pages deployment, but I am here to help you simulate operations." };
  }
  if (path.includes('/health')) {
    return { status: 'ok', mode: 'demo' };
  }
  
  return { success: true, message: "Simulated response for " + path };
}

async function request(path, options = {}) {
  // If deployed to GH Pages (PROD but no API_URL), short-circuit to prevent 405 Method Not Allowed
  if (isStaticDemo) {
    if (path !== '/api/health') {
      console.log(`[Demo/Static Mode] Simulating backend API call: ${path}`);
    }
    return simulateBackendResponse(path, options);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err = new Error(body.error || `API error: ${res.status}`);
    err.status = res.status;
    err.details = body.details;
    throw err;
  }

  return res.json();
}

export const backendApi = {
  // ── Auth ────────────────────────────────────────────────────

  /**
   * Authenticate with the backend and store the JWT.
   * Call this during the login flow.
   */
  async login(email, password) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    _token = data.token;
    storeToken(_token);
    return data;
  },

  /** Clear the stored token (call on logout). */
  clearToken() {
    _token = null;
    clearStoredToken();
  },

  /** Check if backend auth is active. */
  hasToken() {
    return !!_token;
  },

  // ── AI Layer ────────────────────────────────────────────────

  /**
   * Parse a document via the secure Gemini proxy.
   * The API key is never sent from the client.
   */
  async parseDocument(fileContent, fileType, fileName) {
    return request('/api/ai/parse-document', {
      method: 'POST',
      body: JSON.stringify({ fileContent, fileType, fileName }),
    });
  },

  /**
   * Analyze an incident report via AI.
   */
  async analyzeIncident(reportText, provider = 'gemini', context = {}) {
    return request('/api/ai/incident-analyze', {
      method: 'POST',
      body: JSON.stringify({ reportText, provider, context }),
    });
  },

  /**
   * AI chat for operations assistant.
   */
  async chat(message, mode = 'coordinator', context = {}) {
    return request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, mode, context }),
    });
  },

  /**
   * AI-powered explanation of why a volunteer is/isn't a good match for a task.
   * Returns { explanation: string }.
   */
  async explainMatch(volunteer, task) {
    return request('/api/ai/explain-match', {
      method: 'POST',
      body: JSON.stringify({ volunteer, task }),
    });
  },

  /**
   * End-to-end crisis pipeline: analyze report → score priority → match volunteers.
   * Returns { pipeline, report, priority, matches }.
   */
  async processReport(reportText, volunteers = [], useLLM = true) {
    return request('/api/ai/process-report', {
      method: 'POST',
      body: JSON.stringify({ reportText, volunteers, useLLM }),
    });
  },

  /**
   * Analyze a single report to extract structured needs (NLP pipeline).
   * Uses Claude → Gemini → keyword fallback on the server.
   * Returns { location, urgency_level, needs, affected_people_estimate, summary, confidence_score, _extraction_method }.
   */
  async analyzeReport(reportText, useLLM = true) {
    return request('/api/ai/analyze-report', {
      method: 'POST',
      body: JSON.stringify({ reportText, useLLM }),
    });
  },

  // ── Matching Engine ─────────────────────────────────────────

  /**
   * Rank volunteers for a task via the server-side engine.
   * Results are cached server-side for performance.
   */
  async matchVolunteers(task, volunteers, useCache = true) {
    return request('/api/match', {
      method: 'POST',
      body: JSON.stringify({ task, volunteers, useCache }),
    });
  },

  /**
   * Batch recommendations for multiple tasks.
   */
  async getRecommendations(tasks, volunteers, autoAssign = false) {
    return request('/api/match/recommend', {
      method: 'POST',
      body: JSON.stringify({ tasks, volunteers, autoAssign }),
    });
  },

  // ── Monitoring ──────────────────────────────────────────────

  /** Check server health (no auth required). */
  async health() {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.json();
  },

  /** Get match cache statistics (auth required). */
  async getCacheStats() {
    return request('/api/match/cache-stats');
  },
};
