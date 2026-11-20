const router = require('express').Router();
const { query } = require('../db');
const { wrap, HttpError, reqString, reqInt } = require('../util');

const dupe = (err) => { if (err.code === '23505') throw new HttpError(409, 'A payment method with this name already exists'); throw err; };

router.get('/', wrap(async (req, res) => {
  const { rows } = await query('SELECT id, name, sort_order FROM payment_methods WHERE user_id=$1 ORDER BY sort_order, id', [req.userId]);
  res.json(rows);
}));

router.post('/', wrap(async (req, res) => {
  const name = reqString(req.body.name, 'Name', 100);
  try {
    const { rows } = await query(
      `INSERT INTO payment_methods (user_id,name,sort_order)
       VALUES ($1,$2,(SELECT COALESCE(MAX(sort_order),0)+1 FROM payment_methods WHERE user_id=$1))
       RETURNING id, name, sort_order`, [req.userId, name]);
    res.status(201).json(rows[0]);
  } catch (e) { dupe(e); }
}));

router.put('/:id', wrap(async (req, res) => {
  const id = reqInt(req.params.id, 'id', 1);
  const name = reqString(req.body.name, 'Name', 100);
  try {
    const { rows } = await query('UPDATE payment_methods SET name=$3 WHERE id=$1 AND user_id=$2 RETURNING id, name, sort_order', [id, req.userId, name]);
    if (!rows[0]) throw new HttpError(404, 'Payment method not found');
    res.json(rows[0]);
  } catch (e) { dupe(e); }
}));

router.delete('/:id', wrap(async (req, res) => {
  const id = reqInt(req.params.id, 'id', 1);
  const r = await query('DELETE FROM payment_methods WHERE id=$1 AND user_id=$2', [id, req.userId]);
  if (!r.rowCount) throw new HttpError(404, 'Payment method not found');
  res.status(204).end();
}));

module.exports = router;
