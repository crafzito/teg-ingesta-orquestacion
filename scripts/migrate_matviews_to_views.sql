-- ============================================================
-- Migración: Convertir vistas materializadas a vistas regulares
-- ============================================================
-- Las v_* en public fueron creadas como MATERIALIZED VIEW,
-- pero Looker Studio (JDBC) no las lista en su explorador.
-- Este script las convierte a vistas regulares para que
-- Looker Studio las vea automáticamente.
--
-- Ejecutar con: psql -U postgres -d sap_etl -f scripts/migrate_matviews_to_views.sql
-- ============================================================

BEGIN;

-- 1. Eliminar las vistas materializadas
DROP MATERIALIZED VIEW IF EXISTS public.v_ventas     CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.v_cxc        CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.v_cxp        CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.v_inventario CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.v_ordenes    CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.v_pedidos    CASCADE;

-- 2. Recrear como vistas regulares (idéntico a schema.sql)
CREATE OR REPLACE VIEW public.v_ventas      AS SELECT * FROM reporting.v_ventas;
CREATE OR REPLACE VIEW public.v_cxc         AS SELECT * FROM reporting.v_cxc;
CREATE OR REPLACE VIEW public.v_cxp         AS SELECT * FROM reporting.v_cxp;
CREATE OR REPLACE VIEW public.v_inventario  AS SELECT * FROM reporting.v_inventario;
CREATE OR REPLACE VIEW public.v_ordenes     AS SELECT * FROM reporting.v_ordenes;
CREATE OR REPLACE VIEW public.v_pedidos     AS SELECT * FROM reporting.v_pedidos;

COMMIT;

-- Verificar: debe mostrar 31 filas
SELECT COUNT(*) AS total_views FROM pg_views WHERE schemaname = 'public';
