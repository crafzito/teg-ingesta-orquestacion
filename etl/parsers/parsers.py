"""
parsers.py — Funciones de parseo para datos SAP Venezuela

SAP exporta en formatos no estándar:
  - Fechas: '20260106', '06.01.2026', '06/01/2026'
  - Decimales: '141.112,60' (punto=miles, coma=decimal) o '141112.60'
  - Texto: con espacios extra, caracteres raros por latin-1
  - Códigos: con espacios al inicio/final
"""

import re
import hashlib
import unicodedata
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional


# ── FECHAS ────────────────────────────────────────────────────────

_DATE_PATTERNS = [
    (re.compile(r"^(\d{4})(\d{2})(\d{2})$"),            "%Y%m%d"),   # 20260106
    (re.compile(r"^(\d{2})\.(\d{2})\.(\d{4})$"),         "%d.%m.%Y"), # 06.01.2026
    (re.compile(r"^(\d{2})/(\d{2})/(\d{4})$"),           "%d/%m/%Y"), # 06/01/2026
    (re.compile(r"^(\d{4})-(\d{2})-(\d{2})$"),           "%Y-%m-%d"), # 2026-01-06
    (re.compile(r"^(\d{2})-(\d{2})-(\d{4})$"),           "%d-%m-%Y"), # 06-01-2026
]


def parse_date(value: str) -> Optional[date]:
    """Convierte texto SAP a date. Devuelve None si no parsea."""
    if not value:
        return None
    v = value.strip()
    if not v or v in ("0", "00000000", "00.00.0000"):
        return None

    from datetime import datetime
    for pattern, fmt in _DATE_PATTERNS:
        if pattern.match(v):
            try:
                return datetime.strptime(v, fmt).date()
            except ValueError:
                continue
    return None


# ── DECIMALES ─────────────────────────────────────────────────────

def parse_decimal(value: str) -> Optional[Decimal]:
    """
    Convierte texto SAP a Decimal.
    SAP Venezuela usa punto como separador de miles y coma como decimal.
    Ejemplos:
        '141.112,60'  → Decimal('141112.60')
        '141112.60'   → Decimal('141112.60')
        '0,00'        → Decimal('0')
        '-5.000,000'  → Decimal('-5000.000')
    """
    if not value:
        return None
    v = value.strip()
    if not v or v == "-":
        return None

    # Detectar formato europeo: tiene coma y la coma viene DESPUÉS del punto
    # o tiene coma sin punto (0,00)
    has_dot   = "." in v
    has_comma = "," in v

    if has_comma and has_dot:
        # Europeo: 141.112,60 → quitar punto, cambiar coma por punto
        v = v.replace(".", "").replace(",", ".")
    elif has_comma and not has_dot:
        # Solo coma: 0,00 → 0.00
        v = v.replace(",", ".")
    # Si solo tiene punto: ya es formato estándar

    try:
        return Decimal(v)
    except InvalidOperation:
        return None


# ── TEXTO ─────────────────────────────────────────────────────────

def normalize_text(value: str) -> Optional[str]:
    """Limpia texto: strip, espacios múltiples, None si vacío."""
    if not value:
        return None
    v = " ".join(value.strip().split())
    return v if v else None


def normalize_code(value: str) -> Optional[str]:
    """Limpia código SAP: strip + normaliza ceros a la izquierda en códigos numéricos.

    SAP zero-padea los códigos numéricos (ej. KUNNR=0010000748) pero algunos
    exports los entregan sin padding (ej. CLIENTES.CSV=10000748).
    Para que la PK sea consistente, se eliminan los ceros iniciales.
    """
    if not value:
        return None
    v = value.strip()
    if not v:
        return None
    # Si es puramente numérico, quitar ceros a la izquierda
    if v.isdigit():
        v = v.lstrip("0") or "0"
    return v


# ── HASH ──────────────────────────────────────────────────────────

def row_hash(data: dict) -> str:
    """MD5 de un diccionario (para detectar cambios en una fila)."""
    import json
    canonical = json.dumps(
        {k: str(v) if v is not None else "" for k, v in sorted(data.items())},
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.md5(canonical.encode("utf-8")).hexdigest()


def pk_hash(*values) -> str:
    """MD5 de los valores de la PK (para identificar una fila)."""
    canonical = "|".join(str(v).strip() if v is not None else "" for v in values)
    return hashlib.md5(canonical.encode("utf-8")).hexdigest()


def mock_code(text: str) -> str:
    """Genera un código de 8 chars a partir de texto (para cat.sector etc.)."""
    return hashlib.md5(text.strip().upper().encode("utf-8")).hexdigest()[:8].upper()


# ── SNAKE CASE ────────────────────────────────────────────────────

_REPLACEMENTS = str.maketrans({
    "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
    "ñ": "n", "Á": "A", "É": "E", "Í": "I", "Ó": "O",
    "Ú": "U", "Ñ": "N", "ü": "u", "Ü": "U",
    ".": "_", " ": "_", "-": "_", "/": "_",
    "(": "",  ")": "",  "%": "pct", "°": "",
    "¿": "",  "?": "",  "!": "",  "¡": "",
    "#": "num", "@": "at",
})


def to_snake(col: str) -> Optional[str]:
    """
    Convierte nombre de columna SAP a snake_case válido para PostgreSQL.
    Ejemplos:
        'Num.Factura'       → 'num_factura'
        'Fecha.Doc'         → 'fecha_doc'
        'Importe Final'     → 'importe_final'
        'N°.Documento'      → 'n_num_documento'
        'Prec.Unitario.2'   → 'prec_unitario_2'
        '% Var Consumo'     → 'pct_var_consumo'
    """
    if not col or not col.strip():
        return None

    s = col.strip()

    # Columnas que empiezan con número → prefijo
    if re.match(r"^\d", s):
        s = "venc_" + s

    # Reemplazar caracteres especiales
    s = s.translate(_REPLACEMENTS)

    # Limpiar caracteres restantes no alfanuméricos (excepto _)
    s = re.sub(r"[^\w]", "_", s)

    # Colapsar underscores múltiples
    s = re.sub(r"_+", "_", s)

    # Quitar underscores al inicio/final
    s = s.strip("_").lower()

    return s if s else None
