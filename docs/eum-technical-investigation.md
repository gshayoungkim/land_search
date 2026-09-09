# 토지이음 이음지도 기술조사 및 최소 PoC

조사일: 2026-09-08

## 결론

**A — 공식/공개 데이터로 현재 Kakao 지도에 직접 구현 가능**

연속지적도와 핵심 용도지역·지구는 VWorld/국가공간정보 공개 WFS·Data API로 직접 구현할 수 있다. 이음지도의 모든 개별법령 레이어를 동일한 범례와 시점으로 복제하려면 데이터셋별 매핑 작업이 추가로 필요하지만, 서버 브라우저 자동화가 기술적 필수조건은 아니다. Playwright는 “이음지도 화면과 완전히 동일한 이미지”가 반드시 필요한 경우의 예외적 fallback으로만 남긴다.

## 이음지도 기술 구조

- 지도 엔진: OpenLayers(`ol.js`) + Proj4. Kakao Maps/Naver Maps는 iframe의 대체 베이스맵과 로드뷰에 사용된다.
- 내부 공간 좌표계: EPSG:5179(GRS80 통합 TM). Kakao/Naver 연동 시 WGS84와 상호 변환한다.
- 기본 도면: EUM 전용 `MapPlan` 서버가 제공하는 256px 타일. OpenLayers 코드상 `ol.source.XYZ`와 사용자 정의 EPSG:5179 tile grid를 사용한다. 표준 WMTS 파라미터 모양을 일부 갖지만 공개 `GetCapabilities` 기반 WMTS는 아니다.
- 레이어 조합: A(국토계획법), B(개별법령), C(도시계획시설), 0(연속지적도), Y/N(지번)의 조합을 `tile1`~`tile8`에 매핑한다.
- 피처 조회: `MapPlan?req=search`가 EPSG:5179 bbox(`mbr`), `layer`, `code`, `version`을 받아 GeoJSON을 반환한다.
- 표시 레이어 목록: `MapPlan?req=code`가 현재 extent, tile, level을 받아 조회한다.
- 필지별 분석: `MapPlan?req=analysis&version=...&pnus=...` 형태를 사용한다.
- 주소/PNU: EUM Ajax 주소 검색이 PNU 후보를 반환하고, `selectAddr` 조회 결과의 `addrpnu`/`lastpnu`를 사용한다. 19자리 PNU이면 `layer=FA&code={PNU}`로 필지 GeoJSON을 조회하고 extent 중심으로 이동한 뒤 vector layer로 강조한다.
- 현재 도면 기준월: 조사 시점 UI와 요청의 버전은 2026.06 / `20260614`였다.

관련 원본: [이음지도](https://www.eum.go.kr/web/mp/mpMapDet.jsp), [메인 지도 스크립트](https://www.eum.go.kr/web/js/mp/mpMapDet.js), [웹 베이스맵 스크립트](https://www.eum.go.kr/web/js/mp/mpWebMapDet.js)

## endpoint 분류

| URL/서비스 | 분류 | 용도 | 인증 | 권장 여부 |
|---|---|---|---|---|
| `eum.go.kr/web/mp/mpMapDetGisAjaxXml.jsp` | EUM 내부 전용 | 주소 후보 검색 | 로그인 불필요 확인 | 운영 의존 금지 |
| `eum.go.kr/web/am/mp/mpSearchMapAjaxXml.jsp` | EUM 내부 전용 | 주소/PNU 정규화 | 로그인 불필요 확인 | 운영 의존 금지 |
| `eum.ne.kr:900x/MapPlan/MapPlan?req=timg` | EUM 내부 전용 | 합성 주제도 타일 | 별도 토큰 없음 확인 | 운영 의존 금지 |
| `eum.ne.kr:900x/MapPlan/MapPlan?req=search` | EUM 내부 전용 | 필지·지역지구 GeoJSON | 별도 토큰 없음 확인 | 운영 의존 금지 |
| `eum.ne.kr:900x/MapPlan/MapPlan?req=code` | EUM 내부 전용 | 화면 내 레이어 코드 | 별도 토큰 없음 확인 | 운영 의존 금지 |
| `eum.ne.kr:900x/MapPlan/MapPlan?req=analysis` | EUM 내부 전용 | PNU별 저촉 레이어/면적 | 별도 토큰 없음 확인 | 운영 의존 금지 |
| `api.vworld.kr/req/search` | 공식 공개 API | 지번 주소 → 좌표 + PNU | VWorld key/domain | 권장 |
| `api.vworld.kr/req/wfs` | 공식 공개 OGC API | bbox 기반 GeoJSON 도형 | VWorld key/domain | 권장 |
| VWorld Data API | 공식 공개 API | 데이터셋/속성/공간 조건 조회 | VWorld key/domain | 권장 |
| 공공데이터포털 국토교통부 공간정보 WMS/WFS | 공식 공개 서비스 | 연속지적·토지이용계획·도시계획 | 서비스별 활용신청 | 권장 |

EUM의 `900x` 포트는 실제 조사 중 9003과 9004로 달라졌다. 이는 공개 계약이 보장된 endpoint가 아니라는 추가 신호다.

공식 근거: [국토교통부 공간정보오픈플랫폼 WMS/WFS](https://www.data.go.kr/data/15058805/openapi.do), [국토교통부 토지이용계획정보](https://www.data.go.kr/dataset/15012633/openapi.do), [국토교통부 도시계획정보](https://www.data.go.kr/dataset/15021101/openapi.do)

## 공개 데이터 대체 가능성

| 데이터 | 이음지도 내부 출처 | 공개 API 대체 가능 | 추천 소스 | 비고 |
|---|---|---|---|---|
| 연속지적도 | `tile7/8`, `layer=FA` | 가능 | VWorld WFS `lp_pa_cbnd_bonbun`, `lp_pa_cbnd_bubun` | 현 앱에서 이미 사용 중 |
| 용도지역 | A 계열 합성 타일/피처 | 가능 | VWorld WFS `lt_c_uq111` 등 | PoC에서 실제 검증 |
| 용도지구 | A 계열 합성 타일/피처 | 가능 | VWorld UQ 계열 Data API/WFS, 국토교통부 공개 서비스 | 세부 유형별 dataset 매핑 필요 |
| 도시계획시설 | C 계열, 주로 `tile6` | 가능 | VWorld/국가공간정보의 도시계획 도로·공원·시설 데이터 | 시설 종류별 여러 dataset |
| 개별법령 지역지구 | B 계열, 주로 `tile5` | 부분 가능 | VWorld 연속주제도 및 공공데이터포털 | 법령별 제공시점·라이선스·누락 조사 필요 |
| PNU | EUM 검색 Ajax와 `selectAddr` | 가능 | VWorld 주소 검색의 `item.id`, 연속지적도 속성 `PNU` | 19자리 canonical parcel key로 적합 |

공개 데이터 근거: [연속지적도/연속지적도형정보 검색 결과](https://www.data.go.kr/tcs/dss/selectDataSetList.do?conditionType=init&keyword=%EC%97%B0%EC%86%8D%EC%A7%80%EC%A0%81%EB%8F%84%ED%98%95%EC%A0%95%EB%B3%B4%EC%A1%B0%ED%9A%8C%EC%84%9C%EB%B9%84%EC%8A%A4&recmSe=N), [건축 용도지역 공개 데이터](https://www.data.go.kr/data/15125043/fileData.do), [도시계획 공공문화체육시설 공개 데이터](https://www.data.go.kr/data/15147009/fileData.do)

## land-search 통합 설계

1. 기존 `/api/search`에서 주소를 EPSG:4326 좌표와 PNU로 정규화한다.
2. PNU를 필지, 규제 속성, 저장 결과를 연결하는 canonical key로 저장한다.
3. 현재 `/api/wfs` 형태의 서버 프록시에서 허용된 공식 dataset만 요청한다. API key를 브라우저에 직접 노출하지 않고 typename allowlist, bbox/COUNT 제한, 캐시를 둔다.
4. 작은 viewport/선택 필지는 WFS GeoJSON을 Kakao `Polygon`으로 표시한다. 현재 앱의 연속지적도 구현을 그대로 확장할 수 있다.
5. 전국/넓은 영역은 수천 Polygon을 만들지 말고 공식 WMS/WMTS가 있으면 Kakao `Tileset`, 아니면 map projection에 동기화된 단일 canvas/WebGL layer를 사용한다.
6. 서비스가 EPSG:5179만 반환하면 서버 또는 `proj4`로 EPSG:4326 변환한다. 가능하면 요청의 `SRSNAME=EPSG:4326`을 우선한다.
7. 레이어별 출처, 기준일, 법적 효력 없음 안내를 UI와 캡처물에 포함한다.

Kakao SDK는 Polygon, CustomOverlay, Tileset 및 `idle`/`tilesloaded` 이벤트를 제공하므로 세 방식 모두 구현 가능하다. [Kakao Maps Web API 문서](https://apis.map.kakao.com/web/documentation/)

## 최소 PoC 결과

- 파일: `frontend/public/eum-layer-poc.html`
- 입력: `서울특별시 중구 태평로1가 31`
- 공식 VWorld 주소 검색 결과: PNU `1114010300100310000`, EPSG:4326 좌표 반환
- 공식 VWorld WFS: `lt_c_uq111` 17개 용도지역 도형 반환
- 점 포함 판정: `일반상업지역`
- 렌더링: Kakao HYBRID 위성지도 위에 노란 반투명 면/빨간 경계 Polygon 표시 성공
- 기존 페이지와 기존 API 코드는 변경하지 않았다.

## Playwright fallback 평가

- 로그인: 초기 지도 열람에는 불필요
- CAPTCHA: 조사한 초기 로드에는 없음
- headless 자동화 차단: headless Chromium 145에서 HTTP 200, iframe, 내부 타일 렌더링 성공
- 다건 처리: 기술적으로 순차 처리 가능하나 EUM 약관, rate limit, UI 변경, 내부 endpoint 변경에 취약
- Vercel: 가능성은 있으나 Chromium 번들/콜드스타트/메모리와 4.5MB 응답 제한 때문에 배치 캡처에는 불리하다. 함수 번들 제한은 250MB, Hobby 메모리는 2GB이며 함수 실행시간은 설정/플랜 영향을 받는다. [Vercel Functions 제한](https://vercel.com/docs/functions/limitations)
- 권장 fallback 런타임: 브라우저 포함 컨테이너를 제어하기 쉬운 Cloud Run/Render. 큐 + object storage + polling/download URL 구조가 적합하다. [Cloud Run 컨테이너 계약](https://docs.cloud.google.com/run/docs/container-contract)

## 제한사항과 리스크

- EUM 화면 자체는 “법적 효력이 없는 참고자료”이고 자료 생성/서비스 시점 차이를 고지한다.
- EUM 내부 endpoint의 문서화된 외부 이용계약과 안정성은 확인되지 않았다. 직접 호출 production 코드는 만들지 않았다.
- VWorld와 공공데이터 API는 키, 등록 domain, 일일 호출량, 출처표시, 데이터별 이용허락을 적용해야 한다.
- `lt_c_uq111` 한 종류만 실제 렌더링 검증했다. 전체 용도지구/개별법령/도시계획시설은 코드표와 dataset 매핑 검증이 후속 작업이다.
- WFS는 넓은 bbox에서 응답 크기와 Polygon 수가 급증한다. bbox 제한, 단순화, 캐시, 줌 임계값이 필요하다.
- 브라우저가 VWorld WFS를 직접 호출하면 CORS/domain 정책에 걸릴 수 있으므로 현재와 같은 same-origin 서버 프록시가 안전하다.
- Kakao base map과 공식 WFS의 갱신 기준일이 다를 수 있으며, 이음지도와 색상/범례가 완전히 같다는 보장은 없다.
