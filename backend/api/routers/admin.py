from __future__ import annotations

import datetime
import json
import os

from fastapi import APIRouter, Depends, HTTPException, status

from ...auth import VALID_ROLES, UserOut, get_current_user, hash_password, require_role
from ..core import ETL_MONITOR_DIRS, is_protected, readonly_conn, write_conn
from ..models import (
    AdminOverviewResponse,
    AdminProtectedAction,
    AdminRoleCapability,
    AdminUserItem,
    CreateUserRequest,
    DbTableInfo,
    DbTablesResponse,
    DbTablesSummary,
    SidebarConfigItem,
    SidebarConfigUpdate,
    UpdateUserRequest,
    UserDetail,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def validate_password(pw: str) -> None:
    """Enforce password policy: min 8 chars, 1 upper, 1 lower, 1 digit."""
    if len(pw) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contrasena debe tener al menos 8 caracteres",
        )
    if not any(c.isupper() for c in pw):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contrasena debe tener al menos una mayuscula",
        )
    if not any(c.islower() for c in pw):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contrasena debe tener al menos una minuscula",
        )
    if not any(c.isdigit() for c in pw):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contrasena debe tener al menos un numero",
        )


_SUPERADMIN_ONLY = {"superadmin"}
_ROLE_ORDER = {"superadmin": 0, "admin": 1, "analista": 2}
_ROLE_MATRIX = [
    AdminRoleCapability(
        role="superadmin",
        summary="Gobernanza total del sistema",
        capabilities=[
            "Administración y auditoría del sistema",
            "Lectura de negocio, monitor ETL y operación completa",
            "Refresco de metadatos y acciones administrativas sensibles",
            "Gestión de usuarios seeded y políticas visibles",
        ],
    ),
    AdminRoleCapability(
        role="admin",
        summary="Operación, ETL y monitoreo",
        capabilities=[
            "Dashboards y consulta de negocio",
            "Monitor ETL, ejecución manual y lineage",
            "Exploración de esquema y vistas en modo operativo",
            "Sin acceso a administración ni acciones globales sensibles",
        ],
    ),
    AdminRoleCapability(
        role="analista",
        summary="Consulta y análisis",
        capabilities=[
            "Dashboards y páginas analíticas",
            "Filtros y navegación de datos",
            "Sin ETL, sin monitoreo sensible y sin administración",
        ],
    ),
]
_PROTECTED_ACTIONS = [
    AdminProtectedAction(
        key="schema_refresh",
        label="Refrescar caché de esquema",
        endpoint="/api/schema/refresh",
        required_role="superadmin",
        description="Actualiza metadatos de esquema y vistas para toda la aplicación.",
    ),
    AdminProtectedAction(
        key="looker_delete",
        label="Eliminar vistas personalizadas",
        endpoint="/api/looker/views/{view_name}",
        required_role="superadmin",
        description="Borra vistas personalizadas en public; operación sensible por impacto global.",
    ),
    AdminProtectedAction(
        key="etl_run",
        label="Ejecutar ETL manual",
        endpoint="/api/etl/run",
        required_role="admin|superadmin",
        description="Disponible para operación diaria y monitoreo del pipeline.",
    ),
]


@router.get("/summary", response_model=AdminOverviewResponse)
def get_admin_summary(current_user: UserOut = Depends(require_role(_SUPERADMIN_ONLY))):
    with readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, full_name, role, active, last_login
                FROM auth.users
                ORDER BY username
                """
            )
            user_rows = cur.fetchall()

            cur.execute(
                """
                SELECT viewname
                FROM pg_views
                WHERE schemaname = 'public'
                ORDER BY viewname
                """
            )
            public_views = [row[0] for row in cur.fetchall()]

    users = [
        AdminUserItem(
            id=int(row[0]),
            username=row[1],
            full_name=row[2],
            role=row[3],
            active=bool(row[4]),
            last_login=row[5],
        )
        for row in sorted(user_rows, key=lambda row: (_ROLE_ORDER.get(row[3], 99), row[1]))
    ]

    return AdminOverviewResponse(
        generated_at=datetime.datetime.now(datetime.timezone.utc),
        total_users=len(users),
        active_users=sum(1 for user in users if user.active),
        superadmin_count=sum(1 for user in users if user.role == "superadmin"),
        admin_count=sum(1 for user in users if user.role == "admin"),
        analyst_count=sum(1 for user in users if user.role == "analista"),
        custom_public_views=sum(1 for name in public_views if not is_protected(name)),
        protected_public_views=sum(1 for name in public_views if is_protected(name)),
        monitored_directories=[str(path) for path in ETL_MONITOR_DIRS],
        system_flags={
            "db_name": os.getenv("DB_NAME", "sap_etl"),
            "db_host": os.getenv("DB_HOST", "localhost"),
            "schema_refresh_role": "superadmin",
            "looker_delete_role": "superadmin",
            "etl_operator_roles": "admin,superadmin",
        },
        users=users,
        protected_actions=_PROTECTED_ACTIONS,
        role_matrix=_ROLE_MATRIX,
    )


@router.get("/db-tables", response_model=DbTablesResponse)
def get_db_tables(current_user: UserOut = Depends(require_role(_SUPERADMIN_ONLY))):
    with readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    s.schemaname,
                    s.relname,
                    s.n_live_tup,
                    pg_total_relation_size(quote_ident(s.schemaname) || '.' || quote_ident(s.relname)) AS total_size_bytes,
                    pg_size_pretty(pg_total_relation_size(quote_ident(s.schemaname) || '.' || quote_ident(s.relname))) AS total_size_pretty
                FROM pg_stat_user_tables s
                ORDER BY s.schemaname, s.relname
                """
            )
            rows = cur.fetchall()

            cur.execute(
                """
                SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))))
                FROM pg_stat_user_tables
                """
            )
            total_size_pretty = cur.fetchone()[0] or "0 bytes"

    tables = [
        DbTableInfo(
            schema=row[0],
            table_name=row[1],
            row_count=int(row[2]),
            total_size_bytes=int(row[3]),
            total_size_pretty=row[4],
        )
        for row in rows
    ]

    return DbTablesResponse(
        tables=tables,
        summary=DbTablesSummary(
            total_tables=len(tables),
            total_size_pretty=total_size_pretty,
        ),
    )


def _row_to_user_detail(row: tuple) -> UserDetail:
    return UserDetail(
        id=int(row[0]),
        username=row[1],
        full_name=row[2],
        role=row[3],
        active=bool(row[4]),
        last_login=row[5],
        created_at=row[6],
    )


_USER_DETAIL_COLS = "id, username, full_name, role, active, last_login, created_at"


@router.post("/users", response_model=UserDetail, status_code=status.HTTP_201_CREATED)
def create_user(
    req: CreateUserRequest,
    current_user: UserOut = Depends(require_role(_SUPERADMIN_ONLY)),
):
    if req.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rol invalido: '{req.role}'. Roles validos: {list(VALID_ROLES)}",
        )

    validate_password(req.password)

    password_hash = hash_password(req.password)

    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM auth.users WHERE username = %s",
                (req.username,),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"El usuario '{req.username}' ya existe",
                )

            cur.execute(
                f"""
                INSERT INTO auth.users (username, password_hash, full_name, role)
                VALUES (%s, %s, %s, %s)
                RETURNING {_USER_DETAIL_COLS}
                """,
                (req.username, password_hash, req.full_name, req.role),
            )
            row = cur.fetchone()

    return _row_to_user_detail(row)


@router.put("/users/{user_id}", response_model=UserDetail)
def update_user(
    user_id: int,
    req: UpdateUserRequest,
    current_user: UserOut = Depends(require_role(_SUPERADMIN_ONLY)),
):
    sets: list[str] = []
    params: list = []

    if req.full_name is not None:
        sets.append("full_name = %s")
        params.append(req.full_name)

    if req.role is not None:
        if req.role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rol invalido: '{req.role}'. Roles validos: {list(VALID_ROLES)}",
            )
        sets.append("role = %s")
        params.append(req.role)

    if req.password is not None and req.password != "":
        validate_password(req.password)
        sets.append("password_hash = %s")
        params.append(hash_password(req.password))

    if not sets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se proporcionaron campos para actualizar",
        )

    params.append(user_id)

    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE auth.users
                SET {', '.join(sets)}
                WHERE id = %s
                RETURNING {_USER_DETAIL_COLS}
                """,
                params,
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con id {user_id} no encontrado",
        )

    return _row_to_user_detail(row)


@router.patch("/users/{user_id}/toggle", response_model=UserDetail)
def toggle_user_active(
    user_id: int,
    current_user: UserOut = Depends(require_role(_SUPERADMIN_ONLY)),
):
    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE auth.users
                SET active = NOT active
                WHERE id = %s
                RETURNING {_USER_DETAIL_COLS}
                """,
                (user_id,),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con id {user_id} no encontrado",
        )

    return _row_to_user_detail(row)


@router.get("/sidebar-config", response_model=dict[str, dict[str, bool]])
def get_sidebar_config(current_user: UserOut = Depends(get_current_user)):
    """Any authenticated user can read sidebar config (needed on login)."""
    with readonly_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT role, sections FROM auth.sidebar_config ORDER BY role")
            rows = cur.fetchall()

    return {row[0]: row[1] for row in rows}


@router.put("/sidebar-config", response_model=SidebarConfigItem)
def update_sidebar_config(
    req: SidebarConfigUpdate,
    current_user: UserOut = Depends(require_role(_SUPERADMIN_ONLY)),
):
    """Superadmin upserts sidebar section visibility for a role."""
    if req.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rol invalido: '{req.role}'. Roles validos: {list(VALID_ROLES)}",
        )

    sections_json = json.dumps(req.sections)

    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO auth.sidebar_config (role, sections)
                VALUES (%s, %s::jsonb)
                ON CONFLICT (role) DO UPDATE SET sections = EXCLUDED.sections
                RETURNING role, sections
                """,
                (req.role, sections_json),
            )
            row = cur.fetchone()

    return SidebarConfigItem(role=row[0], sections=row[1])
