-- Migration 0006: Add trial fields to subscriptions table
-- Supports 7-day Pro free trial (once per account lifetime)

ALTER TABLE subscriptions ADD COLUMN trial_started_at TEXT;
ALTER TABLE subscriptions ADD COLUMN trial_used INTEGER NOT NULL DEFAULT 0;
