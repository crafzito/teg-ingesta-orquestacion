"""
Tests para etl/parsers/parsers.py — parse_date, parse_decimal, hashes, to_snake
"""
import sys
from pathlib import Path
from datetime import date
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "etl"))

from parsers.parsers import (
    parse_date, parse_decimal, normalize_text, normalize_code,
    pk_hash, row_hash, mock_code, to_snake,
)


# ── parse_date ──────────────────────────────────────────────────

class TestParseDate:
    def test_yyyymmdd(self):
        assert parse_date("20260106") == date(2026, 1, 6)

    def test_dd_dot_mm_dot_yyyy(self):
        assert parse_date("06.01.2026") == date(2026, 1, 6)

    def test_dd_slash_mm_slash_yyyy(self):
        assert parse_date("06/01/2026") == date(2026, 1, 6)

    def test_iso_format(self):
        assert parse_date("2026-01-06") == date(2026, 1, 6)

    def test_dd_dash_mm_dash_yyyy(self):
        assert parse_date("06-01-2026") == date(2026, 1, 6)

    def test_empty(self):
        assert parse_date("") is None
        assert parse_date(None) is None

    def test_zeros(self):
        assert parse_date("00000000") is None
        assert parse_date("00.00.0000") is None

    def test_whitespace(self):
        assert parse_date("  20260106  ") == date(2026, 1, 6)

    def test_invalid(self):
        assert parse_date("not-a-date") is None


# ── parse_decimal ──────────────────────────────────────────────

class TestParseDecimal:
    def test_european_format(self):
        """Punto=miles, coma=decimal."""
        assert parse_decimal("141.112,60") == Decimal("141112.60")

    def test_standard_format(self):
        assert parse_decimal("141112.60") == Decimal("141112.60")

    def test_comma_only(self):
        assert parse_decimal("0,00") == Decimal("0")

    def test_negative_european(self):
        assert parse_decimal("-5.000,000") == Decimal("-5000.000")

    def test_empty(self):
        assert parse_decimal("") is None
        assert parse_decimal(None) is None

    def test_dash(self):
        assert parse_decimal("-") is None

    def test_whitespace(self):
        assert parse_decimal("  1.234,56  ") == Decimal("1234.56")

    def test_invalid(self):
        assert parse_decimal("abc") is None


# ── normalize_text / normalize_code ─────────────────────────────

class TestNormalize:
    def test_text_strips_and_collapses(self):
        assert normalize_text("  hello   world  ") == "hello world"

    def test_text_empty(self):
        assert normalize_text("") is None
        assert normalize_text("   ") is None
        assert normalize_text(None) is None

    def test_code_strips(self):
        assert normalize_code("  ABC123  ") == "ABC123"

    def test_code_empty(self):
        assert normalize_code("") is None
        assert normalize_code(None) is None


# ── Hash functions ──────────────────────────────────────────────

class TestHashes:
    def test_pk_hash_deterministic(self):
        h1 = pk_hash("FAC001", "C001", "MAT001", "20260101")
        h2 = pk_hash("FAC001", "C001", "MAT001", "20260101")
        assert h1 == h2
        assert len(h1) == 32  # MD5 hex

    def test_pk_hash_different_values(self):
        h1 = pk_hash("FAC001", "C001")
        h2 = pk_hash("FAC002", "C001")
        assert h1 != h2

    def test_pk_hash_strips(self):
        h1 = pk_hash("FAC001 ", " C001")
        h2 = pk_hash("FAC001", "C001")
        assert h1 == h2

    def test_row_hash_deterministic(self):
        data = {"col1": "a", "col2": "b"}
        h1 = row_hash(data)
        h2 = row_hash(data)
        assert h1 == h2

    def test_row_hash_order_independent(self):
        """El dict se ordena internamente."""
        h1 = row_hash({"b": "2", "a": "1"})
        h2 = row_hash({"a": "1", "b": "2"})
        assert h1 == h2

    def test_row_hash_changes_on_diff(self):
        h1 = row_hash({"col": "old"})
        h2 = row_hash({"col": "new"})
        assert h1 != h2

    def test_mock_code_deterministic(self):
        c1 = mock_code("ALIMENTOS")
        c2 = mock_code("ALIMENTOS")
        assert c1 == c2
        assert len(c1) == 8


# ── to_snake ────────────────────────────────────────────────────

class TestToSnake:
    def test_basic(self):
        assert to_snake("Num.Factura") == "num_factura"

    def test_spaces(self):
        assert to_snake("Importe Final") == "importe_final"

    def test_accents(self):
        assert to_snake("Almacén") == "almacen"

    def test_number_prefix(self):
        # Guiones dobles se colapsan: 1 -- 15 → venc_1_15
        assert to_snake("1 -- 15") == "venc_1_15"

    def test_percent(self):
        result = to_snake("% Var Consumo")
        assert result.startswith("pct")

    def test_empty(self):
        assert to_snake("") is None
        assert to_snake(None) is None
        assert to_snake("   ") is None
