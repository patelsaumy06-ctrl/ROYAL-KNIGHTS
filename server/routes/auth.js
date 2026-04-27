import { Router } from 'express';
import { signToken } from '../middleware/auth.js';

const router = Router();

/**
 * Demo accounts — mirrors the client-side list.
 * In production: replace with a database lookup or Firebase Admin
 * user verification so credentials are never hardcoded.
 */
const ACCOUNTS = [
  { email: 'ngo@Needlink.org',   password: 'ngo123',   name: 'Needlink Foundation',   type: 'Relief NGO' },
  { email: 'care@gujarat.org',   password: 'care123',  name: 'Gujarat Care Society',  type: 'Health NGO' },
  { email: 'flood@aid.org',      password: 'flood123', name: 'Flood Aid Gujarat',     type: 'Disaster Relief' },
  { email: 'admin@Needlink.org', password: 'admin123', name: 'Needlink Admin',        type: 'Super Admin' },
];

// Dynamically registered accounts (mirrors client-side addAccount)
const _extraAccounts = [];

function findAccount(email, password) {
  const all = [...ACCOUNTS, ..._extraAccounts];
  return all.find(
    (a) => a.email === email.trim().toLowerCase() && a.password === password,
  );
}

/**
 * POST /api/auth/login
 *
 * Body: { email, password }
 * Returns: { token, account: { email, name, type } }
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const account = findAccount(email, password);
  if (!account) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = signToken(account);

  return res.json({
    token,
    account: { email: account.email, name: account.name, type: account.type },
  });
});

/**
 * POST /api/auth/register
 *
 * Body: { email, password, name, type }
 * Returns: { token, account }
 */
router.post('/register', (req, res) => {
  const { email, password, name, type } = req.body || {};

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required.' });
  }

  const normalized = email.trim().toLowerCase();
  if ([...ACCOUNTS, ..._extraAccounts].some((a) => a.email === normalized)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const newAccount = { email: normalized, password, name, type: type || 'Relief NGO' };
  _extraAccounts.push(newAccount);

  const token = signToken(newAccount);
  return res.status(201).json({
    token,
    account: { email: newAccount.email, name: newAccount.name, type: newAccount.type },
  });
});

export default router;
