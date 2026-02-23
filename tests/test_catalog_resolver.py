from etl.transform.catalog_resolver import generate_mock_code


class TestGenerateMockCode:
    def test_deterministic(self):
        code1 = generate_mock_code("canal", "VENTA DIRECTA", "CAN")
        code2 = generate_mock_code("canal", "VENTA DIRECTA", "CAN")
        assert code1 == code2

    def test_different_domains_different_codes(self):
        code1 = generate_mock_code("canal", "DETAL", "CAN")
        code2 = generate_mock_code("ramo", "DETAL", "RAM")
        assert code1 != code2

    def test_unknown_gets_special_code(self):
        code = generate_mock_code("canal", "UNKNOWN", "CAN")
        assert code == "CAN_UNKNOWN"

    def test_format(self):
        code = generate_mock_code("sector", "ABSORBENTES", "SEC")
        assert code.startswith("SEC_")
        assert len(code) == 14  # SEC_ + 10 hex chars
        assert code == code.upper()
