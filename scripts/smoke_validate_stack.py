#!/usr/bin/env python3
"""Smoke e2e del stack TEG: auth, roles, ETL, monitor, watcher y KPIs."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import psycopg2

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_API_BASE = 'http://127.0.0.1:8000/api'
DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / 'data' / 'generated' / 'validation'
BATCH_ID_RE = re.compile(r'batch\s+([\w-]+)')


@dataclass
class HttpResult:
    status: int
    payload: dict


class ValidationError(RuntimeError):
    pass


def http_json(method: str, url: str, *, body: dict | None = None, token: str | None = None, expected_status: int | None = 200) -> HttpResult:
    data = json.dumps(body).encode('utf-8') if body is not None else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode('utf-8') or '{}'
            payload = json.loads(raw)
            result = HttpResult(status=response.status, payload=payload)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode('utf-8') or '{}'
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {'detail': raw or exc.reason}
        result = HttpResult(status=exc.code, payload=payload)
    except urllib.error.URLError as exc:
        raise ValidationError(f'No se pudo conectar a {url}: {exc}') from exc

    if expected_status is not None and result.status != expected_status:
        raise ValidationError(f'{method} {url} devolvió {result.status}: {result.payload}')

    return result


def db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', '5432')),
        dbname=os.getenv('DB_NAME', 'sap_etl'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'postgres'),
    )


def query_metrics(api_base: str, token: str) -> dict[str, float]:
    queries = {
        'ventas_rows': 'SELECT COUNT(*)::int AS total FROM public.v_ventas',
        'ventas_usd': 'SELECT COALESCE(SUM(monto_usd), 0)::numeric(18,2) AS total FROM public.v_ventas',
        'pedidos_rows': 'SELECT COUNT(*)::int AS total FROM public.v_pedidos',
    }
    metrics: dict[str, float] = {}
    for key, sql in queries.items():
        result = http_json('POST', f'{api_base}/query', body={'sql': sql, 'limit': 1}, token=token)
        metrics[key] = float(result.payload['rows'][0][0])
    return metrics


def extract_batch_id(message: str) -> str:
    match = BATCH_ID_RE.search(message)
    if not match:
        raise ValidationError(f'No se pudo extraer batch_id desde: {message}')
    return match.group(1)


def latest_batch_for_data_dir(monitor_payload: dict, data_dir: str, trigger_type: str | None = None) -> dict | None:
    batches = monitor_payload.get('current_batches', []) + monitor_payload.get('recent_batches', [])
    for batch in batches:
        if batch.get('data_dir') != data_dir:
            continue
        if trigger_type and batch.get('trigger_type') != trigger_type:
            continue
        return batch
    return None


def wait_for_batch(api_base: str, token: str, batch_id: str, timeout_sec: int) -> dict:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        payload = http_json('GET', f'{api_base}/etl/monitor', token=token).payload
        for batch in payload.get('current_batches', []) + payload.get('recent_batches', []):
            if batch.get('batch_id') != batch_id:
                continue
            status = batch.get('status')
            if status == 'RUNNING':
                time.sleep(5)
                break
            if status not in {'SUCCESS', 'PARTIAL_FAILED'}:
                raise ValidationError(f'Lote {batch_id} terminó en estado inesperado: {status} - {batch.get("error_message")}')
            return batch
        else:
            time.sleep(3)
            continue
    raise ValidationError(f'Timeout esperando lote {batch_id}')


def wait_for_watcher_batch(api_base: str, token: str, data_dir: str, timeout_sec: int) -> dict:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        payload = http_json('GET', f'{api_base}/etl/monitor', token=token).payload
        batch = latest_batch_for_data_dir(payload, data_dir, trigger_type='WATCHER')
        if batch:
            status = batch.get('status')
            if status == 'RUNNING':
                time.sleep(5)
                continue
            if status not in {'SUCCESS', 'PARTIAL_FAILED'}:
                raise ValidationError(f'Watcher batch falló: {status} - {batch.get("error_message")}')
            return batch
        time.sleep(3)
    raise ValidationError(f'No apareció batch WATCHER para {data_dir}')


def build_datasets(output_root: Path) -> dict:
    result = subprocess.run(
        [sys.executable, str(PROJECT_ROOT / 'scripts' / 'build_validation_datasets.py'), '--output-root', str(output_root)],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        check=True,
    )
    manifest_path = output_root / 'manifest.json'
    if not manifest_path.exists():
        raise ValidationError('No se generó manifest.json para datasets de validación')
    return json.loads(manifest_path.read_text(encoding='utf-8'))


def terminate_process_tree(process: subprocess.Popen[str], timeout_sec: int = 10) -> None:
    if process.poll() is not None:
        return

    if os.name == 'nt':
        subprocess.run(
            ['taskkill', '/PID', str(process.pid), '/T', '/F'],
            check=False,
            capture_output=True,
            text=True,
        )
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            return

    try:
        process.wait(timeout=timeout_sec)
    except subprocess.TimeoutExpired:
        if os.name == 'nt':
            process.kill()
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                return


def run() -> int:
    parser = argparse.ArgumentParser(description='Smoke validation del stack TEG')
    parser.add_argument('--api-base', default=DEFAULT_API_BASE)
    parser.add_argument('--admin-user', default='admin')
    parser.add_argument('--admin-password', default='Admin#2026')
    parser.add_argument('--analyst-user', default='analista')
    parser.add_argument('--analyst-password', default='Analista#2026')
    parser.add_argument('--output-root', default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument('--timeout', type=int, default=1200)
    args = parser.parse_args()

    api_base = args.api_base.rstrip('/')
    output_root = Path(args.output_root).resolve()
    manifest = build_datasets(output_root)

    health = http_json('GET', f'{api_base}/health')
    if health.payload.get('status') != 'ok':
        raise ValidationError(f'Health inesperado: {health.payload}')

    admin_login = http_json('POST', f'{api_base}/auth/login', body={'username': args.admin_user, 'password': args.admin_password})
    analyst_login = http_json('POST', f'{api_base}/auth/login', body={'username': args.analyst_user, 'password': args.analyst_password})
    admin_token = admin_login.payload['access_token']
    analyst_token = analyst_login.payload['access_token']

    admin_me = http_json('GET', f'{api_base}/auth/me', token=admin_token)
    analyst_me = http_json('GET', f'{api_base}/auth/me', token=analyst_token)
    if admin_me.payload.get('role') not in {'admin', 'superadmin'}:
        raise ValidationError(f'Rol admin inesperado: {admin_me.payload}')
    if analyst_me.payload.get('role') != 'analista':
        raise ValidationError(f'Rol analista inesperado: {analyst_me.payload}')

    http_json('POST', f'{api_base}/query', token=analyst_token, body={'sql': 'SELECT COUNT(*) FROM public.v_ventas', 'limit': 1})
    analyst_monitor = http_json('GET', f'{api_base}/etl/monitor', token=analyst_token, expected_status=403)
    if analyst_monitor.status != 403:
        raise ValidationError('El analista no debería poder acceder al monitor ETL')

    baseline_response = http_json('POST', f'{api_base}/etl/run', token=admin_token, body={'data_dir': 'data/input'})
    baseline_batch_id = extract_batch_id(baseline_response.payload['message'])
    baseline_batch = wait_for_batch(api_base, admin_token, baseline_batch_id, args.timeout)

    delta_actual_dir = manifest['datasets']['delta_actual']['path']
    delta_response = http_json('POST', f'{api_base}/etl/run', token=admin_token, body={'data_dir': delta_actual_dir})
    delta_batch_id = extract_batch_id(delta_response.payload['message'])
    delta_batch = wait_for_batch(api_base, admin_token, delta_batch_id, args.timeout)

    metrics_before = query_metrics(api_base, admin_token)

    updates_dir = manifest['datasets']['updates']['path']
    updates_response = http_json('POST', f'{api_base}/etl/run', token=admin_token, body={'data_dir': updates_dir})
    updates_batch_id = extract_batch_id(updates_response.payload['message'])
    updates_batch = wait_for_batch(api_base, admin_token, updates_batch_id, args.timeout)

    metrics_after_updates = query_metrics(api_base, admin_token)
    if metrics_before == metrics_after_updates:
        raise ValidationError(
            'Los KPIs no cambiaron tras la carga incremental única: '
            f'before={metrics_before} after={metrics_after_updates} mutation_tag={manifest.get("mutation_tag")}'
        )

    watch_dir = Path(manifest['datasets']['watch_input']['path'])
    source_candidate = Path(manifest['datasets']['growth']['path']) / 'PHXX.CSV'
    if not source_candidate.exists():
        growth_files = sorted(Path(manifest['datasets']['growth']['path']).rglob('*.CSV'))
        if not growth_files:
            raise ValidationError('No hay archivos CSV en el dataset growth para validar watcher')
        source_candidate = growth_files[0]

    watcher_process = subprocess.Popen(
        [sys.executable, str(PROJECT_ROOT / 'etl' / 'watcher.py'), '--dir', str(watch_dir), '--debounce', '3'],
        cwd=str(PROJECT_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0),
        start_new_session=os.name != 'nt',
    )

    try:
        time.sleep(5)
        target_path = watch_dir / source_candidate.name
        shutil.copy2(source_candidate, target_path)
        watcher_batch = wait_for_watcher_batch(api_base, admin_token, str(watch_dir), args.timeout)
    finally:
        terminate_process_tree(watcher_process)

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM auth.users')
            user_count = cur.fetchone()[0]
            cur.execute('SELECT COUNT(*) FROM etl.batches')
            batch_count = cur.fetchone()[0]

    summary = {
        'health': health.payload,
        'admin_role': admin_me.payload['role'],
        'analyst_role': analyst_me.payload['role'],
        'baseline_batch': baseline_batch,
        'delta_batch': delta_batch,
        'updates_batch': updates_batch,
        'watcher_batch': watcher_batch,
        'metrics_before': metrics_before,
        'metrics_after_updates': metrics_after_updates,
        'db': {
            'auth_users': user_count,
            'etl_batches': batch_count,
        },
        'datasets': manifest['datasets'],
    }

    print(json.dumps(summary, indent=2))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(run())
    except ValidationError as exc:
        print(f'VALIDATION ERROR: {exc}', file=sys.stderr)
        raise SystemExit(1)
