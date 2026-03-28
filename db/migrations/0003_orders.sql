-- Migration 0003: Add orders and payment notifications tables

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  merchant_trade_no TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'failed', 'refunded', 'expired')),
  choose_payment TEXT NOT NULL DEFAULT 'ALL' CHECK(choose_payment IN ('ALL', 'Credit', 'ATM', 'CVS', 'BARCODE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  merchant_trade_no TEXT NOT NULL REFERENCES orders(merchant_trade_no) ON DELETE CASCADE,
  trade_no TEXT,
  rtn_code INTEGER,
  rtn_msg TEXT,
  payment_type TEXT,
  trade_amt INTEGER,
  raw_payload TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_trade_no ON payment_notifications(trade_no);
