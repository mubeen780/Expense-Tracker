import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { useFetch } from '../hooks';
import { usePeriod } from '../components/Layout';
import { Badge, Card, ErrorBox, Field, Loading, Modal, MoneyCell, PeriodPicker, Progress, confirmDelete, useToast } from '../components/ui';
import { MONTHS, MONTHS_SHORT, money, num, pct } from '../format';

export default function Savings() {
  const { period, setPeriod } = usePeriod();
  const toast = useToast();
  const [goal, setGoal] = useState(null);
  const { data: d, error, reload } = useFetch(() => api.get('/savings', { year: period.year }), [period.year]);

  async function saveActual(month, amount) {
    try { await api.put('/savings/actual', { year: period.year, month, amount }); reload(); } catch (e) { toast(e.message); reload(); }
  }
  async function removeGoal(g) {
    if (!confirmDelete(`goal "${g.name}"`)) return;
    try { await api.del(`/savings/goals/${g.id}`); toast('Goal deleted'); reload(); } catch (e) { toast(e.message); }
  }

  const chart = d ? d.months.map((m) => ({ name: MONTHS_SHORT[m.month - 1], Target: m.target, Actual: m.actual, Cumulative: m.cumulative })) : [];

  return (
    <div className="stack">
      <div className="topbar"><div><h1>💵 Savings Goals &amp; Actual Savings</h1><div className="muted">Enter what you actually saved in the tinted column.</div></div>
        <PeriodPicker period={period} setPeriod={setPeriod} showMonth={false} /></div>
      <ErrorBox error={error} onRetry={reload} />
      {!d ? <Loading /> : (
        <>
          <Card title={`Monthly savings tracker — ${period.year}`}>
            <div className="table-wrap"><table>
              <thead><tr><th>Month</th><th className="right">Income</th><th className="right">Expenses</th><th className="right">Savings Target</th><th className="right">Actual Saved</th><th className="right">Actual − Target</th><th className="right">Cumulative Saved</th><th className="right">Remaining Balance</th><th>Status</th></tr></thead>
              <tbody>
                {d.months.map((m) => (
                  <tr key={m.month}>
                    <td>{MONTHS[m.month - 1]}</td><td className="right num">{num(m.income)}</td><td className="right num">{num(m.expenses)}</td><td className="right num">{num(m.target)}</td>
                    <td style={{ minWidth: 110 }}><MoneyCell value={m.actual} onCommit={(n) => saveActual(m.month, n)} /></td>
                    <td className={`right num ${m.diff < 0 ? 'neg' : m.diff > 0 ? 'pos' : ''}`}>{num(m.diff)}</td><td className="right num">{num(m.cumulative)}</td>
                    <td className={`right num ${m.remaining < 0 ? 'neg' : ''}`}>{m.status === 'none' ? '-' : num(m.remaining)}</td><td><Badge status={m.status} kind="saving" /></td>
                  </tr>
                ))}
                <tr className="total"><td>YEAR TOTAL</td>{['income', 'expenses', 'target', 'actual', 'diff', 'cumulative', 'remaining'].map((k) => <td key={k} className="right num">{num(d.totals[k])}</td>)}<td /></tr>
              </tbody>
            </table></div>
            <p className="hint">Remaining Balance = Income − Expenses − Actual Saved (shows “-” for months with no activity).</p>
          </Card>

          <Card title="Target vs actual savings">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chart}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis tickFormatter={num} /><Tooltip formatter={money} /><Legend />
                <Bar dataKey="Target" fill="#94a3b8" radius={[4, 4, 0, 0]} /><Bar dataKey="Actual" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="🎯 Savings goals" actions={<button className="primary" onClick={() => setGoal({})}>+ Add goal</button>}>
            <div className="table-wrap"><table>
              <thead><tr><th>Goal</th><th className="right">Target Amount</th><th className="right">Saved So Far</th><th className="right">Monthly Contribution</th><th className="right">Remaining</th><th style={{ width: 130 }}>% Complete</th><th className="right">Months to Go</th><th>Status</th><th /></tr></thead>
              <tbody>
                {d.goals.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td><td className="right num">{num(g.target)}</td><td className="right num">{num(g.saved)}</td><td className="right num">{num(g.monthly)}</td><td className="right num">{num(g.remaining)}</td>
                    <td>{g.pct == null ? '' : <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><Progress value={g.pct} warn={2} /><span className="hint num">{pct(g.pct)}</span></div>}</td>
                    <td className="right num">{g.monthsToGo == null ? '—' : g.monthsToGo}</td><td><Badge status={g.status} kind="goal" /></td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}><button className="link" onClick={() => setGoal(g)}>Edit</button><button className="link danger" onClick={() => removeGoal(g)}>Delete</button></td>
                  </tr>
                ))}
                {d.goals.length === 0 && <tr><td colSpan={9} className="empty">No goals yet.</td></tr>}
                <tr className="total"><td>TOTAL</td><td className="right num">{num(d.goalTotals.target)}</td><td className="right num">{num(d.goalTotals.saved)}</td><td className="right num">{num(d.goalTotals.monthly)}</td><td className="right num">{num(d.goalTotals.remaining)}</td><td className="num">{pct(d.goalTotals.pct)}</td><td colSpan={3} /></tr>
              </tbody>
            </table></div>
            <div className="grid kpis" style={{ marginTop: 14 }}>
              <div><div className="muted">Monthly savings target (from Budget)</div><b className="num">{money(d.plan.monthlyTarget)}</b></div>
              <div><div className="muted">Total planned goal contributions</div><b className="num">{money(d.plan.contributions)}</b></div>
              <div><div className="muted">Difference (target − contributions)</div><b className={`num ${d.plan.difference !== 0 ? 'neg' : 'pos'}`}>{money(d.plan.difference)}</b></div>
            </div>
            <p className="hint">The difference should be 0 when your goal contributions add up to your monthly savings target.</p>
          </Card>
        </>
      )}
      {goal && <GoalForm goal={goal} onClose={() => setGoal(null)} onSaved={() => { setGoal(null); toast('Goal saved'); reload(); }} />}
    </div>
  );
}

function GoalForm({ goal, onClose, onSaved }) {
  const [v, setV] = useState({ name: goal.name || '', target_amount: goal.target ?? 0, saved_so_far: goal.saved ?? 0, monthly_contribution: goal.monthly ?? 0 });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setErr('');
    try { goal.id ? await api.put(`/savings/goals/${goal.id}`, v) : await api.post('/savings/goals', v); onSaved(); } catch (er) { setErr(er.message); }
  }
  return (
    <Modal title={goal.id ? 'Edit goal' : 'Add goal'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        <Field label="Goal name" className="full"><input value={v.name} onChange={set('name')} required maxLength={100} autoFocus /></Field>
        <Field label="Target amount"><input inputMode="decimal" value={v.target_amount} onChange={set('target_amount')} /></Field>
        <Field label="Saved so far"><input inputMode="decimal" value={v.saved_so_far} onChange={set('saved_so_far')} /></Field>
        <Field label="Monthly contribution" className="full"><input inputMode="decimal" value={v.monthly_contribution} onChange={set('monthly_contribution')} /></Field>
        {err && <div className="error full">{err}</div>}
        <div className="row full" style={{ justifyContent: 'flex-end' }}><button type="button" onClick={onClose}>Cancel</button><button className="primary">Save</button></div>
      </form>
    </Modal>
  );
}
