import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from etl.constants import UNKNOWN


def normalize_text(value: str | None) -> str:
    if value is None:
        return UNKNOWN
    text = value.strip()
    if not text:
        return UNKNOWN
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_text_upper(value: str | None) -> str:
    text = normalize_text(value)
    if text == UNKNOWN:
        return UNKNOWN
    nfkd = unicodedata.normalize("NFKD", text)
    without_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    return without_accents.upper()


def parse_date(value: str | None) -> date | None:
    if not value or not value.strip():
        return None
    text = value.strip()

    # YYYYMMDD (ej: 20250514)
    if re.match(r"^\d{8}$", text):
        return date(int(text[:4]), int(text[4:6]), int(text[6:8]))

    # DD.MM.YYYY (ej: 03.12.2015)
    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", text)
    if m:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))

    # D/M/YYYY (ej: 18/2/2026)
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", text)
    if m:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))

    raise ValueError(f"Formato de fecha no reconocido: '{text}'")


def parse_datetime(value: str | None) -> datetime | None:
    if not value or not value.strip():
        return None
    text = value.strip()

    # DD.MM.YYYY - HH:MM:SS (ej: 02.07.2025 - 08:40:06)
    m = re.match(
        r"^(\d{1,2})\.(\d{1,2})\.(\d{4})\s*-\s*(\d{2}):(\d{2}):(\d{2})$", text
    )
    if m:
        return datetime(
            int(m.group(3)), int(m.group(2)), int(m.group(1)),
            int(m.group(4)), int(m.group(5)), int(m.group(6)),
        )

    raise ValueError(f"Formato de datetime no reconocido: '{text}'")


def parse_decimal(value: str | None) -> Decimal | None:
    if not value or not value.strip():
        return None
    text = value.strip()
    # Formato europeo/latam: punto como miles, coma como decimal (ej: "1.234,56")
    if "," in text and "." in text:
        last_comma = text.rfind(",")
        last_dot = text.rfind(".")
        if last_comma > last_dot:
            # Punto es miles, coma es decimal: "1.234,56" -> "1234.56"
            text = text.replace(".", "").replace(",", ".")
        else:
            # Coma es miles, punto es decimal: "1,234.56" -> "1234.56"
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return Decimal(text)
    except InvalidOperation:
        raise ValueError(f"No se pudo parsear decimal: '{value}'")


def parse_integer(value: str | None) -> int | None:
    if not value or not value.strip():
        return None
    text = value.strip()
    # Quitar separadores de miles
    text = text.replace(".", "").replace(",", "")
    try:
        num = int(text)
        return num
    except ValueError:
        pass
    # Fallback: si tiene parte decimal, redondear
    try:
        f = float(value.strip())
        return round(f)
    except (ValueError, OverflowError):
        raise ValueError(f"No se pudo parsear entero: '{value}'")


def parse_flag(value: str | None) -> bool | None:
    if not value or not value.strip():
        return None
    text = value.strip().upper()
    if text in ("SI", "S", "X", "1", "TRUE", "YES"):
        return True
    if text in ("NO", "N", "0", "FALSE"):
        return False
    return None
