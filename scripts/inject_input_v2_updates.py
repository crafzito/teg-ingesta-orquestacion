#!/usr/bin/env python3
"""
Inject deterministic updates into every CSV under data/input_v2.

The goal is to modify existing files in place, preserving SAP-style headers
and delimiters so the ETL can still read them, while changing enough values to
produce new hashes and new/updated rows for testing.
"""

from __future__ import annotations

import csv
import re
import shutil
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TARGET_DIR = PROJECT_ROOT / "data" / "input_v2"
BACKUP_ROOT = PROJECT_ROOT / ".runtime" / "backups"
ANCHOR_DATE = date(2026, 3, 13)

DATE_YYYYMMDD = re.compile(r"^\d{8}$")
DATE_DOTS = re.compile(r"^\d{2}\.\d{2}\.\d{4}$")
DATE_SLASH = re.compile(r"^\d{2}/\d{2}/\d{4}$")
STAMP_DOTS = re.compile(r"^\d{2}\.\d{2}\.\d{4}\s*-\s*\d{2}:\d{2}:\d{2}$")
STAMP_ISOISH = re.compile(r"^\d{2}\.\d{2}\.\d{4}\s+-\s+\d{2}:\d{2}:\d{2}$")
HORA_SIX = re.compile(r"^\d{6}$")


@dataclass(frozen=True)
class MutationSummary:
    filename: str
    row_count_before: int
    row_count_after: int
    rows_touched: int
    created_row: bool


def normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_text.strip().lower()


def format_date_like(value: str) -> str:
    raw = value.strip()
    if DATE_YYYYMMDD.fullmatch(raw):
        return ANCHOR_DATE.strftime("%Y%m%d")
    if DATE_DOTS.fullmatch(raw):
        return ANCHOR_DATE.strftime("%d.%m.%Y")
    if DATE_SLASH.fullmatch(raw):
        return ANCHOR_DATE.strftime("%d/%m/%Y")
    if STAMP_DOTS.fullmatch(raw) or STAMP_ISOISH.fullmatch(raw):
        return f"{ANCHOR_DATE.strftime('%d.%m.%Y')} - 08:15:00"
    if HORA_SIX.fullmatch(raw):
        return "081500"
    return raw


def parse_european_number(value: str) -> tuple[float, int] | None:
    raw = value.strip()
    if not raw:
        return None

    negative = raw.startswith("-")
    if negative:
        raw = raw[1:]

    decimals = 0
    if "," in raw:
        decimals = len(raw.split(",")[-1])

    try:
        if "." in raw and "," in raw:
            number = float(raw.replace(".", "").replace(",", "."))
        elif "," in raw:
            number = float(raw.replace(",", "."))
        else:
            number = float(raw)
    except ValueError:
        return None

    if negative:
        number *= -1

    return number, decimals


def format_european_number(number: float, decimals: int) -> str:
    decimals = max(decimals, 0)
    sign = "-" if number < 0 else ""
    absolute = abs(number)
    fmt = f"{{:,.{decimals}f}}".format(absolute)
    return sign + fmt.replace(",", "X").replace(".", ",").replace("X", ".")


def bump_numeric(value: str, file_index: int, row_index: int) -> str:
    parsed = parse_european_number(value)
    if parsed is None:
        return value

    number, decimals = parsed
    step = 1 + ((file_index + row_index) % 5 + 1) * 0.03
    bumped = number * step
    return format_european_number(bumped, max(decimals, 2 if "," in value else decimals))


def is_date_column(header_norm: str) -> bool:
    date_tokens = ("fecha", "fec", "venc", "creacion", "valido", "vigente")
    return any(token in header_norm for token in date_tokens)


def is_time_column(header_norm: str) -> bool:
    return "hora" in header_norm


def is_identifier_column(header_norm: str) -> bool:
    identifier_tokens = (
        "cod",
        "codigo",
        "cliente",
        "material",
        "factura",
        "pedido",
        "orden",
        "doc.",
        "docu",
        "doc_",
        "vendedor",
        "vend",
        "referencia",
        "orgvt",
        "orgvtas",
        "sociedad",
        "centro",
        "almacen",
        "clcd",
        "ruta",
    )
    return any(token in header_norm for token in identifier_tokens)


def is_metric_column(header_norm: str) -> bool:
    metric_tokens = (
        "cantidad",
        "cant",
        "importe",
        "monto",
        "valor",
        "iva",
        "precio",
        "prec",
        "peso",
        "libre",
        "calidad",
        "bloqueado",
        "neto",
        "recib",
        "stock",
        "confi",
        "pend",
        "cambio",
        "por_vencer",
        "venc_",
    )
    return any(token in header_norm for token in metric_tokens)


def is_text_column(header_norm: str) -> bool:
    text_tokens = ("texto", "descripcion", "denominacion", "nombre", "motivo")
    return any(token in header_norm for token in text_tokens)


def mutate_cell(header: str, value: str, file_index: int, row_index: int) -> str:
    header_norm = normalize(header)
    raw = value.strip()
    is_date_like_value = bool(
        raw
        and (
            DATE_YYYYMMDD.fullmatch(raw)
            or DATE_DOTS.fullmatch(raw)
            or DATE_SLASH.fullmatch(raw)
        )
    )
    is_time_like_value = bool(
        raw
        and (
            STAMP_DOTS.fullmatch(raw)
            or STAMP_ISOISH.fullmatch(raw)
            or HORA_SIX.fullmatch(raw)
        )
    )

    if is_date_like_value and is_date_column(header_norm):
        return format_date_like(raw)

    if is_time_like_value and (is_date_column(header_norm) or is_time_column(header_norm)):
        return format_date_like(raw)

    if raw and is_metric_column(header_norm):
        return bump_numeric(raw, file_index, row_index)

    if is_date_column(header_norm):
        if raw and raw not in {"00.00.0000", "00000000"}:
            return format_date_like(raw)
        return ANCHOR_DATE.strftime("%d.%m.%Y")

    if is_time_column(header_norm):
        if raw and raw not in {"00.00.0000 - 00:00:00", "000000"}:
            return format_date_like(raw)
        return "081500"

    if is_text_column(header_norm) and raw and len(raw) < 80:
        return f"{raw} ACT 13-03"

    return value


def choose_fallback_column(headers: list[str], row: list[str]) -> int:
    normalized_headers = [normalize(header) for header in headers]

    for index, (header_norm, cell) in enumerate(zip(normalized_headers, row)):
        if cell.strip() and is_text_column(header_norm):
            return index

    for index, (header_norm, cell) in enumerate(zip(normalized_headers, row)):
        if cell.strip() and not is_identifier_column(header_norm):
            return index

    for index, cell in enumerate(row):
        if cell.strip():
            return index

    return 0


def build_synthetic_row(headers: list[str]) -> list[str]:
    row: list[str] = []
    for header in headers:
        header_norm = normalize(header)

        if "material" in header_norm or "codigo_mat" in header_norm:
            row.append("50001024")
        elif "cliente" in header_norm and "nombre" not in header_norm:
            row.append("10000000")
        elif "sociedad" in header_norm or "orgvt" in header_norm or "orgvtas" in header_norm or header_norm == "clcd":
            row.append("1000")
        elif header_norm == "lp" or "lista" in header_norm:
            row.append("17")
        elif "fecha" in header_norm or "fec" in header_norm or "venc" in header_norm or "valido" in header_norm:
            row.append(ANCHOR_DATE.strftime("%Y%m%d") if "de" not in header_norm else ANCHOR_DATE.strftime("%d.%m.%Y"))
        elif "hora" in header_norm:
            row.append("081500")
        elif "importe" in header_norm or "valor" in header_norm or "precio" in header_norm:
            row.append("125,00")
        elif "cantidad" in header_norm or "cant" in header_norm or "por" == header_norm:
            row.append("1,000")
        elif header_norm in {"um", "cb", "un"}:
            row.append("UN")
        elif "texto" in header_norm or "descripcion" in header_norm or "denominacion" in header_norm:
            row.append("ACTUALIZADO 13-03-2026")
        else:
            row.append("")
    return row


def read_csv(path: Path) -> tuple[list[str], list[list[str]]]:
    with path.open("r", encoding="latin-1", errors="replace", newline="") as handle:
        raw = handle.read(3)
        if not raw.startswith("\ufeff"):
            handle.seek(0)
        else:
            handle.seek(3)

        reader = csv.reader(handle, delimiter=";")
        headers = next(reader, [])
        rows = list(reader)
    return headers, rows


def write_csv(path: Path, headers: list[str], rows: list[list[str]]) -> None:
    with path.open("w", encoding="latin-1", errors="replace", newline="") as handle:
        writer = csv.writer(handle, delimiter=";")
        writer.writerow(headers)
        writer.writerows(rows)


def mutate_file(path: Path, file_index: int) -> MutationSummary:
    headers, rows = read_csv(path)
    if not headers:
        return MutationSummary(path.name, 0, 0, 0, False)

    created_row = False
    rows_touched = 0
    original_count = len(rows)

    if not rows:
        rows.append(build_synthetic_row(headers))
        created_row = True

    for row_index, row in enumerate(rows[:2]):
        changed = False
        target = list(row)
        for column_index, header in enumerate(headers):
            if column_index >= len(target):
                target.append("")
            new_value = mutate_cell(header, target[column_index], file_index, row_index)
            if new_value != target[column_index]:
                target[column_index] = new_value
                changed = True

        if not changed:
            fallback_index = choose_fallback_column(headers, target)
            target[fallback_index] = f"{target[fallback_index].strip()} ACT 13-03".strip()
            changed = True

        rows[row_index] = target
        if changed:
            rows_touched += 1

    write_csv(path, headers, rows)
    return MutationSummary(path.name, original_count, len(rows), rows_touched, created_row)


def make_backup(target_dir: Path) -> Path:
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    backup_dir = BACKUP_ROOT / f"input_v2-before-inject-{ANCHOR_DATE.strftime('%Y%m%d')}"
    if backup_dir.exists():
        shutil.rmtree(backup_dir)
    shutil.copytree(target_dir, backup_dir)
    return backup_dir


def main() -> None:
    if not TARGET_DIR.exists():
        raise SystemExit(f"No existe la carpeta objetivo: {TARGET_DIR}")

    backup_dir = make_backup(TARGET_DIR)
    csv_files = sorted(TARGET_DIR.glob("*.CSV"))
    if not csv_files:
        raise SystemExit(f"No se encontraron CSV en {TARGET_DIR}")

    print("=" * 70)
    print(f"Inyectando cambios sobre {TARGET_DIR}")
    print(f"Fecha ancla: {ANCHOR_DATE.isoformat()}")
    print(f"Backup:      {backup_dir}")
    print(f"Archivos:    {len(csv_files)}")
    print("=" * 70)

    summaries: list[MutationSummary] = []
    for index, csv_path in enumerate(csv_files):
        summary = mutate_file(csv_path, index)
        summaries.append(summary)
        suffix = " +row" if summary.created_row else ""
        print(
            f"{summary.filename:<30} "
            f"{summary.row_count_before:>6} -> {summary.row_count_after:>6} "
            f"touched={summary.rows_touched}{suffix}"
        )

    print("=" * 70)
    print(f"CSV editados: {len(summaries)}")
    print(f"Backup listo: {backup_dir}")


if __name__ == "__main__":
    main()
