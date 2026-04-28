"""Seed inicial de usuarios para auth.users.

Uso:
    python backend/seed_users.py

Idempotente: ON CONFLICT (username) DO UPDATE.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

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
        "password": "SuperAdmin#2026",
        "full_name": "Superadministrador del Sistema",
        "role": "superadmin",
        "ci": "12345678",
    },
    {
        "username": "admin",
        "password": "Admin#2026",
        "full_name": "Administrador Operativo",
        "role": "admin",
        "ci": "23456789",
    },
    {
        "username": "analista",
        "password": "Analista#2026",
        "full_name": "Analista",
        "role": "analista",
        "ci": "34567890",
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
                    INSERT INTO auth.users (username, password_hash, full_name, role, active, ci)
                    VALUES (%s, %s, %s, %s, TRUE, %s)
                    ON CONFLICT (username) DO UPDATE
                    SET
                        password_hash = EXCLUDED.password_hash,
                        full_name = EXCLUDED.full_name,
                        role = EXCLUDED.role,
                        active = TRUE,
                        ci = EXCLUDED.ci
                    """,
                    (user["username"], hashed, user["full_name"], user["role"], user.get("ci")),
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
