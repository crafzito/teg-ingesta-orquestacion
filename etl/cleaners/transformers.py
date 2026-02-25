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

v2: Usa getv() de config.columns para resolución centralizada de headers.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import uuid

from parsers.parsers import (
    parse_date, parse_decimal, normalize_text, normalize_code,
    row_hash, pk_hash, mock_code
)
from config.columns import getv, getv_str


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


# Shorthand: g(raw, col) → getv con source_key parcialmente aplicado
def _g(raw, sk, col, default=""):
    return getv(raw, sk, col, default) or default


# ────────────────────────────────────────────────────────────────
# VENTAS — PHXX.CSV → fact.ventas
# ────────────────────────────────────────────────────────────────
def transform_ventas(raw: Dict) -> TransformResult:
    SK = "PHXX"
    errors = []

    num_factura = normalize_code(_g(raw, SK, "Num.Factura"))
    cod_cliente = normalize_code(_g(raw, SK, "Cod_cliente"))
    codigo_mat  = normalize_code(_g(raw, SK, "Codigo_Mat"))
    fecha_doc   = parse_date(_g(raw, SK, "Fecha.Doc"))

    if not num_factura:
        errors.append("num_factura vacío")
    if not cod_cliente:
        errors.append("cod_cliente vacío")
    if not codigo_mat:
        errors.append("codigo_mat vacío")
    if fecha_doc is None:
        errors.append(f"fecha_doc inválida: {_g(raw, SK, 'Fecha.Doc')!r}")

    if errors:
        return TransformResult(False, {}, errors)

    tipo_cambio    = parse_decimal(_g(raw, SK, "Tipo.Cambio", "0"))
    importe_final  = parse_decimal(_g(raw, SK, "Importe Final", "0"))
    importe_final2 = parse_decimal(_g(raw, SK, "Importe Final 2", "0"))

    row = {
        "line_hash":         pk_hash(num_factura, cod_cliente, codigo_mat, str(fecha_doc)),
        "batch_id":          _CURRENT_BATCH_ID,
        "cod_cliente":       cod_cliente,
        "codigo_mat":        codigo_mat,
        "cod_vendedor":      normalize_code(_g(raw, SK, "CodVend")),
        "cod_condicion_pago": None,
        "cod_sector":        normalize_code(_g(raw, SK, "Sector")),
        "canal_texto":       normalize_text(_g(raw, SK, "Canal")),
        "num_factura":       num_factura,
        "clase_doc":         normalize_code(_g(raw, SK, "ClaseDoc.")),
        "referencia":        normalize_code(_g(raw, SK, "Referencia")),
        "pedido_vta":        normalize_code(_g(raw, SK, "Pedido.Vta")),
        "almacen":           normalize_code(_g(raw, SK, "Almacen")),
        "org_vtas":          normalize_code(_g(raw, SK, "OrgVtas")),
        "cod_moneda":        normalize_code(_g(raw, SK, "Moneda.Doc.")),
        "status_anulacion":  normalize_code(_g(raw, SK, "Status de Anulacion")),
        "ind_retcl":         normalize_code(_g(raw, SK, "Ind_retcl")),
        "ind_auto_retcl":    normalize_code(_g(raw, SK, "Ind_auto_retcl")),
        "cod_mot":           normalize_code(_g(raw, SK, "CodMot")),
        "fecha_doc":         fecha_doc,
        "fec_venc":          parse_date(_g(raw, SK, "Fec.Venc.")),
        "fechahora":         None,
        "mes":               _safe_int(getv(raw, SK, "Mes")),
        "ejercicio":         _safe_int(getv(raw, SK, "Ejercicio")),
        "cantidad_umv":      parse_decimal(_g(raw, SK, "Cantidad UMV", "0")),
        "um_vtas":           normalize_code(_g(raw, SK, "UM.Vtas")),
        "cantidad_umb":      parse_decimal(_g(raw, SK, "Cantidad UMB", "0")),
        "um_base":           normalize_code(_g(raw, SK, "UM.Base")),
        "prec_unitario":     parse_decimal(_g(raw, SK, "Prec.Unitario", "0")),
        "monto_neto":        parse_decimal(_g(raw, SK, "Monto Neto", "0")),
        "iva":               parse_decimal(_g(raw, SK, "IVA", "0")),
        "importe_final":     importe_final,
        "tipo_cambio":       tipo_cambio,
        "prec_unitario_usd": parse_decimal(_g(raw, SK, "Prec.Unitario 2", "0")),
        "monto_neto_usd":    parse_decimal(_g(raw, SK, "Monto Neto 2", "0")),
        "iva_usd":           parse_decimal(_g(raw, SK, "IVA 2", "0")),
        "importe_final_usd": importe_final2,
        "peso_fact":         parse_decimal(_g(raw, SK, "Peso.Fact", "0")),
        "um_peso":           normalize_code(_g(raw, SK, "UM.Peso")),
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# CxC — AVPH.CSV → fact.cxc
# ────────────────────────────────────────────────────────────────
def transform_cxc(raw: Dict) -> TransformResult:
    SK = "AVPH"
    n_doc = normalize_code(_g(raw, SK, "N°.Documento"))
    cliente = normalize_code(_g(raw, SK, "Cliente"))

    if not n_doc or not cliente:
        return TransformResult(False, {}, ["n_documento o cliente vacío"])

    row = {
        "line_hash":         pk_hash(
            n_doc, cliente,
            _g(raw, SK, "Cl.Doc."),
            _g(raw, SK, "Asignación"),
            _g(raw, SK, "Mon.F."),
            _g(raw, SK, "Valor monetario"),
        ),
        "batch_id":          _CURRENT_BATCH_ID,
        "cod_cliente":       cliente,
        "cod_vendedor":      normalize_code(_g(raw, SK, "Vendedor")),
        "cod_clase_doc":     normalize_code(_g(raw, SK, "Cl.Doc.")),
        "cod_condicion_pago":normalize_code(_g(raw, SK, "Cond.Pago")),
        "cod_moneda":        normalize_code(_g(raw, SK, "Mon.F.")),
        "n_documento":       n_doc,
        "asignacion":        normalize_code(_g(raw, SK, "Asignación")),
        "sociedad":          normalize_code(_g(raw, SK, "Sociedad")),
        "texto":             normalize_text(_g(raw, SK, "Texto")),
        "fecha_doc":         parse_date(_g(raw, SK, "Fecha Doc.")),
        "fecha_base":        parse_date(_g(raw, SK, "Fecha Base")),
        "d_venc":            _safe_int(getv(raw, SK, "D. Venc.")),
        "fecha_venc":        parse_date(_g(raw, SK, "Fecha Venc.")),
        "valor_monetario":   parse_decimal(_g(raw, SK, "Valor monetario", "0")),
        "no_vencido":        parse_decimal(_g(raw, SK, "No Vencido", "0")),
        "venc_1_15":         parse_decimal(_g(raw, SK, "1 -- 15", "0")),
        "venc_16_30":        parse_decimal(_g(raw, SK, "16 -- 30", "0")),
        "venc_31_60":        parse_decimal(_g(raw, SK, "31 -- 60", "0")),
        "venc_61_90":        parse_decimal(_g(raw, SK, "61 -- 90", "0")),
        "venc_91_mas":       parse_decimal(_g(raw, SK, "91 -- 99999", "0")),
        "tc_conversion":     parse_decimal(_g(raw, SK, "T/C conversión 3", "0")),
        "importe_ml":        parse_decimal(_g(raw, SK, "Importe en ML", "0")),
        "importe_md":        parse_decimal(_g(raw, SK, "Importe en MD", "0")),
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# ENTREGAS — NEXFAC20.CSV → fact.entregas
# ────────────────────────────────────────────────────────────────
def transform_entregas(raw: Dict) -> TransformResult:
    SK = "NEXFAC"
    entrega = normalize_code(_g(raw, SK, "Entrega"))
    pos_ped = normalize_code(_g(raw, SK, "PosPed"))

    if not entrega:
        return TransformResult(False, {}, ["num_entrega vacío"])

    row = {
        "line_hash":     pk_hash(entrega, pos_ped or ""),
        "batch_id":      _CURRENT_BATCH_ID,
        "cod_cliente":   normalize_code(_g(raw, SK, "Solicitante")),
        "codigo_mat":    normalize_code(_g(raw, SK, "Codigo_Mat")),
        "cod_vendedor":  normalize_code(_g(raw, SK, "Cod.Vend")),
        "cod_moneda":    normalize_code(_g(raw, SK, "Moneda")),
        "num_entrega":   entrega,
        "pos_ped":       pos_ped,
        "num_pedido":    normalize_code(_g(raw, SK, "Pedido")),
        "destinatario":  normalize_code(_g(raw, SK, "Destinatario mcia.")),
        "clase_entrega": normalize_text(_g(raw, SK, "ClaseE")),
        "zona_texto":    normalize_text(_g(raw, SK, "Zona")),
        "mes_entrega":   normalize_text(_g(raw, SK, "MesEntr")),
        "fecha_entrega": parse_date(_g(raw, SK, "FechaE")),
        "fecha_real":    parse_date(_g(raw, SK, "FechaR")) if getv(raw, SK, "FechaR") else None,
        "cantidad":      parse_decimal(_g(raw, SK, "Cantidad entrega", "0")),
        "um":            normalize_code(_g(raw, SK, "Un.medida venta")),
        "monto":         parse_decimal(_g(raw, SK, "Monto", "0")),
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# PEDIDOS — PEDIDOSFULL20 + PEDIDOS20 → fact.pedidos
# es_mes_actual se inyecta desde el pipeline
# ────────────────────────────────────────────────────────────────
def _make_transform_pedidos(es_mes_actual: bool, source_key: str):
    def transform(raw: Dict) -> TransformResult:
        SK = source_key
        doc_comer  = normalize_code(_g(raw, SK, "Doc.comer."))
        pedido     = normalize_code(_g(raw, SK, "Pedido"))
        material   = normalize_code(_g(raw, SK, "Material"))

        if not pedido or not material:
            return TransformResult(False, {}, ["pedido o material vacío"])

        row = {
            "line_hash":     pk_hash(doc_comer or "", pedido, material),
            "batch_id":      _CURRENT_BATCH_ID,
            "cod_cliente":   normalize_code(_g(raw, SK, "Solic.")),
            "codigo_mat":    material,
            "cod_moneda":    normalize_code(_g(raw, SK, "Mon.")),
            "es_mes_actual": es_mes_actual,
            "doc_comer":     doc_comer,
            "num_pedido":    pedido,
            "status":        normalize_text(_g(raw, SK, "Status")),
            "clase_vt":      normalize_code(_g(raw, SK, "ClVt")),
            "almacen":       normalize_code(_g(raw, SK, "Alm.")),
            "fecha_doc":     parse_date(_g(raw, SK, "Fecha doc.")),
            "fe_entrega":    parse_date(_g(raw, SK, "Fe.entrega")),
            "fe_precio":     parse_date(_g(raw, SK, "Fe.precio")),
            "creado_el":     parse_date(_g(raw, SK, "Creado el")),
            "fe_ped_app":    parse_date(_g(raw, SK, "Fe.ped.APP")),
            "ctd_conf":      parse_decimal(_g(raw, SK, "Ctd.conf.", "0")),
            "ctd_ped":       parse_decimal(_g(raw, SK, "Ctd.ped.", "0")),
            "tp_cambio":     parse_decimal(_g(raw, SK, "Tp.cambio", "0")),
            "prc_neto":      parse_decimal(_g(raw, SK, "Prc.neto", "0")),
            "valor_neto":    parse_decimal(_g(raw, SK, "Valor neto", "0")),
            "neto":          parse_decimal(_g(raw, SK, "Neto", "0")),
        }

        return TransformResult(True, row)
    return transform


transform_pedidos_full = _make_transform_pedidos(es_mes_actual=False, source_key="PEDIDOSFULL")
transform_pedidos_mes  = _make_transform_pedidos(es_mes_actual=True, source_key="PEDIDOS")


# ────────────────────────────────────────────────────────────────
# INVENTARIO — INVPT_XX + INVPT_XXGENERAL + INVMP_XX → fact.inventario
# tipo_inv se inyecta desde el pipeline
# ────────────────────────────────────────────────────────────────
def _make_transform_inventario(tipo_inv: str, source_key: str):
    def transform(raw: Dict) -> TransformResult:
        SK = source_key
        codigo_mat = normalize_code(_g(raw, SK, "Codigo_Mat"))
        if not codigo_mat:
            return TransformResult(False, {}, ["codigo_mat vacío"])

        almacen = normalize_code(_g(raw, SK, "Almacen"))

        row = {
            "line_hash":     pk_hash(tipo_inv, codigo_mat,
                                     _g(raw, SK, "Centro"),
                                     almacen or ""),
            "batch_id":      _CURRENT_BATCH_ID,
            "codigo_mat":    codigo_mat,
            "tipo_inv":      tipo_inv,
            "centro":        normalize_code(_g(raw, SK, "Centro")),
            "almacen":       almacen or None,
            "desc_almacen":  normalize_text(_g(raw, SK, "TextAlm")),
            "desc_centro":   normalize_text(_g(raw, SK, "TextCent")),
            "cb":            normalize_code(_g(raw, SK, "C-B")),
            "tp_mt":         normalize_code(_g(raw, SK, "TpMt")) if source_key == "INVMP" else None,
            "libre_ut":      parse_decimal(_g(raw, SK, "LibreUt", "0")),
            "calidad":       parse_decimal(_g(raw, SK, "Calidad", "0")),
            "bloqueado":     parse_decimal(_g(raw, SK, "Bloqueado", "0")),
            "valor_libre":   parse_decimal(_g(raw, SK, "Valor_Lut", "0")) if source_key == "INVMP" else 0,
            "valor_calidad": parse_decimal(_g(raw, SK, "Valor_Cal", "0")) if source_key == "INVMP" else 0,
            "valor_bloqueado":parse_decimal(_g(raw, SK, "Valor_Blo", "0")) if source_key == "INVMP" else 0,
            "hora_snapshot": None,
        }

        return TransformResult(True, row)
    return transform


transform_invpt         = _make_transform_inventario("PT", "INVPT")
transform_invpt_general = _make_transform_inventario("PT_GENERAL", "INVPT_GENERAL")
transform_invmp         = _make_transform_inventario("MP", "INVMP")


# ────────────────────────────────────────────────────────────────
# ÓRDENES — O_PHXX + O_HGXX + O_PMXX → fact.ordenes
# planta se inyecta desde el pipeline
# ────────────────────────────────────────────────────────────────
def _make_transform_ordenes(planta: str, source_key: str):
    def transform(raw: Dict) -> TransformResult:
        SK = source_key
        num_orden  = normalize_code(_g(raw, SK, "Orden"))
        codigo_mat = normalize_code(_g(raw, SK, "Codigo_Mat"))

        if not num_orden or not codigo_mat:
            return TransformResult(False, {}, ["orden o codigo_mat vacío"])

        row = {
            "line_hash":          pk_hash(planta, num_orden, codigo_mat),
            "batch_id":           _CURRENT_BATCH_ID,
            "codigo_mat":         codigo_mat,
            "cod_clase_orden":    normalize_code(_g(raw, SK, "Clase Orden")),
            "planta":             planta,
            "num_orden":          num_orden,
            "centro":             normalize_code(_g(raw, SK, "Centro")),
            "reproceso":          normalize_code(_g(raw, SK, "Reproceso")),
            "estatus":            normalize_text(_g(raw, SK, "Estatus")),
            "maquina":            normalize_text(_g(raw, SK, "Maquina")),
            "fecha_ini_extrema":  parse_date(_g(raw, SK, "Fecha Inicio Extrema")),
            "fecha_fin_extrema":  parse_date(_g(raw, SK, "Fecha Fin Extrema")),
            "fecha_ini_real":     parse_date(_g(raw, SK, "Fecha Inic Real")),
            "fecha_fin_real":     parse_date(_g(raw, SK, "Fecha fin real")),
            "fecha_liberacion":   parse_date(_g(raw, SK, "Fecha Liberacion")),
            "fecha_hora":         None,
            "cantidad_orden":     parse_decimal(_g(raw, SK, "Cantidad Orden", "0")),
            "cantidad_recibida":  parse_decimal(_g(raw, SK, "Cantidad Recibida", "0")),
            "um_orden":           normalize_code(_g(raw, SK, "UM Orden")),
        }

        return TransformResult(True, row)
    return transform


transform_ordenes_ph = _make_transform_ordenes("PH", "O_PH")
transform_ordenes_hg = _make_transform_ordenes("HG", "O_HG")
transform_ordenes_pm = _make_transform_ordenes("PM", "O_PM")


# ────────────────────────────────────────────────────────────────
# CONSUMOS — C_PHXX + C_HGXX → fact.consumos
# ────────────────────────────────────────────────────────────────
def _make_transform_consumos(planta: str, source_key: str):
    def transform(raw: Dict) -> TransformResult:
        SK = source_key
        codigo_mat = normalize_code(_g(raw, SK, "Codigo_Mat"))
        num_orden  = normalize_code(_g(raw, SK, "Orden"))
        origen     = normalize_code(_g(raw, SK, "Origen"))

        if not codigo_mat or not num_orden:
            return TransformResult(False, {}, ["codigo_mat u orden vacío"])

        row = {
            "line_hash":       pk_hash(planta, codigo_mat, num_orden, origen or ""),
            "batch_id":        _CURRENT_BATCH_ID,
            "codigo_mat":      codigo_mat,
            "planta":          planta,
            "num_orden":       num_orden,
            "umb":             normalize_code(_g(raw, SK, "UMB")),
            "cant_plan":       parse_decimal(_g(raw, SK, "Cant.Plan", "0")),
            "cant_real":       parse_decimal(_g(raw, SK, "Cant.Real", "0")),
            "var_consumo":     parse_decimal(_g(raw, SK, "Var.Consumo", "0")),
            "pct_var_consumo": parse_decimal(_g(raw, SK, "(%)Var.Consumo", "0")),
            "tot_cos_plan":    parse_decimal(_g(raw, SK, "Tot.Cos.Plan", "0")),
            "tot_cos_real":    parse_decimal(_g(raw, SK, "Tot.Cos.Real", "0")),
            "precio_std":      parse_decimal(_g(raw, SK, "Precio Std", "0")),
            "precio_var":      parse_decimal(_g(raw, SK, "Precio Var.", "0")),
            "var_precio":      parse_decimal(_g(raw, SK, "Var.Precio", "0")),
            "val_var_prec":    parse_decimal(_g(raw, SK, "Val.Var.Prec.", "0")),
            "val_var_con":     parse_decimal(_g(raw, SK, "Val.Var.Con.", "0")),
            "tot_variacion":   parse_decimal(_g(raw, SK, "Tot.Variación", "0")),
            "c_planificada":   parse_decimal(_g(raw, SK, "C.Planificada", "0")),
            "c_entregada":     parse_decimal(_g(raw, SK, "C.Entregada", "0")),
        }

        return TransformResult(True, row)
    return transform


transform_consumos_ph = _make_transform_consumos("PH", "C_PH")
transform_consumos_hg = _make_transform_consumos("HG", "C_HG")


# ────────────────────────────────────────────────────────────────
# NOTIFICACIONES — N_PHXX.CSV → fact.notificaciones
# ────────────────────────────────────────────────────────────────
def transform_notificaciones(raw: Dict) -> TransformResult:
    SK = "N_PH"
    codigo_mat = normalize_code(_g(raw, SK, "Codigo_Mat"))
    fecha      = parse_date(_g(raw, SK, "Fecha"))
    um         = normalize_code(_g(raw, SK, "UM"))

    if not codigo_mat or fecha is None:
        return TransformResult(False, {}, ["codigo_mat o fecha vacío"])

    row = {
        "line_hash":    pk_hash(codigo_mat, str(fecha), um or ""),
        "batch_id":     _CURRENT_BATCH_ID,
        "codigo_mat":   codigo_mat,
        "fecha":        fecha,
        "um":           um,
        "sector_texto": normalize_text(_g(raw, SK, "Sector")),
        "reproceso":    normalize_code(_g(raw, SK, "Reproceso")),
        "cant_notif":   parse_decimal(_g(raw, SK, "Cant_Notif", "0")),
        "libre_ut":     parse_decimal(_g(raw, SK, "Libre Ut.", "0")),
        "exist_otr":    parse_decimal(_g(raw, SK, "Exist.Otr.", "0")),
        "fecha_hora":   None,
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# PRECIOS — PRECIOS.CSV → fact.precios
# ────────────────────────────────────────────────────────────────
def transform_precios(raw: Dict) -> TransformResult:
    SK = "PRECIOS"
    material = normalize_code(_g(raw, SK, "Material"))
    if not material:
        return TransformResult(False, {}, ["material vacío"])

    cl_cd  = normalize_code(_g(raw, SK, "ClCd"))
    org_vt = normalize_code(_g(raw, SK, "OrgVt"))
    lp     = normalize_code(_g(raw, SK, "LP"))

    row = {
        "line_hash":        pk_hash(cl_cd or "", org_vt or "", lp or "", material),
        "batch_id":         _CURRENT_BATCH_ID,
        "codigo_mat":       material,
        "cod_lista_precio": lp,
        "cl_cd":            cl_cd,
        "org_vt":           org_vt,
        "lp":               lp,
        "importe":          parse_decimal(_g(raw, SK, "Importe", "0")),
        "un":               normalize_code(_g(raw, SK, "Un.")),
        "por":              parse_decimal(_g(raw, SK, "por", "1")),
        "valido_de":        parse_date(_g(raw, SK, "Válido de")),
        "valido_a":         parse_date(_g(raw, SK, "A")),
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# CxP — AVAC_PH.CSV → fact.cxp (NUEVO)
# ────────────────────────────────────────────────────────────────
def transform_cxp(raw: Dict) -> TransformResult:
    SK = "AVAC"
    n_doc      = normalize_code(_g(raw, SK, "Nº doc."))
    proveedor  = normalize_code(_g(raw, SK, "Proveedor"))

    if not n_doc or not proveedor:
        return TransformResult(False, {}, ["n_documento o proveedor vacío"])

    row = {
        "line_hash":          pk_hash(
            n_doc, proveedor,
            _g(raw, SK, "Clase Doc"),
            _g(raw, SK, "Asignacion"),
            _g(raw, SK, "Mon."),
        ),
        "batch_id":           _CURRENT_BATCH_ID,
        "sociedad":           normalize_code(_g(raw, SK, "Soc.")),
        "proveedor":          proveedor,
        "nombre_proveedor":   normalize_text(_g(raw, SK, "Nombre")),
        "asignacion":         normalize_code(_g(raw, SK, "Asignacion")),
        "referencia":         normalize_code(_g(raw, SK, "Referencia")),
        "clase_doc":          normalize_code(_g(raw, SK, "Clase Doc")),
        "n_documento":        n_doc,
        "fecha_doc":          parse_date(_g(raw, SK, "Fecha doc.")),
        "cod_condicion_pago": normalize_code(_g(raw, SK, "Cond. Pago")),
        "desc_pago":          normalize_text(_g(raw, SK, "Desc. Pago")),
        "d_venc":             _safe_int(getv(raw, SK, "D. Venc.")),
        "fecha_venc":         parse_date(_g(raw, SK, "Fecha Venc")),
        "cod_moneda":         normalize_code(_g(raw, SK, "Mon.")),
        "importe_ml":         parse_decimal(_g(raw, SK, "Imp Mon Lo", "0")),
        "por_vencer":         parse_decimal(_g(raw, SK, "Por Vencer", "0")),
        "venc_1_30":          parse_decimal(_g(raw, SK, "1 -- 30", "0")),
        "venc_31_60":         parse_decimal(_g(raw, SK, "31 -- 60", "0")),
        "venc_61_90":         parse_decimal(_g(raw, SK, "61 -- 90", "0")),
        "venc_91_mas":        parse_decimal(_g(raw, SK, "91 -- 9999", "0")),
        "importe":            parse_decimal(_g(raw, SK, "Importe", "0")),
        "importe_m":          parse_decimal(_g(raw, SK, "Importe. M", "0")),
        "cod_ramo":           normalize_code(_g(raw, SK, "Ramo")),
        "ref_factura":        normalize_code(_g(raw, SK, "Ref.fact.")),
        "importe_moneda_fuerte": parse_decimal(_g(raw, SK, "Importe Moneda Fuerte", "0")),
        "moneda_fuerte":      normalize_code(_g(raw, SK, "Moneda")),
        "importe_mf_fecha_doc": parse_decimal(_g(raw, SK, "Importe MF Fecha Doc", "0")),
    }

    return TransformResult(True, row)


# ────────────────────────────────────────────────────────────────
# RAW — Ventas sin transformar (usa getv_str para resolución flexible)
# ────────────────────────────────────────────────────────────────
def transform_raw_ventas(raw: Dict, source_file: str, batch_id: str) -> Dict:
    SK = "PHXX"
    g = lambda col: getv_str(raw, SK, col)

    pk = pk_hash(
        g("Num.Factura") or "",
        g("Cod_cliente") or "",
        g("Codigo_Mat") or "",
        g("Fecha.Doc") or "",
    )

    record = {
        "pk_hash":                pk,
        "row_hash":               row_hash({k: str(v) for k, v in raw.items()}),
        "razon_social":           g("Razon Social"),
        "gpo_de_cliente":         g("Gpo de Cliente"),
        "clase_doc":              g("ClaseDoc."),
        "num_factura":            g("Num.Factura"),
        "sector":                 g("Sector"),
        "canal":                  g("Canal"),
        "fecha_doc":              g("Fecha.Doc"),
        "zona_vtas":              g("Zona.Vtas"),
        "almacen":                g("Almacen"),
        "denominacion_material":  g("Denominacion Material"),
        "cantidad_umv":           g("Cantidad UMV"),
        "um_vtas":                g("UM.Vtas"),
        "cantidad_umb":           g("Cantidad UMB"),
        "um_base":                g("UM.Base"),
        "prec_unitario":          g("Prec.Unitario"),
        "monto_neto":             g("Monto Neto"),
        "iva":                    g("IVA"),
        "importe_final":          g("Importe Final"),
        "doc_comercial":          g("Doc.Comercial"),
        "cond_pago":              g("Cond.Pago"),
        "fec_venc":               g("Fec.Venc."),
        "moneda_doc":             g("Moneda.Doc."),
        "status_anulacion":       g("Status de Anulacion"),
        "doc_anulac":             g("Doc.Anulac"),
        "grp_vend":               g("Grp.Vend"),
        "vendedor":               g("Vendedor"),
        "referencia":             g("Referencia"),
        "pedido_vta":             g("Pedido.Vta"),
        "jerarquia_1":            g("Jerarquia 1"),
        "jerarquia_2":            g("Jerarquia 2"),
        "jerarquia_3":            g("Jerarquia 3"),
        "um_peso":                g("UM.Peso"),
        "peso_fact":              g("Peso.Fact"),
        "peso_total":             g("Peso.Total"),
        "um_peso_gen":            g("Um.PesoGen"),
        "ramo":                   g("Ramo"),
        "gr_material":            g("Gr.Material"),
        "gr_articulo":            g("Gr.Articulo"),
        "tipo_cambio":            g("Tipo.Cambio"),
        "mes":                    g("Mes"),
        "ejercicio":              g("Ejercicio"),
        "prec_unitario_2":        g("Prec.Unitario 2"),
        "monto_neto_2":           g("Monto Neto 2"),
        "iva_2":                  g("IVA 2"),
        "importe_final_2":        g("Importe Final 2"),
        "conc_busq":              g("Conc.Busq"),
        "codigo_mat":             g("Codigo_Mat"),
        "listas_precios":         g("Listas_precios"),
        "cod_cliente":            g("Cod_cliente"),
        "ind_retcl":              g("Ind_retcl"),
        "ind_auto_retcl":         g("Ind_auto_retcl"),
        "fechahora":              g("fechahora"),
        "cod_mot":                g("CodMot"),
        "tx_motivo":              g("Tx Motivo"),
        "cod_vend":               g("CodVend"),
        "org_vtas":               g("OrgVtas"),
        "source_file":            source_file,
        "batch_id":               batch_id,
    }
    return record


# ────────────────────────────────────────────────────────────────
# RAW — Clientes sin transformar
# ────────────────────────────────────────────────────────────────
def transform_raw_clientes(raw: Dict, source_file: str, batch_id: str) -> Dict:
    SK = "CLIENTES"
    g = lambda col: getv_str(raw, SK, col)

    cod = g("Cod. Cliente") or ""
    pk = pk_hash(cod)

    return {
        "pk_hash":         pk,
        "row_hash":        row_hash({k: str(v) for k, v in raw.items()}),
        "cod_cliente":     g("Cod. Cliente"),
        "nombre_sol":      g("Nombre Sol."),
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


def _parse_bool(value) -> Optional[bool]:
    if not value:
        return None
    v = str(value).strip().upper()
    if v in ("X", "SI", "SÍ", "1", "TRUE", "YES"):
        return True
    if v in ("", "0", "FALSE", "NO"):
        return False
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
    "AVAC":          transform_cxp,
}
