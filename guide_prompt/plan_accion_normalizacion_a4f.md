# Plan de Acción y Prompt Maestro A4F

## Objetivo
Construir una plataforma de ingesta y normalización en PostgreSQL para cargar CSV de clientes y ventas, con consultas rápidas por relaciones, manteniendo integridad y trazabilidad.

Regla clave del negocio: **el CSV de clientes conservará todos sus campos en la tabla normalizada de clientes** (con nombres claros y tipado correcto).

---

## 1) Plan de acción sólido

### Fase 0. Definiciones y contratos (Día 1)
- Definir contrato fijo de columnas para ambos CSV.
- Definir convención de nombres limpia: `snake_case`, descriptiva, sin abreviaturas ambiguas.
- Definir criterios de calidad: tipos, nulos permitidos, reglas de duplicados, reglas de rechazo.

### Fase 1. Modelo de datos PostgreSQL (Días 2-3)
- Crear capas:
  - `staging_raw` (ingesta cruda por lote)
  - `staging_clean` (tipos/limpieza)
  - `core` (modelo normalizado consultable)
- Diseñar tablas:
  - `core.dim_cliente` (con **todos los campos del CSV de clientes**)
  - `core.dim_producto`
  - `core.dim_vendedor`
  - Catálogos estándar por código/descripcion (ventas)
  - `core.fact_venta_linea` (grano: 1 fila CSV = 1 línea de venta)
- Definir PK/FK y restricciones `NOT NULL`, `UNIQUE`, `CHECK`.

### Fase 2. Catálogos estándar para ventas (Día 4)
Para estas columnas de ventas: `gpo de cliente`, `clase doc`, `sector`, `canal`, `zona vtas`, `doc comercial`, `grp vend`, `ramo`, `gr material`, `gr articulo`, `listas precios`, `tx motivo`:
- Crear tabla catálogo por dominio con estructura:
  - `catalog_id`, `code`, `description`, `is_mock`, `source_type`, `created_at`, `updated_at`
- Regla de código:
  - Si existe código oficial: usarlo.
  - Si no existe: generar código mock estable por valor normalizado.
- Regla de vacíos: usar registro `UNKNOWN` por dominio.

### Fase 3. Worker ETL (Días 5-6)
- Pipeline deterministico:
  - `extract -> raw -> clean -> resolver catálogos -> upsert dimensiones -> upsert fact`
- Reglas clave:
  - Parseo robusto de fechas múltiples formatos.
  - Parseo decimal con coma.
  - Detección de duplicados.
  - Cliente faltante en ventas: crear cliente placeholder y marcar para conciliación.
- Generar salida de auditoría por lote:
  - CSV enriquecido con columnas `cod_*` al final.

### Fase 4. Rendimiento y escalabilidad (Día 7)
- Índices obligatorios:
  - Todos los FKs en `fact_venta_linea`
  - `(fecha_doc)`, `(cliente_id, fecha_doc)`, `(producto_id, fecha_doc)`, `(vendedor_id, fecha_doc)`, `(num_factura)`
- Particionado mensual por `fecha_doc` para `fact_venta_linea`.
- Mantenimiento: `ANALYZE`, `VACUUM` y monitoreo de planes de ejecución.

### Fase 5. API de consulta con FastAPI (Días 8-9)
Si se habilita capa API, usar **FastAPI**:
- `GET /api/v1/ventas` (filtros por códigos, cliente, producto, fecha, paginación)
- `GET /api/v1/clientes/{cod_cliente}`
- `GET /api/v1/catalogos/{dominio}`
- `POST /api/v1/ingestas` (trigger opcional para ejecutar lote)

Arquitectura recomendada FastAPI:
- `app/api/`, `app/schemas/`, `app/services/`, `app/repositories/`, `app/core/`
- SQLAlchemy async + Pydantic + DI con `Depends`.

### Fase 6. Pruebas y aceptación (Días 10-11)
- Unit tests:
  - parseo fechas, parseo montos, generación de códigos mock estables, regla `UNKNOWN`
- Integración:
  - carga clientes+ventas, integridad FK, idempotencia por lote
- Performance:
  - objetivo mínimo: p95 < 300 ms en consultas de filtro sobre 500k filas

### Fase 7. Operación y gobierno (Día 12)
- Scheduler simple para lotes (cron/Task Scheduler).
- Bitácora de lotes: `etl_batch`, `etl_warnings`, `etl_rejects`, `etl_metrics`.
- Reproceso por `batch_id` y trazabilidad completa.

---

## 2) Nomenclatura limpia recomendada

### 2.1 Cliente (todos los campos se conservan)
Tabla: `core.dim_cliente`

Mapeo recomendado (CSV -> columna final):
- `Cod. Cliente` -> `cod_cliente`
- `Nombre Sol.` -> `nombre_cliente`
- `Cond. Pago` -> `cod_condicion_pago`
- `Descripción Cond Pag` -> `desc_condicion_pago`
- `Ramo` -> `cod_ramo_cliente`
- `Descripción Ramo` -> `desc_ramo_cliente`
- `Gr Clientes` -> `cod_grupo_cliente`
- `Descripción Gr Clien` -> `desc_grupo_cliente`
- `Dirección` -> `direccion`
- `Telefono` -> `telefono_fijo`
- `RIF` -> `rif`
- `Ruta Transp.` -> `cod_ruta_transporte`
- `Poblacion` -> `poblacion`
- `Zona Ventas` -> `cod_zona_ventas`
- `Descripción Zona` -> `desc_zona_ventas`
- `Grupo Vend.` -> `cod_grupo_vendedor`
- `Descripción Grupo Ve` -> `desc_grupo_vendedor`
- `Descrip. Estado` -> `estado`
- `Fecha de creacion` -> `fecha_creacion_cliente`
- `AG. RET.` -> `agente_retencion_flag`
- `Ult.Fact` -> `num_ultima_factura`
- `Fecha Fact` -> `fecha_ultima_factura`
- `Doc.Ult.Pago` -> `num_ultimo_pago`
- `Fecha Pago` -> `fecha_ultimo_pago`
- `Nombre persona conta` -> `nombre_contacto`
- `Teléfono móvil` -> `telefono_movil_contacto`
- `Cod.Vend` -> `cod_vendedor`
- `Nombre_vendedor` -> `nombre_vendedor`
- `Cód.Ger.Reg.` -> `cod_gerente_regional`
- `Nombre Gte. Regional` -> `nombre_gerente_regional`
- `Moneda` -> `cod_moneda`
- `Lista` -> `cod_lista_precio_cliente`
- `Denominacion` -> `desc_lista_precio_cliente`
- `Canal` -> `cod_canal_cliente`
- `fecha actual` -> `fecha_corte_archivo`
- `Dias ult fact` -> `dias_sin_facturar`

### 2.2 Ventas (limpio + relacional)
Tabla: `core.fact_venta_linea`

Principio: en ventas guardar claves (`*_id` / `cod_*`) y métricas; descripciones se consultan vía JOIN a catálogos.

---

## 3) Prompt maestro A4F (listo para usar)

```text
1) GLOBAL SYSTEM PROMPT (GSP)
Eres un Arquitecto de Datos + Data Engineer senior. Diseñas e implementas una plataforma de normalización CSV->PostgreSQL orientada a consulta rápida.
Mandatos:
- Sigue EXACTAMENTE las 8 secciones A4F.
- Nombres finales limpios, claros y consistentes en snake_case.
- Sin placeholders ambiguos.
- Entrega SQL ejecutable, plan ETL, pruebas y criterios de aceptación.

2) PROJECT SYSTEM PROMPT (PSP)
Proyecto de grado: plataforma de ingesta y orquestación de datos.
Entradas fijas:
- filesTest/Clientes Consumo - Hoja 1.csv
- filesTest/Copia de Ventas_Mes_Consumo - Copia de Hoja 1.csv
Requisitos:
- PostgreSQL obligatorio.
- El CSV de clientes debe conservar todos los campos en la tabla normalizada de cliente.
- En ventas, los campos estándar deben ir por código/FK a tablas catálogo.
- Capacidad objetivo: 500k registros con filtros rápidos.
- Si se crea API, usar FastAPI.

3) OPEN SOURCE PROJECTS REFERENCE
- FastAPI: https://github.com/fastapi/fastapi
- SQLAlchemy: https://github.com/sqlalchemy/sqlalchemy
- Alembic: https://github.com/sqlalchemy/alembic
- pytest: https://github.com/pytest-dev/pytest
- PostgreSQL: https://github.com/postgres/postgres

4) KEY PAPERS
- ACE: https://arxiv.org/abs/2510.04618
- RLM: https://arxiv.org/abs/2512.24601

5) EXAMPLE (OUTPUT CONTRACT)
Debes entregar:
A) Plan por fases con riesgos y mitigación.
B) Modelo lógico y físico (DDL PostgreSQL, PK/FK/índices/particiones).
C) Mapeo completo CSV->columnas normalizadas.
D) Diseño del worker ETL idempotente.
E) Catálogos estándar para ventas con política de códigos (oficial primero, mock estable fallback).
F) Estrategia de rendimiento para 500k+.
G) Plan de pruebas y DoD medible.
H) Si aplica API: endpoints FastAPI para consulta y trigger de ingesta.

6) PREVIOUS CODE / FUENTES DE VERDAD
[CONTEXT_PACK]
[FILES]
- filesTest/Clientes Consumo - Hoja 1.csv
- filesTest/Copia de Ventas_Mes_Consumo - Copia de Hoja 1.csv
[RULES]
- Clientes conserva todos los campos del CSV.
- Ventas usa códigos/FK para campos estándar.
- Vacíos de catálogo -> UNKNOWN.
- Códigos mock estables por valor normalizado cuando no exista código oficial.
[/CONTEXT_PACK]

7) CHALLENGE PROMPT
Diseña el plan completo e implementable para producción académica:
- Capa staging/raw/clean/core.
- Tablas catálogo por dominio para: gpo_cliente, clase_doc, sector, canal, zona_ventas, doc_comercial, grp_vend, ramo, gr_material, gr_articulo, lista_precio, tx_motivo.
- fact_venta_linea con grano 1 fila CSV.
- CSV enriquecido de auditoría con cod_* al final.
- Índices, particiones y consultas SQL de ejemplo.
- Pruebas unitarias, integración y performance.

8) BASES V2.0
- Cargas incrementales avanzadas y CDC.
- Observabilidad completa de pipeline.
- Capa semántica para BI.
- Endurecimiento de API y seguridad.
```

---

## 4) Definition of Done (DoD)
- Existe modelo PostgreSQL normalizado y documentado.
- `dim_cliente` conserva todos los campos del CSV de clientes con nombres limpios.
- `fact_venta_linea` usa códigos/FK para catálogos estándar.
- Worker ETL idempotente y auditable por `batch_id`.
- Índices/particiones aplicados para 500k+.
- Si se habilita API, FastAPI operativo con endpoints de consulta.
- Suite de pruebas ejecutable y criterio de rendimiento validado.
