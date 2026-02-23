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
DB_NAME=teg_etl
DB_USER=etl_user
DB_PASSWORD=etl_pass
LOG_LEVEL=INFO
BATCH_SIZE=1000
```

### 3. Levantar la base de datos

```bash
docker-compose up -d
```

Esto inicia un contenedor PostgreSQL 16 accesible en `localhost:5432`.

Para verificar que esta corriendo:

```bash
docker-compose ps
```

### 4. Instalar dependencias de Python

```bash
pip install -r requirements.txt
```

> Se recomienda usar un entorno virtual:
> ```bash
> python -m venv .venv
> .venv\Scripts\activate        # Windows
> source .venv/bin/activate     # Linux/Mac
> pip install -r requirements.txt
> ```

### 5. Instalar dependencias del frontend

```bash
cd frontend
npm install
cd ..
```

## Levantar el proyecto

### Opcion A: Todos los servicios

Abrir 3 terminales y ejecutar en cada una:

**Terminal 1 - Base de datos:**
```bash
docker-compose up -d
```

**Terminal 2 - Backend API:**
```bash
uvicorn api.main:app --reload --port 8000
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

Una vez levantados los tres servicios:
- Frontend: http://localhost:5173
- API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

### Opcion B: Solo ETL (sin interfaz web)

```bash
docker-compose up -d
python -m etl.run --clientes "filesTest/Clientes Consumo - Hoja 1.csv" --ventas "filesTest/Copia de Ventas_Mes_Consumo - Copia de Hoja 1.csv" --batch-id batch_test
```

### Opcion C: ETL en modo watch (automatico)

Coloca archivos CSV en la carpeta `input/` con el formato:
- `ventas_YYYYMMDD_HHMMSS.csv` (obligatorio)
- `clientes_YYYYMMDD_HHMMSS.csv` (opcional)

Luego ejecuta:

```bash
python -m etl --watch
```

El watcher revisara la carpeta cada 5 minutos (configurable con `WATCH_POLL_SECONDS`).

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
├── api/                    # API REST (FastAPI)
│   └── main.py             # Endpoints
├── etl/                    # Pipeline ETL
│   ├── __main__.py          # Entry point (batch y watch)
│   ├── config.py            # Configuracion desde .env
│   ├── run.py               # Orquestacion del pipeline
│   ├── watcher.py           # Modo watch automatico
│   ├── db/                  # Conexion y DDL
│   ├── extract/             # Lectura de CSVs
│   ├── transform/           # Limpieza y transformacion
│   ├── load/                # Carga a BD (staging y core)
│   └── quality/             # Validacion y metricas
├── frontend/               # Interfaz web (React + Vite)
├── sql/                    # Scripts DDL (001-008)
├── tests/                  # Tests unitarios (pytest)
├── filesTest/              # Archivos CSV de prueba
├── input/                  # Directorio para modo watch
├── output/                 # CSVs enriquecidos de auditoria
├── docs/                   # Documentacion adicional
├── .env.example            # Template de configuracion
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
