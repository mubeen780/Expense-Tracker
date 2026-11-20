import { useEffect, useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks';
import { Card, ErrorBox, Field, Loading, Modal, confirmDelete, useToast } from '../components/ui';
import { money, num, pct } from '../format';

export default function Budget() {
  const toast = useToast();
  const cats = useFetch(() => api.get('/categories'), []);
  const set = useFetch(() => api.get('/settings'), []);
  const [editing, setEditing] = useState(null);

  const total = cats.data ? cats.data.reduce((s, c) => s + c.monthly_budget, 0) : 0;
  const salary = set.data?.monthly_salary || 0;
  const planned = salary * (set.data?.savings_target_pct || 0);
  const unalloc = salary - total - planned;

  async function remove(c) {
    if (!confirmDelete(`category "${c.name}" (its expenses will become Uncategorised)`)) return;
    try { await api.del(`/categories/${c.id}`); toast('Category deleted'); cats.reload(); } catch (e) { toast(e.message); }
  }

  return (
    <div className="stack">
      <div className="topbar"><div><h1>🎯 Monthly Budget by Category</h1><div className="muted">A fixed monthly amount applied to every month.</div></div>
        <button className="primary" onClick={() => setEditing({})}>+ Add category</button></div>
      <ErrorBox error={cats.error || set.error} />
      {set.data && <SettingsCard s={set.data} onSaved={() => { set.reload(); toast('Settings saved'); }} />}
      <Card title="Categories">
        {!cats.data ? <Loading /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Category</th><th>Type (Need/Want)</th><th className="right">Monthly Budget</th><th className="right">% of Salary</th><th className="right">Yearly Budget</th><th>Notes</th><th /></tr></thead>
            <tbody>
              {cats.data.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td><td><span className={`badge ${c.type === 'Need' ? 'good' : 'warn'}`}>{c.type}</span></td>
                  <td className="right num">{num(c.monthly_budget)}</td><td className="right num">{salary ? pct(c.monthly_budget / salary, 1) : '—'}</td>
                  <td className="right num">{num(c.monthly_budget * 12)}</td><td className="muted">{c.notes}</td>
                  <td className="right" style={{ whiteSpace: 'nowrap' }}><button className="link" onClick={() => setEditing(c)}>Edit</button><button className="link danger" onClick={() => remove(c)}>Delete</button></td>
                </tr>
              ))}
              <tr className="total"><td colSpan={2}>TOTAL BUDGET</td><td className="right num">{num(total)}</td><td className="right num">{salary ? pct(total / salary, 1) : '—'}</td><td className="right num">{num(total * 12)}</td><td colSpan={2} /></tr>
            </tbody>
          </table></div>
        )}
      </Card>
      <Card>
        <div className="grid kpis" style={{ gap: 20 }}>
          <div><div className="muted">Planned monthly savings</div><b className="num">{money(planned)}</b></div>
          <div><div className="muted">Unallocated (Salary − Budget − Savings)</div><b className={`num ${unalloc < 0 ? 'neg' : 'pos'}`}>{money(unalloc)}</b></div>
        </div>
        {unalloc < 0 && <p className="error" style={{ marginTop: 10 }}>Your budget plus planned savings exceed your salary by {money(-unalloc)}.</p>}
      </Card>
      {editing && <CategoryForm cat={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast('Category saved'); cats.reload(); }} />}
    </div>
  );
}

const toPct = (f) => String(Math.round(f * 10000) / 100);

function SettingsCard({ s, onSaved }) {
  const [v, setV] = useState({});
  const [err, setErr] = useState('');
  useEffect(() => setV({ salary: String(s.monthly_salary), warn: toPct(s.warn_threshold), save: toPct(s.savings_target_pct), need: toPct(s.need_guideline), want: toPct(s.want_guideline) }), [s]);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      await api.put('/settings', {
        monthly_salary: v.salary, warn_threshold: Number(v.warn) / 100, savings_target_pct: Number(v.save) / 100,
        need_guideline: Number(v.need) / 100, want_guideline: Number(v.want) / 100,
      });
      onSaved();
    } catch (er) { setErr(er.message); }
  }
  return (
    <Card title="Budget settings">
      <form onSubmit={submit} className="stack">
        <div className="grid kpis">
          <Field label="Monthly salary (PKR)"><input inputMode="decimal" value={v.salary ?? ''} onChange={set('salary')} /></Field>
          <Field label="Warning threshold (% used)"><input inputMode="decimal" value={v.warn ?? ''} onChange={set('warn')} /></Field>
          <Field label="Savings target (% of income)"><input inputMode="decimal" value={v.save ?? ''} onChange={set('save')} /></Field>
          <Field label="Needs guideline (% of income)"><input inputMode="decimal" value={v.need ?? ''} onChange={set('need')} /></Field>
          <Field label="Wants guideline (% of income)"><input inputMode="decimal" value={v.want ?? ''} onChange={set('want')} /></Field>
        </div>
        <div className="hint">Categories turn amber (“Near limit”) at the warning threshold and red when over budget. Savings target of {v.save}% of {money(Number(v.salary) || 0)} = {money((Number(v.salary) || 0) * (Number(v.save) || 0) / 100)} per month.</div>
        {err && <div className="error">{err}</div>}
        <div><button className="primary">Save settings</button></div>
      </form>
    </Card>
  );
}

function CategoryForm({ cat, onClose, onSaved }) {
  const [v, setV] = useState({ name: cat.name || '', type: cat.type || 'Need', monthly_budget: cat.monthly_budget ?? 0, notes: cat.notes || '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setErr('');
    try { cat.id ? await api.put(`/categories/${cat.id}`, v) : await api.post('/categories', v); onSaved(); }
    catch (er) { setErr(er.message); }
  }
  return (
    <Modal title={cat.id ? 'Edit category' : 'Add category'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Field label="Name" className="full"><input value={v.name} onChange={set('name')} required maxLength={100} autoFocus /></Field>
        <Field label="Type"><select value={v.type} onChange={set('type')}><option>Need</option><option>Want</option></select></Field>
        <Field label="Monthly budget (PKR)"><input inputMode="decimal" value={v.monthly_budget} onChange={set('monthly_budget')} required /></Field>
        <Field label="Notes" className="full"><input value={v.notes} onChange={set('notes')} maxLength={300} /></Field>
        {err && <div className="error full">{err}</div>}
        <div className="row full" style={{ justifyContent: 'flex-end' }}><button type="button" onClick={onClose}>Cancel</button><button className="primary">Save</button></div>
      </form>
    </Modal>
  );
}
