class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isInt = (v) => Number.isInteger(Number(v)) && String(v).trim() !== '';

function reqInt(v, name, min = -Infinity, max = Infinity) {
  if (!isInt(v) || Number(v) < min || Number(v) > max) {
    throw new HttpError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  return Number(v);
}

function reqMoney(v, name) {
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '').trim()) : Number(v);
  if (v === '' || v === null || v === undefined || !Number.isFinite(n) || n < 0 || n > 1e12) {
    throw new HttpError(400, `${name} must be a non-negative number`);
  }
  return Math.round(n * 100) / 100;
}

function reqFraction(v, name) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isFinite(n) || n < 0 || n > 1) {
    throw new HttpError(400, `${name} must be between 0 and 1`);
  }
  return n;
}

function reqString(v, name, max = 200) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw new HttpError(400, `${name} is required`);
  if (s.length > max) throw new HttpError(400, `${name} must be at most ${max} characters`);
  return s;
}

function optString(v, max = 500) {
  if (v === undefined || v === null) return '';
  const s = String(v).trim();
  if (s.length > max) throw new HttpError(400, `Text must be at most ${max} characters`);
  return s;
}

function reqDate(v, name = 'date') {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new HttpError(400, `${name} must be in YYYY-MM-DD format`);
  }
  const d = new Date(v + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
    throw new HttpError(400, `${name} is not a valid date`);
  }
  const year = Number(v.slice(0, 4));
  if (year < 2000 || year > 2100) throw new HttpError(400, `${name} year must be 2000-2100`);
  return v;
}

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

module.exports = {
  HttpError, wrap, reqInt, reqMoney, reqFraction, reqString, optString, reqDate,
  daysInMonth, MONTHS,
};
