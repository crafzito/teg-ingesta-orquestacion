# TEG - Pipeline ETL + Explorador de Datos

Pipeline ETL (Extract, Transform, Load) con API REST y frontend web para procesamiento de datos de clientes y ventas desde archivos CSV hacia un data warehouse en PostgreSQL.

## Arquitectura

| Componente | Tecnologia | Puerto |
|------------|------------|--------|
| Base de datos | PostgreSQL 16 (Docker) | 5432 |
| Backend API | FastAPI + Uvicorn (Python) | 8000 |
| Frontend | React 19 + TypeScript + Vite | 5173 |
| ETL | Python (batch o watch mode) | - |

## Requisitos previos

- **Python** 3.12+
- **Node.js** 18+
- **Docker** y **Docker Compose**
- **Git** (opcional)

## Instalacion

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd TEG
```

### 2. Configurar variables de entorno

Copiar el archivo de ejemplo y ajustar si es necesario:

```bash
cp .env.example .env
```

Contenido por defecto de `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sap_etl
DB_USER=postgres
DB_PASSWORD=postgres
SAP_CSV_DIR=data/input
```

### 3. Levantar todo con un solo comando (Windows)

```powershell
.\start.ps1
```

Esto prepara el entorno y levanta:

- PostgreSQL en Docker
- Backend FastAPI en `http://localhost:8000`
- Watcher ETL sobre `data/input/`
- Frontend Vite en `http://localhost:5173`

Para iniciar todo y correr ademas una carga ETL inicial:

```powershell
.\start.ps1 -ETL
```

Variantes utiles:

- `.\start.ps1 -NoFrontend` -> backend + ETL + postgres
- `.\start.ps1 -NoWatcher` -> backend + frontend + postgres
- `.\start.ps1 -SkipSchema` -> no reaplica `sql/schema.sql`
- `.\start.ps1 -SkipDocker` -> asume que `sap_etl_postgres` ya existe y esta corriendo
- `.\start.ps1 -BackendOnly` -> solo backend en foreground

Para detener los servicios lanzados en background:

```powershell
.\stop.ps1
```

## Levantar el proyecto

### Opcion A: Stack completo recomendado

```powershell
.\start.ps1
```

Una vez levantado el stack:
- Frontend: http://localhost:5173
- API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

### Opcion B: Solo ETL (sin interfaz web)

```powershell
.\start.ps1 -NoFrontend -ETL
```

### Opcion C: ETL en modo watch (automatico)

Si ya preparaste el entorno y solo quieres correr el watcher manualmente:

```powershell
.venv\Scripts\python.exe etl\watcher.py --dir data\input
```

Para una corrida ETL manual unica:

```powershell
.venv\Scripts\python.exe etl\pipeline.py --dir data\input
```

## Ejecutar tests

### Tests unitarios (Python)

```bash
pip install pytest
pytest tests/ -v
```

Tests disponibles:
- `tests/test_cleaners.py` - Validacion de limpieza de datos
- `tests/test_catalog_resolver.py` - Resolucion de catalogos/dimensiones
- `tests/test_parsers.py` - Parseo y conversion de tipos

### Lint del frontend

```bash
cd frontend
npm run lint
```

### Build del frontend

```bash
cd frontend
npm run build
```

## Endpoints de la API

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/health` | Health check (valida conexion a BD) |
| GET | `/api/schema` | Lista tablas y vistas de los schemas staging y core |
| POST | `/api/schema/refresh` | Refresca cache del schema |
| POST | `/api/query` | Ejecuta consultas SQL de solo lectura |

### Ejemplo de consulta

```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM core.dim_cliente LIMIT 10"}'
```

## Estructura del proyecto

```
TEG/
├── backend/                # API REST (FastAPI)
│   └── main.py             # Endpoints
├── etl/                    # Pipeline ETL
│   ├── pipeline.py          # Corrida batch del ETL
│   ├── watcher.py           # Modo watch automatico
│   ├── config/              # Contratos y fuentes
│   ├── cleaners/            # Transformaciones
│   ├── loaders/             # Carga a PostgreSQL
│   └── parsers/             # Parseo y helpers
├── frontend/               # Interfaz web (React + Vite)
├── sql/                    # Scripts DDL (001-008)
├── tests/                  # Tests unitarios (pytest)
├── data/                   # Archivos de datos
│   ├── input/              # Directorio para modo watch
│   ├── output/             # CSVs enriquecidos de auditoria
│   └── samples/            # Archivos CSV de prueba
├── docs/                   # Documentacion adicional
│   └── guide_prompt/       # Guias y ejemplos de prompts
├── .env.example            # Template de configuracion
├── start.ps1               # Orquesta el stack local
├── stop.ps1                # Detiene servicios locales
├── docker-compose.yml      # PostgreSQL containerizado
└── requirements.txt        # Dependencias Python
```

## Troubleshooting

**El backend no conecta a la BD:**
- Verificar que el contenedor corre: `docker-compose ps`
- Verificar que las variables de `.env` coinciden con `docker-compose.yml`

**Error de puerto en uso (5432):**
- Detener PostgreSQL local si esta corriendo, o cambiar el puerto en `docker-compose.yml` y `.env`

**El frontend no conecta al backend:**
- Verificar que el backend corre en puerto 8000 (el proxy de Vite redirige `/api` hacia `http://localhost:8000`)

**Reiniciar desde cero la BD:**
```bash
docker-compose down -v
docker-compose up -d
```
