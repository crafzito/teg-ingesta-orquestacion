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
    batch_id: str | None = None
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


class EtlBatchFileItem(BaseModel):
    id: int
    batch_id: str
    source_key: str | None
    filename: str
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


class EtlBatchItem(BaseModel):
    batch_id: str
    trigger_type: str
    scope: str
    status: str
    data_dir: str | None
    started_at: datetime.datetime | None
    heartbeat_at: datetime.datetime | None
    finished_at: datetime.datetime | None
    file_count: int
    source_count: int
    files_received: int
    files_processing: int
    files_success: int
    files_failed: int
    rows_read_total: int
    rows_inserted_total: int
    rows_updated_total: int
    rows_rejected_total: int
    error_message: str | None
    files: list[EtlBatchFileItem] = Field(default_factory=list)


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
    running_batches: int = 0
    successful_batches: int = 0
    failed_batches: int = 0
    last_batch_id: str | None = None
    last_batch_status: str | None = None
    batch_id: str | None = None
    batch_rows_total: int = 0


class EtlMonitorResponse(BaseModel):
    generated_at: datetime.datetime
    database_available: bool
    database_error: str | None
    summary: EtlMonitorSummary
    current_runs: list[EtlExecutionItem]
    latest_execution: EtlExecutionItem | None
    recent_executions: list[EtlExecutionItem]
    source_status: list[EtlSourceStatus]
    current_batches: list[EtlBatchItem] = Field(default_factory=list)
    recent_batches: list[EtlBatchItem] = Field(default_factory=list)
    directories: list[EtlDirectorySummary]


class EtlRunRequest(BaseModel):
    data_dir: str = Field(default="data/input", max_length=500)
    source: str | None = Field(default=None, max_length=50)
    dry_run: bool = False
    skip_raw: bool = False


class EtlRunResponse(BaseModel):
    status: str
    message: str
    pid: int | None = None
    data_dir: str | None = None


class AdminUserItem(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: str
    active: bool
    last_login: datetime.datetime | None
    ci: str | None = None


class AdminProtectedAction(BaseModel):
    key: str
    label: str
    endpoint: str
    required_role: str
    description: str


class AdminRoleCapability(BaseModel):
    role: str
    summary: str
    capabilities: list[str]


class AdminOverviewResponse(BaseModel):
    generated_at: datetime.datetime
    total_users: int
    active_users: int
    superadmin_count: int
    admin_count: int
    analyst_count: int
    custom_public_views: int
    protected_public_views: int
    monitored_directories: list[str]
    system_flags: dict[str, str]
    users: list[AdminUserItem]
    protected_actions: list[AdminProtectedAction]
    role_matrix: list[AdminRoleCapability]


class DbTableInfo(BaseModel):
    schema: str
    table_name: str
    row_count: int
    total_size_bytes: int
    total_size_pretty: str


class DbTablesSummary(BaseModel):
    total_tables: int
    total_size_pretty: str


class DbTablesResponse(BaseModel):
    tables: list[DbTableInfo]
    summary: DbTablesSummary


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=8, max_length=200)
    full_name: str = Field(..., min_length=1, max_length=200)
    role: str = Field(..., min_length=1, max_length=20)
    ci: str | None = Field(default=None, max_length=20)


class UpdateUserRequest(BaseModel):
    full_name: str | None = None
    role: str | None = None
    password: str | None = None
    ci: str | None = None


class UserDetail(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: str
    active: bool
    last_login: datetime.datetime | None
    created_at: datetime.datetime | None
    ci: str | None = None


class PasswordResetRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    ci: str = Field(..., min_length=1, max_length=20)
    new_password: str = Field(..., min_length=1, max_length=200)


class PasswordResetResponse(BaseModel):
    status: str
    message: str


class SidebarConfigUpdate(BaseModel):
    role: str = Field(..., min_length=1, max_length=20)
    sections: dict[str, bool]


class SidebarConfigItem(BaseModel):
    role: str
    sections: dict[str, bool]
