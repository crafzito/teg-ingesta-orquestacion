import logging

from etl.constants import (
    CLIENTES_COLUMN_MAP,
    UNKNOWN,
    VENTAS_COLUMNS_BY_INDEX,
    VENTAS_DATE_YYYYMMDD_FIELDS,
    VENTAS_DECIMAL_FIELDS,
    VENTAS_SKIP_COLUMNS,
)
from etl.transform.hasher import compute_line_hash
from etl.transform.parsers import (
    normalize_text,
    parse_date,
    parse_datetime,
    parse_decimal,
    parse_flag,
    parse_integer,
)

logger = logging.getLogger(__name__)


class ClientesCleaner:
    def __init__(self):
        self._header_to_clean = CLIENTES_COLUMN_MAP

    def clean_row(self, header: list[str], raw_values: list[str]) -> tuple[dict, list[str]]:
        warnings = []
        row = {}

        for i, hdr in enumerate(header):
            val = raw_values[i] if i < len(raw_values) else ""
            clean_name = self._header_to_clean.get(hdr)
            if clean_name is None:
                warnings.append(f"Columna desconocida ignorada: '{hdr}'")
                continue
            row[clean_name] = val

        cleaned = {}
        for key, val in row.items():
            try:
                cleaned[key] = self._parse_field(key, val, warnings)
            except ValueError as e:
                warnings.append(f"Error parseando {key}='{val}': {e}")
                cleaned[key] = None

        return cleaned, warnings

    def _parse_field(self, key: str, val: str, warnings: list[str]):
        # Fechas
        if key in ("fecha_creacion_cliente", "fecha_ultima_factura", "fecha_ultimo_pago"):
            return parse_date(val)
        if key == "fecha_corte_archivo":
            return parse_date(val)

        # Enteros
        if key == "dias_sin_facturar":
            return parse_integer(val)

        # Flags
        if key == "agente_retencion_flag":
            return parse_flag(val)

        # Texto normal
        text = normalize_text(val)

        # Campos que NO deben tener UNKNOWN (codigos/nombres especificos)
        if key in ("cod_cliente", "rif", "nombre_cliente") and text == UNKNOWN:
            if key == "cod_cliente":
                warnings.append("cod_cliente vacio")
            return text

        return text


class VentasCleaner:
    def __init__(self):
        self._col_names = VENTAS_COLUMNS_BY_INDEX
        self._skip = VENTAS_SKIP_COLUMNS
        self._decimal_fields = VENTAS_DECIMAL_FIELDS
        self._date_yyyymmdd = VENTAS_DATE_YYYYMMDD_FIELDS

    def clean_row(self, raw_values: list[str]) -> tuple[dict, list[str]]:
        warnings = []
        row = {}

        for i, col_name in enumerate(self._col_names):
            if col_name in self._skip:
                continue
            val = raw_values[i] if i < len(raw_values) else ""
            row[col_name] = val

        cleaned = {}
        for key, val in row.items():
            try:
                cleaned[key] = self._parse_field(key, val, warnings)
            except ValueError as e:
                warnings.append(f"Error parseando {key}='{val}': {e}")
                cleaned[key] = None

        # Calcular line_hash sobre los valores raw
        cleaned["line_hash"] = compute_line_hash(raw_values)

        return cleaned, warnings

    def _parse_field(self, key: str, val: str, warnings: list[str]):
        # Fechas YYYYMMDD
        if key in self._date_yyyymmdd:
            return parse_date(val)

        # Datetime
        if key == "fechahora":
            return parse_datetime(val)

        # Decimales (montos, cantidades, tipo cambio)
        if key in self._decimal_fields:
            return parse_decimal(val)

        # Enteros
        if key in ("mes", "ejercicio"):
            return parse_integer(val)

        # Texto
        return normalize_text(val)
