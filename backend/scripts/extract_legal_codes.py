import csv
import sys
from pathlib import Path

import openpyxl


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/extract_legal_codes.py <workbook.xlsm>")
        raise SystemExit(1)

    workbook_path = Path(sys.argv[1])
    out_path = Path(__file__).resolve().parents[1] / "data" / "legal_codes.csv"

    wb = openpyxl.load_workbook(workbook_path, data_only=True, read_only=True)
    ws = wb.worksheets[0]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["법정동코드", "법정동명", "폐지여부"])
        for row in ws.iter_rows(min_row=2, max_col=3, values_only=True):
            code, name, status = row
            if code is None and name is None:
                continue
            writer.writerow([str(code or "").strip(), str(name or "").strip(), str(status or "").strip()])

    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
