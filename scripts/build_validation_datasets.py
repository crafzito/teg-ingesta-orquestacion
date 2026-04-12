#!/usr/bin/env python3
"""Construye datasets reproducibles para validar baseline, delta y watcher."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE = PROJECT_ROOT / 'data' / 'input'
DEFAULT_ACTUAL = PROJECT_ROOT / 'data' / 'inputActual'
DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / 'data' / 'generated' / 'validation'


def reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.parent.mkdir(parents=True, exist_ok=True)


def copy_tree(src: Path, dst: Path) -> None:
    reset_dir(dst)
    shutil.copytree(src, dst)


def count_csv_files(path: Path) -> int:
    files = {item.resolve() for item in path.rglob('*') if item.is_file() and item.suffix.lower() == '.csv'}
    return len(files)


def run_command(command: list[str]) -> None:
    subprocess.run(command, cwd=str(PROJECT_ROOT), check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description='Genera datasets de validación para el ETL TEG')
    parser.add_argument('--base-input', default=str(DEFAULT_BASE), help='Dataset base inicial')
    parser.add_argument('--actual-input', default=str(DEFAULT_ACTUAL), help='Dataset alterno con cambios reales')
    parser.add_argument('--output-root', default=str(DEFAULT_OUTPUT_ROOT), help='Directorio donde se generarán las variantes')
    parser.add_argument('--seed', default='42', help='Seed reproducible para generate_variations.py')
    parser.add_argument(
        '--mutation-tag',
        default='',
        help='Tag único para forzar cambios incrementales; si se omite se genera uno UTC',
    )
    args = parser.parse_args()

    base_input = Path(args.base_input).resolve()
    actual_input = Path(args.actual_input).resolve()
    output_root = Path(args.output_root).resolve()
    mutation_tag = args.mutation_tag.strip() or datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')

    if not base_input.exists():
        raise SystemExit(f'No existe el dataset base: {base_input}')

    baseline_dir = output_root / 'input_baseline'
    actual_dir = output_root / 'input_delta_actual'
    growth_dir = output_root / 'input_growth'
    updates_dir = output_root / 'input_updates'
    watch_dir = output_root / 'watch_input'
    backups_dir = output_root / 'backups'

    output_root.mkdir(parents=True, exist_ok=True)
    copy_tree(base_input, baseline_dir)
    copy_tree(base_input, watch_dir)

    if actual_input.exists():
        copy_tree(actual_input, actual_dir)
    else:
        copy_tree(base_input, actual_dir)

    run_command([
        sys.executable,
        str(PROJECT_ROOT / 'scripts' / 'generate_variations.py'),
        '--seed',
        str(args.seed),
        '--output',
        str(growth_dir),
    ])

    copy_tree(base_input, updates_dir)
    run_command([
        sys.executable,
        str(PROJECT_ROOT / 'scripts' / 'inject_input_v2_updates.py'),
        '--target-dir',
        str(updates_dir),
        '--backup-root',
        str(backups_dir),
        '--mutation-tag',
        mutation_tag,
    ])

    manifest = {
        'base_input': str(base_input),
        'output_root': str(output_root),
        'mutation_tag': mutation_tag,
        'datasets': {
            'baseline': {'path': str(baseline_dir), 'csv_files': count_csv_files(baseline_dir)},
            'delta_actual': {'path': str(actual_dir), 'csv_files': count_csv_files(actual_dir)},
            'growth': {'path': str(growth_dir), 'csv_files': count_csv_files(growth_dir)},
            'updates': {'path': str(updates_dir), 'csv_files': count_csv_files(updates_dir)},
            'watch_input': {'path': str(watch_dir), 'csv_files': count_csv_files(watch_dir)},
        },
    }

    manifest_path = output_root / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')

    print(json.dumps(manifest, indent=2))
    print(f"\nManifest guardado en: {manifest_path}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
