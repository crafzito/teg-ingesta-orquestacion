from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ...auth import (
    LoginRequest,
    LoginResponse,
    UserOut,
    create_access_token,
    fetch_user_by_username,
    get_current_user,
    hash_password,
    update_last_login,
    verify_password,
)
from ..core import write_conn
from ..models import PasswordResetRequest, PasswordResetResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _validate_reset_password(pw: str) -> None:
    """Reglas alineadas con frontedTEG/src/utils/passwordValidation.ts."""
    if len(pw) < 8:
        raise HTTPException(status_code=400, detail="La contrasena debe tener al menos 8 caracteres")
    if not any(c.isupper() for c in pw):
        raise HTTPException(status_code=400, detail="La contrasena debe tener al menos una mayuscula")
    if not any(c.islower() for c in pw):
        raise HTTPException(status_code=400, detail="La contrasena debe tener al menos una minuscula")
    if not any(c.isdigit() for c in pw):
        raise HTTPException(status_code=400, detail="La contrasena debe tener al menos un numero")


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    user = fetch_user_by_username(req.username)
    if not user or not user["active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales invalidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales invalidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    update_last_login(user["id"])

    token = create_access_token(
        {
            "sub": str(user["id"]),
            "username": user["username"],
            "role": user["role"],
        }
    )

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut(
            id=user["id"],
            username=user["username"],
            full_name=user["full_name"],
            role=user["role"],
        ),
    )


@router.get("/me", response_model=UserOut)
def me(current_user: UserOut = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(current_user: UserOut = Depends(get_current_user)):
    # JWT es stateless: el cliente borra el token. Devolvemos 200 para
    # que el frontend pueda invocar este endpoint sin lidiar con errores.
    return {"ok": True}


# TODO: rate-limit (no hay middleware global de rate-limiting en el proyecto).
@router.post("/reset-password", response_model=PasswordResetResponse)
def reset_password(req: PasswordResetRequest):
    _validate_reset_password(req.new_password)

    generic_error = HTTPException(status_code=400, detail="Datos no coinciden")

    sql = """
        SELECT id, ci, active
        FROM auth.users
        WHERE username = %s
    """
    with write_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (req.username,))
            row = cur.fetchone()

            if not row:
                raise generic_error

            user_id, ci, active = row[0], row[1], row[2]

            if not active:
                raise generic_error

            if not ci or ci != req.ci.strip():
                raise generic_error

            new_hash = hash_password(req.new_password)
            cur.execute(
                "UPDATE auth.users SET password_hash = %s WHERE id = %s",
                (new_hash, user_id),
            )

    return PasswordResetResponse(status="ok", message="Contrasena actualizada")
