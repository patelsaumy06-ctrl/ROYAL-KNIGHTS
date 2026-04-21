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

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // { email, name, type, iat, exp }
    next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Token expired. Please login again.'
        : 'Invalid authentication token.';
    return res.status(401).json({ error: message });
  }
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
