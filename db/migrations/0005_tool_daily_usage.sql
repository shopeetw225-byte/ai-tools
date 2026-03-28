-- Tool-specific daily usage tracking for per-tool quotas
-- (e.g. resume-optimize: 2 free/day, within global 10/day limit)

CREATE TABLE IF NOT EXISTS tool_daily_usage (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  UNIQUE(user_id, tool_name, date)
);

CREATE INDEX IF NOT EXISTS idx_tool_daily_usage
  ON tool_daily_usage(user_id, tool_name, date);
