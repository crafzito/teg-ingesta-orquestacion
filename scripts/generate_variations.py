#!/usr/bin/env python3
"""
generate_variations.py — Genera copias modificadas de los CSV para testear el ETL

Crea una carpeta con los mismos archivos de data/input pero con variaciones:
  - Filas existentes con montos modificados (+/- aleatorio)
  - Filas nuevas sintéticas (facturas nuevas, nuevos clientes, etc.)
  - Algunas filas eliminadas (simula cierre de periodo)
  - Fechas actualizadas al mes actual

Uso:
    python scripts/generate_variations.py                     # genera en data/input_v2
    python scripts/generate_variations.py --output data/test  # carpeta custom
    python scripts/generate_variations.py --seed 42           # reproducible

Luego ejecutar el ETL contra la nueva carpeta:
    cd etl && python pipeline.py --dir ../data/input_v2
"""

import argparse
import csv
import os
import random
import re
import shutil
import sys
from datetime import date, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "data" / "input"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "input_v2"


def read_csv_raw(filepath: Path, encoding="latin-1", delimiter=";"):
    """Lee un CSV y retorna (headers, rows) sin transformar."""
    with open(filepath, encoding=encoding, errors="replace", newline="") as f:
        raw = f.read(3)
        if not raw.startswith("\ufeff"):
            f.seek(0)
        else:
            f.seek(3)
        reader = csv.reader(f, delimiter=delimiter)
        headers = next(reader)
        rows = list(reader)
    return headers, rows


def write_csv_raw(filepath: Path, headers: list, rows: list, encoding="latin-1", delimiter=";"):
    """Escribe un CSV con los headers y rows dados."""
    with open(filepath, "w", encoding=encoding, errors="replace", newline="") as f:
        writer = csv.writer(f, delimiter=delimiter)
        writer.writerow(headers)
        writer.writerows(rows)


def find_col(headers: list, name: str) -> int:
    """Busca una columna por nombre (case-insensitive, strip)."""
    name_lower = name.strip().lower()
    for i, h in enumerate(headers):
        if h.strip().lower() == name_lower:
            return i
    return -1


def vary_european_number(value: str, pct_range: float = 0.15) -> str:
    """Varía un número en formato europeo (141.112,60) por +/- pct_range."""
    if not value or not value.strip():
        return value
    v = value.strip()
    negative = v.startswith("-")
    if negative:
        v = v[1:]

    has_dot = "." in v
    has_comma = "," in v

    try:
        if has_comma and has_dot:
            num = float(v.replace(".", "").replace(",", "."))
        elif has_comma:
            num = float(v.replace(",", "."))
        else:
            num = float(v)
    except ValueError:
        return value

    if negative:
        num = -num

    # Variar por +/- pct_range
    factor = 1 + random.uniform(-pct_range, pct_range)
    num = num * factor

    # Reconstruir en formato original
    if has_comma and has_dot:
        # Formato europeo: 141.112,60
        sign = "-" if num < 0 else ""
        abs_num = abs(num)
        integer_part = int(abs_num)
        decimal_part = abs_num - integer_part
        int_str = f"{integer_part:,}".replace(",", ".")
        dec_str = f"{decimal_part:.2f}"[1:].replace(".", ",")
        return f"{sign}{int_str}{dec_str}"
    elif has_comma:
        return f"{num:,.2f}".replace(",", "X").replace(".", ",").replace("X", "")
    else:
        return f"{num:.2f}"


def vary_date_forward(value: str, days_range: int = 30) -> str:
    """Adelanta una fecha SAP por 0-days_range días."""
    if not value or not value.strip():
        return value
    v = value.strip()

    # Formato YYYYMMDD
    if re.match(r"^\d{8}$", v):
        try:
            y, m, d = int(v[:4]), int(v[4:6]), int(v[6:8])
            dt = date(y, m, d) + timedelta(days=random.randint(0, days_range))
            return dt.strftime("%Y%m%d")
        except ValueError:
            return v

    # Formato DD.MM.YYYY
    if re.match(r"^\d{2}\.\d{2}\.\d{4}$", v):
        try:
            d, m, y = int(v[:2]), int(v[3:5]), int(v[6:10])
            dt = date(y, m, d) + timedelta(days=random.randint(0, days_range))
            return dt.strftime("%d.%m.%Y")
        except ValueError:
            return v

    # Formato DD/MM/YYYY
    if re.match(r"^\d{2}/\d{2}/\d{4}$", v):
        try:
            d, m, y = int(v[:2]), int(v[3:5]), int(v[6:10])
            dt = date(y, m, d) + timedelta(days=random.randint(0, days_range))
            return dt.strftime("%d/%m/%Y")
        except ValueError:
            return v

    return v


def make_new_factura_num(existing: str) -> str:
    """Genera un número de factura nuevo basado en uno existente."""
    if not existing:
        return "9999999999"
    v = existing.strip()
    if v.isdigit():
        return str(int(v) + random.randint(100000, 999999))
    return v + "_NEW"


# ── Variadores por tipo de archivo ────────────────────────────────

def vary_phxx(headers, rows, rng):
    """Ventas: variar montos, agregar filas nuevas, quitar algunas."""
    money_cols = []
    for name in ["Monto Neto", "IVA", "Importe Final", "Prec.Unitario",
                  "Monto Neto 2", "IVA 2", "Importe Final 2", "Prec.Unitario 2"]:
        idx = find_col(headers, name)
        if idx >= 0:
            money_cols.append(idx)

    date_cols = []
    for name in ["Fecha.Doc", "Fec.Venc."]:
        idx = find_col(headers, name)
        if idx >= 0:
            date_cols.append(idx)

    qty_cols = []
    for name in ["Cantidad UMV", "Cantidad UMB"]:
        idx = find_col(headers, name)
        if idx >= 0:
            qty_cols.append(idx)

    factura_col = find_col(headers, "Num.Factura")

    new_rows = []
    for row in rows:
        action = rng.random()
        if action < 0.03:
            # 3% de filas se eliminan (simula cierre de periodo)
            continue
        elif action < 0.15:
            # 12% de filas tienen montos modificados
            row = list(row)
            for idx in money_cols:
                if idx < len(row):
                    row[idx] = vary_european_number(row[idx], 0.20)
            for idx in qty_cols:
                if idx < len(row):
                    row[idx] = vary_european_number(row[idx], 0.10)
            new_rows.append(row)
        else:
            new_rows.append(row)

    # Agregar ~5% de filas nuevas (copias con factura diferente + fecha adelantada)
    n_new = max(1, len(rows) // 20)
    sample_rows = rng.sample(rows, min(n_new, len(rows)))
    for template in sample_rows:
        new_row = list(template)
        if factura_col >= 0 and factura_col < len(new_row):
            new_row[factura_col] = make_new_factura_num(new_row[factura_col])
        for idx in date_cols:
            if idx < len(new_row):
                new_row[idx] = vary_date_forward(new_row[idx], 30)
        for idx in money_cols:
            if idx < len(new_row):
                new_row[idx] = vary_european_number(new_row[idx], 0.30)
        new_rows.append(new_row)

    return headers, new_rows


def vary_avph(headers, rows, rng):
    """CxC: variar valores monetarios, quitar/agregar partidas."""
    money_cols = []
    for name in ["Valor monetario", "Importe en ML", "Importe en MD",
                  "No Vencido"]:
        idx = find_col(headers, name)
        if idx >= 0:
            money_cols.append(idx)

    new_rows = []
    for row in rows:
        action = rng.random()
        if action < 0.02:
            continue  # 2% eliminadas
        elif action < 0.10:
            row = list(row)
            for idx in money_cols:
                if idx < len(row):
                    row[idx] = vary_european_number(row[idx], 0.15)
            new_rows.append(row)
        else:
            new_rows.append(row)

    # 3% nuevas
    n_new = max(1, len(rows) // 33)
    for template in rng.sample(rows, min(n_new, len(rows))):
        new_row = list(template)
        for idx in money_cols:
            if idx < len(new_row):
                new_row[idx] = vary_european_number(new_row[idx], 0.25)
        doc_col = find_col(headers, "N\u00b0.Documento")
        if doc_col < 0:
            doc_col = find_col(headers, "N.Documento")
        if doc_col >= 0 and doc_col < len(new_row):
            new_row[doc_col] = make_new_factura_num(new_row[doc_col])
        new_rows.append(new_row)

    return headers, new_rows


def vary_inventory(headers, rows, rng):
    """Inventario: variar cantidades (snapshots se reemplazan completos)."""
    qty_cols = []
    for name in ["Stock Libre Ut.", "Stck B/C", "Stock Tránsito",
                  "Valor_Lut", "Valor_Cal", "Valor_Blo"]:
        idx = find_col(headers, name)
        if idx >= 0:
            qty_cols.append(idx)

    new_rows = []
    for row in rows:
        row = list(row)
        for idx in qty_cols:
            if idx < len(row):
                row[idx] = vary_european_number(row[idx], 0.25)
        new_rows.append(row)

    return headers, new_rows


def vary_ordenes(headers, rows, rng):
    """Ordenes de producción: variar cantidades."""
    qty_cols = []
    for name in ["Cantidad", "Recibido", "Cantidad 2", "Recibido 2"]:
        idx = find_col(headers, name)
        if idx >= 0:
            qty_cols.append(idx)

    new_rows = []
    for row in rows:
        if rng.random() < 0.10:
            row = list(row)
            for idx in qty_cols:
                if idx < len(row):
                    row[idx] = vary_european_number(row[idx], 0.15)
        new_rows.append(row)

    # Agregar nuevas órdenes
    n_new = max(1, len(rows) // 10)
    for template in rng.sample(rows, min(n_new, len(rows))):
        new_row = list(template)
        orden_col = find_col(headers, "Orden")
        if orden_col >= 0 and orden_col < len(new_row):
            new_row[orden_col] = make_new_factura_num(new_row[orden_col])
        for idx in qty_cols:
            if idx < len(new_row):
                new_row[idx] = vary_european_number(new_row[idx], 0.30)
        new_rows.append(new_row)

    return headers, new_rows


def vary_consumos(headers, rows, rng):
    """Consumos: variar cantidades."""
    qty_cols = []
    for name in ["Cantidad Consumo", "Cantidad Consumo 2"]:
        idx = find_col(headers, name)
        if idx >= 0:
            qty_cols.append(idx)

    new_rows = []
    for row in rows:
        if rng.random() < 0.15:
            row = list(row)
            for idx in qty_cols:
                if idx < len(row):
                    row[idx] = vary_european_number(row[idx], 0.20)
        new_rows.append(row)

    return headers, new_rows


def vary_pedidos(headers, rows, rng):
    """Pedidos: variar cantidades y montos."""
    qty_cols = []
    for name in ["Cantidad", "Cant.pdte.", "Pend.factu"]:
        idx = find_col(headers, name)
        if idx >= 0:
            qty_cols.append(idx)

    money_cols = []
    for name in ["Valor neto", "Importe"]:
        idx = find_col(headers, name)
        if idx >= 0:
            money_cols.append(idx)

    new_rows = []
    for row in rows:
        action = rng.random()
        if action < 0.02:
            continue  # 2% eliminadas
        elif action < 0.12:
            row = list(row)
            for idx in qty_cols + money_cols:
                if idx < len(row):
                    row[idx] = vary_european_number(row[idx], 0.20)
            new_rows.append(row)
        else:
            new_rows.append(row)

    return headers, new_rows


def vary_generic(headers, rows, rng):
    """Copiar sin cambios archivos que no necesitan variación."""
    return headers, rows


# ── Mapeo de archivo → variador ──────────────────────────────────

FILE_VARIATORS = {
    "PHXX": vary_phxx,
    "AMXX": vary_phxx,
    "PPXX": vary_phxx,
    "EMPX": vary_phxx,

    "AVPH": vary_avph,
    "AVAM": vary_avph,
    "AVPP": vary_avph,
    "AV_EMPAQUE": vary_avph,
    "AVAC_PH": vary_avph,

    "INVPT_XX": vary_inventory,
    "INVPT_1200": vary_inventory,
    "INVPT_1300": vary_inventory,
    "INVPT_XXGENERAL": vary_inventory,
    "INVMP_XX": vary_inventory,
    "INVMP_1200": vary_inventory,
    "INVMP_1300": vary_inventory,
    "INVENTARIOS": vary_inventory,

    "O_PHXX": vary_ordenes,
    "O_HGXX": vary_ordenes,
    "O_PMXX": vary_ordenes,
    "O_PPXX": vary_ordenes,
    "O_AMXX": vary_ordenes,

    "C_PHXX": vary_consumos,
    "C_HGXX": vary_consumos,
    "C_PPXX": vary_consumos,
    "C_AMXX": vary_consumos,

    "N_PHXX": vary_generic,
    "N_PPXX": vary_generic,
    "N_AMXX": vary_generic,

    "PEDIDOS20": vary_pedidos,
    "PEDIDOSFULL20": vary_pedidos,

    "NEXFAC20": vary_generic,
    "PRECIOS": vary_generic,
    "CLIENTES": vary_generic,
    "CLIENTES_AMP": vary_generic,
    "CLIENTES_PET": vary_generic,
}


def get_variator(filename: str):
    """Busca el variador correcto para un archivo."""
    stem = Path(filename).stem.upper()
    # Intentar match exacto
    if stem in FILE_VARIATORS:
        return FILE_VARIATORS[stem]
    # Intentar match parcial (EMPX_11 → EMPX)
    for key, fn in FILE_VARIATORS.items():
        if stem.startswith(key):
            return fn
    return vary_generic


def main():
    parser = argparse.ArgumentParser(description="Genera variaciones de CSV para testing ETL")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Carpeta origen (default: data/input)")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Carpeta destino (default: data/input_v2)")
    parser.add_argument("--seed", type=int, default=None, help="Seed para reproducibilidad")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)

    if not input_dir.exists():
        print(f"ERROR: Carpeta origen no existe: {input_dir}")
        sys.exit(1)

    rng = random.Random(args.seed)

    # Crear carpeta destino limpia
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)

    csv_files = sorted(input_dir.glob("*.CSV"))
    if not csv_files:
        print(f"No se encontraron archivos CSV en {input_dir}")
        sys.exit(1)

    print(f"{'=' * 60}")
    print(f"Generando variaciones de datos")
    print(f"  Origen:  {input_dir}")
    print(f"  Destino: {output_dir}")
    print(f"  Archivos: {len(csv_files)}")
    print(f"  Seed: {args.seed or 'random'}")
    print(f"{'=' * 60}")

    total_original = 0
    total_varied = 0

    for csv_file in csv_files:
        try:
            headers, rows = read_csv_raw(csv_file)
        except Exception as e:
            print(f"  SKIP {csv_file.name}: {e}")
            # Copiar sin cambios
            shutil.copy2(csv_file, output_dir / csv_file.name)
            continue

        variator = get_variator(csv_file.name)
        new_headers, new_rows = variator(headers, rows, rng)

        write_csv_raw(output_dir / csv_file.name, new_headers, new_rows)

        diff = len(new_rows) - len(rows)
        sign = "+" if diff > 0 else ""
        total_original += len(rows)
        total_varied += len(new_rows)

        label = variator.__name__
        print(f"  {csv_file.name:<30} {len(rows):>6} -> {len(new_rows):>6} ({sign}{diff}) [{label}]")

    print(f"{'=' * 60}")
    print(f"Total: {total_original} -> {total_varied} filas ({total_varied - total_original:+d})")
    print(f"Carpeta lista: {output_dir}")
    print()
    print("Para procesar con el ETL:")
    print(f"  cd etl && python pipeline.py --dir \"{output_dir}\"")


if __name__ == "__main__":
    main()
