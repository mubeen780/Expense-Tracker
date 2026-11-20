const jwt = require('jsonwebtoken');
const { HttpError } = require('./util');

const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
if (!process.env.JWT_SECRET || SECRET === 'change-me-to-a-long-random-string') {
  console.warn('[auth] WARNING: JWT_SECRET is not set to a strong value. Edit .env before sharing this app.');
}

const sign = (user) =>
  jwt.sign({ sub: user.id }, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

function requireAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return next(new HttpError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(m[1], SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, 'Session expired, please sign in again'));
  }
}

// Tiny in-memory rate limiter for login/register (per IP).
function rateLimit({ windowMs = 15 * 60 * 1000, max = 30 } = {}) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip;
    const rec = hits.get(key) || { count: 0, reset: now + windowMs };
    if (now > rec.reset) { rec.count = 0; rec.reset = now + windowMs; }
    rec.count += 1;
    hits.set(key, rec);
    if (rec.count > max) return next(new HttpError(429, 'Too many attempts, try again later'));
    next();
  };
}

module.exports = { sign, requireAuth, rateLimit };
