import csv
import logging
from pathlib import Path
from typing import Iterator

logger = logging.getLogger(__name__)


class CSVReader:
    def __init__(self, filepath: str, encoding: str = "utf-8"):
        self.filepath = Path(filepath)
        self.encoding = encoding
        if not self.filepath.exists():
            raise FileNotFoundError(f"CSV no encontrado: {self.filepath}")

    def read_header(self) -> list[str]:
        with open(self.filepath, "r", encoding=self.encoding, newline="") as f:
            reader = csv.reader(f)
            return next(reader)

    def read_rows(self) -> Iterator[tuple[int, list[str]]]:
        with open(self.filepath, "r", encoding=self.encoding, newline="") as f:
            reader = csv.reader(f)
            next(reader)  # skip header
            for row_num, row in enumerate(reader, start=1):
                yield row_num, row

    def row_count(self) -> int:
        count = 0
        with open(self.filepath, "r", encoding=self.encoding, newline="") as f:
            reader = csv.reader(f)
            next(reader)  # skip header
            for _ in reader:
                count += 1
        return count
