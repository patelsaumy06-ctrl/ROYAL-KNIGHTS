/**
 * Centralized server configuration.
 * All secrets and tunables are read from process.env so they never
 * leak into client bundles or version control.
 */
const env = process.env;

const config = {
  port: Number(env.PORT) || 8787,

  // ── AI providers ──────────────────────────────────────────────
  claudeApiKey: env.CLAUDE_API_KEY || '',
  claudeModel: env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  geminiApiKey: env.GEMINI_API_KEY || '',
  geminiModel: env.GEMINI_MODEL || 'gemini-1.5-flash',
  openaiApiKey: env.OPENAI_API_KEY || '',
  openaiModel: env.OPENAI_MODEL || 'gpt-4o-mini',

  // ── Auth ──────────────────────────────────────────────────────
  jwtSecret: env.JWT_SECRET || 'Needlink-dev-secret-change-in-prod',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',

  // ── Rate limiting ─────────────────────────────────────────────
  rateLimitWindowMs: Number(env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  rateLimitMax: Number(env.RATE_LIMIT_MAX) || 100,
  aiRateLimitMax: Number(env.AI_RATE_LIMIT_MAX) || 20,       // stricter for AI

  // ── CORS ──────────────────────────────────────────────────────
  corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',

  // ── Maps ──────────────────────────────────────────────────────
  // FIX: Surface Google Maps key via health endpoint for diagnostics.
  // Set GOOGLE_MAPS_API_KEY in .env (see .env.example).
  googleMapsApiKey: env.GOOGLE_MAPS_API_KEY || '',

  // ── Cache ─────────────────────────────────────────────────────
  matchCacheTtlMs: Number(env.MATCH_CACHE_TTL_MS) || 5 * 60 * 1000,  // 5 min
  matchCacheMaxSize: Number(env.MATCH_CACHE_MAX_SIZE) || 500,
};

export default config;
