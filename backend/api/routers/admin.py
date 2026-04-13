from __future__ import annotations

import datetime
import os

from fastapi import APIRouter, Depends

from ...auth import UserOut, require_role
from ..core import ETL_MONITOR_DIRS, is_protected, readonly_conn
from ..models import (
    AdminOverviewResponse,
    AdminProtectedAction,
    AdminRoleCapability,
    AdminUserItem,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

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
