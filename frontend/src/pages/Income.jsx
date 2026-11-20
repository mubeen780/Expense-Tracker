import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks';
import { usePeriod } from '../components/Layout';
import { Card, ErrorBox, Loading, MoneyCell, PeriodPicker, useToast } from '../components/ui';
import { MONTHS_SHORT, money, num } from '../format';

export default function Income() {
  const { period, setPeriod } = usePeriod();
  const toast = useToast();
  const [extra, setExtra] = useState([]); // locally-added source rows
  const [newSource, setNewSource] = useState('');
  const { data, error, loading, reload } = useFetch(() => api.get('/income', { year: period.year }), [period.year]);

  async function save(source, month, amount) {
    try { await api.put('/income', { year: period.year, month, source, amount }); reload(); }
    catch (e) { toast(e.message); reload(); }
  }
  async function fillSalary() {
    if (!data.salary) return toast('Set your monthly salary on the Budget page first');
    if (!window.confirm(`Fill Salary = ${money(data.salary)} for all 12 months of ${period.year}? Existing salary entries will be overwritten.`)) return;
    try { await api.post('/income/fill-salary', { year: period.year, from_month: 1, to_month: 12 }); toast('Salary filled'); reload(); }
    catch (e) { toast(e.message); }
  }

  const grid = data ? [...data.grid, ...extra.filter((s) => !data.grid.some((g) => g.source === s)).map((source) => ({ source, months: Array(12).fill(0), total: 0 }))] : [];

  return (
    <div className="stack">
      <div className="topbar">
        <div><h1>💰 Income</h1><div className="muted">Type an amount and press Enter/Tab to save. Cells with a yellow tint are editable.</div></div>
        <div className="row"><PeriodPicker period={period} setPeriod={setPeriod} showMonth={false} /><button onClick={fillSalary}>Fill salary into all months</button></div>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : data && (
        <>
          <Card>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Income Source</th>{MONTHS_SHORT.map((m) => <th key={m} className="right">{m}</th>)}<th className="right">Year Total</th></tr></thead>
                <tbody>
                  {grid.map((g) => (
                    <tr key={g.source}>
                      <td style={{ whiteSpace: 'nowrap' }}>{g.source}</td>
                      {g.months.map((amt, i) => <td key={i} style={{ minWidth: 96 }}><MoneyCell value={amt} onCommit={(n) => save(g.source, i + 1, n)} /></td>)}
                      <td className="right num"><b>{num(g.total)}</b></td>
                    </tr>
                  ))}
                  <tr className="total"><td>TOTAL INCOME</td>{data.monthTotals.map((t, i) => <td key={i} className="right num">{num(t)}</td>)}<td className="right num">{num(data.total)}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
          <div className="row between">
            <div className="row">
              <input placeholder="Add another income source…" value={newSource} onChange={(e) => setNewSource(e.target.value)} maxLength={100} />
              <button onClick={() => { const s = newSource.trim(); if (s) { setExtra([...extra, s]); setNewSource(''); } }}>+ Add source</button>
            </div>
            <div><span className="muted">Average monthly income: </span><b className="num">{money(data.average)}</b></div>
          </div>
        </>
      )}
    </div>
  );
}
