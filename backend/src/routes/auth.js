const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool, query } = require('../db');
const { sign, requireAuth, rateLimit } = require('../auth');
const { wrap, HttpError, reqString } = require('../util');
const { seedDefaults } = require('../defaults');

const limiter = rateLimit({ max: 30 });
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

router.post('/register', limiter, wrap(async (req, res) => {
  const name = reqString(req.body.name, 'Name', 100);
  const email = reqString(req.body.email, 'Email', 200).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id,email,name',
      [email, name, hash]);
    await seedDefaults(client, rows[0].id);
    await client.query('COMMIT');
    res.status(201).json({ token: sign(rows[0]), user: publicUser(rows[0]) });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw new HttpError(409, 'An account with this email already exists');
    throw err;
  } finally {
    client.release();
  }
}));

router.post('/login', limiter, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const ok = rows[0] && (await bcrypt.compare(password, rows[0].password_hash));
  if (!ok) throw new HttpError(401, 'Incorrect email or password');
  res.json({ token: sign(rows[0]), user: publicUser(rows[0]) });
}));

router.get('/me', requireAuth, wrap(async (req, res) => {
  const { rows } = await query('SELECT id,email,name FROM users WHERE id=$1', [req.userId]);
  if (!rows[0]) throw new HttpError(401, 'Account no longer exists');
  res.json({ user: rows[0] });
}));

module.exports = router;
