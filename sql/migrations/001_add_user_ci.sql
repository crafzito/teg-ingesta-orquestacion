-- ============================================================
-- 001_add_user_ci.sql
-- Agrega columna ci (cedula de identidad) a auth.users
-- Idempotente: usa IF NOT EXISTS.
-- ============================================================

ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS ci VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_users_ci ON auth.users(ci) WHERE ci IS NOT NULL;
