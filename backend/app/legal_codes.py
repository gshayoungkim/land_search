import csv
from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "legal_codes.csv"


def load_legal_codes() -> List[Dict[str, str]]:
    if not DATA_PATH.exists():
        return []

    rows: List[Dict[str, str]] = []
    with DATA_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            if len(row) < 3:
                continue
            rows.append(
                {
                    "code": (row[0] or "").strip(),
                    "name": (row[1] or "").strip(),
                    "status": (row[2] or "").strip(),
                }
            )
    return rows


def search_legal_codes(rows: List[Dict[str, str]], q: str, limit: int) -> List[Dict[str, str]]:
    if not q:
        return rows[:limit]

    q_lower = q.lower()
    filtered = [
        r
        for r in rows
        if q_lower in r["name"].lower() or q_lower in r["code"].lower()
    ]
    return filtered[:limit]


def get_sido_codes(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    items = [r for r in rows if _is_active(r) and _is_sido(r["code"])]
    return sorted(items, key=lambda x: x["code"])


def get_sigungu_codes(rows: List[Dict[str, str]], sido_code: str) -> List[Dict[str, str]]:
    prefix = (sido_code or "").strip()[:2]
    if len(prefix) != 2 or not prefix.isdigit():
        return []

    items = [
        r
        for r in rows
        if _is_active(r) and _is_sigungu(r["code"]) and r["code"].startswith(prefix)
    ]
    return sorted(items, key=lambda x: x["code"])


def get_eupmyeondong_codes(rows: List[Dict[str, str]], sigungu_code: str) -> List[Dict[str, str]]:
    prefix = (sigungu_code or "").strip()[:5]
    if len(prefix) != 5 or not prefix.isdigit():
        return []

    items = [
        r
        for r in rows
        if _is_active(r)
        and r["code"].startswith(prefix)
        and not _is_sigungu(r["code"])
        and not _is_sido(r["code"])
    ]
    return sorted(items, key=lambda x: x["code"])


def _is_active(row: Dict[str, str]) -> bool:
    return row.get("status", "") == "존재"


def _is_sido(code: str) -> bool:
    return len(code) == 10 and code.endswith("00000000")


def _is_sigungu(code: str) -> bool:
    return len(code) == 10 and code.endswith("00000") and not _is_sido(code)
