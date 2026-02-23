from datetime import date
from decimal import Decimal

from etl.transform.cleaner import ClientesCleaner, VentasCleaner


class TestClientesCleaner:
    HEADER = [
        "Cod. Cliente", "Nombre Sol.", "Cond. Pago", "Descripción Cond Pag",
        "Ramo", "Descripción Ramo", "Gr Clientes", "Descripción Gr Clien",
        "Dirección", "Telefono", "RIF", "Ruta Transp.",
        "Poblacion", "Zona Ventas", "Descripción Zona",
        "Grupo Vend.", "Descripción Grupo Ve", "Descrip. Estado",
        "Fecha de creacion", "AG. RET.", "Ult.Fact", "Fecha Fact",
        "Doc.Ult.Pago", "Fecha Pago", "Nombre persona conta",
        "Teléfono móvil", "Cod.Vend", "Nombre_vendedor",
        "Cód.Ger.Reg.", "Nombre Gte. Regional", "Moneda",
        "Lista", "Denominacion", "Canal", "fecha actual", "Dias ult fact",
    ]

    def _make_row(self, **overrides):
        base = [
            "10000000", "ALMACENES LAS TRES N, C.A.", "NT01", "Prepagado",
            "Z065", "Detal", "26", "Detal",
            "CALLE COMERCIO", "0234-6620860", "J294722261", "ZMIR000001",
            "CAUCAGUA", "ZVE004", "Zona Metropolitana",
            "102", "GV Ger. Reg. Capital", "Miranda",
            "03.12.2015", "SI", "6000006152", "06.10.2016",
            "1400028639", "28.11.2016", "MOHAMED KHADDOUR",
            "0412-1234567", "100127", "ROMERO H ADOLFO J",
            "100141", "CALDERA P JESUS D", "VED",
            "17", "Precio Base General", "60", "18/2/2026", "3422",
        ]
        for k, v in overrides.items():
            idx = list(self.HEADER).index(k) if k in self.HEADER else None
            if idx is not None:
                base[idx] = v
        return base

    def test_basic_cleaning(self):
        cleaner = ClientesCleaner()
        row = self._make_row()
        cleaned, warnings = cleaner.clean_row(self.HEADER, row)

        assert cleaned["cod_cliente"] == "10000000"
        assert cleaned["nombre_cliente"] == "ALMACENES LAS TRES N, C.A."
        assert cleaned["cod_condicion_pago"] == "NT01"
        assert cleaned["fecha_creacion_cliente"] == date(2015, 12, 3)
        assert cleaned["fecha_corte_archivo"] == date(2026, 2, 18)
        assert cleaned["dias_sin_facturar"] == 3422
        assert cleaned["agente_retencion_flag"] is True

    def test_empty_fields_become_unknown(self):
        cleaner = ClientesCleaner()
        row = self._make_row(**{"Poblacion": "", "Dirección": "  "})
        cleaned, _ = cleaner.clean_row(self.HEADER, row)

        assert cleaned["poblacion"] == "UNKNOWN"
        assert cleaned["direccion"] == "UNKNOWN"


class TestVentasCleaner:
    def _make_raw(self):
        return [
            "MEIS UNIVERSAL COMPAÑIA ANONIMA",  # 0 razon_social
            "Mayoristas",      # 1 gpo_cliente
            "Fact. Nac. Pharsana",  # 2 clase_doc
            "6000123628",      # 3 num_factura
            "Absorbentes",     # 4 sector
            "Venta Directa",   # 5 canal
            "20250514",        # 6 fecha_doc
            "Zona Andina",     # 7 zona_vtas
            "3000",            # 8 almacen
            "SECUREZZA POST PARTO PREMIUM (12X10)",  # 9 denom
            "5",               # 10 cantidad_umv
            "PAK",             # 11 um_vtas
            "60",              # 12 cantidad_umb
            "PAQ",             # 13 um_base
            "2212,2",          # 14 prec_unitario
            "11061",           # 15 monto_neto
            "1769,76",         # 16 iva
            "12830,76",        # 17 importe_final
            "Factura",         # 18 doc_comercial
            "Crédito 15 Días", # 19 cond_pago
            "20250529",        # 20 fec_venc
            "VED",             # 21 moneda_doc
            "NA",              # 22 status_anulacion
            "",                # 23 doc_anulac (skip)
            "GV. Ger. Reg. Occid.",  # 24 grp_vend
            "PEDRO A. COLMENARES",   # 25 vendedor
            "00-0606701",      # 26 referencia
            "1002056586",      # 27 pedido_vta
            "Securezza",       # 28 jerarquia_1
            "10",              # 29 jerarquia_2
            "Anatómica",       # 30 jerarquia_3
            "KG",              # 31 um_peso
            "10500",           # 32 peso_fact
            "",                # 33 peso_total (skip)
            "10500",           # 34 um_peso_gen
            "Mayorista",       # 35 ramo
            "PH-Toalla Post-Parto",  # 36 gr_material
            "INCONTINENCIA",   # 37 gr_articulo
            "93,5796",         # 38 tipo_cambio
            "5",               # 39 mes
            "2025",            # 40 ejercicio
            "23,64",           # 41 prec_unitario_2
            "118,2",           # 42 monto_neto_2
            "18,91",           # 43 iva_2
            "137,11",          # 44 importe_final_2
            "MEIS",            # 45 conc_busq
            "50000632",        # 46 codigo_mat
            "Mayoristas",      # 47 listas_precios
            "",                # 48 empty col 49 (skip)
            "10000007",        # 49 cod_cliente
            "16",              # 50 cod_lista_precio_origen
            "1",               # 51 ind_retcl
            "X",               # 52 ind_auto_retcl
            "02.07.2025 - 08:40:06",  # 53 fechahora
            "",                # 54 cod_mot
            "",                # 55 tx_motivo
            "100026",          # 56 cod_vend
        ]

    def test_basic_cleaning(self):
        cleaner = VentasCleaner()
        cleaned, warnings = cleaner.clean_row(self._make_raw())

        assert cleaned["fecha_doc"] == date(2025, 5, 14)
        assert cleaned["fec_venc"] == date(2025, 5, 29)
        assert cleaned["prec_unitario"] == Decimal("2212.2")
        assert cleaned["tipo_cambio"] == Decimal("93.5796")
        assert cleaned["importe_final_2"] == Decimal("137.11")
        assert cleaned["cod_cliente"] == "10000007"
        assert cleaned["cod_lista_precio_origen"] == "16"
        assert cleaned["cod_vend"] == "100026"
        assert cleaned["num_factura"] == "6000123628"
        assert "line_hash" in cleaned
        assert len(cleaned["line_hash"]) == 32

    def test_skipped_columns_not_present(self):
        cleaner = VentasCleaner()
        cleaned, _ = cleaner.clean_row(self._make_raw())

        assert "_empty_49" not in cleaned
        assert "doc_anulac" not in cleaned
        assert "peso_total" not in cleaned
