import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { useFetch } from '../hooks';
import { usePeriod } from '../components/Layout';
import { Badge, Card, ErrorBox, Loading, PeriodPicker, Progress, Stat } from '../components/ui';
import { CHART_COLORS, MONTHS, MONTHS_SHORT, fmtDate, money, num, pct } from '../format';

const tip = (v) => money(v);

export default function Dashboard() {
  const { period, setPeriod } = usePeriod();
  const { data: d, error, loading, reload } = useFetch(() => api.get('/dashboard', period), [period.year, period.month]);

  return (
    <div className="stack">
      <div className="topbar">
        <div>
          <h1>📊 Monthly Dashboard</h1>
          <div className="muted">Pick a month — everything updates automatically.</div>
        </div>
        <PeriodPicker period={period} setPeriod={setPeriod} />
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !d && <Loading />}
      {d && <Body d={d} period={period} />}
    </div>
  );
}

function Body({ d, period }) {
  const k = d.kpis;
  const warn = d.settings.warn_threshold;
  const goalLabel = { met: 'Goal met', below: 'Below target', none: '—' }[k.goalStatus];
  const goalTone = { met: 'good', below: 'bad', none: undefined }[k.goalStatus];

  const barData = d.categories.filter((c) => c.budget > 0 || c.actual > 0).map((c) => ({ name: c.name, Budget: c.budget, Actual: c.actual }));
  const pieData = d.categories.filter((c) => c.actual > 0).map((c) => ({ name: c.name, value: c.actual }));
  const yearly = d.yearly.map((r) => ({ name: MONTHS_SHORT[r.month - 1], Income: r.income, Expenses: r.expenses }));
  const weeklyData = d.weekly.filter((w) => w.days > 0).map((w) => ({ name: w.label, Spent: w.spent, Budget: w.budget }));

  return (
    <>
      <div className={`banner ${d.banner.level}`}>{d.banner.level === 'danger' ? '🔴' : d.banner.level === 'warn' ? '🟠' : '🟢'} {d.banner.text}</div>

      <div className="grid kpis">
        <Stat label="💰 Total Income" value={money(k.income)} sub="Salary + other income" />
        <Stat label="💸 Total Expenses" value={money(k.expenses)} sub={`${k.transactions} transactions`} />
        <Stat label="💵 Actual Savings" value={money(k.savingsActual)} sub={`Target ${money(k.savingsTarget)}`} />
        <Stat label="Remaining Balance" value={money(k.remaining)} tone={k.remaining >= 0 ? 'good' : 'bad'} sub="Income − Expenses − Savings" />
        <Stat label="🟠 Extras / Unexpected" value={money(k.unexpected)} sub={`${k.unexpectedCount} unexpected item(s)`} />
        <Stat label="🎯 Total Monthly Budget" value={money(k.totalBudget)} sub="Sum of category budgets" />
        <div className="card stat">
          <div className="label">📊 Budget Used</div>
          <div className="value">{pct(k.budgetUsed, 1)}</div>
          <Progress value={k.budgetUsed} warn={warn} />
          <div className="sub">{k.budgetLeft >= 0 ? `${money(k.budgetLeft)} left in budget` : `${money(-k.budgetLeft)} over budget`}</div>
        </div>
        <Stat label="🏆 Savings Goal Status" value={goalLabel} tone={goalTone} sub={`${pct(d.settings.savings_target_pct)} of income`} />
      </div>

      <div className="grid two">
        <Card title="Budget vs Actual by category">
          {barData.length === 0 ? <div className="empty">No budget or spending yet.</div> : (
            <ResponsiveContainer width="100%" height={Math.max(260, barData.length * 34)}>
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tickFormatter={num} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={tip} />
                <Legend />
                <Bar dataKey="Budget" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Actual" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title="Spending by category">
          {pieData.length === 0 ? <div className="empty">No expenses this month.</div> : (
            <ResponsiveContainer width="100%" height={340}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={tip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card title="🚦 Budget vs Actual by Category">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Category</th><th>Type</th><th className="right">Budget</th><th className="right">Actual</th><th className="right">Remaining</th><th style={{ width: 130 }}>% Used</th><th>Status</th></tr></thead>
            <tbody>
              {d.categories.map((c) => (
                <tr key={c.id ?? 'none'}>
                  <td>{c.name}</td><td className="muted">{c.type || '—'}</td>
                  <td className="right num">{num(c.budget)}</td><td className="right num">{num(c.actual)}</td>
                  <td className={`right num ${c.remaining < 0 ? 'neg' : ''}`}>{num(c.remaining)}</td>
                  <td><div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><Progress value={c.pctUsed} warn={warn} /><span className="num hint">{c.budget ? pct(c.pctUsed) : '—'}</span></div></td>
                  <td><Badge status={c.status} /></td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>TOTAL</td><td className="right num">{num(k.totalBudget)}</td><td className="right num">{num(k.expenses)}</td>
                <td className={`right num ${k.budgetLeft < 0 ? 'neg' : ''}`}>{num(k.budgetLeft)}</td>
                <td className="num">{pct(k.budgetUsed, 1)}</td>
                <td>{k.totalBudget > 0 && <Badge status={k.budgetUsed > 1 ? 'over' : k.budgetUsed >= warn ? 'near' : 'ok'} />}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="stack">
        <Card title={`📅 Weekly Spending — ${MONTHS[period.month - 1]}`}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Week</th><th>Dates</th><th className="right">Spent</th><th className="right">Budget</th><th className="right">Budget − Spent</th><th className="right">% of Budget</th><th>Status</th></tr></thead>
              <tbody>
                {d.weekly.map((w) => (
                  <tr key={w.week}>
                    <td>{w.label}</td><td className="muted num">{w.days ? `${fmtDate(w.from).slice(0, -5)} – ${fmtDate(w.to).slice(0, -5)}` : '—'}</td>
                    <td className="right num">{num(w.spent)}</td><td className="right num">{num(w.budget)}</td>
                    <td className={`right num ${w.remaining < 0 ? 'neg' : ''}`}>{num(w.remaining)}</td>
                    <td className="right num">{pct(w.pctUsed)}</td><td><Badge status={w.status} kind="week" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">Week budget = monthly budget × days in that week ÷ days in month. Weeks with big bills (e.g. rent) naturally look high.</p>
          {weeklyData.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis tickFormatter={num} /><Tooltip formatter={tip} /><Legend />
                <Bar dataKey="Budget" fill="#94a3b8" /><Bar dataKey="Spent" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="grid two">
          <Card title="⚖️ Need vs Want">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Type</th><th className="right">Spent</th><th className="right">% of Expenses</th><th className="right">% of Income</th><th className="right">Guideline</th><th>Status</th></tr></thead>
                <tbody>
                  {[['Need', d.needWant.need], ['Want', d.needWant.want], ['Not tagged', d.needWant.untagged]].map(([name, r]) => (
                    <tr key={name}>
                      <td>{name}</td><td className="right num">{num(r.spent)}</td><td className="right num">{pct(r.pctOfExpenses, 1)}</td>
                      <td className="right num">{pct(r.pctOfIncome, 1)}</td><td className="right num">{r.guideline == null ? '—' : pct(r.guideline)}</td>
                      <td>{r.status ? <span className={`badge ${r.status === 'above' ? 'warn' : 'good'}`}>{r.status === 'above' ? 'Above guideline' : 'Within guideline'}</span> : '—'}</td>
                    </tr>
                  ))}
                  <tr className="total"><td>TOTAL</td><td className="right num">{num(d.needWant.total)}</td><td colSpan={4} /></tr>
                </tbody>
              </table>
            </div>
            <p className="hint">Guideline: 50/30/20 rule (needs/wants/savings). Edit the percentages on the Budget page. “Not tagged” = expenses without a Need/Want choice.</p>
          </Card>

          <Card title="💳 Payment Methods">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Method</th><th className="right">Spent</th><th className="right">% of Expenses</th><th className="right">Transactions</th></tr></thead>
                <tbody>
                  {d.payments.filter((p) => p.spent > 0 || p.count > 0).map((p) => (
                    <tr key={p.id ?? 'none'}><td>{p.name}</td><td className="right num">{num(p.spent)}</td><td className="right num">{pct(p.pct, 1)}</td><td className="right num">{p.count}</td></tr>
                  ))}
                  {d.payments.every((p) => p.spent === 0 && p.count === 0) && <tr><td colSpan={4} className="empty">No transactions this month.</td></tr>}
                  <tr className="total"><td>TOTAL</td><td className="right num">{num(k.expenses)}</td><td /><td className="right num">{k.transactions}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Card title={`Income vs Expenses — ${period.year}`}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={yearly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis tickFormatter={num} /><Tooltip formatter={tip} /><Legend />
            <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}
