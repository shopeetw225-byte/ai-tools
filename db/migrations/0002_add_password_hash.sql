-- Migration 0002: Add password_hash to users

ALTER TABLE users ADD COLUMN password_hash TEXT;
