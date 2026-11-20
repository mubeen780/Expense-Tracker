import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks';
import { usePeriod } from '../components/Layout';
import { Badge, Card, ErrorBox, Loading, PeriodPicker, Progress } from '../components/ui';
import { MONTHS, fmtDate, money, num, pct } from '../format';

export default function Weekly() {
  const { period, setPeriod } = usePeriod();
  const [week, setWeek] = useState(1);
  const sum = useFetch(() => api.get('/dashboard', period), [period.year, period.month]);
  const det = useFetch(() => api.get('/weekly', { ...period, week }), [period.year, period.month, week]);
  const d = sum.data;
  const warn = d?.settings.warn_threshold ?? 0.85;

  return (
    <div className="stack">
      <div className="topbar"><div><h1>📅 Weekly Expense Summary</h1><div className="muted">{MONTHS[period.month - 1]} {period.year} · {d?.period.daysInMonth ?? '–'} days</div></div>
        <PeriodPicker period={period} setPeriod={setPeriod} /></div>
      <ErrorBox error={sum.error || det.error} />
      {!d ? <Loading /> : (
        <Card title="Weeks overview">
          <div className="table-wrap"><table>
            <thead><tr><th>Week</th><th>From</th><th>To</th><th className="right">Days</th><th className="right">Total Spent</th><th className="right">Needs</th><th className="right">Wants</th><th className="right">Not Tagged</th><th className="right">Unexpected</th><th className="right">Week Budget</th><th className="right">Budget − Spent</th><th className="right">% of Budget</th><th>Status</th></tr></thead>
            <tbody>
              {d.weekly.map((w) => (
                <tr key={w.week} style={{ cursor: w.days ? 'pointer' : 'default' }} onClick={() => w.days && setWeek(w.week)}>
                  <td><b>{w.label}</b></td><td className="num">{w.from ? fmtDate(w.from) : ''}</td><td className="num">{w.to ? fmtDate(w.to) : ''}</td><td className="right">{w.days}</td>
                  <td className="right num">{num(w.spent)}</td><td className="right num">{num(w.needs)}</td><td className="right num">{num(w.wants)}</td><td className="right num">{num(w.untagged)}</td><td className="right num">{num(w.unexpected)}</td>
                  <td className="right num">{num(w.budget)}</td><td className={`right num ${w.remaining < 0 ? 'neg' : ''}`}>{num(w.remaining)}</td><td className="right num">{pct(w.pctUsed)}</td><td><Badge status={w.status} kind="week" /></td>
                </tr>
              ))}
              <tr className="total"><td>TOTAL</td><td colSpan={3} className="right">{d.weekly.reduce((s, w) => s + w.days, 0)}</td>
                {['spent', 'needs', 'wants', 'untagged', 'unexpected', 'budget', 'remaining'].map((k) => <td key={k} className="right num">{num(d.weekly.reduce((s, w) => s + w[k], 0))}</td>)}<td colSpan={2} /></tr>
            </tbody>
          </table></div>
          <p className="hint">Week budget = monthly budget × days in that week ÷ days in month. Click a week to see its detail below.</p>
        </Card>
      )}

      <Card title="🔎 Week detail" actions={<select value={week} onChange={(e) => setWeek(Number(e.target.value))} aria-label="Week">{[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>Week {w}</option>)}</select>}>
        {!det.data ? <Loading /> : det.data.days === 0 ? <div className="empty">Week {week} does not exist in this month.</div> : (
          <div className="grid two">
            <div>
              <div className="muted" style={{ marginBottom: 8 }}>{fmtDate(det.data.from)} – {fmtDate(det.data.to)} · {det.data.days} days</div>
              <div className="table-wrap"><table>
                <thead><tr><th>Category</th><th className="right">Spent</th><th style={{ width: 90 }}>% of Week</th><th className="right">Week Budget Share</th><th className="right">Budget − Spent</th><th>Status</th></tr></thead>
                <tbody>
                  {det.data.items.map((i) => (
                    <tr key={i.id}><td>{i.name}</td><td className="right num">{num(i.spent)}</td><td><Progress value={i.pctOfWeek} warn={2} /></td>
                      <td className="right num">{num(i.budgetShare)}</td><td className={`right num ${i.remaining < 0 ? 'neg' : ''}`}>{num(i.remaining)}</td><td><Badge status={i.status} kind="week" /></td></tr>
                  ))}
                  <tr className="total"><td>TOTAL</td><td className="right num">{num(det.data.total)}</td><td /><td className="right num">{num(det.data.budgetTotal)}</td><td className="right num">{num(det.data.budgetTotal - det.data.total)}</td><td /></tr>
                </tbody>
              </table></div>
            </div>
            <div>
              <h3>Transactions</h3>
              {det.data.transactions.length === 0 ? <div className="empty">No expenses in this week.</div> : (
                <div className="table-wrap"><table>
                  <thead><tr><th>Date</th><th>Description</th><th>Category</th><th className="right">Amount</th></tr></thead>
                  <tbody>{det.data.transactions.map((t) => <tr key={t.id}><td className="num">{fmtDate(t.date).slice(0, -5)}</td><td>{t.description}</td><td className="muted">{t.category || '—'}</td><td className="right num">{money(t.amount).replace('PKR ', '')}</td></tr>)}</tbody>
                </table></div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
