import { NavLink, Outlet } from 'react-router-dom';
import { createContext, useContext, useState } from 'react';
import { useAuth } from '../AuthContext';

const PeriodCtx = createContext(null);
export const usePeriod = () => useContext(PeriodCtx);

const links = [
  ['/', '📊', 'Dashboard'], ['/expenses', '💸', 'Expenses'], ['/income', '💰', 'Income'],
  ['/budget', '🎯', 'Budget'], ['/weekly', '📅', 'Weekly'], ['/savings', '💵', 'Savings'], ['/settings', '⚙️', 'Settings'],
];

export default function Layout() {
  const { user, logout } = useAuth();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  return (
    <PeriodCtx.Provider value={{ period, setPeriod }}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">💰 Expense Tracker</div>
          <nav className="nav">
            {links.map(([to, icon, label]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                <span>{icon}</span>{label}
              </NavLink>
            ))}
          </nav>
          <div className="spacer" />
          <div className="userbox">
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div className="muted" style={{ marginBottom: 8, wordBreak: 'break-all' }}>{user.email}</div>
            <button onClick={logout}>Sign out</button>
          </div>
        </aside>
        <main className="main"><Outlet /></main>
      </div>
    </PeriodCtx.Provider>
  );
}
