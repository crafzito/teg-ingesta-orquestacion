"""Autenticacion y autorizacion (JWT + roles) para el backend TEG."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Iterable

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field

from .api.core import write_conn

# ---------------------------------------------------------------------------
# Configuracion
# ---------------------------------------------------------------------------

JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "dev-only-change-me-in-production-9f8a7b6c5d4e3f2a1b0c",
)
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 8
VALID_ROLES = ("superadmin", "admin", "analista")

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Hashing
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(plain, hashed)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def create_access_token(data: dict) -> str:
    to_encode = dict(data)
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token invalido: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise _UNAUTHORIZED

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise _UNAUTHORIZED

    return parts[1]


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=200)


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def fetch_user_by_username(username: str) -> dict | None:
    sql = """
        SELECT id, username, password_hash, full_name, role, active
        FROM auth.users
        WHERE username = %s
    """
    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (username,))
            row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "username": row[1],
        "password_hash": row[2],
        "full_name": row[3],
        "role": row[4],
        "active": row[5],
    }


def fetch_user_by_id(user_id: int) -> dict | None:
    sql = """
        SELECT id, username, password_hash, full_name, role, active
        FROM auth.users
        WHERE id = %s
    """
    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (user_id,))
            row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "username": row[1],
        "password_hash": row[2],
        "full_name": row[3],
        "role": row[4],
        "active": row[5],
    }


def update_last_login(user_id: int) -> None:
    sql = "UPDATE auth.users SET last_login = now() WHERE id = %s"
    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (user_id,))


# ---------------------------------------------------------------------------
# Dependencias FastAPI
# ---------------------------------------------------------------------------

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="No autenticado",
    headers={"WWW-Authenticate": "Bearer"},
)


def resolve_user_from_token(token: str | None) -> UserOut:
    if not token:
        raise _UNAUTHORIZED

    payload = decode_token(token)

    user_id = payload.get("sub")
    if user_id is None:
        raise _UNAUTHORIZED

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError) as exc:
        raise _UNAUTHORIZED from exc

    user = fetch_user_by_id(user_id_int)
    if not user or not user["active"]:
        raise _UNAUTHORIZED

    return UserOut(
        id=user["id"],
        username=user["username"],
        full_name=user["full_name"],
        role=user["role"],
    )


def get_current_user(authorization: str | None = Header(default=None)) -> UserOut:
    return resolve_user_from_token(extract_bearer_token(authorization))


def require_role(allowed: Iterable[str]):
    allowed_set = set(allowed)
    invalid_roles = sorted(role for role in allowed_set if role not in VALID_ROLES)
    if invalid_roles:
        raise ValueError(f"Roles invalidos en require_role: {invalid_roles}")

    def _checker(current_user: UserOut = Depends(get_current_user)) -> UserOut:
        if current_user.role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Permiso denegado: rol '{current_user.role}' no tiene "
                    f"acceso (requiere uno de {sorted(allowed_set)})"
                ),
            )
        return current_user

    return _checker
