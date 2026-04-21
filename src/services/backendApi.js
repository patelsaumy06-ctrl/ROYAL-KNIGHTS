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

async function request(path, options = {}) {
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
