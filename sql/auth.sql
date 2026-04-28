-- ============================================================
-- sql/auth.sql
-- Esquema y tabla de usuarios para autenticacion + roles.
-- Aplicar manualmente con: psql -U postgres -d sap_etl -f sql/auth.sql
-- ============================================================

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(150),
  role          VARCHAR(20) NOT NULL CHECK (role IN ('superadmin','admin','analista')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login    TIMESTAMPTZ,
  ci            VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON auth.users(username) WHERE active;

ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS ci VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_users_ci ON auth.users(ci) WHERE ci IS NOT NULL;

-- ============================================================
-- Sidebar configuration per role (JSONB)
-- ============================================================

CREATE TABLE IF NOT EXISTS auth.sidebar_config (
  role TEXT PRIMARY KEY,
  sections JSONB NOT NULL DEFAULT '{}'
);

-- Seed defaults (all sections enabled for all roles)
INSERT INTO auth.sidebar_config (role, sections) VALUES
  ('superadmin', '{"Principal": true, "Finanzas": true, "Operaciones": true, "Maestros": true}'),
  ('admin', '{"Principal": true, "Finanzas": true, "Operaciones": true, "Maestros": true}'),
  ('analista', '{"Principal": true, "Finanzas": true, "Operaciones": true, "Maestros": true}')
ON CONFLICT (role) DO NOTHING;
