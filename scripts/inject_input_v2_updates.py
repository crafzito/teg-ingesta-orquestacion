#!/usr/bin/env python3
"""
Inject deterministic updates into every CSV under data/input_v2.

The goal is to modify existing files in place, preserving SAP-style headers
and delimiters so the ETL can still read them, while changing enough values to
produce new hashes and new/updated rows for testing.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import re
import shutil
import unicodedata
from dataclasses import dataclass
from datetime import date
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TARGET_DIR = PROJECT_ROOT / "data" / "input_v2"
DEFAULT_BACKUP_ROOT = PROJECT_ROOT / ".runtime" / "backups"
ANCHOR_DATE = date(2026, 3, 13)
DEFAULT_MUTATION_TAG = ANCHOR_DATE.strftime("%Y%m%d")
KPI_FILES = {"PHXX.CSV", "PEDIDOS20.CSV", "PEDIDOSFULL20.CSV"}

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
    appended_row: bool


def normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_text.strip().lower()


def fit_like_original(original: str, replacement: str, fallback_max: int = 80) -> str:
    max_len = len(original.strip()) if original and original.strip() else fallback_max
    if max_len <= 0:
        max_len = fallback_max
    return replacement[:max_len]


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


def compute_tag_offset(tag: str) -> int:
    digest = hashlib.sha1(tag.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 11 + 1


def bump_numeric(value: str, file_index: int, row_index: int, tag_offset: int) -> str:
    parsed = parse_european_number(value)
    if parsed is None:
        return value

    number, decimals = parsed
    step = 1 + (((file_index + row_index + tag_offset) % 7) + 1) * 0.025
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


def is_document_key_column(header_norm: str) -> bool:
    document_tokens = (
        "factura",
        "pedido",
        "doc",
        "documento",
        "numero",
        "nro",
        "referencia",
        "sal.mcias",
    )
    protected_tokens = (
        "material",
        "cliente",
        "sociedad",
        "centro",
        "alm",
        "vendedor",
        "gven",
        "lista",
        "canal",
        "zona",
    )
    return any(token in header_norm for token in document_tokens) and not any(
        token in header_norm for token in protected_tokens
    )


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


def unique_identifier(value: str, mutation_tag: str, file_index: int, row_index: int) -> str:
    raw = value.strip()
    tag_digits = "".join(ch for ch in mutation_tag if ch.isdigit()) or str(file_index + row_index + 1)

    if raw.isdigit():
        replacement = (tag_digits * ((len(raw) // len(tag_digits)) + 2))[: len(raw)]
        prefix = raw[: max(0, len(raw) - len(replacement))]
        return (prefix + replacement)[-len(raw):]

    if raw:
        suffix = f"-{mutation_tag[-6:]}"
        candidate = f"{raw}{suffix}"
        if len(candidate) <= len(raw):
            return candidate
        trimmed = f"{raw[: max(1, len(raw) - len(suffix))]}{suffix}"
        return fit_like_original(raw, trimmed, fallback_max=len(raw))

    return mutation_tag[-10:]


def mutate_cell(
    header: str,
    value: str,
    file_index: int,
    row_index: int,
    mutation_tag: str,
    tag_offset: int,
) -> str:
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
        return bump_numeric(raw, file_index, row_index, tag_offset)

    if raw and is_document_key_column(header_norm):
        return unique_identifier(raw, mutation_tag, file_index, row_index)

    if is_date_column(header_norm):
        if raw and raw not in {"00.00.0000", "00000000"}:
            return format_date_like(raw)
        return ANCHOR_DATE.strftime("%d.%m.%Y")

    if is_time_column(header_norm):
        if raw and raw not in {"00.00.0000 - 00:00:00", "000000"}:
            return format_date_like(raw)
        return "081500"

    if is_text_column(header_norm) and raw and len(raw) < 80:
        suffix = f" ACT {mutation_tag[-6:]}"
        base = raw.split(" ACT ")[0].strip()
        candidate = f"{base}{suffix}"
        return fit_like_original(raw, candidate, fallback_max=80)

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


def build_synthetic_row(headers: list[str], mutation_tag: str) -> list[str]:
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
        elif is_document_key_column(header_norm):
            row.append(unique_identifier("", mutation_tag, 0, 0))
        elif "texto" in header_norm or "descripcion" in header_norm or "denominacion" in header_norm:
            row.append(f"ACTUALIZADO {mutation_tag[-6:]}")
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


def append_incremental_row(
    filename: str,
    headers: list[str],
    rows: list[list[str]],
    file_index: int,
    mutation_tag: str,
    tag_offset: int,
) -> bool:
    if filename.upper() not in KPI_FILES:
        return False

    source_row = list(rows[0]) if rows else build_synthetic_row(headers, mutation_tag)
    synthetic = list(source_row)

    for column_index, header in enumerate(headers):
        if column_index >= len(synthetic):
            synthetic.append("")

        current_value = synthetic[column_index]
        header_norm = normalize(header)

        if is_document_key_column(header_norm):
            synthetic[column_index] = unique_identifier(current_value, mutation_tag, file_index, len(rows) + column_index)
        elif is_metric_column(header_norm) and current_value.strip():
            synthetic[column_index] = bump_numeric(current_value, file_index + 5, len(rows) + column_index, tag_offset + 3)
        elif is_date_column(header_norm) and current_value.strip():
            synthetic[column_index] = format_date_like(current_value)
        elif is_text_column(header_norm) and current_value.strip():
            base = current_value.split(" ACT ")[0].strip()
            synthetic[column_index] = fit_like_original(
                current_value,
                f"{base} ACT {mutation_tag[-6:]}",
                fallback_max=80,
            )

    rows.append(synthetic)
    return True


def mutate_file(path: Path, file_index: int, mutation_tag: str) -> MutationSummary:
    headers, rows = read_csv(path)
    if not headers:
        return MutationSummary(path.name, 0, 0, 0, False, False)

    created_row = False
    appended_row = False
    rows_touched = 0
    original_count = len(rows)
    tag_offset = compute_tag_offset(f"{mutation_tag}:{path.name}")

    if not rows:
        rows.append(build_synthetic_row(headers, mutation_tag))
        created_row = True

    for row_index, row in enumerate(rows[:2]):
        changed = False
        target = list(row)
        for column_index, header in enumerate(headers):
            if column_index >= len(target):
                target.append("")
            new_value = mutate_cell(
                header,
                target[column_index],
                file_index,
                row_index,
                mutation_tag,
                tag_offset,
            )
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

    appended_row = append_incremental_row(
        path.name,
        headers,
        rows,
        file_index,
        mutation_tag,
        tag_offset,
    )

    write_csv(path, headers, rows)
    return MutationSummary(path.name, original_count, len(rows), rows_touched, created_row, appended_row)


def make_backup(target_dir: Path, backup_root: Path) -> Path:
    backup_root.mkdir(parents=True, exist_ok=True)
    backup_dir = backup_root / f"{target_dir.name}-before-inject-{ANCHOR_DATE.strftime('%Y%m%d')}"
    if backup_dir.exists():
        shutil.rmtree(backup_dir)
    shutil.copytree(target_dir, backup_dir)
    return backup_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Inyecta cambios determinísticos en un directorio CSV.")
    parser.add_argument("--target-dir", default=str(DEFAULT_TARGET_DIR), help="Directorio objetivo con CSV SAP")
    parser.add_argument("--backup-root", default=str(DEFAULT_BACKUP_ROOT), help="Raíz para backups previos")
    parser.add_argument(
        "--mutation-tag",
        default=DEFAULT_MUTATION_TAG,
        help="Tag para forzar cambios únicos por corrida (ej: 20260412191500)",
    )
    args = parser.parse_args()

    target_dir = Path(args.target_dir).resolve()
    backup_root = Path(args.backup_root).resolve()
    mutation_tag = args.mutation_tag.strip() or DEFAULT_MUTATION_TAG

    if not target_dir.exists():
        raise SystemExit(f"No existe la carpeta objetivo: {target_dir}")

    backup_dir = make_backup(target_dir, backup_root)
    csv_files = sorted(target_dir.rglob("*.CSV"))
    if not csv_files:
        raise SystemExit(f"No se encontraron CSV en {target_dir}")

    print("=" * 70)
    print(f"Inyectando cambios sobre {target_dir}")
    print(f"Fecha ancla: {ANCHOR_DATE.isoformat()}")
    print(f"Mutation tag: {mutation_tag}")
    print(f"Backup:      {backup_dir}")
    print(f"Archivos:    {len(csv_files)}")
    print("=" * 70)

    summaries: list[MutationSummary] = []
    for index, csv_path in enumerate(csv_files):
        summary = mutate_file(csv_path, index, mutation_tag)
        summaries.append(summary)
        flags = []
        if summary.created_row:
            flags.append("seed-row")
        if summary.appended_row:
            flags.append("appended-kpi")
        suffix = f" ({', '.join(flags)})" if flags else ""
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
