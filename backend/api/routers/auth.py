from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from ...auth import (
    LoginRequest,
    LoginResponse,
    UserOut,
    create_access_token,
    fetch_user_by_username,
    get_current_user,
    update_last_login,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
