// Calculation layer: mirrors the Dashboard / Weekly / Savings formulas of the Excel workbook.
const { query } = require('./db');
const { daysInMonth } = require('./util');

const pad = (n) => String(n).padStart(2, '0');
const monthStart = (y, m) => `${y}-${pad(m)}-01`;
const nextMonthStart = (y, m) => (m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

async function getSettings(userId) {
  const { rows } = await query(
    `SELECT monthly_salary, warn_threshold, savings_target_pct, need_guideline, want_guideline
       FROM settings WHERE user_id = $1`, [userId]);
  return rows[0] || {
    monthly_salary: 0, warn_threshold: 0.85, savings_target_pct: 0.15,
    need_guideline: 0.5, want_guideline: 0.3,
  };
}

function budgetStatus(budget, actual, warn) {
  if (!budget) return actual > 0 ? 'over_nobudget' : 'none';
  const pct = actual / budget;
  if (pct > 1) return 'over';
  if (pct >= warn) return 'near';
  return 'ok';
}

// Week rows 1..5 with day counts (week 5 may have 0-3 days).
function weekDays(year, month) {
  const dim = daysInMonth(year, month);
  return [1, 2, 3, 4, 5].map((w) => ({
    week: w,
    days: Math.max(0, Math.min(w * 7, dim) - (w - 1) * 7),
    from: `${year}-${pad(month)}-${pad((w - 1) * 7 + 1)}`,
    to: `${year}-${pad(month)}-${pad(Math.min(w * 7, dim))}`,
  }));
}

async function weeklyTable(userId, year, month, totalBudget, warn) {
  const dim = daysInMonth(year, month);
  const { rows } = await query(
    `SELECT ((EXTRACT(DAY FROM spent_on)::int - 1) / 7) + 1 AS week,
            COALESCE(SUM(amount),0) AS total,
            COALESCE(SUM(amount) FILTER (WHERE need_want = 'Need'),0) AS needs,
            COALESCE(SUM(amount) FILTER (WHERE need_want = 'Want'),0) AS wants,
            COALESCE(SUM(amount) FILTER (WHERE kind = 'Unexpected'),0) AS unexpected
       FROM expenses
      WHERE user_id = $1 AND spent_on >= $2 AND spent_on < $3
      GROUP BY 1`,
    [userId, monthStart(year, month), nextMonthStart(year, month)]);
  const byWeek = Object.fromEntries(rows.map((r) => [r.week, r]));
  return weekDays(year, month).map((w) => {
    const r = byWeek[w.week] || { total: 0, needs: 0, wants: 0, unexpected: 0 };
    const budget = round2((totalBudget * w.days) / dim);
    const pct = budget ? r.total / budget : 0;
    return {
      week: w.week, label: `Week ${w.week}`, days: w.days,
      from: w.days ? w.from : null, to: w.days ? w.to : null,
      spent: r.total, needs: r.needs, wants: r.wants,
      untagged: round2(r.total - r.needs - r.wants), unexpected: r.unexpected,
      budget, remaining: round2(budget - r.total), pctUsed: pct,
      status: w.days === 0 ? 'none' : pct > 1 ? 'over' : pct >= warn ? 'near' : 'ok',
    };
  });
}

async function dashboard(userId, year, month) {
  const settings = await getSettings(userId);
  const warn = settings.warn_threshold;
  const from = monthStart(year, month);
  const to = nextMonthStart(year, month);

  const [inc, exp, sav, cats, uncat, needwant, pay, yearly] = await Promise.all([
    query('SELECT COALESCE(SUM(amount),0) AS total FROM income WHERE user_id=$1 AND year=$2 AND month=$3',
      [userId, year, month]),
    query(`SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS cnt,
                  COALESCE(SUM(amount) FILTER (WHERE kind='Unexpected'),0) AS unexpected,
                  COUNT(*) FILTER (WHERE kind='Unexpected') AS unexpected_cnt
             FROM expenses WHERE user_id=$1 AND spent_on >= $2 AND spent_on < $3`, [userId, from, to]),
    query('SELECT amount FROM savings_actual WHERE user_id=$1 AND year=$2 AND month=$3', [userId, year, month]),
    query(`SELECT c.id, c.name, c.type, c.monthly_budget AS budget,
                  COALESCE(SUM(e.amount),0) AS actual
             FROM categories c
             LEFT JOIN expenses e ON e.category_id = c.id AND e.user_id = c.user_id
                                 AND e.spent_on >= $2 AND e.spent_on < $3
            WHERE c.user_id = $1
            GROUP BY c.id ORDER BY c.sort_order, c.id`, [userId, from, to]),
    query(`SELECT COALESCE(SUM(amount),0) AS actual FROM expenses
            WHERE user_id=$1 AND category_id IS NULL AND spent_on >= $2 AND spent_on < $3`, [userId, from, to]),
    query(`SELECT need_want, COALESCE(SUM(amount),0) AS total FROM expenses
            WHERE user_id=$1 AND spent_on >= $2 AND spent_on < $3 GROUP BY need_want`, [userId, from, to]),
    query(`SELECT pm.id, pm.name, COALESCE(SUM(e.amount),0) AS spent, COUNT(e.id) AS cnt
             FROM payment_methods pm
             LEFT JOIN expenses e ON e.payment_method_id = pm.id AND e.user_id = pm.user_id
                                 AND e.spent_on >= $2 AND e.spent_on < $3
            WHERE pm.user_id = $1 GROUP BY pm.id ORDER BY pm.sort_order, pm.id`, [userId, from, to]),
    query(`SELECT m AS month,
                  COALESCE((SELECT SUM(amount) FROM income i WHERE i.user_id=$1 AND i.year=$2 AND i.month=m),0) AS income,
                  COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.user_id=$1
                             AND e.spent_on >= make_date($2,m,1) AND e.spent_on < make_date($2,m,1) + interval '1 month'),0) AS expenses
             FROM generate_series(1,12) AS m ORDER BY m`, [userId, year]),
  ]);

  const income = inc.rows[0].total;
  const spent = exp.rows[0].total;
  const txCount = exp.rows[0].cnt;
  const savingsActual = sav.rows[0] ? sav.rows[0].amount : 0;
  const totalBudget = round2(cats.rows.reduce((s, c) => s + c.budget, 0));

  const categories = cats.rows.map((c) => ({
    id: c.id, name: c.name, type: c.type, budget: c.budget, actual: c.actual,
    remaining: round2(c.budget - c.actual),
    pctUsed: c.budget ? c.actual / c.budget : 0,
    status: budgetStatus(c.budget, c.actual, warn),
  }));
  if (uncat.rows[0].actual > 0) {
    categories.push({
      id: null, name: 'Uncategorised', type: null, budget: 0, actual: uncat.rows[0].actual,
      remaining: -uncat.rows[0].actual, pctUsed: 0, status: 'over_nobudget',
    });
  }
  const overCount = categories.filter((c) => c.remaining < 0).length;

  let banner;
  if (spent > totalBudget && totalBudget > 0) {
    banner = { level: 'danger', text: `OVER BUDGET: spending is PKR ${Math.round(spent - totalBudget).toLocaleString('en-PK')} above your total monthly budget.` };
  } else if (overCount > 0) {
    banner = { level: 'warn', text: `${overCount} ${overCount === 1 ? 'category is' : 'categories are'} over budget — see the table below.` };
  } else {
    banner = { level: 'ok', text: 'All categories are within budget.' };
  }

  const nw = Object.fromEntries(needwant.rows.map((r) => [r.need_want || 'none', r.total]));
  const guide = (spentAmt, g) => ({
    spent: spentAmt,
    pctOfExpenses: spent ? spentAmt / spent : 0,
    pctOfIncome: income ? spentAmt / income : 0,
    guideline: g,
    status: g == null ? null : (income ? spentAmt / income : 0) > g ? 'above' : 'within',
  });
  const needWant = {
    need: guide(nw.Need || 0, settings.need_guideline),
    want: guide(nw.Want || 0, settings.want_guideline),
    untagged: guide(nw.none || 0, null),
    total: spent,
  };

  const payTotals = pay.rows.map((p) => ({
    id: p.id, name: p.name, spent: p.spent, count: p.cnt, pct: spent ? p.spent / spent : 0,
  }));
  const knownSpent = payTotals.reduce((s, p) => s + p.spent, 0);
  const knownCount = payTotals.reduce((s, p) => s + p.count, 0);
  payTotals.push({
    id: null, name: 'Not specified', spent: round2(spent - knownSpent),
    count: txCount - knownCount, pct: spent ? (spent - knownSpent) / spent : 0,
  });

  const savingsTarget = round2(income * settings.savings_target_pct);
  let goalStatus = 'none';
  if (spent > 0 || savingsActual > 0) goalStatus = savingsActual >= savingsTarget ? 'met' : 'below';

  return {
    period: { year, month, daysInMonth: daysInMonth(year, month) },
    settings,
    banner,
    kpis: {
      income, expenses: spent, transactions: txCount, savingsActual, savingsTarget,
      remaining: round2(income - spent - savingsActual),
      unexpected: exp.rows[0].unexpected, unexpectedCount: exp.rows[0].unexpected_cnt,
      totalBudget, budgetUsed: totalBudget ? spent / totalBudget : 0,
      budgetLeft: round2(totalBudget - spent), goalStatus,
    },
    categories,
    weekly: await weeklyTable(userId, year, month, totalBudget, warn),
    needWant,
    payments: payTotals,
    yearly: yearly.rows,
  };
}

async function weekDetail(userId, year, month, week) {
  const settings = await getSettings(userId);
  const dim = daysInMonth(year, month);
  const wd = weekDays(year, month).find((w) => w.week === week);
  const { rows } = await query(
    `SELECT c.id, c.name, c.monthly_budget AS budget, COALESCE(SUM(e.amount),0) AS spent
       FROM categories c
       LEFT JOIN expenses e ON e.category_id = c.id AND e.user_id = c.user_id
            AND e.spent_on >= $2 AND e.spent_on < $3
            AND ((EXTRACT(DAY FROM e.spent_on)::int - 1) / 7) + 1 = $4
      WHERE c.user_id = $1 GROUP BY c.id ORDER BY c.sort_order, c.id`,
    [userId, monthStart(year, month), nextMonthStart(year, month), week]);
  const total = rows.reduce((s, r) => s + r.spent, 0);
  const items = rows.map((r) => {
    const share = round2((r.budget / dim) * wd.days);
    return {
      id: r.id, name: r.name, spent: r.spent, pctOfWeek: total ? r.spent / total : 0,
      budgetShare: share, remaining: round2(share - r.spent),
      status: r.spent === 0 && share === 0 ? 'none' : r.spent > share ? 'over' : 'ok',
    };
  });
  const detail = await query(
    `SELECT e.id, e.spent_on AS date, e.description, e.amount, c.name AS category
       FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
      WHERE e.user_id=$1 AND e.spent_on >= $2 AND e.spent_on < $3
        AND ((EXTRACT(DAY FROM e.spent_on)::int - 1) / 7) + 1 = $4
      ORDER BY e.spent_on, e.id`,
    [userId, monthStart(year, month), nextMonthStart(year, month), week]);
  return {
    week, days: wd.days, from: wd.days ? wd.from : null, to: wd.days ? wd.to : null,
    items, total, budgetTotal: round2(items.reduce((s, i) => s + i.budgetShare, 0)),
    transactions: detail.rows, warn: settings.warn_threshold,
  };
}

async function savingsReport(userId, year) {
  const settings = await getSettings(userId);
  const [inc, exp, act, goalsRes] = await Promise.all([
    query('SELECT month, SUM(amount) AS total FROM income WHERE user_id=$1 AND year=$2 GROUP BY month', [userId, year]),
    query(`SELECT EXTRACT(MONTH FROM spent_on)::int AS month, SUM(amount) AS total FROM expenses
            WHERE user_id=$1 AND spent_on >= make_date($2,1,1) AND spent_on < make_date($2+1,1,1) GROUP BY 1`, [userId, year]),
    query('SELECT month, amount FROM savings_actual WHERE user_id=$1 AND year=$2', [userId, year]),
    query('SELECT * FROM savings_goals WHERE user_id=$1 ORDER BY sort_order, id', [userId]),
  ]);
  const I = Object.fromEntries(inc.rows.map((r) => [r.month, r.total]));
  const E = Object.fromEntries(exp.rows.map((r) => [r.month, r.total]));
  const A = Object.fromEntries(act.rows.map((r) => [r.month, r.amount]));

  let cumulative = 0;
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const income = I[m] || 0, expenses = E[m] || 0, actual = A[m] || 0;
    const target = round2(income * settings.savings_target_pct);
    cumulative = round2(cumulative + actual);
    const active = expenses !== 0 || actual !== 0;
    months.push({
      month: m, income, expenses, target, actual, diff: round2(actual - target), cumulative,
      remaining: active ? round2(income - expenses - actual) : 0,
      status: !active ? 'none' : actual >= target ? 'met' : 'below',
    });
  }
  const sum = (k) => round2(months.reduce((s, r) => s + r[k], 0));
  const totals = {
    income: sum('income'), expenses: sum('expenses'), target: sum('target'), actual: sum('actual'),
    diff: sum('diff'), cumulative, remaining: sum('remaining'),
  };

  const goals = goalsRes.rows.map((g) => {
    const remaining = Math.max(0, round2(g.target_amount - g.saved_so_far));
    const pct = g.target_amount ? Math.min(1, g.saved_so_far / g.target_amount) : null;
    const monthsToGo = remaining === 0 ? 0 : g.monthly_contribution === 0 ? null : Math.ceil(remaining / g.monthly_contribution);
    const status = g.target_amount === 0 ? 'none' : remaining === 0 ? 'done' : pct >= 0.5 ? 'on_track' : 'building';
    return { id: g.id, name: g.name, target: g.target_amount, saved: g.saved_so_far,
      monthly: g.monthly_contribution, remaining, pct, monthsToGo, status };
  });
  const gt = {
    target: round2(goals.reduce((s, g) => s + g.target, 0)),
    saved: round2(goals.reduce((s, g) => s + g.saved, 0)),
    monthly: round2(goals.reduce((s, g) => s + g.monthly, 0)),
    remaining: round2(goals.reduce((s, g) => s + g.remaining, 0)),
  };
  gt.pct = gt.target ? gt.saved / gt.target : 0;
  const monthlyTarget = round2(settings.monthly_salary * settings.savings_target_pct);

  return {
    year, months, totals, goals, goalTotals: gt,
    plan: { monthlyTarget, contributions: gt.monthly, difference: round2(monthlyTarget - gt.monthly) },
  };
}

module.exports = { getSettings, dashboard, weekDetail, savingsReport, monthStart, nextMonthStart, budgetStatus };
