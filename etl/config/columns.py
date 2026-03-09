"""
columns.py — Registro central de columnas por fuente SAP

Cada source_key tiene un dict donde:
  - key   = nombre canónico (el que usa el código internamente)
  - value = lista de aliases (primer elemento = header real del CSV actual,
            resto = variantes legacy o posibles futuros cambios de SAP)

La función getv() busca el valor en el dict raw usando estos aliases.
Si ningún alias matchea, devuelve el default.
"""

from typing import Any, Dict, List, Optional


# ────────────────────────────────────────────────────────────────
# COLUMN_ALIASES: nombre_canonico → [header_real, ...aliases_legacy]
# El primer alias SIEMPRE es el header real verificado contra CSV
# ────────────────────────────────────────────────────────────────

COLUMN_ALIASES: Dict[str, Dict[str, List[str]]] = {

    # ── PHXX.CSV (ventas) ─────────────────────────────────────
    "PHXX": {
        "Num.Factura":          ["Num.Factura"],
        "Cod_cliente":          ["Cod_cliente"],
        "Codigo_Mat":           ["Codigo_Mat"],
        "Fecha.Doc":            ["Fecha.Doc"],
        "Tipo.Cambio":          ["Tipo.Cambio", "Tipo Cambio"],
        "Importe Final":        ["Importe Final"],
        "Importe Final 2":      ["Importe Final 2", "Importe Final.2"],
        "CodVend":              ["CodVend"],
        "Sector":               ["Sector"],
        "Canal":                ["Canal"],
        "ClaseDoc.":            ["ClaseDoc.", "Clase Doc."],
        "Referencia":           ["Referencia"],
        "Pedido.Vta":           ["Pedido.Vta", "Pedido Vta."],
        "Almacen":              ["Almacen", "Almacén"],
        "OrgVtas":              ["OrgVtas", "Org.Vtas."],
        "Moneda.Doc.":          ["Moneda.Doc."],
        "Status de Anulacion":  ["Status de Anulacion", "Status Anulación"],
        "Ind_retcl":            ["Ind_retcl", "Ind.RetCl"],
        "Ind_auto_retcl":       ["Ind_auto_retcl", "Ind.AutoRetCl"],
        "CodMot":               ["CodMot", "Cod_Mot"],
        "Fec.Venc.":            ["Fec.Venc."],
        "Mes":                  ["Mes"],
        "Ejercicio":            ["Ejercicio"],
        "Cantidad UMV":         ["Cantidad UMV"],
        "UM.Vtas":              ["UM.Vtas", "UM Vtas."],
        "Cantidad UMB":         ["Cantidad UMB"],
        "UM.Base":              ["UM.Base", "UM Base"],
        "Prec.Unitario":        ["Prec.Unitario"],
        "Monto Neto":           ["Monto Neto", "Mto.Neto"],
        "IVA":                  ["IVA"],
        "Prec.Unitario 2":     ["Prec.Unitario 2", "Prec.Unitario.2"],
        "Monto Neto 2":        ["Monto Neto 2", "Mto.Neto.2"],
        "IVA 2":               ["IVA 2", "IVA.2"],
        "Peso.Fact":            ["Peso.Fact", "Peso Fact."],
        "UM.Peso":              ["UM.Peso", "UM Peso"],
        # Columnas adicionales para raw_col_map y drop_cols
        "Razon Social":         ["Razón Social", "Razon Social"],
        "Gpo de Cliente":       ["Gpo de Cliente", "Gr Clientes"],
        "Zona.Vtas":            ["Zona.Vtas", "Zona Vtas."],
        "Denominacion Material":["Denominacion Material"],
        "Doc.Comercial":        ["Doc.Comercial"],
        "Cond.Pago":            ["Cond.Pago"],
        "Doc.Anulac":           ["Doc.Anulac", "Doc.Anulac."],
        "Grp.Vend":             ["Grp.Vend"],
        "Vendedor":             ["Vendedor"],
        "Jerarquia 1":          ["Jerarquía 1", "Jerarquia 1"],
        "Jerarquia 2":          ["Jerarquía 2", "Jerarquia 2"],
        "Jerarquia 3":          ["Jerarquía 3", "Jerarquia 3"],
        "Um.PesoGen":           ["Um.PesoGen", "UM Peso Gen."],
        "Ramo":                 ["Ramo"],
        "Gr.Material":          ["Gr.Material"],
        "Gr.Articulo":          ["Gr.Articulo"],
        "Conc.Busq":            ["Conc.Busq", "Conc.Búsq."],
        "Listas_precios":       ["Listas_precios", "Listas.Precios"],
        "fechahora":            ["fechahora", "FechaHora"],
        "Tx Motivo":            ["Tx Motivo", "Tx_Motivo"],
        "Peso.Total":           ["Peso.Total"],
    },

    # ── AVPH.CSV (CxC) ───────────────────────────────────────
    "AVPH": {
        "N°.Documento":         ["N°.Documento"],
        "Cliente":              ["Cliente"],
        "Cl.Doc.":              ["Cl.Doc."],
        "Asignación":           ["Asignación"],
        "Mon.F.":               ["Mon.F."],
        "Valor monetario":      ["Valor monetario"],
        "Vendedor":             ["Vendedor"],
        "Cond.Pago":            ["Cond.Pago"],
        "Sociedad":             ["Sociedad"],
        "Texto":                ["Texto"],
        "Fecha Doc.":           ["Fecha Doc.", "Fecha Doc"],
        "Fecha Base":           ["Fecha Base"],
        "D. Venc.":             ["D. Venc.", "D.Venc"],
        "Fecha Venc.":          ["Fecha Venc."],
        "No Vencido":           ["No Vencido", "No vencido"],
        "1 -- 15":              ["1 -- 15", "1 - 15"],
        "16 -- 30":             ["16 -- 30", "16 - 30"],
        "31 -- 60":             ["31 -- 60", "31 - 60"],
        "61 -- 90":             ["61 -- 90", "61 - 90"],
        "91 -- 99999":          ["91 -- 99999", "91 - 99999"],
        "T/C conversión 3":     ["T/C conversión 3", "TC Conversión"],
        "Importe en ML":        ["Importe en ML", "Importe ML"],
        "Importe en MD":        ["Importe en MD", "Importe MD"],
    },

    # ── NEXFAC20.CSV (entregas) ───────────────────────────────
    "NEXFAC": {
        "Entrega":              ["Entrega"],
        "PosPed":               ["PosPed"],
        "Solicitante":          ["Solicitante"],
        "Codigo_Mat":           ["Codigo_Mat"],
        "Cod.Vend":             ["Cod.Vend"],
        "Moneda":               ["Moneda"],
        "Pedido":               ["Pedido"],
        "Destinatario mcia.":   ["Destinatario mcía.", "Dest.Mcia."],
        "Cantidad entrega":     ["Cantidad entrega", "Cantidad"],
        "Un.medida venta":      ["Un.medida venta", "UMB"],
        "FechaE":               ["FechaE", "Fecha Entrega"],
        "FechaR":               ["FechaR"],
        "ClaseE":               ["ClaseE", "Clase Entrega"],
        "Zona":                 ["Zona"],
        "MesEntr":              ["MesEntr", "Mes"],
        "Monto":                ["Monto"],
    },

    # ── PEDIDOS20 / PEDIDOSFULL20 ─────────────────────────────
    "PEDIDOS": {
        "Doc.comer.":           ["Doc.comer.", "  Doc.comer."],
        "Pedido":               ["Pedido"],
        "Material":             ["Material"],
        "Solic.":               ["Solic.", "Solicitante"],
        "Mon.":                 ["Mon.", "Mon", "MonCd"],
        "Status":               ["Status"],
        "ClVt":                 ["ClVt", "Cl.Vt"],
        "Alm.":                 ["Alm.", "Alm"],
        "Fecha doc.":           ["Fecha doc.", "Fecha Doc"],
        "Fe.entrega":           ["Fe.entrega", "Fe.Entrega"],
        "Fe.precio":            ["Fe.precio", "Fe.Precio"],
        "Creado el":            ["Creado el"],
        "Fe.ped.APP":           ["Fe.ped.APP", "Fe.Ped.App."],
        "Ctd.conf.":            ["Ctd.conf.", "Ctd.Conf."],
        "Ctd.ped.":             ["Ctd.ped.", "Ctd.Ped."],
        "Tp.cambio":            ["Tp.cambio", "Tp.Cambio"],
        "Prc.neto":             ["Prc.neto", "Prc.Neto"],
        "Valor neto":           ["Valor neto", "Valor Neto"],
        "Neto":                 ["Neto"],
    },

    # ── INVPT_XX.CSV (inventario PT) ──────────────────────────
    "INVPT": {
        "Codigo_Mat":           ["Codigo_Mat"],
        "Centro":               ["Centro"],
        "Almacen":              ["Almacen", "Almacén"],
        "C-B":                  ["C-B", "CB"],
        "LibreUt":              ["LibreUt", "Libre Ut.", "Libre utilización"],
        "Calidad":              ["Calidad"],
        "Bloqueado":            ["Bloqueado"],
        "Categoría":            ["Categoría"],
        "Marca":                ["Marca"],
        "Grupo":                ["Grupo"],
        "Sector":               ["Sector"],
    },

    # ── INVPT_XXGENERAL.CSV ───────────────────────────────────
    "INVPT_GENERAL": {
        "Codigo_Mat":           ["Codigo_Mat"],
        "Centro":               ["Centro"],
        "Almacen":              ["Almacen", "Almacén"],
        "C-B":                  ["C-B", "CB"],
        "LibreUt":              ["LibreUt", "Libre Ut.", "Libre utilización"],
        "Calidad":              ["Calidad"],
        "Bloqueado":            ["Bloqueado"],
        "TextAlm":              ["TextAlm", "Text.Alm."],
        "TextCent":             ["TextCent", "Text.Cent."],
    },

    # ── INVENTARIOS.CSV (inventario PT valorizado) ─────────────
    "INVENTARIOS": {
        "Codigo_Mat":           ["Codigo_Mat"],
        "Centro":               ["Centro"],
        "Almacen":              ["Almacen", "Almacén"],
        "C-B":                  ["C-B", "CB"],
        "LibreUt":              ["LibreUt", "Libre Ut.", "Libre utilización"],
        "Valor_Lut":            ["Valor_Lut", "Valor Libre Ut."],
        "Calidad":              ["Calidad"],
        "Valor_Cal":            ["Valor_Cal", "Valor Calidad"],
        "Bloqueado":            ["Bloqueado"],
        "Valor_Blo":            ["Valor_Blo", "Valor Bloqueado"],
        "TpMt":                 ["TpMt", "Tp.Mt."],
        "Categoría":            ["Categoria", "Categoría"],
        "Marca":                ["Marca"],
        "Grupo":                ["Grupo"],
        "Sector":               ["Sector"],
        "TextAlm":              ["TextAlm", "Text.Alm."],
        "TextCent":             ["TextCent", "Text.Cent."],
    },

    # ── INVMP_XX.CSV (inventario MP) ──────────────────────────
    "INVMP": {
        "Codigo_Mat":           ["Codigo_Mat"],
        "Centro":               ["Centro"],
        "Almacen":              ["Almacen", "Almacén"],
        "C-B":                  ["C-B", "CB"],
        "LibreUt":              ["LibreUt", "Libre Ut.", "Libre utilización"],
        "Valor_Lut":            ["Valor_Lut", "Valor Libre Ut."],
        "Calidad":              ["Calidad"],
        "Valor_Cal":            ["Valor_Cal", "Valor Calidad"],
        "Bloqueado":            ["Bloqueado"],
        "Valor_Blo":            ["Valor_Blo", "Valor Bloqueado"],
        "TpMt":                 ["TpMt", "Tp.Mt."],
        "TextAlm":              ["TextAlm", "Text.Alm."],
        "TextCent":             ["TextCent", "Text.Cent."],
    },

    # ── O_PHXX / O_HGXX / O_PMXX (órdenes) ───────────────────
    "ORDENES": {
        "Orden":                ["Orden"],
        "Codigo_Mat":           ["Codigo_Mat"],
        "Clase Orden":          ["Clase Orden"],
        "Centro":               ["Centro"],
        "Reproceso":            ["Reproceso"],
        "Estatus":              ["Estatus"],
        "Maquina":              ["Maquina", "Máquina"],
        "Fecha Inicio Extrema": ["Fecha Inicio Extrema", "Fecha Ini.Extrema"],
        "Fecha Fin Extrema":    ["Fecha Fin Extrema", "Fecha Fin.Extrema"],
        "Fecha Inic Real":      ["Fecha Inic Real", "Fecha Ini.Real"],
        "Fecha fin real":       ["Fecha fin real", "Fecha Fin.Real"],
        "Fecha Liberacion":     ["Fecha Liberacion", "Fecha Liberación"],
        "Cantidad Orden":       ["Cantidad Orden"],
        "Cantidad Recibida":    ["Cantidad Recibida"],
        "UM Orden":             ["UM Orden"],
    },

    # ── C_PHXX / C_HGXX (consumos) ───────────────────────────
    "CONSUMOS": {
        "Codigo_Mat":           ["Codigo_Mat"],
        "Orden":                ["Orden"],
        "Origen":               ["Origen"],
        "UMB":                  ["UMB"],
        "Cant.Plan":            ["Cant.Plan", "Cant.Plan."],
        "Cant.Real":            ["Cant.Real"],
        "Var.Consumo":          ["Var.Consumo"],
        "(%)Var.Consumo":       ["(%)Var.Consumo", "% Var.Consu"],
        "Tot.Cos.Plan":         ["Tot.Cos.Plan", "Tot.Cos.Plan."],
        "Tot.Cos.Real":         ["Tot.Cos.Real"],
        "Precio Std":           ["Precio Std", "Precio STD"],
        "Precio Var.":          ["Precio Var."],
        "Var.Precio":           ["Var.Precio"],
        "Val.Var.Prec.":        ["Val.Var.Prec."],
        "Val.Var.Con.":         ["Val.Var.Con."],
        "Tot.Variación":        ["Tot.Variación"],
        "C.Planificada":        ["C.Planificada"],
        "C.Entregada":          ["C.Entregada"],
    },

    # ── N_PHXX.CSV (notificaciones) ──────────────────────────
    "N_PH": {
        "Codigo_Mat":           ["Codigo_Mat"],
        "Fecha":                ["Fecha"],
        "UM":                   ["UM"],
        "Sector":               ["Sector"],
        "Reproceso":            ["Reproceso"],
        "Cant_Notif":           ["Cant_Notif", "Cant.Notif."],
        "Libre Ut.":            ["Libre Ut."],
        "Exist.Otr.":           ["Exist.Otr."],
    },

    # ── PRECIOS.CSV ───────────────────────────────────────────
    "PRECIOS": {
        "Material":             ["Material"],
        "ClCd":                 ["ClCd"],
        "OrgVt":                ["OrgVt"],
        "LP":                   ["LP"],
        "Importe":              ["Importe"],
        "Un.":                  ["Un.", "Un"],
        "por":                  ["por", "Por"],
        "Válido de":            ["Válido de"],
        "A":                    ["A", "Válido a"],
        "UM":                   ["UM"],
    },

    # ── CLIENTES.CSV ──────────────────────────────────────────
    "CLIENTES": {
        "Cod. Cliente":         ["Cod. Cliente"],
        "Nombre Sol.":          ["Nombre Sol.", "Nombre sol."],
        "Cond. Pago":           ["Cond. Pago"],
        "Ramo":                 ["Ramo"],
        "Gr Clientes":          ["Gr Clientes"],
        "Dirección":            ["Dirección"],
        "Telefono":             ["Telefono"],
        "RIF":                  ["RIF"],
        "Ruta Transp.":         ["Ruta Transp."],
        "Poblacion":            ["Poblacion"],
        "Zona Ventas":          ["Zona Ventas"],
        "Grupo Vend.":          ["Grupo Vend."],
        "Descrip. Estado":      ["Descrip. Estado"],
        "Fecha de creacion":    ["Fecha de creacion"],
        "AG. RET.":             ["AG. RET."],
        "Ult.Fact":             ["Ult.Fact"],
        "Fecha Fact":           ["Fecha Fact"],
        "Doc.Ult.Pago":        ["Doc.Ult.Pago"],
        "Fecha Pago":           ["Fecha Pago"],
        "Nombre persona conta": ["Nombre persona conta"],
        "Teléfono móvil":       ["Teléfono móvil"],
        "Cod.Vend":             ["Cod.Vend"],
        "Nombre_vendedor":      ["Nombre_vendedor"],
        "Cód.Ger.Reg.":        ["Cód.Ger.Reg."],
        "Nombre Gte. Regional": ["Nombre Gte. Regional"],
        "Moneda":               ["Moneda"],
        "Lista":                ["Lista"],
        "Denominacion":         ["Denominacion"],
        "Canal":                ["Canal"],
        # Columnas de descripción (para catálogos + raw)
        "Descripción Cond Pag": ["Descripción Cond Pag"],
        "Descripción Ramo":     ["Descripción Ramo"],
        "Descripción Gr Clien": ["Descripción Gr Clien"],
        "Descripción Zona":     ["Descripción Zona"],
        "Descripción Grupo Ve": ["Descripción Grupo Ve"],
    },

    # ── AVAC_PH.CSV (CxP — nuevo) ────────────────────────────
    "AVAC": {
        "Soc.":                 ["Soc."],
        "Proveedor":            ["Proveedor"],
        "Nombre":               ["Nombre"],
        "Asignacion":           ["Asignacion"],
        "Referencia":           ["Referencia"],
        "Clase Doc":            ["Clase Doc"],
        "Denominación":         ["Denominación"],
        "Nº doc.":              ["Nº doc."],
        "Fecha doc.":           ["Fecha doc."],
        "Cond. Pago":           ["Cond. Pago"],
        "Desc. Pago":           ["Desc. Pago"],
        "D. Venc.":             ["D. Venc."],
        "Fecha Venc":           ["Fecha Venc"],
        "Mon.":                 ["Mon."],
        "Imp Mon Lo":           ["Imp Mon Lo"],
        "Por Vencer":           ["Por Vencer"],
        "1 -- 30":              ["1 -- 30"],
        "31 -- 60":             ["31 -- 60"],
        "61 -- 90":             ["61 -- 90"],
        "91 -- 9999":           ["91 -- 9999"],
        "Importe":              ["Importe"],
        "Importe. M":           ["Importe. M"],
        "Gr.tes.":              ["Gr.tes."],
        "Ramo":                 ["Ramo"],
        "Descr.Ramo":           ["Descr.Ramo"],
        "Ref.fact.":            ["Ref.fact."],
        "Txt.cabec.":           ["Txt.cabec."],
        "Importe Moneda Fuerte":["Importe Moneda Fuerte"],
        "Moneda":               ["Moneda"],
        "Importe MF Fecha Doc": ["Importe MF Fecha Doc"],
    },
}

# Aliases compartidos entre PEDIDOS y PEDIDOSFULL
COLUMN_ALIASES["PEDIDOSFULL"] = COLUMN_ALIASES["PEDIDOS"]

# Aliases compartidos para órdenes por planta
COLUMN_ALIASES["O_PH"] = COLUMN_ALIASES["ORDENES"]
COLUMN_ALIASES["O_HG"] = COLUMN_ALIASES["ORDENES"]
COLUMN_ALIASES["O_PM"] = COLUMN_ALIASES["ORDENES"]

# Aliases compartidos para consumos por planta
COLUMN_ALIASES["C_PH"] = COLUMN_ALIASES["CONSUMOS"]
COLUMN_ALIASES["C_HG"] = COLUMN_ALIASES["CONSUMOS"]


# ────────────────────────────────────────────────────────────────
# getv(): resolución flexible de columnas con aliases
# ────────────────────────────────────────────────────────────────

def getv(raw: Dict[str, Any], source_key: str, canonical: str,
         default: Any = None) -> Any:
    """
    Busca el valor de una columna en el dict raw usando los aliases
    registrados para esa fuente.

    Orden de búsqueda:
      1. Aliases registrados en COLUMN_ALIASES[source_key][canonical]
      2. Si no hay registro, intenta el nombre canónico directamente

    Args:
        raw: dict de la fila CSV (keys = headers)
        source_key: clave de la fuente (ej: "PHXX", "AVPH")
        canonical: nombre canónico de la columna
        default: valor por defecto si no se encuentra

    Returns:
        El valor encontrado, o default si ningún alias matchea
    """
    aliases = COLUMN_ALIASES.get(source_key, {}).get(canonical)
    if aliases:
        for alias in aliases:
            val = raw.get(alias)
            if val is not None:
                return val
    # Fallback: intentar el nombre canónico directamente
    val = raw.get(canonical)
    if val is not None:
        return val
    return default


def getv_str(raw: Dict[str, Any], source_key: str, canonical: str,
             default: Optional[str] = None) -> Optional[str]:
    """getv que garantiza retorno str o None (para raw tables)."""
    val = getv(raw, source_key, canonical)
    if val is None:
        return default
    s = str(val).strip()
    return s if s else default


# ────────────────────────────────────────────────────────────────
# validate_headers(): validación fail-fast de headers CSV
# ────────────────────────────────────────────────────────────────

def get_expected_headers(source_key: str) -> List[str]:
    """
    Devuelve la lista de headers esperados (primer alias de cada canónico)
    para una fuente dada.
    """
    aliases = COLUMN_ALIASES.get(source_key, {})
    return [alias_list[0] for alias_list in aliases.values() if alias_list]


def validate_headers(
    source_key: str,
    actual_headers: List[str],
    critical_cols: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Valida los headers reales del CSV contra los aliases registrados.

    Args:
        source_key: clave de la fuente (ej: "PHXX")
        actual_headers: headers reales leídos del CSV
        critical_cols: lista de canónicos que DEBEN existir (fail-fast)
                       Si None, usa las pk_cols como críticas

    Returns:
        dict con:
          ok: bool — True si todas las críticas están presentes
          missing_critical: list — canónicos críticos sin match en CSV
          missing_optional: list — canónicos no-críticos sin match
          unexpected: list — headers del CSV sin mapeo en aliases
          matched: dict — canónico → header real encontrado
    """
    aliases = COLUMN_ALIASES.get(source_key, {})
    actual_set = set(h.strip() for h in actual_headers if h)

    matched = {}
    missing = []

    for canonical, alias_list in aliases.items():
        found = False
        for alias in alias_list:
            if alias in actual_set:
                matched[canonical] = alias
                found = True
                break
        if not found:
            # Intentar el canónico directo
            if canonical in actual_set:
                matched[canonical] = canonical
            else:
                missing.append(canonical)

    # Headers en CSV que no están mapeados
    all_known = set()
    for alias_list in aliases.values():
        all_known.update(alias_list)
    all_known.update(aliases.keys())
    unexpected = [h for h in actual_set if h not in all_known and h]

    # Separar críticas de opcionales
    crit_set = set(critical_cols) if critical_cols else set()
    missing_critical = [c for c in missing if c in crit_set]
    missing_optional = [c for c in missing if c not in crit_set]

    return {
        "ok": len(missing_critical) == 0,
        "missing_critical": missing_critical,
        "missing_optional": missing_optional,
        "unexpected": unexpected,
        "matched": matched,
    }
