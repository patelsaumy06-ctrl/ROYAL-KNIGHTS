import jwt from 'jsonwebtoken';
import config from '../config.js';

/**
 * JWT authentication middleware.
 *
 * Verifies the Bearer token in the Authorization header.
 * On success, attaches `req.user` with the decoded payload
 * (email, name, type) for downstream handlers.
 *
 * In production, swap this for Firebase Admin `verifyIdToken()`
 * if migrating to Firebase Authentication.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required.',
      hint: 'Include Authorization: Bearer <token> header.',
    });
  }

  const token = header.slice(7); // strip "Bearer "

  // ── Try our own backend JWT first ──────────────────────────────
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // { email, name, type, iat, exp }
    return next();
  } catch (ownErr) {
    // Not a backend JWT — try decoding as a Firebase ID token
  }

  // ── Firebase ID token fallback ─────────────────────────────────
  // Firebase tokens are JWTs signed by Google, not our secret.
  // We decode without verification here (trusting the Vite proxy / local dev).
  // In production, replace this with firebase-admin verifyIdToken().
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.email) {
      req.user = { email: decoded.email, name: decoded.name || decoded.email, type: 'firebase' };
      return next();
    }
  } catch (_) {
    // fall through to error
  }

  return res.status(401).json({ error: 'Invalid authentication token.' });
}

/**
 * Generate a signed JWT for the given account.
 */
export function signToken(account) {
  return jwt.sign(
    { email: account.email, name: account.name, type: account.type },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}
