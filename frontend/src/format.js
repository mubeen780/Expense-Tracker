export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

const nf = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 });
export const num = (n) => nf.format(Number(n) || 0);
export const money = (n) => `PKR ${nf.format(Number(n) || 0)}`;
export const pct = (n, digits = 0) => `${((Number(n) || 0) * 100).toFixed(digits)}%`;

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
};

// status code -> [label, tone]
const BUDGET_STATUS = {
  ok: ['On track', 'good'], near: ['Near limit', 'warn'], over: ['Over budget', 'bad'],
  over_nobudget: ['Over (no budget)', 'bad'], none: ['—', 'muted'],
};
const WEEK_STATUS = { ok: ['OK', 'good'], near: ['Near limit', 'warn'], over: ['Over', 'bad'], none: ['—', 'muted'] };
const GOAL_STATUS = { done: ['Done', 'good'], on_track: ['On track', 'good'], building: ['Building', 'warn'], none: ['—', 'muted'] };
const SAVE_STATUS = { met: ['Goal met', 'good'], below: ['Below target', 'warn'], none: ['—', 'muted'] };

export const STATUS = { budget: BUDGET_STATUS, week: WEEK_STATUS, goal: GOAL_STATUS, saving: SAVE_STATUS };

export const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];
