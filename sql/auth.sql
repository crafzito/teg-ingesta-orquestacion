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
  last_login    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_username ON auth.users(username) WHERE active;
