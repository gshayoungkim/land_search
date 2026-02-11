import os
from typing import Any, Dict, List
from xml.etree import ElementTree

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

from .legal_codes import (
    get_eupmyeondong_codes,
    get_sido_codes,
    get_sigungu_codes,
    load_legal_codes,
    search_legal_codes,
)

VWORLD_URL = "https://api.vworld.kr/ned/data/getLandCharacteristics"


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    legal_codes = load_legal_codes()

    @app.get("/api/health")
    def health() -> Any:
        return jsonify({"ok": True})

    @app.get("/api/legal-codes")
    def legal_codes_api() -> Any:
        q = request.args.get("q", "").strip()
        limit = _safe_int(request.args.get("limit", "20"), default=20, min_v=1, max_v=100)
        rows = search_legal_codes(legal_codes, q=q, limit=limit)
        return jsonify({"items": rows, "count": len(rows)})

    @app.get("/api/legal-codes/sido")
    def legal_codes_sido_api() -> Any:
        rows = get_sido_codes(legal_codes)
        return jsonify({"items": rows, "count": len(rows)})

    @app.get("/api/legal-codes/sigungu")
    def legal_codes_sigungu_api() -> Any:
        sido_code = request.args.get("sidoCode", "").strip()
        rows = get_sigungu_codes(legal_codes, sido_code=sido_code)
        return jsonify({"items": rows, "count": len(rows)})

    @app.get("/api/legal-codes/eupmyeondong")
    def legal_codes_eupmyeondong_api() -> Any:
        sigungu_code = request.args.get("sigunguCode", "").strip()
        rows = get_eupmyeondong_codes(legal_codes, sigungu_code=sigungu_code)
        return jsonify({"items": rows, "count": len(rows)})

    @app.post("/api/land-characteristics")
    def land_characteristics() -> Any:
        body = request.get_json(silent=True) or {}

        stdr_year = str(body.get("stdrYear", "")).strip()
        legal_code = str(body.get("legalDongCode", "")).strip()
        main_no = str(body.get("mainNo", "")).strip()
        sub_no = str(body.get("subNo", "")).strip()
        mountain = bool(body.get("mountain", False))

        valid, message = _validate_inputs(stdr_year, legal_code, main_no, sub_no)
        if not valid:
            return jsonify({"error": message}), 400

        pnu = build_pnu(legal_code, main_no, sub_no, mountain)

        api_key = os.getenv("VWORLD_API_KEY", "").strip()
        if not api_key:
            return jsonify({"error": "Server is missing VWORLD_API_KEY"}), 500

        domain = os.getenv("VWORLD_DOMAIN", "")
        params = {
            "pnu": pnu,
            "stdrYear": stdr_year,
            "format": "xml",
            "numOfRows": "10",
            "pageNo": "1",
            "key": api_key,
        }
        if domain:
            params["domain"] = domain

        try:
            resp = requests.get(VWORLD_URL, params=params, timeout=15)
            resp.raise_for_status()
        except requests.RequestException as exc:
            return jsonify({"error": "VWORLD request failed", "detail": str(exc)}), 502

        parsed = parse_vworld_xml(resp.text)
        parsed["request"] = {
            "pnu": pnu,
            "stdrYear": stdr_year,
            "legalDongCode": legal_code,
            "mainNo": main_no,
            "subNo": sub_no,
            "mountain": mountain,
        }
        return jsonify(parsed)

    return app


def _safe_int(raw: str, default: int, min_v: int, max_v: int) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return max(min_v, min(value, max_v))


def _validate_inputs(stdr_year: str, legal_code: str, main_no: str, sub_no: str) -> Any:
    if not (stdr_year.isdigit() and len(stdr_year) == 4):
        return False, "stdrYear must be a 4-digit year"
    if not (legal_code.isdigit() and len(legal_code) == 10):
        return False, "legalDongCode must be a 10-digit code"
    if not main_no.isdigit():
        return False, "mainNo must be numeric"
    if not sub_no.isdigit():
        return False, "subNo must be numeric"
    if int(main_no) > 9999 or int(sub_no) > 9999:
        return False, "mainNo and subNo must be <= 9999"
    return True, ""


def build_pnu(legal_code: str, main_no: str, sub_no: str, mountain: bool) -> str:
    # Excel logic: legalDongCode + (1 if normal, 2 if mountain) + 4-digit main + 4-digit sub
    mountain_flag = "2" if mountain else "1"
    return f"{legal_code}{mountain_flag}{int(main_no):04d}{int(sub_no):04d}"


def parse_vworld_xml(xml_text: str) -> Dict[str, Any]:
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return {"error": "Invalid XML returned from VWORLD", "raw": xml_text[:500]}

    result_code = _find_text(root, "resultCode")
    result_msg = _find_text(root, "resultMsg")

    fields = [
        "pnu",
        "ldCodeNm",
        "mnnmSlno",
        "stdrYear",
        "lndcgrCodeNm",
        "lndpclAr",
        "lnduseSittnCodeNm",
        "tpgrphFrmCodeNm",
        "tpgrphHgCodeNm",
        "roadSideCodeNm",
        "prrnk",
        "lastUpdtDt",
        "jibun",
        "spfc1",
        "spfc2",
    ]

    items: List[Dict[str, str]] = []
    for item in root.findall(".//field") + root.findall(".//item"):
        row: Dict[str, str] = {}
        for key in fields:
            value = _find_text(item, key)
            if value:
                row[key] = value
        if row:
            if "spfc1" in row and "tpgrphFrmCodeNm" not in row:
                row["tpgrphFrmCodeNm"] = row.get("spfc1", "")
            if "spfc2" in row and "tpgrphHgCodeNm" not in row:
                row["tpgrphHgCodeNm"] = row.get("spfc2", "")
            items.append(row)

    return {
        "resultCode": result_code,
        "resultMsg": result_msg,
        "items": items,
        "count": len(items),
    }


def _find_text(node: ElementTree.Element, tag: str) -> str:
    found = node.find(f".//{tag}")
    return (found.text or "").strip() if found is not None and found.text else ""
