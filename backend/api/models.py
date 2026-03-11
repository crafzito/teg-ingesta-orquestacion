import datetime

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    sql: str = Field(..., min_length=1, max_length=10_000)
    limit: int = Field(default=1000, ge=1, le=10_000)


class QueryResponse(BaseModel):
    columns: list[str]
    rows: list[list]
    row_count: int
    execution_time_ms: float
    truncated: bool


class SchemaTable(BaseModel):
    schema_name: str
    table_name: str
    table_type: str


class SchemaColumn(BaseModel):
    schema_name: str
    table_name: str
    column_name: str
    ordinal_position: int
    data_type: str
    is_nullable: bool
    column_default: str | None
    is_primary_key: bool


class SchemaRelation(BaseModel):
    constraint_name: str
    source_schema: str
    source_table: str
    source_column: str
    target_schema: str
    target_table: str
    target_column: str


class ViewFilter(BaseModel):
    column: str = Field(..., min_length=1, max_length=100)
    operator: str = Field(..., min_length=1, max_length=6)
    value: str = Field(..., max_length=500)


class CreateLookerViewRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=63)
    base_view: str = Field(..., min_length=3, max_length=130)
    description: str = Field(default="", max_length=500)
    filters: list[ViewFilter] = Field(default_factory=list)


class LookerView(BaseModel):
    name: str
    view_definition: str
    is_custom: bool
    category: str
    description: str


class BaseView(BaseModel):
    schema_name: str
    view_name: str
    full_name: str
    label: str


class ViewColumn(BaseModel):
    column_name: str
    data_type: str


class LineageSource(BaseModel):
    source_key: str
    file_name: str
    target_schema: str
    target_table: str
    role: str
    pk_cols: list[str]
    upsert_mode: str


class LogicalRelation(BaseModel):
    source_key: str
    source_column: str
    target_table: str
    target_column: str
    confidence: str
    evidence: str


class EtlFileEntry(BaseModel):
    name: str
    extension: str
    size_bytes: int
    modified_at: datetime.datetime | None


class EtlDirectorySummary(BaseModel):
    name: str
    path: str
    exists: bool
    total_files: int
    csv_files: int
    xlsx_files: int
    latest_file_at: datetime.datetime | None
    files: list[EtlFileEntry]


class EtlExecutionItem(BaseModel):
    id: int
    source_key: str
    filepath: str
    status: str
    started_at: datetime.datetime | None
    finished_at: datetime.datetime | None
    rows_read: int
    rows_inserted: int
    rows_updated: int
    rows_skipped: int
    rows_rejected: int
    error_message: str | None


class EtlSourceStatus(BaseModel):
    archivo: str
    estado: str
    ultima_carga: str | None
    leidas: int
    nuevas: int
    actualizadas: int
    sin_cambios: int
    rechazadas: int
    pct_sin_cambios: str
    error: str | None


class EtlMonitorSummary(BaseModel):
    monitored_directories: int
    total_files: int
    csv_files: int
    xlsx_files: int
    latest_modified_file_at: datetime.datetime | None
    running_count: int
    successful_executions: int
    failed_executions: int
    last_started_at: datetime.datetime | None
    last_finished_at: datetime.datetime | None
    last_success_at: datetime.datetime | None
    last_failure_at: datetime.datetime | None
    total_sources: int
    sources_ok: int
    sources_failed: int
    sources_running: int


class EtlMonitorResponse(BaseModel):
    generated_at: datetime.datetime
    database_available: bool
    database_error: str | None
    summary: EtlMonitorSummary
    current_runs: list[EtlExecutionItem]
    latest_execution: EtlExecutionItem | None
    recent_executions: list[EtlExecutionItem]
    source_status: list[EtlSourceStatus]
    directories: list[EtlDirectorySummary]
