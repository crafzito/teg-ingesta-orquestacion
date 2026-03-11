from fastapi import APIRouter
from pathlib import Path

from ..core import LOGICAL_RELATIONS, PROJECT_ROOT, load_lineage_sources
from ..models import LineageSource, LogicalRelation

router = APIRouter(prefix="/api/lineage", tags=["lineage"])


@router.get("/sources", response_model=list[LineageSource])
def list_lineage_sources():
    return load_lineage_sources()


@router.get("/relations", response_model=list[LogicalRelation])
def list_logical_relations():
    return LOGICAL_RELATIONS


@router.get("/input-files")
def list_input_files():
    base = PROJECT_ROOT / "data" / "input"
    if not base.exists():
        return {
            "total_files": 0,
            "all_files": [],
            "csv_count": 0,
            "csv_files": [],
            "non_csv_count": 0,
            "non_csv_files": [],
        }

    all_files = sorted([p.name for p in base.iterdir() if p.is_file()])
    csv_files = sorted([name for name in all_files if Path(name).suffix.lower() == ".csv"])
    non_csv_files = sorted([name for name in all_files if Path(name).suffix.lower() != ".csv"])

    return {
        "total_files": len(all_files),
        "all_files": all_files,
        "csv_count": len(csv_files),
        "csv_files": csv_files,
        "non_csv_count": len(non_csv_files),
        "non_csv_files": non_csv_files,
    }
