import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { STATUS } from '../format';

export const Card = ({ title, actions, children, className = '' }) => (
  <section className={`card ${className}`}>
    {(title || actions) && (
      <div className="row between" style={{ marginBottom: 10 }}>
        {title && <h2 style={{ margin: 0 }}>{title}</h2>}
        {actions && <div className="row">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

export const Stat = ({ label, value, sub, tone }) => (
  <div className="card stat">
    <div className="label">{label}</div>
    <div className={`value ${tone === 'good' ? 'pos' : tone === 'bad' ? 'neg' : ''}`}>{value}</div>
    {sub && <div className="sub">{sub}</div>}
  </div>
);

export function Badge({ status, kind = 'budget' }) {
  const [label, tone] = (STATUS[kind][status] || STATUS[kind].none);
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function Progress({ value, warn = 0.85 }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const tone = value > 1 ? 'bad' : value >= warn ? 'warn' : '';
  return <div className={`progress ${tone}`}><span style={{ width: `${v * 100}%` }} /></div>;
}

export const Loading = () => <div className="empty">Loading…</div>;
export const ErrorBox = ({ error, onRetry }) => error ? (
  <div className="error row between"><span>{error}</span>{onRetry && <button onClick={onRetry}>Retry</button>}</div>
) : null;

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="link" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, children, className = '' }) => (
  <label className={`field ${className}`}>{label}{children}</label>
);

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const show = useCallback((m) => { setMsg(m); setTimeout(() => setMsg(null), 2600); }, []);
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>;
}

export function PeriodPicker({ period, setPeriod, showMonth = true }) {
  const years = [];
  for (let y = new Date().getFullYear() + 1; y >= new Date().getFullYear() - 6; y--) years.push(y);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return (
    <div className="period">
      {showMonth && (
        <select value={period.month} onChange={(e) => setPeriod({ ...period, month: Number(e.target.value) })} aria-label="Month">
          {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      )}
      <select value={period.year} onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })} aria-label="Year">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

// Text input that holds a money value and commits on blur/Enter.
export function MoneyCell({ value, onCommit, disabled }) {
  const [v, setV] = useState(String(value ?? 0));
  useEffect(() => setV(String(value ?? 0)), [value]);
  const commit = () => {
    const n = Number(String(v).replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) return setV(String(value ?? 0));
    if (n !== Number(value)) onCommit(n);
  };
  return (
    <input className="cell num" inputMode="decimal" value={v} disabled={disabled}
      onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  );
}

export const confirmDelete = (what) => window.confirm(`Delete ${what}? This cannot be undone.`);
