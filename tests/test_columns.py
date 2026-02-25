"""
Tests para etl/config/columns.py — getv(), getv_str(), validate_headers()
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "etl"))

from config.columns import (
    COLUMN_ALIASES, getv, getv_str, validate_headers, get_expected_headers,
)


# ── getv() ────────────────────────────────────────────────────────

class TestGetv:
    def test_first_alias_match(self):
        """El primer alias (header real) debe matchear."""
        raw = {"Tipo.Cambio": "1234.56"}
        assert getv(raw, "PHXX", "Tipo.Cambio") == "1234.56"

    def test_legacy_alias_fallback(self):
        """Si el header real no está, usa alias legacy."""
        raw = {"Tipo Cambio": "1234.56"}
        assert getv(raw, "PHXX", "Tipo.Cambio") == "1234.56"

    def test_canonical_direct_fallback(self):
        """Si no hay alias registrado, intenta el canónico directo."""
        raw = {"CampoLibre": "valor"}
        assert getv(raw, "PHXX", "CampoLibre") == "valor"

    def test_default_when_missing(self):
        """Devuelve default si no encuentra nada."""
        raw = {"Otro": "x"}
        assert getv(raw, "PHXX", "Tipo.Cambio", "N/A") == "N/A"

    def test_none_default(self):
        raw = {}
        assert getv(raw, "PHXX", "NoExiste") is None

    def test_shared_aliases_pedidosfull(self):
        """PEDIDOSFULL comparte aliases con PEDIDOS."""
        assert COLUMN_ALIASES["PEDIDOSFULL"] is COLUMN_ALIASES["PEDIDOS"]
        raw = {"Ctd.conf.": "10"}
        assert getv(raw, "PEDIDOSFULL", "Ctd.conf.") == "10"

    def test_shared_aliases_ordenes(self):
        """O_PH, O_HG, O_PM comparten aliases con ORDENES."""
        raw = {"Fecha Inicio Extrema": "20260101"}
        assert getv(raw, "O_PH", "Fecha Inicio Extrema") == "20260101"
        assert getv(raw, "O_HG", "Fecha Inicio Extrema") == "20260101"
        assert getv(raw, "O_PM", "Fecha Inicio Extrema") == "20260101"

    def test_shared_aliases_consumos(self):
        raw = {"Cant.Plan": "50"}
        assert getv(raw, "C_PH", "Cant.Plan") == "50"
        assert getv(raw, "C_HG", "Cant.Plan") == "50"

    def test_avac_columns(self):
        raw = {"Nº doc.": "5001234", "Proveedor": "V001"}
        assert getv(raw, "AVAC", "Nº doc.") == "5001234"
        assert getv(raw, "AVAC", "Proveedor") == "V001"

    def test_phxx_accent_correction(self):
        """Header real sin acento debe matchear."""
        raw = {"Almacen": "0100"}
        assert getv(raw, "PHXX", "Almacen") == "0100"

    def test_phxx_legacy_with_accent(self):
        """Header legacy con acento también debe funcionar."""
        raw = {"Almacén": "0100"}
        assert getv(raw, "PHXX", "Almacen") == "0100"

    def test_avph_double_dash(self):
        """Headers con doble guión (reales) deben matchear."""
        raw = {"1 -- 15": "500.00"}
        assert getv(raw, "AVPH", "1 -- 15") == "500.00"

    def test_avph_single_dash_fallback(self):
        """Legacy con guión simple también funciona."""
        raw = {"1 - 15": "500.00"}
        assert getv(raw, "AVPH", "1 -- 15") == "500.00"

    def test_clientes_nombre_sol_casing(self):
        """Nombre Sol. (con mayúscula) es el real; 'Nombre sol.' es legacy."""
        raw_real = {"Nombre Sol.": "Juan Pérez"}
        raw_legacy = {"Nombre sol.": "Juan Pérez"}
        assert getv(raw_real, "CLIENTES", "Nombre Sol.") == "Juan Pérez"
        assert getv(raw_legacy, "CLIENTES", "Nombre Sol.") == "Juan Pérez"

    def test_nexfac_abbreviated_headers(self):
        raw = {"FechaE": "20260115", "ClaseE": "ZEL", "MesEntr": "01"}
        assert getv(raw, "NEXFAC", "FechaE") == "20260115"
        assert getv(raw, "NEXFAC", "ClaseE") == "ZEL"
        assert getv(raw, "NEXFAC", "MesEntr") == "01"


class TestGetvStr:
    def test_returns_str(self):
        raw = {"Num.Factura": 12345}
        result = getv_str(raw, "PHXX", "Num.Factura")
        assert isinstance(result, str)
        assert result == "12345"

    def test_strips_whitespace(self):
        raw = {"Num.Factura": "  ABC  "}
        assert getv_str(raw, "PHXX", "Num.Factura") == "ABC"

    def test_empty_returns_none(self):
        raw = {"Num.Factura": "   "}
        assert getv_str(raw, "PHXX", "Num.Factura") is None

    def test_none_returns_default(self):
        raw = {}
        assert getv_str(raw, "PHXX", "NoExiste", "default") == "default"


# ── validate_headers() ─────────────────────────────────────────────

class TestValidateHeaders:
    def test_all_present(self):
        """Cuando todos los headers reales están, ok=True."""
        actual = ["Num.Factura", "Cod_cliente", "Codigo_Mat", "Fecha.Doc",
                  "Tipo.Cambio", "Importe Final"]
        result = validate_headers("PHXX", actual,
                                  critical_cols=["Num.Factura", "Cod_cliente"])
        assert result["ok"] is True
        assert result["missing_critical"] == []

    def test_missing_critical(self):
        """Falta una PK → ok=False."""
        actual = ["Tipo.Cambio", "Importe Final"]
        result = validate_headers("PHXX", actual,
                                  critical_cols=["Num.Factura"])
        assert result["ok"] is False
        assert "Num.Factura" in result["missing_critical"]

    def test_unexpected_headers(self):
        """Headers no mapeados aparecen en 'unexpected'."""
        actual = ["Num.Factura", "ColumnaInventada", "OtroExtra"]
        result = validate_headers("PHXX", actual)
        assert "ColumnaInventada" in result["unexpected"]
        assert "OtroExtra" in result["unexpected"]

    def test_legacy_alias_resolves(self):
        """Un alias legacy cuenta como matched."""
        actual = ["Tipo Cambio"]  # legacy de "Tipo.Cambio"
        result = validate_headers("PHXX", actual)
        assert "Tipo.Cambio" in result["matched"]
        assert result["matched"]["Tipo.Cambio"] == "Tipo Cambio"

    def test_avac_validation(self):
        actual = ["Soc.", "Proveedor", "Nº doc.", "Fecha doc.",
                  "Mon.", "Clase Doc", "Asignacion"]
        result = validate_headers("AVAC", actual,
                                  critical_cols=["Nº doc.", "Proveedor",
                                                 "Clase Doc", "Asignacion", "Mon."])
        assert result["ok"] is True

    def test_empty_source_key(self):
        """Fuente sin aliases registrados → todo es unexpected."""
        result = validate_headers("INEXISTENTE", ["Col1", "Col2"])
        assert result["ok"] is True  # no hay críticas definidas
        assert len(result["unexpected"]) == 2


class TestGetExpectedHeaders:
    def test_phxx_has_headers(self):
        headers = get_expected_headers("PHXX")
        assert "Num.Factura" in headers
        assert "Tipo.Cambio" in headers

    def test_avac_has_headers(self):
        headers = get_expected_headers("AVAC")
        assert "Nº doc." in headers
        assert "Proveedor" in headers

    def test_unknown_source(self):
        assert get_expected_headers("NADA") == []
