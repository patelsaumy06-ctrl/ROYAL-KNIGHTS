import jwt from 'jsonwebtoken';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import config from '../config.js';

// ── Firebase Admin initialisation (singleton) ──────────────────
// Requires FIREBASE_SERVICE_ACCOUNT env var set to the JSON string
// of your Firebase service account key, or a path to the file.
function getFirebaseAdmin() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    console.warn(
      '[auth] FIREBASE_SERVICE_ACCOUNT not set — Firebase token verification disabled.',
    );
    return null;
  }

  try {
    const credential = typeof serviceAccount === 'string' && serviceAccount.trim().startsWith('{')
      ? cert(JSON.parse(serviceAccount))       // JSON string in env var
      : cert(serviceAccount);                  // file path in env var

    return initializeApp({ credential });
  } catch (err) {
    console.error('[auth] Failed to initialise Firebase Admin:', err.message);
    return null;
  }
}

const adminApp = getFirebaseAdmin();

/**
 * JWT / Firebase authentication middleware.
 *
 * Priority:
 *  1. Our own backend JWT (signed with JWT_SECRET) → verified with jwt.verify()
 *  2. Firebase ID token → verified with Firebase Admin verifyIdToken()
 *
 * On success, attaches `req.user` with { email, name, type } for downstream handlers.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required.',
      hint: 'Include Authorization: Bearer <token> header.',
    });
  }

  const token = header.slice(7); // strip "Bearer "

  // ── 1. Try our own backend JWT ─────────────────────────────────
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // { email, name, type, iat, exp }
    return next();
  } catch (ownErr) {
    // Not a valid backend JWT — fall through to Firebase check
  }

  // ── 2. Try Firebase ID token (properly verified) ───────────────
  if (adminApp) {
    try {
      const decoded = await getAuth(adminApp).verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email || '',
        name: decoded.name || decoded.email || decoded.uid,
        type: 'firebase',
      };
      return next();
    } catch (firebaseErr) {
      console.warn('[auth] Firebase token verification failed:', firebaseErr.code);
    }
  }

  return res.status(401).json({ error: 'Invalid or expired authentication token.' });
}

/**
 * Generate a signed JWT for the given account (used by /api/auth/login).
 */
export function signToken(account) {
  return jwt.sign(
    { email: account.email, name: account.name, type: account.type },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}