import { useEffect, useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks';
import { usePeriod } from '../components/Layout';
import { Card, ErrorBox, Field, Loading, Modal, PeriodPicker, confirmDelete, useToast } from '../components/ui';
import { MONTHS, fmtDate, money, todayISO } from '../format';

const PAGE = 25;

export default function Expenses() {
  const { period, setPeriod } = usePeriod();
  const toast = useToast();
  const [scope, setScope] = useState('month');
  const [f, setF] = useState({ q: '', category_id: '', payment_method_id: '', kind: '', need_want: '' });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null); // null | {} (new) | expense
  const [qInput, setQInput] = useState('');

  useEffect(() => { const t = setTimeout(() => { setF((x) => ({ ...x, q: qInput })); setPage(0); }, 300); return () => clearTimeout(t); }, [qInput]);

  const meta = useFetch(async () => {
    const [categories, methods] = await Promise.all([api.get('/categories'), api.get('/payment-methods')]);
    return { categories, methods };
  }, []);

  const params = { year: period.year, month: scope === 'month' ? period.month : '', ...f };
  const { data, error, loading, reload } = useFetch(
    () => api.get('/expenses', { ...params, limit: PAGE, offset: page * PAGE }),
    [period.year, period.month, scope, f.q, f.category_id, f.payment_method_id, f.kind, f.need_want, page]);

  const setFilter = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(0); };

  async function remove(e) {
    if (!confirmDelete(`"${e.description || 'this expense'}"`)) return;
    try { await api.del(`/expenses/${e.id}`); toast('Expense deleted'); reload(); } catch (err) { toast(err.message); }
  }

  const exportCsv = () => api.download('/expenses/export.csv', params, `expenses-${period.year}${scope === 'month' ? '-' + String(period.month).padStart(2, '0') : ''}.csv`).catch((e) => toast(e.message));
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div className="stack">
      <div className="topbar">
        <div><h1>💸 Daily Expense Log</h1><div className="muted">{scope === 'month' ? `${MONTHS[period.month - 1]} ${period.year}` : `Whole year ${period.year}`}</div></div>
        <div className="row">
          <select value={scope} onChange={(e) => { setScope(e.target.value); setPage(0); }} aria-label="Scope"><option value="month">Month</option><option value="year">Whole year</option></select>
          <PeriodPicker period={period} setPeriod={(p) => { setPeriod(p); setPage(0); }} showMonth={scope === 'month'} />
          <button onClick={exportCsv}>⬇ CSV</button>
          <button className="primary" onClick={() => setEditing({})}>+ Add expense</button>
        </div>
      </div>

      <Card>
        <div className="row">
          <input placeholder="Search description…" value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ flex: '1 1 200px' }} />
          <select value={f.category_id} onChange={setFilter('category_id')} aria-label="Category filter">
            <option value="">All categories</option><option value="none">Uncategorised</option>
            {meta.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={f.payment_method_id} onChange={setFilter('payment_method_id')} aria-label="Payment filter">
            <option value="">All payment methods</option>
            {meta.data?.methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={f.need_want} onChange={setFilter('need_want')} aria-label="Need/Want filter"><option value="">Need &amp; Want</option><option>Need</option><option>Want</option><option value="none">Not tagged</option></select>
          <select value={f.kind} onChange={setFilter('kind')} aria-label="Type filter"><option value="">Regular &amp; Unexpected</option><option>Regular</option><option>Unexpected</option></select>
        </div>
      </Card>

      <ErrorBox error={error || meta.error} onRetry={reload} />
      <Card>
        {data && (
          <div className="row" style={{ marginBottom: 10, gap: 22 }}>
            <span><span className="muted">Total logged:</span> <b className="num">{money(data.sum)}</b></span>
            <span><span className="muted">Unexpected:</span> <b className="num">{money(data.unexpected)}</b></span>
            <span><span className="muted">Entries:</span> <b>{data.total}</b></span>
          </div>
        )}
        {loading && !data ? <Loading /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th className="right">Amount (PKR)</th><th>Payment</th><th>Need/Want</th><th>Type</th><th>Week</th><th /></tr></thead>
              <tbody>
                {data?.items.map((e) => (
                  <tr key={e.id}>
                    <td className="num">{fmtDate(e.date)}</td><td>{e.description || <span className="muted">—</span>}</td>
                    <td>{e.category || <span className="muted">Uncategorised</span>}</td>
                    <td className="right num">{money(e.amount).replace('PKR ', '')}</td>
                    <td>{e.payment_method || <span className="muted">—</span>}</td>
                    <td>{e.need_want || <span className="muted">—</span>}</td>
                    <td>{e.kind === 'Unexpected' ? <span className="badge warn">Unexpected</span> : 'Regular'}</td>
                    <td className="muted">W{e.week}</td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="link" onClick={() => setEditing(e)}>Edit</button>
                      <button className="link danger" onClick={() => remove(e)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {data && data.items.length === 0 && <tr><td colSpan={9} className="empty">No expenses found. Click “+ Add expense” to log one.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE && (
          <div className="row between" style={{ marginTop: 12 }}>
            <span className="hint">Page {page + 1} of {pages}</span>
            <div className="row"><button disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button><button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next →</button></div>
          </div>
        )}
      </Card>

      {editing && meta.data && (
        <ExpenseForm expense={editing} meta={meta.data} period={period} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); toast('Expense saved'); reload(); }} />
      )}
    </div>
  );
}

function ExpenseForm({ expense, meta, period, onClose, onSaved }) {
  const isEdit = !!expense.id;
  const defaultDate = () => {
    const t = todayISO();
    return t.startsWith(`${period.year}-${String(period.month).padStart(2, '0')}`) ? t : `${period.year}-${String(period.month).padStart(2, '0')}-01`;
  };
  const [v, setV] = useState({
    date: expense.date || defaultDate(), description: expense.description || '', category_id: expense.category_id || '',
    amount: expense.amount ?? '', payment_method_id: expense.payment_method_id || '', need_want: expense.need_want || '', kind: expense.kind || 'Regular',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const onCategory = (e) => {
    const id = e.target.value;
    const cat = meta.categories.find((c) => String(c.id) === id);
    setV({ ...v, category_id: id, need_want: v.need_want || (cat ? cat.type : '') });
  };

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body = { ...v, category_id: v.category_id || null, payment_method_id: v.payment_method_id || null, need_want: v.need_want || null };
      if (isEdit) await api.put(`/expenses/${expense.id}`, body); else await api.post('/expenses', body);
      onSaved();
    } catch (er) { setErr(er.message); setBusy(false); }
  }

  return (
    <Modal title={isEdit ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Field label="Date"><input type="date" value={v.date} onChange={set('date')} required /></Field>
        <Field label="Amount (PKR)"><input inputMode="decimal" value={v.amount} onChange={set('amount')} required placeholder="0" autoFocus /></Field>
        <Field label="Description" className="full"><input value={v.description} onChange={set('description')} maxLength={300} placeholder="e.g. Weekly groceries" /></Field>
        <Field label="Category"><select value={v.category_id} onChange={onCategory}><option value="">— Uncategorised —</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Payment method"><select value={v.payment_method_id} onChange={set('payment_method_id')}><option value="">— Not specified —</option>{meta.methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Need / Want"><select value={v.need_want} onChange={set('need_want')}><option value="">— Not tagged —</option><option>Need</option><option>Want</option></select></Field>
        <Field label="Type"><select value={v.kind} onChange={set('kind')}><option>Regular</option><option>Unexpected</option></select></Field>
        {err && <div className="error full">{err}</div>}
        <div className="row full" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
