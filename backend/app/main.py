import math
import os
import time
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
VWORLD_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; land-search/1.0; +https://vercel.app)",
    "Accept": "application/xml,text/xml,*/*",
    "Connection": "close",
}
WFS_DATASETS = {
    "lp_pa_cbnd_bonbun": 200,
    "lp_pa_cbnd_bubun": 200,
    "lt_c_uq111": 100,
}


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    legal_codes = load_legal_codes()

    @app.get("/api/health")
    def health() -> Any:
        return jsonify({"ok": True})

    @app.get("/api/config")
    def config_api() -> Any:
        return jsonify({
            "kakaoAppKey": os.getenv("KAKAO_APP_KEY", ""),
        })

    @app.get("/api/wfs")
    def wfs_api() -> Any:
        typename = request.args.get("typename", "").strip().lower()
        bbox = request.args.get("bbox", "").strip()
        if not typename or not bbox:
            return jsonify({"error": "typename and bbox are required"}), 400
        if typename not in WFS_DATASETS:
            return jsonify({"error": "Unsupported WFS dataset"}), 400
        bbox_error = _validate_bbox(bbox)
        if bbox_error:
            return jsonify({"error": bbox_error}), 400
        api_key = os.getenv("VWORLD_API_KEY", "").strip()
        domain = os.getenv("VWORLD_DOMAIN", "").strip()
        if not api_key:
            return jsonify({"error": "VWORLD_API_KEY is not configured"}), 500
        params = {
            "SERVICE": "WFS",
            "VERSION": "2.0.0",
            "REQUEST": "GetFeature",
            "TYPENAME": typename,
            "SRSNAME": "EPSG:4326",
            "OUTPUT": "application/json",
            "BBOX": f"{bbox},EPSG:4326",
            "COUNT": str(WFS_DATASETS[typename]),
            "KEY": api_key,
            "DOMAIN": domain,
        }
        try:
            resp = requests.get("https://api.vworld.kr/req/wfs", params=params, timeout=(5, 20))
            text = resp.text
            if text.strip().startswith("<"):
                return jsonify({"error": f"Vworld WFS error: {text[:200]}"}), 502
            from flask import Response
            response = Response(text, status=resp.status_code, mimetype="application/json")
            response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
            return response
        except Exception as exc:
            return jsonify({"error": str(exc)}), 502

    @app.get("/api/search")
    def search_api() -> Any:
        query = request.args.get("query", "").strip()
        if not query:
            return jsonify({"error": "query is required"}), 400
        api_key = os.getenv("VWORLD_API_KEY", "").strip()
        domain = os.getenv("VWORLD_DOMAIN", "").strip()
        url = (
            f"https://api.vworld.kr/req/search?SERVICE=search&REQUEST=search&VERSION=2.0"
            f"&crs=EPSG:4326&size=10&page=1&query={query}"
            f"&type=ADDRESS&category=PARCEL"
            f"&KEY={api_key}&DOMAIN={domain}"
        )
        try:
            resp = requests.get(url, timeout=(5, 20))
            return jsonify(resp.json()), resp.status_code
        except Exception as exc:
            return jsonify({"error": str(exc)}), 502

    @app.get("/api/proxy")
    def image_proxy() -> Any:
        url = request.args.get("url", "").strip()
        if not url:
            return jsonify({"error": "url is required"}), 400
        
        allowed_domains = ["daumcdn.net", "kakao.com", "kakaocdn.net", "vworld.kr", "api.vworld.kr"]
        from urllib.parse import urlparse
        try:
            parsed = urlparse(url)
            domain = parsed.netloc
            if not any(domain.endswith(d) for d in allowed_domains):
                return jsonify({"error": "Forbidden domain"}), 403
            
            resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=(5, 10))
            from flask import Response
            response = Response(resp.content, status=resp.status_code, mimetype=resp.headers.get("Content-Type", "image/png"))
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response
        except Exception as exc:
            return jsonify({"error": str(exc)}), 502



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

        resp, err = request_vworld_with_retry(params)
        if err is not None:
            return jsonify({"error": "VWORLD request failed", "detail": err}), 502

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


def _validate_bbox(raw: str) -> str:
    try:
        values = [float(value) for value in raw.split(",")]
    except ValueError:
        return "bbox must contain four numeric values"
    if len(values) != 4:
        return "bbox must contain four numeric values"
    if not all(math.isfinite(value) for value in values):
        return "bbox must contain four numeric values"
    south, west, north, east = values
    if south < -90 or north > 90 or west < -180 or east > 180 or south >= north or west >= east:
        return "bbox coordinates are invalid"
    if north - south > 0.2 or east - west > 0.2:
        return "bbox is too large"
    return ""


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
        "ladUseSittnNm",
        "lnduseSittnCodeNm",
        "prposArea1Nm",
        "prposArea2Nm",
        "tpgrphFrmCodeNm",
        "tpgrphHgCodeNm",
        "roadSideCodeNm",
        "pblntfPclnd",
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
            if "ladUseSittnNm" in row and "lnduseSittnCodeNm" not in row:
                row["lnduseSittnCodeNm"] = row.get("ladUseSittnNm", "")
            if "pblntfPclnd" in row and "prrnk" not in row:
                row["prrnk"] = row.get("pblntfPclnd", "")
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


def request_vworld_with_retry(params: Dict[str, str]) -> Any:
    last_error = ""
    for idx in range(3):
        try:
            resp = requests.get(
                VWORLD_URL,
                params=params,
                headers=VWORLD_HEADERS,
                timeout=(5, 20),
            )
            resp.raise_for_status()
            return resp, None
        except requests.RequestException as exc:
            last_error = str(exc)
            if idx < 2:
                time.sleep(0.5 * (idx + 1))
    return None, last_error


def _find_text(node: ElementTree.Element, tag: str) -> str:
    found = node.find(f".//{tag}")
    return (found.text or "").strip() if found is not None and found.text else ""
