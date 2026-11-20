const router = require('express').Router();
const { query } = require('../db');
const { wrap, HttpError, reqString, optString, reqMoney, reqInt } = require('../util');

const TYPES = ['Need', 'Want'];
function parse(b) {
  const type = TYPES.includes(b.type) ? b.type : null;
  if (!type) throw new HttpError(400, 'Type must be Need or Want');
  return {
    name: reqString(b.name, 'Name', 100), type,
    budget: b.monthly_budget === undefined ? 0 : reqMoney(b.monthly_budget, 'Monthly budget'),
    notes: optString(b.notes, 300),
  };
}
const dupe = (err) => { if (err.code === '23505') throw new HttpError(409, 'A category with this name already exists'); throw err; };

router.get('/', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, type, monthly_budget, notes, sort_order FROM categories
      WHERE user_id=$1 ORDER BY sort_order, id`, [req.userId]);
  res.json(rows);
}));

router.post('/', wrap(async (req, res) => {
  const v = parse(req.body);
  try {
    const { rows } = await query(
      `INSERT INTO categories (user_id,name,type,monthly_budget,notes,sort_order)
       VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(sort_order),0)+1 FROM categories WHERE user_id=$1))
       RETURNING id, name, type, monthly_budget, notes, sort_order`,
      [req.userId, v.name, v.type, v.budget, v.notes]);
    res.status(201).json(rows[0]);
  } catch (e) { dupe(e); }
}));

router.put('/:id', wrap(async (req, res) => {
  const id = reqInt(req.params.id, 'id', 1);
  const v = parse(req.body);
  try {
    const { rows } = await query(
      `UPDATE categories SET name=$3,type=$4,monthly_budget=$5,notes=$6 WHERE id=$1 AND user_id=$2
       RETURNING id, name, type, monthly_budget, notes, sort_order`,
      [id, req.userId, v.name, v.type, v.budget, v.notes]);
    if (!rows[0]) throw new HttpError(404, 'Category not found');
    res.json(rows[0]);
  } catch (e) { dupe(e); }
}));

router.delete('/:id', wrap(async (req, res) => {
  const id = reqInt(req.params.id, 'id', 1);
  const r = await query('DELETE FROM categories WHERE id=$1 AND user_id=$2', [id, req.userId]);
  if (!r.rowCount) throw new HttpError(404, 'Category not found');
  res.status(204).end();
}));

module.exports = router;
