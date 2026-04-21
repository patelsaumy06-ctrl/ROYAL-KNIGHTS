/**
 * ReliefLink API Server — Production-Grade Entrypoint
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  Helmet (secure headers)                                │
 *   │  Morgan (request logging)                               │
 *   │  CORS (origin whitelist)                                │
 *   │  Rate Limiter (global + stricter for AI)                │
 *   │  ├── /api/auth/*    → JWT login/register (public)       │
 *   │  ├── /api/ai/*      → Gemini proxy (auth required)      │
 *   │  ├── /api/match/*   → Matching engine (auth required)    │
 *   │  └── /api/health    → Liveness check (public)           │
 *   └─────────────────────────────────────────────────────────┘
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import config from './config.js';
import authRouter from './routes/auth.js';
import aiRouter from './routes/ai.js';
import matchRouter from './routes/match.js';

const app = express();

// ── 1. Secure headers ──────────────────────────────────────────
// Helmet sets 15+ HTTP headers to prevent common attacks
// (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet());

// ── 2. Request logging ─────────────────────────────────────────
// Combined format includes IP, method, path, status, response time
app.use(morgan('[:date[iso]] :method :url :status :response-time ms - :remote-addr'));

// ── 3. CORS ────────────────────────────────────────────────────
// corsOptions is defined once and reused for both the general
// middleware and the explicit OPTIONS preflight handler below.
const corsOptions = {
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// ⚠️  FIX: Explicitly respond to CORS preflight (OPTIONS) requests
// BEFORE rate-limiters and route handlers.
// Without this, Express matches the route path but finds no OPTIONS
// handler and returns 405 Method Not Allowed — which the client
// reports as "Backend auth unavailable: API error: 405".
app.options('*', cors(corsOptions));

// ── 4. Body parsing ────────────────────────────────────────────
// Global 1 MB limit; AI routes get 10 MB for file uploads
app.use(express.json({ limit: '1mb' }));

// ── 5. Global rate limiter ─────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
});
app.use('/api/', globalLimiter);

// Stricter rate limit for AI endpoints (expensive operations)
const aiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.aiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded. Please wait before sending more requests.' },
});
app.use('/api/ai/', aiLimiter);

// Increase body size limit for AI routes (base64 file uploads)
app.use('/api/ai/', express.json({ limit: '10mb' }));

// ── 6. Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/ai', aiRouter);
app.use('/api/match', matchRouter);

// ── 7. Health / monitoring ─────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    geminiConfigured: !!config.geminiApiKey,
    claudeConfigured: !!config.claudeApiKey,
    googleMapsConfigured: !!config.googleMapsApiKey,
    version: '1.0.0',
  });
});

// ── 8. 404 fallback ────────────────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// ── 9. Global error handler ────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[FATAL]', err);
  res.status(500).json({
    error: 'Internal server error.',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ── 10. Start ──────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n🚀 ReliefLink API running on http://localhost:${config.port}`);
  console.log(`   Health:        GET  /api/health`);
  console.log(`   Auth:          POST /api/auth/login`);
  console.log(`   AI:            POST /api/ai/parse-document`);
  console.log(`   AI:            POST /api/ai/incident-analyze`);
  console.log(`   AI:            POST /api/ai/chat`);
  console.log(`   AI:            POST /api/ai/explain-match`);
  console.log(`   AI:            POST /api/ai/analyze-report`);
  console.log(`   AI:            POST /api/ai/analyze-reports-batch`);
  console.log(`   AI:            POST /api/ai/priority-score`);
  console.log(`   AI:            POST /api/ai/priority-rank`);
  console.log(`   AI:            POST /api/ai/match-volunteers`);
  console.log(`   AI:            POST /api/ai/match-batch`);
  console.log(`   AI:            POST /api/ai/match-score`);
  console.log(`   Match:         POST /api/match`);
  console.log(`\n   ── Key Status ──`);
  console.log(`   Gemini:        ${config.geminiApiKey ? '✅ configured' : '⚠️  NOT configured — set GEMINI_API_KEY in .env'}`);
  console.log(`   Claude:        ${config.claudeApiKey ? '✅ configured' : 'ℹ️  not set (optional)'}`);
  console.log(`   Google Maps:   ${config.googleMapsApiKey ? '✅ configured' : '⚠️  NOT configured — set GOOGLE_MAPS_API_KEY in .env'}`);
  console.log(`   CORS origin:   ${config.corsOrigin}`);
  console.log('');
});
