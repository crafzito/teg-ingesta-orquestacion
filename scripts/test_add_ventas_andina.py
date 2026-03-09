#!/usr/bin/env python3
"""
Script de prueba: Inserta ventas ficticias en Zona Andina por ~20K USD
y refresca las vistas materializadas para verificar que Looker se actualiza.

Uso:
    python scripts/test_add_ventas_andina.py          # insertar
    python scripts/test_add_ventas_andina.py --undo   # revertir (borrar filas de prueba)
"""
import argparse
import hashlib
import random
import time
import psycopg2

DSN = "host=localhost dbname=sap_etl user=postgres password=postgres"
TEST_BATCH = "TEST-ANDINA-20K"

# Datos reales de Zona Andina para que los JOINs funcionen
CLIENTES = ["0010000099", "0010000184", "0010000649", "0010001346", "0010002670"]
PRODUCTOS = ["50000010", "50000106", "50000373", "50000443", "50000495", "50000532"]
VENDEDORES = ["00100017", "00100023", "00100026"]

MATERIALIZED_VIEWS = [
    "public.v_ventas",
    "public.v_cxc",
    "public.v_cxp",
    "public.v_inventario",
    "public.v_ordenes",
    "public.v_pedidos",
]


def insert_test_ventas():
    conn = psycopg2.connect(DSN)
    conn.autocommit = False

    target_usd = 20_000.0
    accumulated = 0.0
    rows = []
    i = 0

    while accumulated < target_usd:
        i += 1
        monto = round(random.uniform(200, 2000), 2)
        if accumulated + monto > target_usd + 500:
            monto = round(target_usd - accumulated, 2)
        cantidad = round(random.uniform(1, 50), 4)
        precio = round(monto / max(cantidad, 0.01), 4)
        iva = round(monto * 0.16, 2)
        importe = round(monto + iva, 2)
        dia = random.randint(1, 27)

        line_hash = hashlib.md5(f"TEST-ANDINA-{i}".encode()).hexdigest()
        num_factura = f"TEST{9000000 + i}"

        rows.append((
            line_hash,
            TEST_BATCH,
            random.choice(CLIENTES),
            random.choice(PRODUCTOS),
            random.choice(VENDEDORES),
            None,          # cod_condicion_pago
            None,          # cod_sector
            "Venta Directa",
            num_factura,
            "ZF",          # clase_doc
            None,          # referencia
            None,          # pedido_vta
            "3000",        # almacen
            None,          # org_vtas
            "USD",
            "NA",          # status_anulacion
            None, None, None,  # ind_retcl, ind_auto_retcl, cod_mot
            f"2026-02-{dia:02d}",
            None,          # fec_venc
            None,          # fechahora
            2,             # mes
            2026,          # ejercicio
            cantidad,
            "CS",
            None, None,    # cantidad_umb, um_base
            precio,
            monto,
            iva,
            importe,
            1.0,           # tipo_cambio
            precio,        # prec_unitario_usd
            monto,         # monto_neto_usd
            iva,           # iva_usd
            importe,       # importe_final_usd
            round(cantidad * 1.5, 4),  # peso_fact
            "KG",
        ))
        accumulated += monto

    print(f"Insertando {len(rows)} filas de prueba (~${accumulated:,.2f} USD)...")

    cols = (
        "line_hash, batch_id, cod_cliente, codigo_mat, cod_vendedor, "
        "cod_condicion_pago, cod_sector, canal_texto, num_factura, clase_doc, "
        "referencia, pedido_vta, almacen, org_vtas, cod_moneda, status_anulacion, "
        "ind_retcl, ind_auto_retcl, cod_mot, "
        "fecha_doc, fec_venc, fechahora, mes, ejercicio, "
        "cantidad_umv, um_vtas, cantidad_umb, um_base, "
        "prec_unitario, monto_neto, iva, importe_final, "
        "tipo_cambio, prec_unitario_usd, monto_neto_usd, iva_usd, importe_final_usd, "
        "peso_fact, um_peso"
    )
    placeholders = ", ".join(["%s"] * 39)

    with conn.cursor() as cur:
        for row in rows:
            cur.execute(f"INSERT INTO fact.ventas ({cols}) VALUES ({placeholders})", row)

    conn.commit()
    print(f"  {len(rows)} filas insertadas en fact.ventas (batch={TEST_BATCH})")

    # Refrescar vistas materializadas
    print("Refrescando vistas materializadas...")
    conn.autocommit = True
    with conn.cursor() as cur:
        for mv in MATERIALIZED_VIEWS:
            t0 = time.perf_counter()
            cur.execute(f"REFRESH MATERIALIZED VIEW {mv}")
            ms = round((time.perf_counter() - t0) * 1000, 1)
            print(f"  {mv}: {ms}ms")

    # Verificar
    with conn.cursor() as cur:
        cur.execute("SELECT count(*), sum(monto_neto_usd) FROM public.v_ventas WHERE zona_ventas = 'Zona Andina'")
        cnt, total = cur.fetchone()
        print(f"\nZona Andina ahora: {cnt} filas, ${total:,.2f} USD")

    conn.close()
    print("Listo! Revisa Looker Studio.")


def undo():
    conn = psycopg2.connect(DSN)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM fact.ventas WHERE batch_id = %s", (TEST_BATCH,))
        deleted = cur.rowcount
    conn.commit()
    print(f"Eliminadas {deleted} filas de prueba")

    # Refrescar
    print("Refrescando vistas materializadas...")
    conn.autocommit = True
    with conn.cursor() as cur:
        for mv in MATERIALIZED_VIEWS:
            cur.execute(f"REFRESH MATERIALIZED VIEW {mv}")

    with conn.cursor() as cur:
        cur.execute("SELECT count(*), coalesce(sum(monto_neto_usd),0) FROM public.v_ventas WHERE zona_ventas = 'Zona Andina'")
        cnt, total = cur.fetchone()
        print(f"Zona Andina restaurada: {cnt} filas, ${total:,.2f} USD")

    conn.close()
    print("Revertido!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--undo", action="store_true", help="Revertir: borrar filas de prueba")
    args = parser.parse_args()

    if args.undo:
        undo()
    else:
        insert_test_ventas()
