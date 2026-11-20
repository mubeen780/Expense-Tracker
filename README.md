# 💰 Expense & Savings Tracker (PKR)

A full-stack web version of your `Expense_Savings_Tracker_PKR.xlsx` workbook — same Dashboard, Expenses, Income,
Budget, Weekly and Savings logic, but with a real database, multi-user login, and charts.

| Layer    | Tech                                              |
|----------|---------------------------------------------------|
| Frontend | React 18 + Vite + Recharts, served by nginx       |
| Backend  | Node 20 + Express (REST API, JWT auth)            |
| Database | PostgreSQL 16 (data persisted in a Docker volume) |

## Run it (only Docker required)

```bash
cd expense-tracker
cp .env.example .env        # optional but recommended: set JWT_SECRET (openssl rand -hex 32)
docker compose up --build
```

Open **http://localhost:3000**

* Demo login: `demo@example.com` / `demo12345` (sample November 2026 data, from your workbook's sample rows)
* Or click **Create an account** for a clean account (categories & payment methods from your workbook are pre-loaded, budgets at 0).
* Set `SEED_DEMO=false` in `.env` to skip the demo account.

Stop: `Ctrl+C` (or `docker compose down`). Your data stays in the `pgdata` volume.
Wipe everything: `docker compose down -v`.

## Pages (mapped from your workbook sheets)

| Page      | Workbook sheet | What it does |
|-----------|----------------|--------------|
| Dashboard | Dashboard      | Month/year picker, KPI cards, over-budget banner, Budget vs Actual by category (status: On track / Near limit / Over), weekly spending, Need vs Want (50/30/20), payment methods, charts |
| Expenses  | Expenses       | Add/edit/delete, search & filters, month or whole-year view, pagination, CSV export. Week is derived from the date (days 1–7 = Week 1 …) |
| Income    | Income         | Sources × 12 months grid (edit inline), totals, average, "fill salary into all months" |
| Budget    | Budget + settings | Categories (Need/Want, monthly budget, notes), salary, warning threshold (85%), savings target (15%), 50/30 guidelines, unallocated amount |
| Weekly    | Weekly         | Week 1–5 summary and per-week category detail with budget share |
| Savings   | Savings        | Monthly target vs actual saved, cumulative, remaining balance, savings goals (Kametti, Laptop, Umrah …) |
| Settings  | Lists          | Payment methods (add / rename / delete) |

## Good to know

* **Sample numbers are assumptions.** In your uploaded workbook every sample expense amount and every category budget was `0`,
  so the demo account uses illustrative amounts and budgets (they sum to salary − 15% savings = PKR 59,500).
  Edit them on the Budget page or create a fresh account.
* **Categories are now data, not a fixed list.** The workbook's sample rows used categories that weren't in its Budget sheet
  (Groceries, Utilities…), so they never showed on the Dashboard. Here every category you create is tracked; expenses with no
  category show as "Uncategorised".
* `Medical & Health` was typed `No Need` in the workbook (not a valid Need/Want choice); it is `Need` here — change it on the Budget page.
* Deleting a category / payment method keeps the expenses (they become Uncategorised / Not specified).
* Each account's data is private (every query is scoped to the logged-in user).

## Useful commands

```bash
docker compose logs -f backend                      # API logs
docker compose exec db psql -U expense expense_tracker   # SQL shell
docker compose exec db pg_dump -U expense expense_tracker > backup.sql        # backup
docker compose exec -T db psql -U expense expense_tracker < backup.sql        # restore
```
Direct DB access from your PC: `localhost:5433` (user/password from `.env`). API: `http://localhost:4000/api/health`.

## Development without Docker

```bash
# 1) database
docker run -d --name pg -e POSTGRES_USER=expense -e POSTGRES_PASSWORD=expense -e POSTGRES_DB=expense_tracker -p 5432:5432 postgres:16-alpine
# 2) backend  (http://localhost:4000)
cd backend && npm install && SEED_DEMO=true npm run dev
# 3) frontend (http://localhost:5173, proxies /api to :4000)
cd frontend && npm install && npm run dev
```

## API overview (all under `/api`, Bearer token except auth)

`POST /auth/register|login` · `GET /auth/me` · `GET|PUT /settings` · `GET|POST|PUT|DELETE /categories` ·
`/payment-methods` · `GET|POST|PUT|DELETE /expenses` (+ `GET /expenses/export.csv`; filters: year, month, category_id,
payment_method_id, kind, need_want, week, q, limit, offset) · `GET|PUT /income?year=` · `POST /income/fill-salary` ·
`GET /savings?year=` · `PUT /savings/actual` · `POST|PUT|DELETE /savings/goals` ·
`GET /dashboard?year=&month=` · `GET /weekly?year=&month=&week=` · `GET /health`

## Troubleshooting

* **Port already in use** → change `APP_PORT` / `API_PORT` / `DB_PORT` in `.env`.
* **Backend can't reach DB on first start** → it retries for ~60 s automatically.
* **Changed DB password after first run** → the old value is stored in the volume; run `docker compose down -v` (deletes data) or change it inside Postgres.
* Before exposing this beyond your own machine: set a strong `JWT_SECRET` and `POSTGRES_PASSWORD`, and put HTTPS in front.
