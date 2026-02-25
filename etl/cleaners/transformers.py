"""
transformers.py — Un transformador por cada fuente SAP

Cada función recibe un dict con la fila cruda (columnas originales SAP)
y devuelve un TransformResult con:
  - is_valid: True si la fila es válida para cargar
  - row: dict listo para INSERT/UPSERT en PostgreSQL
  - errors: lista de problemas encontrados

Decisiones de validación basadas en datos reales:
  - tipo_cambio=0 cuando moneda=USD es VÁLIDO (SAP lo hace cuando
    el importe ya está en USD, no necesita conversión)
  - Cantidades negativas en N/C devoluciones son VÁLIDAS
  - Filas sin almacén en INVPT_GENERAL son totales por centro (VÁLIDAS)
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import uuid

from parsers.parsers import (
    parse_date, parse_decimal, normalize_text, normalize_code,
    row_hash, pk_hash, mock_code
)


@dataclass
class TransformResult:
    is_valid: bool
    row: Dict[str, Any]
    errors: List[str] = field(default_factory=list)


def _new_batch() -> str:
    """Genera un batch_id único para esta ejecución."""
    return str(uuid.uuid4())


# Batch ID compartido en toda la ejecución (se setea al inicio del pipeline)
_CURRENT_BATCH_ID = "UNSET"

def set_batch_id(batch_id: str):
    global _CURRENT_BATCH_ID
    _CURRENT_BATCH_ID = batch_id

def get_batch_id() -> str:
    return _CURRENT_BATCH_ID


# ────────────────────────────────────────────────────────────────
# VENTAS — PHXX.CSV → fact.ventas
# ────────────────────────────────────────────────────────────────
def transform_ventas(raw: Dict) -> TransformResult:
    errors = []

    num_factura = normalize_code(raw.get("Num.Factura") or "")
    cod_cliente = normalize_code(raw.get("Cod_cliente") or "")
    codigo_mat  = normalize_code(raw.get("Codigo_Mat")  or "")
    fecha_doc   = parse_date(raw.get("Fecha.Doc") or "")

    # Validaciones mínimas
    if not num_factura:
        errors.append("num_factura vacío")
    if not cod_cliente:
        errors.append("cod_cliente vacío")
    if not codigo_mat:
        errors.append("codigo_mat vacío")
    if fecha_doc is None:
        errors.append(f"fecha_doc inválida: {raw.get('Fecha.Doc')!r}")

    if errors:
        return TransformResult(False, {}, errors)

    tipo_cambio    = parse_decimal(raw.get("Tipo Cambio")    or "0")
    importe_final  = parse_decimal(raw.get("Importe Final")  or "0")
    importe_final2 = parse_decimal(raw.get("Importe Final.2") or "0")

    # tipo_cambio=0 con moneda USD es VÁLIDO (SAP ya tiene el valor en USD)
    # No rechazar estas filas.

    row = {
        "line_hash":         pk_hash(num_factura, cod_cliente, codigo_mat, str(fecha_doc)),
        "batch_id":          _CURRENT_BATCH_ID,
        "cod_cliente":       cod_cliente,
        "codigo_mat":        codigo_mat,
        "cod_vendedor":      normalize_code(raw.get("CodVend") or ""),
        # PHXX exporta la descripción en Cond.Pago, no el código.
        # El código real está en dim.cliente.cod_condicion_pago.
        # Se guarda el texto aquí solo como referencia.
        "cod_condicion_pago": None,  # no disponible en PHXX
        "cod_sector":        normalize_code(raw.get("Sector") or ""),
        "canal_texto":       normalize_text(raw.get("Canal") or ""),
        "num_factura":       num_factura,
        "clase_doc":         normalize_code(raw.get("Clase Doc.") or ""),
        "referencia":        normalize_code(raw.get("Referencia") or ""),
        "pedido_vta":        normalize_code(raw.get("Pedido Vta.") or ""),
        "almacen":           normalize_code(raw.get("Almacén") or ""),
        "org_vtas":          normalize_code(raw.get("Org.Vtas.") or ""),
        "cod_moneda":        normalize_code(raw.get("Moneda.Doc.") or ""),
        "status_anulacion":  normalize_code(raw.get("Status Anulación") or ""),
        "ind_retcl":         normalize_code(raw.get("Ind.RetCl") or ""),
        "ind_auto_retcl":    normalize_code(raw.get("Ind.AutoRetCl") or ""),
        "cod_mot":           normalize_code(raw.get("Cod_Mot") or ""),
        "fecha_doc":         fecha_doc,
        "fec_venc":          parse_date(raw.get("Fec.Venc.") or ""),
        "fechahora":         None,  # timestamptz, parsear si es necesario
        "mes":               _safe_int(raw.get("Mes")),
        "ejercicio":         _safe_int(raw.get("Ejercicio")),
        "cantidad_umv":      parse_decimal(raw.get("Cantidad UMV") or "0"),
        "um_vtas":           normalize_code(raw.get("UM Vtas.") or ""),
        "cantidad_umb":      parse_decimal(raw.get("Cantidad UMB") or "0"),
        "um_base":           normalize_code(raw.get("UM Base") or ""),
        "prec_unitario":     parse_decimal(raw.get("Prec.Unitario") or "0"),
        "monto_neto":        parse_decimal(raw.get("Mto.Neto") or "0"),
        "iva":               parse_decimal(raw.get("IVA") or "0"),
        "importe_final":     importe_final,
        "tipo_cambio":       tipo_cambio,
        "prec_unitario_usd": parse_decimal(raw.get("Prec.Unitario.2") or "0"),
        "monto_neto_usd":    parse_decimal(raw.get("Mto.Neto.2") or "0"),
        "iva_usd":           parse_decimal(raw.get("IVA.2") or "0"),
        "importe_final_usd": importe_final2,
        "peso_fact":         parse_decimal(raw.get("Peso Fact.") or "0"),
        "um_peso":           normalize_code(raw.get("UM Peso") or ""),
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# CxC — AVPH.CSV → fact.cxc
# ────────────────────────────────────────────────────────────────
def transform_cxc(raw: Dict) -> TransformResult:
    n_doc = normalize_code(raw.get("N°.Documento") or "")
    cliente = normalize_code(raw.get("Cliente") or "")

    if not n_doc or not cliente:
        return TransformResult(False, {}, ["n_documento o cliente vacío"])

    row = {
        "line_hash":         pk_hash(
            n_doc, cliente,
            raw.get("Cl.Doc.") or "",
            raw.get("Asignación") or "",
            raw.get("Mon.F.") or "",
            raw.get("Valor monetario") or "",
        ),
        "batch_id":          _CURRENT_BATCH_ID,
        "cod_cliente":       cliente,
        "cod_vendedor":      normalize_code(raw.get("Vendedor") or ""),
        "cod_clase_doc":     normalize_code(raw.get("Cl.Doc.") or ""),
        "cod_condicion_pago":normalize_code(raw.get("Cond.Pago") or ""),
        "cod_moneda":        normalize_code(raw.get("Mon.F.") or ""),
        "n_documento":       n_doc,
        "asignacion":        normalize_code(raw.get("Asignación") or ""),
        "sociedad":          normalize_code(raw.get("Sociedad") or ""),
        "texto":             normalize_text(raw.get("Texto") or ""),
        "fecha_doc":         parse_date(raw.get("Fecha Doc") or ""),
        "fecha_base":        parse_date(raw.get("Fecha Base") or ""),
        "d_venc":            _safe_int(raw.get("D.Venc")),
        "fecha_venc":        parse_date(raw.get("Fecha Venc.") or ""),
        "valor_monetario":   parse_decimal(raw.get("Valor monetario") or "0"),
        "no_vencido":        parse_decimal(raw.get("No vencido") or "0"),
        "venc_1_15":         parse_decimal(raw.get("1 - 15") or "0"),
        "venc_16_30":        parse_decimal(raw.get("16 - 30") or "0"),
        "venc_31_60":        parse_decimal(raw.get("31 - 60") or "0"),
        "venc_61_90":        parse_decimal(raw.get("61 - 90") or "0"),
        "venc_91_mas":       parse_decimal(raw.get("91 - 99999") or "0"),
        "tc_conversion":     parse_decimal(raw.get("TC Conversión") or "0"),
        "importe_ml":        parse_decimal(raw.get("Importe ML") or "0"),
        "importe_md":        parse_decimal(raw.get("Importe MD") or "0"),
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# ENTREGAS — NEXFAC20.CSV → fact.entregas
# ────────────────────────────────────────────────────────────────
def transform_entregas(raw: Dict) -> TransformResult:
    entrega = normalize_code(raw.get("Entrega") or "")
    pos_ped = normalize_code(raw.get("PosPed") or "")

    if not entrega:
        return TransformResult(False, {}, ["num_entrega vacío"])

    row = {
        "line_hash":     pk_hash(entrega, pos_ped or ""),
        "batch_id":      _CURRENT_BATCH_ID,
        "cod_cliente":   normalize_code(raw.get("Solicitante") or ""),
        "codigo_mat":    normalize_code(raw.get("Codigo_Mat") or ""),
        "cod_vendedor":  normalize_code(raw.get("Cod.Vend") or ""),
        "cod_moneda":    normalize_code(raw.get("Moneda") or ""),
        "num_entrega":   entrega,
        "pos_ped":       pos_ped,
        "num_pedido":    normalize_code(raw.get("Pedido") or ""),
        "destinatario":  normalize_code(raw.get("Dest.Mcia.") or ""),
        "clase_entrega": normalize_text(raw.get("Clase Entrega") or ""),
        "zona_texto":    normalize_text(raw.get("Zona") or ""),
        "mes_entrega":   normalize_text(raw.get("Mes") or ""),
        "fecha_entrega": parse_date(raw.get("Fecha Entrega") or ""),
        "fecha_real":    None,
        "cantidad":      parse_decimal(raw.get("Cantidad") or "0"),
        "um":            normalize_code(raw.get("UMB") or ""),
        "monto":         parse_decimal(raw.get("Monto") or "0"),
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# PEDIDOS — PEDIDOSFULL20 + PEDIDOS20 → fact.pedidos
# es_mes_actual se inyecta desde el pipeline
# ────────────────────────────────────────────────────────────────
def _make_transform_pedidos(es_mes_actual: bool):
    def transform(raw: Dict) -> TransformResult:
        doc_comer  = normalize_code(raw.get("  Doc.comer.") or raw.get("Doc.comer.") or "")
        pedido     = normalize_code(raw.get("Pedido") or "")
        material   = normalize_code(raw.get("Material") or "")

        if not pedido or not material:
            return TransformResult(False, {}, ["pedido o material vacío"])

        row = {
            "line_hash":     pk_hash(doc_comer or "", pedido, material),
            "batch_id":      _CURRENT_BATCH_ID,
            "cod_cliente":   normalize_code(raw.get("Solic.") or raw.get("Solicitante") or ""),
            "codigo_mat":    material,
            "cod_moneda":    normalize_code(raw.get("Mon") or ""),
            "es_mes_actual": es_mes_actual,
            "doc_comer":     doc_comer,
            "num_pedido":    pedido,
            "status":        normalize_text(raw.get("Status") or ""),
            "clase_vt":      normalize_code(raw.get("Cl.Vt") or ""),
            "almacen":       normalize_code(raw.get("Alm") or ""),
            "fecha_doc":     parse_date(raw.get("Fecha Doc") or ""),
            "fe_entrega":    parse_date(raw.get("Fe.Entrega") or ""),
            "fe_precio":     parse_date(raw.get("Fe.Precio") or ""),
            "creado_el":     parse_date(raw.get("Creado el") or ""),
            "fe_ped_app":    parse_date(raw.get("Fe.Ped.App.") or ""),
            "ctd_conf":      parse_decimal(raw.get("Ctd.Conf.") or "0"),
            "ctd_ped":       parse_decimal(raw.get("Ctd.Ped.") or "0"),
            "tp_cambio":     parse_decimal(raw.get("Tp.Cambio") or "0"),
            "prc_neto":      parse_decimal(raw.get("Prc.Neto") or "0"),
            "valor_neto":    parse_decimal(raw.get("Valor Neto") or "0"),
            "neto":          parse_decimal(raw.get("Neto") or "0"),
        }

        return TransformResult(True, row)
    return transform


transform_pedidos_full = _make_transform_pedidos(es_mes_actual=False)
transform_pedidos_mes  = _make_transform_pedidos(es_mes_actual=True)


# ────────────────────────────────────────────────────────────────
# INVENTARIO — INVPT_XX + INVPT_XXGENERAL + INVMP_XX → fact.inventario
# tipo_inv se inyecta desde el pipeline
# ────────────────────────────────────────────────────────────────
def _make_transform_inventario(tipo_inv: str):
    def transform(raw: Dict) -> TransformResult:
        codigo_mat = normalize_code(raw.get("Codigo_Mat") or "")
        if not codigo_mat:
            return TransformResult(False, {}, ["codigo_mat vacío"])

        # Almacén vacío en INVPT_GENERAL son totales por centro → válido
        almacen = normalize_code(raw.get("Almacen") or raw.get("Almacén") or "")

        row = {
            "line_hash":     pk_hash(tipo_inv, codigo_mat,
                                     raw.get("Centro") or "",
                                     almacen or ""),
            "batch_id":      _CURRENT_BATCH_ID,
            "codigo_mat":    codigo_mat,
            "tipo_inv":      tipo_inv,
            "centro":        normalize_code(raw.get("Centro") or ""),
            "almacen":       almacen or None,
            "desc_almacen":  normalize_text(raw.get("TextAlm") or raw.get("Text.Alm.") or ""),
            "desc_centro":   normalize_text(raw.get("TextCent") or raw.get("Text.Cent.") or ""),
            "cb":            normalize_code(raw.get("CB") or ""),
            "tp_mt":         normalize_code(raw.get("Tp.Mt.") or ""),  # solo MP
            "libre_ut":      parse_decimal(raw.get("Libre utilización") or raw.get("Libre Ut.") or "0"),
            "calidad":       parse_decimal(raw.get("Calidad") or "0"),
            "bloqueado":     parse_decimal(raw.get("Bloqueado") or "0"),
            # Solo MP:
            "valor_libre":   parse_decimal(raw.get("Valor Libre Ut.") or "0"),
            "valor_calidad": parse_decimal(raw.get("Valor Calidad") or "0"),
            "valor_bloqueado":parse_decimal(raw.get("Valor Bloqueado") or "0"),
            "hora_snapshot": None,
        }

        return TransformResult(True, row)
    return transform


transform_invpt         = _make_transform_inventario("PT")
transform_invpt_general = _make_transform_inventario("PT_GENERAL")
transform_invmp         = _make_transform_inventario("MP")


# ────────────────────────────────────────────────────────────────
# ÓRDENES — O_PHXX + O_HGXX + O_PMXX → fact.ordenes
# planta se inyecta desde el pipeline
# ────────────────────────────────────────────────────────────────
def _make_transform_ordenes(planta: str):
    def transform(raw: Dict) -> TransformResult:
        num_orden  = normalize_code(raw.get("Orden") or "")
        codigo_mat = normalize_code(raw.get("Codigo_Mat") or "")

        if not num_orden or not codigo_mat:
            return TransformResult(False, {}, ["orden o codigo_mat vacío"])

        row = {
            "line_hash":          pk_hash(planta, num_orden, codigo_mat),
            "batch_id":           _CURRENT_BATCH_ID,
            "codigo_mat":         codigo_mat,
            "cod_clase_orden":    normalize_code(raw.get("Clase Orden") or ""),
            "planta":             planta,
            "num_orden":          num_orden,
            "centro":             normalize_code(raw.get("Centro") or ""),
            "reproceso":          normalize_code(raw.get("Reproceso") or ""),
            "estatus":            normalize_text(raw.get("Estatus") or ""),
            "maquina":            normalize_text(raw.get("Máquina") or raw.get("Maquina") or ""),
            "fecha_ini_extrema":  parse_date(raw.get("Fecha Ini.Extrema") or ""),
            "fecha_fin_extrema":  parse_date(raw.get("Fecha Fin.Extrema") or ""),
            "fecha_ini_real":     parse_date(raw.get("Fecha Ini.Real") or ""),
            "fecha_fin_real":     parse_date(raw.get("Fecha Fin.Real") or ""),
            "fecha_liberacion":   parse_date(raw.get("Fecha Liberación") or ""),
            "fecha_hora":         None,
            "cantidad_orden":     parse_decimal(raw.get("Cantidad Orden") or "0"),
            "cantidad_recibida":  parse_decimal(raw.get("Cantidad Recibida") or "0"),
            "um_orden":           normalize_code(raw.get("UM Orden") or ""),
        }

        return TransformResult(True, row)
    return transform


transform_ordenes_ph = _make_transform_ordenes("PH")
transform_ordenes_hg = _make_transform_ordenes("HG")
transform_ordenes_pm = _make_transform_ordenes("PM")


# ────────────────────────────────────────────────────────────────
# CONSUMOS — C_PHXX + C_HGXX → fact.consumos
# ────────────────────────────────────────────────────────────────
def _make_transform_consumos(planta: str):
    def transform(raw: Dict) -> TransformResult:
        codigo_mat = normalize_code(raw.get("Codigo_Mat") or "")
        num_orden  = normalize_code(raw.get("Orden") or "")
        origen     = normalize_code(raw.get("Origen") or "")

        if not codigo_mat or not num_orden:
            return TransformResult(False, {}, ["codigo_mat u orden vacío"])

        row = {
            "line_hash":       pk_hash(planta, codigo_mat, num_orden, origen or ""),
            "batch_id":        _CURRENT_BATCH_ID,
            "codigo_mat":      codigo_mat,
            "planta":          planta,
            "num_orden":       num_orden,
            "umb":             normalize_code(raw.get("UMB") or ""),
            "cant_plan":       parse_decimal(raw.get("Cant.Plan.") or "0"),
            "cant_real":       parse_decimal(raw.get("Cant.Real") or "0"),
            "var_consumo":     parse_decimal(raw.get("Var.Consumo") or "0"),
            "pct_var_consumo": parse_decimal(raw.get("% Var.Consu") or "0"),
            "tot_cos_plan":    parse_decimal(raw.get("Tot.Cos.Plan.") or "0"),
            "tot_cos_real":    parse_decimal(raw.get("Tot.Cos.Real") or "0"),
            "precio_std":      parse_decimal(raw.get("Precio STD") or "0"),
            "precio_var":      parse_decimal(raw.get("Precio Var.") or "0"),
            "var_precio":      parse_decimal(raw.get("Var.Precio") or "0"),
            "val_var_prec":    parse_decimal(raw.get("Val.Var.Prec.") or "0"),
            "val_var_con":     parse_decimal(raw.get("Val.Var.Con.") or "0"),
            "tot_variacion":   parse_decimal(raw.get("Tot.Variación") or "0"),
            "c_planificada":   parse_decimal(raw.get("C.Planificada") or "0"),
            "c_entregada":     parse_decimal(raw.get("C.Entregada") or "0"),
        }

        return TransformResult(True, row)
    return transform


transform_consumos_ph = _make_transform_consumos("PH")
transform_consumos_hg = _make_transform_consumos("HG")


# ────────────────────────────────────────────────────────────────
# NOTIFICACIONES — N_PHXX.CSV → fact.notificaciones
# ────────────────────────────────────────────────────────────────
def transform_notificaciones(raw: Dict) -> TransformResult:
    codigo_mat = normalize_code(raw.get("Codigo_Mat") or "")
    fecha      = parse_date(raw.get("Fecha") or "")
    um         = normalize_code(raw.get("UM") or "")

    if not codigo_mat or fecha is None:
        return TransformResult(False, {}, ["codigo_mat o fecha vacío"])

    row = {
        "line_hash":    pk_hash(codigo_mat, str(fecha), um or ""),
        "batch_id":     _CURRENT_BATCH_ID,
        "codigo_mat":   codigo_mat,
        "fecha":        fecha,
        "um":           um,
        "sector_texto": normalize_text(raw.get("Sector") or ""),
        "reproceso":    normalize_code(raw.get("Reproceso") or ""),
        "cant_notif":   parse_decimal(raw.get("Cant.Notif.") or "0"),
        "libre_ut":     parse_decimal(raw.get("Libre Ut.") or "0"),
        "exist_otr":    parse_decimal(raw.get("Exist.Otr.") or "0"),
        "fecha_hora":   None,
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# PRECIOS — PRECIOS.CSV → fact.precios
# ────────────────────────────────────────────────────────────────
def transform_precios(raw: Dict) -> TransformResult:
    material = normalize_code(raw.get("Material") or "")
    if not material:
        return TransformResult(False, {}, ["material vacío"])

    cl_cd  = normalize_code(raw.get("ClCd") or "")
    org_vt = normalize_code(raw.get("OrgVt") or "")
    lp     = normalize_code(raw.get("LP") or "")

    row = {
        "line_hash":        pk_hash(cl_cd or "", org_vt or "", lp or "", material),
        "batch_id":         _CURRENT_BATCH_ID,
        "codigo_mat":       material,
        "cod_lista_precio": lp,
        "cl_cd":            cl_cd,
        "org_vt":           org_vt,
        "lp":               lp,
        "importe":          parse_decimal(raw.get("Importe") or "0"),
        "un":               normalize_code(raw.get("Un") or ""),
        "por":              parse_decimal(raw.get("Por") or "1"),
        "valido_de":        parse_date(raw.get("Válido de") or ""),
        "valido_a":         parse_date(raw.get("Válido a") or ""),
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# RAW — Ventas sin transformar
# ────────────────────────────────────────────────────────────────
def transform_raw_ventas(raw: Dict, source_file: str, batch_id: str) -> Dict:
    """
    Toma la fila cruda y la mapea a raw.ventas.
    Todas las columnas van como TEXT sin ningún parseo.
    """
    # Mapeo flexible: intentar múltiples nombres de columna SAP
    def g(*keys):
        for k in keys:
            v = raw.get(k)
            if v is not None:
                return str(v).strip() or None
        return None

    pk = pk_hash(
        g("Num.Factura") or "",
        g("Cod_cliente") or "",
        g("Codigo_Mat") or "",
        g("Fecha.Doc") or "",
    )

    record = {
        "pk_hash":                pk,
        "row_hash":               row_hash({k: str(v) for k, v in raw.items()}),
        "razon_social":           g("Razón Social"),
        "gpo_de_cliente":         g("Gr Clientes"),
        "clase_doc":              g("Clase Doc."),
        "num_factura":            g("Num.Factura"),
        "sector":                 g("Sector"),
        "canal":                  g("Canal"),
        "fecha_doc":              g("Fecha.Doc"),
        "zona_vtas":              g("Zona Vtas."),
        "almacen":                g("Almacén"),
        "denominacion_material":  g("Denominacion Material"),
        "cantidad_umv":           g("Cantidad UMV"),
        "um_vtas":                g("UM Vtas."),
        "cantidad_umb":           g("Cantidad UMB"),
        "um_base":                g("UM Base"),
        "prec_unitario":          g("Prec.Unitario"),
        "monto_neto":             g("Mto.Neto"),
        "iva":                    g("IVA"),
        "importe_final":          g("Importe Final"),
        "doc_comercial":          g("Doc.Comercial"),
        "cond_pago":              g("Cond.Pago"),
        "fec_venc":               g("Fec.Venc."),
        "moneda_doc":             g("Moneda.Doc."),
        "status_anulacion":       g("Status Anulación"),
        "doc_anulac":             g("Doc.Anulac."),
        "grp_vend":               g("Grp.Vend"),
        "vendedor":               g("Vendedor"),
        "referencia":             g("Referencia"),
        "pedido_vta":             g("Pedido Vta."),
        "jerarquia_1":            g("Jerarquía 1"),
        "jerarquia_2":            g("Jerarquía 2"),
        "jerarquia_3":            g("Jerarquía 3"),
        "um_peso":                g("UM Peso"),
        "peso_fact":              g("Peso Fact."),
        "peso_total":             g("Peso.Total"),
        "um_peso_gen":            g("UM Peso Gen."),
        "ramo":                   g("Ramo"),
        "gr_material":            g("Gr.Material"),
        "gr_articulo":            g("Gr.Articulo"),
        "tipo_cambio":            g("Tipo Cambio"),
        "mes":                    g("Mes"),
        "ejercicio":              g("Ejercicio"),
        "prec_unitario_2":        g("Prec.Unitario.2"),
        "monto_neto_2":           g("Mto.Neto.2"),
        "iva_2":                  g("IVA.2"),
        "importe_final_2":        g("Importe Final.2"),
        "conc_busq":              g("Conc.Búsq."),
        "codigo_mat":             g("Codigo_Mat"),
        "listas_precios":         g("Listas.Precios"),
        "cod_cliente":            g("Cod_cliente"),
        "ind_retcl":              g("Ind.RetCl"),
        "ind_auto_retcl":         g("Ind.AutoRetCl"),
        "fechahora":              g("FechaHora"),
        "cod_mot":                g("Cod_Mot"),
        "tx_motivo":              g("Tx_Motivo"),
        "cod_vend":               g("CodVend"),
        "org_vtas":               g("Org.Vtas."),
        "source_file":            source_file,
        "batch_id":               batch_id,
    }
    return record


# ────────────────────────────────────────────────────────────────
# RAW — Clientes sin transformar
# ────────────────────────────────────────────────────────────────
def transform_raw_clientes(raw: Dict, source_file: str, batch_id: str) -> Dict:
    def g(*keys):
        for k in keys:
            v = raw.get(k)
            if v is not None:
                return str(v).strip() or None
        return None

    cod = g("Cod. Cliente") or ""
    pk = pk_hash(cod)

    return {
        "pk_hash":         pk,
        "row_hash":        row_hash({k: str(v) for k, v in raw.items()}),
        "cod_cliente":     g("Cod. Cliente"),
        "nombre_sol":      g("Nombre sol."),
        "cond_pago":       g("Cond. Pago"),
        "desc_cond_pag":   g("Descripción Cond Pag"),
        "ramo":            g("Ramo"),
        "desc_ramo":       g("Descripción Ramo"),
        "gr_clientes":     g("Gr Clientes"),
        "desc_gr_clien":   g("Descripción Gr Clien"),
        "direccion":       g("Dirección"),
        "telefono":        g("Telefono"),
        "rif":             g("RIF"),
        "ruta_transp":     g("Ruta Transp."),
        "poblacion":       g("Poblacion"),
        "zona_ventas":     g("Zona Ventas"),
        "desc_zona":       g("Descripción Zona"),
        "grupo_vend":      g("Grupo Vend."),
        "desc_grupo_ve":   g("Descripción Grupo Ve"),
        "desc_estado":     g("Descrip. Estado"),
        "fecha_creacion":  g("Fecha de creacion"),
        "ag_ret":          g("AG. RET."),
        "ult_fact":        g("Ult.Fact"),
        "fecha_fact":      g("Fecha Fact"),
        "doc_ult_pago":    g("Doc.Ult.Pago"),
        "fecha_pago":      g("Fecha Pago"),
        "nombre_contacto": g("Nombre persona conta"),
        "telefono_movil":  g("Teléfono móvil"),
        "cod_vend":        g("Cod.Vend"),
        "nombre_vendedor": g("Nombre_vendedor"),
        "cod_ger_reg":     g("Cód.Ger.Reg."),
        "nombre_gte":      g("Nombre Gte. Regional"),
        "moneda":          g("Moneda"),
        "lista":           g("Lista"),
        "denominacion":    g("Denominacion"),
        "canal":           g("Canal"),
        "source_file":     source_file,
        "batch_id":        batch_id,
    }


# ────────────────────────────────────────────────────────────────
# Helpers internos
# ────────────────────────────────────────────────────────────────
def _safe_int(value) -> Optional[int]:
    if not value:
        return None
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return None


# Mapa source_key → función transformer
TRANSFORMER_MAP = {
    "PHXX":          transform_ventas,
    "AVPH":          transform_cxc,
    "NEXFAC":        transform_entregas,
    "PEDIDOSFULL":   transform_pedidos_full,
    "PEDIDOS":       transform_pedidos_mes,
    "INVPT":         transform_invpt,
    "INVPT_GENERAL": transform_invpt_general,
    "INVMP":         transform_invmp,
    "O_PH":          transform_ordenes_ph,
    "O_HG":          transform_ordenes_hg,
    "O_PM":          transform_ordenes_pm,
    "C_PH":          transform_consumos_ph,
    "C_HG":          transform_consumos_hg,
    "N_PH":          transform_notificaciones,
    "PRECIOS":       transform_precios,
}
