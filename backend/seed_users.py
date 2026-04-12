"""Seed inicial de usuarios para auth.users.

Uso:
    python backend/seed_users.py

Lee la conexion de DB del mismo .env que usa backend/main.py.
Idempotente: ON CONFLICT (username) DO UPDATE.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Aseguramos que el repo este en sys.path para poder importar backend.*
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402
import psycopg2  # noqa: E402

from backend.auth import hash_password  # noqa: E402

load_dotenv()

SEED_USERS = [
    {
        "username": "superadmin",
        "password": "Admin#2026",
        "full_name": "Super Administrador",
        "role": "superadmin",
    },
    {
        "username": "admin",
        "password": "Admin#2026",
        "full_name": "Administrador",
        "role": "admin",
    },
    {
        "username": "analista",
        "password": "Analista#2026",
        "full_name": "Analista",
        "role": "analista",
    },
]


def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "sap_etl"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
    )


def main() -> int:
    print(f"Conectando a {os.getenv('DB_NAME', 'sap_etl')}@{os.getenv('DB_HOST', 'localhost')}...")
    conn = get_connection()
    conn.autocommit = False
    inserted = 0
    skipped = 0
    try:
        with conn.cursor() as cur:
            for user in SEED_USERS:
                hashed = hash_password(user["password"])
                cur.execute(
                    """
                    INSERT INTO auth.users (username, password_hash, full_name, role, active)
                    VALUES (%s, %s, %s, %s, TRUE)
                    ON CONFLICT (username) DO UPDATE
                    SET
                        password_hash = EXCLUDED.password_hash,
                        full_name = EXCLUDED.full_name,
                        role = EXCLUDED.role,
                        active = TRUE
                    """,
                    (user["username"], hashed, user["full_name"], user["role"]),
                )
                if cur.rowcount > 0:
                    inserted += 1
                    print(f"  [+] {user['username']} ({user['role']}) creado/actualizado")
                else:
                    skipped += 1
                    print(f"  [=] {user['username']} ya existia, no se modifica")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"\nResumen: {inserted} creado(s), {skipped} ya existente(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
