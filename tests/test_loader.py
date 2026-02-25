"""
Tests para etl/loaders/loader.py — read_csv hardening
"""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "etl"))

from loaders.loader import read_csv


class TestReadCsv:
    def _write_csv(self, content: str, encoding: str = "latin-1") -> str:
        """Helper: escribe contenido CSV en archivo temporal."""
        fd, path = tempfile.mkstemp(suffix=".csv")
        with os.fdopen(fd, "w", encoding=encoding) as f:
            f.write(content)
        return path

    def test_basic_read(self):
        path = self._write_csv("Col1;Col2;Col3\nA;B;C\nD;E;F\n")
        rows = list(read_csv(path, "latin-1", ";"))
        assert len(rows) == 2
        assert rows[0]["Col1"] == "A"
        assert rows[1]["Col3"] == "F"
        os.unlink(path)

    def test_strips_header_whitespace(self):
        """Headers con espacios extra se limpian."""
        path = self._write_csv("  Col1 ; Col2 ;Col3  \nA;B;C\n")
        rows = list(read_csv(path, "latin-1", ";"))
        assert "Col1" in rows[0]
        assert "Col2" in rows[0]
        assert "Col3" in rows[0]
        os.unlink(path)

    def test_bom_handling(self):
        """BOM al inicio del archivo se ignora."""
        # Escribir BOM UTF-8 manualmente como bytes
        fd, path = tempfile.mkstemp(suffix=".csv")
        with os.fdopen(fd, "wb") as f:
            f.write(b"\xef\xbb\xbfCol1;Col2\nA;B\n")
        rows = list(read_csv(path, "utf-8", ";"))
        assert len(rows) == 1
        assert "Col1" in rows[0]
        os.unlink(path)

    def test_extra_separators_filtered(self):
        """Filas con más separadores que headers no generan keys None."""
        # 3 headers, pero la segunda fila tiene 5 campos
        path = self._write_csv("Col1;Col2;Col3\nA;B;C\nD;E;F;G;H\n")
        rows = list(read_csv(path, "latin-1", ";"))
        assert len(rows) == 2
        # La fila con separadores extra no debe tener None como key
        assert None not in rows[1]
        # Debe tener solo las 3 columnas del header
        assert set(rows[1].keys()) == {"Col1", "Col2", "Col3"}
        os.unlink(path)

    def test_empty_file(self):
        """CSV vacío no genera filas."""
        path = self._write_csv("")
        rows = list(read_csv(path, "latin-1", ";"))
        assert len(rows) == 0
        os.unlink(path)

    def test_header_only(self):
        """CSV con solo headers, sin datos."""
        path = self._write_csv("Col1;Col2\n")
        rows = list(read_csv(path, "latin-1", ";"))
        assert len(rows) == 0
        os.unlink(path)

    def test_empty_key_filtered(self):
        """Headers vacíos (trailing ;) se filtran."""
        # Header con ; al final crea un campo con key vacía
        path = self._write_csv("Col1;Col2;\nA;B;C\n")
        rows = list(read_csv(path, "latin-1", ";"))
        assert len(rows) == 1
        # "" key debe ser filtrada
        assert "" not in rows[0]
        os.unlink(path)
