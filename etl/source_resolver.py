"""
Resuelve archivos reales de una fuente ETL a partir de nombres y patrones.

Permite que una misma fuente lógica procese variantes por organización
sin depender de que el cronjob etiquete manualmente cada archivo.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List

from config.sources import SOURCES


@dataclass(frozen=True)
class ResolvedSourceFile:
    source_key: str
    path: Path

    @property
    def filename(self) -> str:
        return self.path.name


def resolve_source_files(data_dir: str | Path, source_key: str) -> List[ResolvedSourceFile]:
    """Busca recursivamente todos los archivos que matchean una fuente lógica."""
    root = Path(data_dir)
    if not root.exists():
        return []

    patterns = _compile_patterns(source_key)
    if not patterns:
        return []

    matches: List[ResolvedSourceFile] = []
    seen_paths = set()

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        filename = path.name.strip()
        if not _matches_any(filename, patterns):
            continue

        resolved = str(path.resolve()).lower()
        if resolved in seen_paths:
            continue
        seen_paths.add(resolved)
        matches.append(ResolvedSourceFile(source_key=source_key, path=path.resolve()))

    return sorted(matches, key=lambda item: (item.filename.upper(), str(item.path.parent).upper()))


def build_source_group_hash(files: Iterable[ResolvedSourceFile]) -> str:
    """Calcula un hash estable del grupo completo de archivos de una fuente."""
    digest = hashlib.md5()

    for source_file in sorted(files, key=lambda item: (item.filename.upper(), str(item.path))):
        digest.update(source_file.filename.upper().encode("utf-8"))
        digest.update(b"\0")
        digest.update(_file_md5(source_file.path).encode("ascii"))
        digest.update(b"\0")

    return digest.hexdigest()


def summarize_source_files(files: Iterable[ResolvedSourceFile], limit: int = 3) -> str:
    """Genera una descripción corta de los archivos procesados."""
    items = list(files)
    if not items:
        return ""
    if len(items) == 1:
        return str(items[0].path)

    names = [item.filename for item in items[:limit]]
    summary = ", ".join(names)
    if len(items) > limit:
        summary = f"{summary}, +{len(items) - limit} mas"
    return summary[:500]


def _compile_patterns(source_key: str) -> List[re.Pattern[str]]:
    src_cfg = SOURCES.get(source_key, {})
    raw_patterns = src_cfg.get("file_patterns")

    if raw_patterns:
        return [re.compile(pattern, re.IGNORECASE) for pattern in raw_patterns]

    filename = src_cfg.get("file")
    if not filename:
        return []
    return [re.compile(re.escape(filename), re.IGNORECASE)]


def _matches_any(filename: str, patterns: Iterable[re.Pattern[str]]) -> bool:
    return any(pattern.fullmatch(filename) for pattern in patterns)


def _file_md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()
