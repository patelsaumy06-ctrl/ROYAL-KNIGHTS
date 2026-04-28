/**
 * Needlink API Server — Production-Grade Entrypoint
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
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
  return res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      geminiConfigured: !!config.geminiApiKey,
      claudeConfigured: !!config.claudeApiKey,
      googleMapsConfigured: !!config.googleMapsApiKey,
      version: '1.0.0',
    },
  });
});

// ── Firestore helpers for stats & urgent-needs ──────────────────
// Uses Firebase Admin SDK (initialised in middleware/auth.js) to
// read live NGO data from Firestore.

function getDb() {
  const apps = getApps();
  if (!apps.length) return null;
  return getFirestore(apps[0]);
}

async function getStats() {
  const db = getDb();
  if (!db) {
    console.warn('[stats-summary] Firebase Admin not initialised — returning empty stats.');
    return { totalNeeds: 0, volunteers: 0, resolved: 0, urgent: 0 };
  }

  const snapshot = await db.collection('ngos').get();
  if (snapshot.empty) {
    console.log('[stats-summary] Firestore ngos collection is empty.');
    return { totalNeeds: 0, volunteers: 0, resolved: 0, urgent: 0 };
  }

  let totalNeeds = 0, volunteers = 0, resolved = 0, urgent = 0;
  snapshot.forEach((doc) => {
    const d = doc.data();
    if (d.stats) {
      totalNeeds += Number(d.stats.totalNeeds) || 0;
      volunteers += Number(d.stats.volunteers) || 0;
      resolved   += Number(d.stats.resolved) || 0;
      urgent     += Number(d.stats.urgent) || 0;
    } else if (Array.isArray(d.needs)) {
      // Fallback: compute from raw needs array
      totalNeeds += d.needs.filter(n => n.status !== 'resolved').length;
      resolved   += d.needs.filter(n => n.status === 'resolved').length;
      urgent     += d.needs.filter(n => n.priority === 'urgent' && n.status !== 'resolved').length;
    }
    if (Array.isArray(d.volunteers)) {
      volunteers += d.volunteers.length;
    }
  });

  return { totalNeeds, volunteers, resolved, urgent };
}

async function getUrgentNeeds() {
  const db = getDb();
  if (!db) {
    console.warn('[urgent-needs] Firebase Admin not initialised — returning empty.');
    return [];
  }

  const snapshot = await db.collection('ngos').get();
  if (snapshot.empty) {
    console.log('[urgent-needs] Firestore ngos collection is empty.');
    return [];
  }

  const urgentList = [];
  snapshot.forEach((doc) => {
    const d = doc.data();
    if (Array.isArray(d.needs)) {
      d.needs
        .filter(n => n.priority === 'urgent' && n.status !== 'resolved')
        .forEach(n => urgentList.push({ ...n, ngo: doc.id }));
    }
  });

  return urgentList;
}

app.get('/api/stats-summary', async (req, res) => {
  console.log(`[stats-summary] Incoming request from ${req.ip}`);
  try {
    const data = await getStats();
    console.log('[stats-summary] Fetched data:', JSON.stringify(data));

    return res.json({
      success: true,
      data,
      message: data.totalNeeds === 0 ? 'No data available' : 'Stats fetched successfully',
    });
  } catch (err) {
    console.error('[stats-summary] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

app.get('/api/urgent-needs', async (req, res) => {
  console.log(`[urgent-needs] Incoming request from ${req.ip}`);
  try {
    const data = await getUrgentNeeds();
    console.log(`[urgent-needs] Fetched ${data.length} urgent items`);

    return res.json({
      success: true,
      data,
      message: data.length === 0 ? 'No urgent needs at this time' : `${data.length} urgent needs found`,
    });
  } catch (err) {
    console.error('[urgent-needs] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ── Emergency Mode Activation ──────────────────────────────────
app.post('/api/emergency/activate', async (req, res) => {
  console.log(`[emergency] Activation request from ${req.ip}`);
  try {
    const db = getDb();
    if (!db) {
      console.warn('[emergency] Firebase Admin not initialised — returning limited mode.');
      return res.json({
        success: true,
        limitedData: true,
        assignments: [],
        criticalZones: [],
        stats: { totalIncidents: 0, criticalZones: 0, volunteersDispatched: 0, averageETA: 0 },
        message: '⚠️ Emergency mode activated with limited data',
      });
    }

    const snapshot = await db.collection('ngos').get();
    let allNeeds = [];
    let allVolunteers = [];

    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      if (Array.isArray(d.needs)) {
        d.needs.forEach((n) => allNeeds.push({ ...n, ngo: docSnap.id }));
      }
      if (Array.isArray(d.volunteers)) {
        d.volunteers.forEach((v) => allVolunteers.push({ ...v, ngo: docSnap.id }));
      }
    });

    const unresolved = allNeeds.filter((n) => n.status !== 'resolved');
    const available = allVolunteers.filter((v) => v.available !== false);

    // Prioritize by severity + wait time
    const prioritized = unresolved
      .map((t) => {
        const sev = t.priority === 'urgent' ? 100 : t.priority === 'medium' ? 60 : 30;
        return { ...t, score: sev + (t.assigned || 0) * -5 };
      })
      .sort((a, b) => b.score - a.score);

    // Auto-assign nearest volunteers (up to 5)
    const assignments = [];
    const usedIds = new Set();
    for (const task of prioritized.slice(0, 5)) {
      const pool = available.filter((v) => !usedIds.has(v.id) && v.lat != null);
      if (pool.length === 0) break;
      let best = pool[0];
      let bestDist = Infinity;
      if (task.lat != null) {
        for (const v of pool) {
          const dlat = (task.lat - v.lat) * 111;
          const dlng = (task.lng - v.lng) * 111 * Math.cos((task.lat * Math.PI) / 180);
          const d = Math.sqrt(dlat * dlat + dlng * dlng);
          if (d < bestDist) { bestDist = d; best = v; }
        }
      }
      usedIds.add(best.id);
      assignments.push({
        task: { id: task.id, category: task.category, location: task.location, priority: task.priority },
        volunteer: { id: best.id, name: best.name, skill: best.skill },
        distanceKm: Number.isFinite(bestDist) ? Math.round(bestDist * 10) / 10 : null,
        etaMinutes: Number.isFinite(bestDist) ? Math.max(3, Math.round((bestDist / 40) * 60)) : 5,
      });
    }

    // Compute critical zones
    const zoneMap = {};
    for (const t of unresolved) {
      const key = t.region || t.location || 'Unknown';
      if (!zoneMap[key]) zoneMap[key] = { region: key, taskCount: 0, urgentCount: 0 };
      zoneMap[key].taskCount++;
      if (t.priority === 'urgent') zoneMap[key].urgentCount++;
    }
    const criticalZones = Object.values(zoneMap)
      .map((z) => ({
        ...z,
        severity: z.urgentCount >= 2 ? 'critical' : z.urgentCount >= 1 ? 'high' : 'moderate',
        color: z.urgentCount >= 2 ? '#EF4444' : z.urgentCount >= 1 ? '#F59E0B' : '#FB923C',
      }))
      .sort((a, b) => b.urgentCount - a.urgentCount);

    console.log(`[emergency] ${assignments.length} assigned, ${criticalZones.length} zones`);
    return res.json({
      success: true,
      limitedData: false,
      assignments,
      criticalZones,
      stats: {
        totalIncidents: unresolved.length,
        criticalZones: criticalZones.filter((z) => z.severity === 'critical').length,
        volunteersDispatched: assignments.length,
        averageETA: assignments.length > 0
          ? Math.round(assignments.reduce((s, a) => s + a.etaMinutes, 0) / assignments.length)
          : 0,
      },
    });
  } catch (err) {
    console.error('[emergency] Error:', err);
    return res.status(500).json({ success: false, error: 'Emergency activation failed.' });
  }
});

// ── 8. 404 fallback ────────────────────────────────────────────
app.use('/api/*', (_req, res) => {
  return res.status(404).json({ success: false, error: 'Endpoint not found.' });
});

// ── 9. Global error handler ────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[FATAL]', err);
  return res.status(500).json({
    success: false,
    error: 'Internal server error.',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ── 10. Start ──────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n🚀 Needlink API running on http://localhost:${config.port}`);
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
