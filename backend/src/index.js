const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { waitForDb, migrate, query } = require('./db');
const { requireAuth } = require('./auth');
const { HttpError } = require('./util');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try { await query('SELECT 1'); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'db_down' }); }
});

app.use('/api/auth', require('./routes/auth'));
const secured = express.Router();
secured.use(requireAuth);
secured.use('/settings', require('./routes/settings'));
secured.use('/categories', require('./routes/categories'));
secured.use('/payment-methods', require('./routes/paymentMethods'));
secured.use('/expenses', require('./routes/expenses'));
secured.use('/income', require('./routes/income'));
secured.use('/savings', require('./routes/savings'));
secured.use('/', require('./routes/reports'));
app.use('/api', secured);

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === '23514' || err.code === '22003') return res.status(400).json({ error: 'Value out of allowed range' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  await waitForDb();
  await migrate();
  if (String(process.env.SEED_DEMO).toLowerCase() === 'true') await require('./seed').seedDemo();
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`[api] listening on :${port}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
