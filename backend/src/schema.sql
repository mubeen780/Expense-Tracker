-- Idempotent schema: safe to run on every start.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  user_id            INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_salary     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_salary >= 0),
  warn_threshold     NUMERIC(5,4)  NOT NULL DEFAULT 0.85 CHECK (warn_threshold > 0 AND warn_threshold <= 1),
  savings_target_pct NUMERIC(5,4)  NOT NULL DEFAULT 0.15 CHECK (savings_target_pct >= 0 AND savings_target_pct <= 1),
  need_guideline     NUMERIC(5,4)  NOT NULL DEFAULT 0.50 CHECK (need_guideline >= 0 AND need_guideline <= 1),
  want_guideline     NUMERIC(5,4)  NOT NULL DEFAULT 0.30 CHECK (want_guideline >= 0 AND want_guideline <= 1)
);

CREATE TABLE IF NOT EXISTS categories (
  id             SERIAL PRIMARY KEY,
  user_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('Need','Want')),
  monthly_budget NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_budget >= 0),
  notes          TEXT NOT NULL DEFAULT '',
  sort_order     INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS expenses (
  id                SERIAL PRIMARY KEY,
  user_id           INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spent_on          DATE NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  category_id       INT REFERENCES categories(id) ON DELETE SET NULL,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  payment_method_id INT REFERENCES payment_methods(id) ON DELETE SET NULL,
  need_want         TEXT CHECK (need_want IN ('Need','Want')),
  kind              TEXT NOT NULL DEFAULT 'Regular' CHECK (kind IN ('Regular','Unexpected')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_user_date_idx ON expenses (user_id, spent_on);

CREATE TABLE IF NOT EXISTS income (
  id      SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year    INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month   INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  source  TEXT NOT NULL,
  amount  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  UNIQUE (user_id, year, month, source)
);

CREATE TABLE IF NOT EXISTS savings_actual (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year    INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month   INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  PRIMARY KEY (user_id, year, month)
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id                   SERIAL PRIMARY KEY,
  user_id              INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  target_amount        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  saved_so_far         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (saved_so_far >= 0),
  monthly_contribution NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_contribution >= 0),
  sort_order           INT NOT NULL DEFAULT 0
);
