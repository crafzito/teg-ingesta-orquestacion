from datetime import date, datetime
from decimal import Decimal

import pytest

from etl.transform.parsers import (
    normalize_text,
    normalize_text_upper,
    parse_date,
    parse_datetime,
    parse_decimal,
    parse_flag,
    parse_integer,
)


class TestParseDate:
    def test_yyyymmdd(self):
        assert parse_date("20250514") == date(2025, 5, 14)

    def test_dd_mm_yyyy_dots(self):
        assert parse_date("03.12.2015") == date(2015, 12, 3)

    def test_d_m_yyyy_slashes(self):
        assert parse_date("18/2/2026") == date(2026, 2, 18)

    def test_dd_mm_yyyy_slashes(self):
        assert parse_date("06/10/2016") == date(2016, 10, 6)

    def test_empty_returns_none(self):
        assert parse_date("") is None
        assert parse_date(None) is None
        assert parse_date("  ") is None

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            parse_date("not-a-date")


class TestParseDatetime:
    def test_standard_format(self):
        result = parse_datetime("02.07.2025 - 08:40:06")
        assert result == datetime(2025, 7, 2, 8, 40, 6)

    def test_empty_returns_none(self):
        assert parse_datetime("") is None
        assert parse_datetime(None) is None

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            parse_datetime("2025-07-02 08:40:06")


class TestParseDecimal:
    def test_comma_decimal(self):
        assert parse_decimal("2212,2") == Decimal("2212.2")

    def test_comma_decimal_four_places(self):
        assert parse_decimal("93,5796") == Decimal("93.5796")

    def test_negative(self):
        assert parse_decimal("-1465,71") == Decimal("-1465.71")

    def test_integer_value(self):
        assert parse_decimal("10500") == Decimal("10500")

    def test_zero(self):
        assert parse_decimal("0") == Decimal("0")

    def test_empty_returns_none(self):
        assert parse_decimal("") is None
        assert parse_decimal(None) is None

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            parse_decimal("abc")


class TestParseInteger:
    def test_normal(self):
        assert parse_integer("3422") == 3422

    def test_float_string(self):
        assert parse_integer("3422.0") == 3422

    def test_empty_returns_none(self):
        assert parse_integer("") is None

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            parse_integer("abc")


class TestNormalizeText:
    def test_strips_whitespace(self):
        assert normalize_text("  hello  ") == "hello"

    def test_collapses_spaces(self):
        assert normalize_text("hello   world") == "hello world"

    def test_empty_returns_unknown(self):
        assert normalize_text("") == "UNKNOWN"
        assert normalize_text(None) == "UNKNOWN"
        assert normalize_text("   ") == "UNKNOWN"


class TestNormalizeTextUpper:
    def test_uppercase_no_accents(self):
        assert normalize_text_upper("Zona Metropolitana") == "ZONA METROPOLITANA"

    def test_removes_accents(self):
        assert normalize_text_upper("Descripción") == "DESCRIPCION"

    def test_empty_returns_unknown(self):
        assert normalize_text_upper("") == "UNKNOWN"


class TestParseFlag:
    def test_si(self):
        assert parse_flag("SI") is True

    def test_x(self):
        assert parse_flag("X") is True

    def test_no(self):
        assert parse_flag("NO") is False

    def test_empty_returns_none(self):
        assert parse_flag("") is None
        assert parse_flag(None) is None

    def test_na_returns_none(self):
        assert parse_flag("NA") is None
