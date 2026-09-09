# 토지이용계획 검색기 웹 버전

엑셀 `토지이용계획 검색기(v1.5).xlsm`의 핵심 기능을 웹으로 옮긴 프로젝트입니다.

- Frontend: React + Vite
- Backend: Flask
- Deployment: Vercel 단일 배포 (정적 + Python Serverless)
- External API: VWORLD `getLandCharacteristics`, 주소 검색, WFS

지도 화면(`/map.html`)은 Kakao HYBRID 위성지도를 베이스맵으로 사용하고 VWorld
연속지적도와 용도지역(`LT_C_UQ111`)을 오버레이합니다. 주소 검색 결과의 PNU를
기준으로 해당 지점의 용도지역명을 표시하며, 일괄 캡처에도 같은 레이어가 포함됩니다.

## 프로젝트 구조

```text
api/
  index.py                # Vercel Python Function entry
  requirements.txt
backend/
  app/
  data/legal_codes.csv
  scripts/extract_legal_codes.py
  run.py                  # local backend 실행
frontend/
  src/
vercel.json               # root Vercel config
```

## 로컬 실행

### 1) Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

기본 주소: `http://127.0.0.1:5000`

환경변수는 `backend/.env`에 작성:

```env
VWORLD_API_KEY=your_vworld_api_key
VWORLD_DOMAIN=
KAKAO_APP_KEY=your_kakao_javascript_key
PORT=5000
FLASK_HOST=127.0.0.1
```

### 2) Frontend

```bash
cd frontend
npm install
npm.cmd run dev
```

- `frontend/.env`를 비우면 기본적으로 같은 도메인의 `/api`를 호출합니다.
- 로컬에서 백엔드 분리 실행 시에만 아래를 사용하세요.

```env
VITE_API_BASE_URL=http://127.0.0.1:5000
```

## Vercel 단일 배포

1. Vercel에서 **프로젝트 Root를 저장소 루트**(`토지이용검색ㄱ`)로 선택
2. Environment Variables 설정
- `VWORLD_API_KEY`
- `VWORLD_DOMAIN` (선택, 등록 도메인 제한이 있을 때)
- `KAKAO_APP_KEY` (Kakao Maps JavaScript 키)
3. Deploy

배포 후 동작:
- 프론트 정적 파일: `frontend/dist`
- API: `/api/*` -> `api/index.py` (Flask app)

## 엑셀 데이터 갱신

```bash
cd backend
pip install openpyxl
python scripts/extract_legal_codes.py "../토지이용계획 검색기(v1.5).xlsm"
```

## 주의사항

- API 키는 절대 프론트 코드에 넣지 마세요.
- 키 만료/도메인 제한이 걸리면 Vercel 환경변수 값부터 확인하세요.
