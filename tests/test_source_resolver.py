import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "etl"))

from source_resolver import build_source_group_hash, resolve_source_files


def test_resolve_source_files_supports_org_variants(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    for name in [
        "PHXX.CSV",
        "PPXX.CSV",
        "AMXX.CSV",
        "EMPX.CSV",
        "IGNORAR.CSV",
    ]:
        (data_dir / name).write_text("h1;h2\n1;2\n", encoding="latin-1")

    files = resolve_source_files(data_dir, "PHXX")

    assert [file.filename for file in files] == [
        "AMXX.CSV",
        "EMPX.CSV",
        "PHXX.CSV",
        "PPXX.CSV",
    ]


def test_resolve_source_files_is_recursive(tmp_path):
    root = tmp_path / "data"
    (root / "Div Consumo").mkdir(parents=True)
    (root / "Div Empaque").mkdir(parents=True)

    (root / "Div Consumo" / "CLIENTES.CSV").write_text("h1;h2\n1;2\n", encoding="latin-1")
    (root / "Div Empaque" / "CLIENTES_PET.CSV").write_text("h1;h2\n1;2\n", encoding="latin-1")
    (root / "Div Empaque" / "CLIENTES_AMP.CSV").write_text("h1;h2\n1;2\n", encoding="latin-1")

    files = resolve_source_files(root, "CLIENTES")

    assert [file.filename for file in files] == [
        "CLIENTES.CSV",
        "CLIENTES_AMP.CSV",
        "CLIENTES_PET.CSV",
    ]


def test_group_hash_changes_when_file_set_changes(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    (data_dir / "AVPH.CSV").write_text("h1;h2\n1;2\n", encoding="latin-1")
    base_hash = build_source_group_hash(resolve_source_files(data_dir, "AVPH"))

    (data_dir / "AVPP.CSV").write_text("h1;h2\n1;2\n", encoding="latin-1")
    changed_hash = build_source_group_hash(resolve_source_files(data_dir, "AVPH"))

    assert base_hash != changed_hash
