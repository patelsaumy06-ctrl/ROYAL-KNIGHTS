/**
 * Lightweight input-validation middleware factory.
 *
 * Usage:
 *   app.post('/api/match', requireAuth, validateBody(matchSchema), handler);
 *
 * A schema is an object where each key maps to a validator function
 * that returns true (valid) or a string (error message).
 */

function sanitize(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/[<>`]/g, '')  // strip common XSS vectors
    .replace(/[\u0000-\u001F\u007F]/g, '') // strip control chars
    .trim();
}

function deepSanitize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[sanitize(key)] = deepSanitize(value);
    }
    return result;
  }
  return obj;
}

/**
 * Middleware: sanitize all body values automatically.
 */
export function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  next();
}

/**
 * Middleware factory: validate req.body against a schema.
 *
 * @param {Record<string, (v: any) => true | string>} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const errors = {};
    for (const [field, validator] of Object.entries(schema)) {
      const result = validator(req.body?.[field], req.body);
      if (result !== true) {
        errors[field] = result || `Invalid value for '${field}'.`;
      }
    }
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }
    next();
  };
}

// ── Reusable validators ───────────────────────────────────────

export const required = (label = 'Field') => (v) =>
  v != null && String(v).trim().length > 0 ? true : `${label} is required.`;

export const isString = (label = 'Field', maxLen = 5000) => (v) => {
  if (typeof v !== 'string') return `${label} must be a string.`;
  if (v.length > maxLen) return `${label} must be ≤ ${maxLen} characters.`;
  return true;
};

export const isArray = (label = 'Field') => (v) =>
  Array.isArray(v) ? true : `${label} must be an array.`;

export const isObject = (label = 'Field') => (v) =>
  v && typeof v === 'object' && !Array.isArray(v) ? true : `${label} must be an object.`;
