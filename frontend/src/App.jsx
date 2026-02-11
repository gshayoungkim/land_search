import { useEffect, useMemo, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const initialForm = {
  stdrYear: new Date().getFullYear().toString(),
  legalDongCode: "",
  legalDongName: "",
  mountain: false,
  mainNo: "",
  subNo: "",
};

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [sidoList, setSidoList] = useState([]);
  const [sigunguList, setSigunguList] = useState([]);
  const [eupmyeondongList, setEupmyeondongList] = useState([]);
  const [selectedSido, setSelectedSido] = useState("");
  const [selectedSigungu, setSelectedSigungu] = useState("");
  const [selectedEupmyeondong, setSelectedEupmyeondong] = useState("");

  const [codeQuery, setCodeQuery] = useState("");
  const [codeResults, setCodeResults] = useState([]);
  const [searchingCodes, setSearchingCodes] = useState(false);
  const [codeSearched, setCodeSearched] = useState(false);

  const pnuPreview = useMemo(() => {
    if (!form.legalDongCode || !form.mainNo || !form.subNo) return "";
    const mountainFlag = form.mountain ? "2" : "1";
    const main = String(Number(form.mainNo || 0)).padStart(4, "0");
    const sub = String(Number(form.subNo || 0)).padStart(4, "0");
    return `${form.legalDongCode}${mountainFlag}${main}${sub}`;
  }, [form]);

  useEffect(() => {
    fetchSido();
  }, []);

  async function parseJsonSafe(res) {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  }

  useEffect(() => {
    if (!selectedSido) {
      setSigunguList([]);
      setSelectedSigungu("");
      setEupmyeondongList([]);
      setSelectedEupmyeondong("");
      return;
    }
    fetchSigungu(selectedSido);
  }, [selectedSido]);

  useEffect(() => {
    if (!selectedSigungu) {
      setEupmyeondongList([]);
      setSelectedEupmyeondong("");
      return;
    }
    fetchEupmyeondong(selectedSigungu);
  }, [selectedSigungu]);

  async function fetchSido() {
    try {
      const res = await fetch(`${API_BASE}/api/legal-codes/sido`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "시/도 목록 조회 실패");
      setSidoList(data.items || []);
    } catch (err) {
      setError(err.message || "시/도 목록 조회 중 오류");
    }
  }

  async function fetchSigungu(sidoCode) {
    try {
      const res = await fetch(`${API_BASE}/api/legal-codes/sigungu?sidoCode=${encodeURIComponent(sidoCode)}`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "구/군 목록 조회 실패");
      setSigunguList(data.items || []);
      setSelectedSigungu("");
      setSelectedEupmyeondong("");
      setEupmyeondongList([]);
    } catch (err) {
      setError(err.message || "구/군 목록 조회 중 오류");
    }
  }

  async function fetchEupmyeondong(sigunguCode) {
    try {
      const res = await fetch(
        `${API_BASE}/api/legal-codes/eupmyeondong?sigunguCode=${encodeURIComponent(sigunguCode)}`
      );
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "동/읍/면 목록 조회 실패");
      setEupmyeondongList(data.items || []);
      setSelectedEupmyeondong("");
    } catch (err) {
      setError(err.message || "동/읍/면 목록 조회 중 오류");
    }
  }

  function handleEupmyeondongChange(code) {
    setSelectedEupmyeondong(code);
    const picked = eupmyeondongList.find((item) => item.code === code);
    if (!picked) return;

    setForm((prev) => ({
      ...prev,
      legalDongCode: picked.code,
      legalDongName: picked.name,
    }));
  }

  async function searchLegalCodes() {
    setSearchingCodes(true);
    setError("");
    setCodeSearched(true);
    try {
      const res = await fetch(`${API_BASE}/api/legal-codes?q=${encodeURIComponent(codeQuery)}&limit=30`);
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "법정동코드 조회에 실패했습니다.");
      setCodeResults(data.items || []);
    } catch (err) {
      setError(err.message || "법정동코드 조회 중 오류가 발생했습니다.");
    } finally {
      setSearchingCodes(false);
    }
  }

  function applyCode(item) {
    setForm((prev) => ({
      ...prev,
      legalDongCode: item.code,
      legalDongName: item.name,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/land-characteristics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stdrYear: form.stdrYear,
          legalDongCode: form.legalDongCode,
          mountain: form.mountain,
          mainNo: form.mainNo,
          subNo: form.subNo,
        }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || "조회에 실패했습니다.");
      setResult(data);
    } catch (err) {
      setError(err.message || "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h1>토지이용계획 검색기</h1>
        <p className="sub">법정동코드는 드롭다운 선택 또는 검색으로 입력할 수 있습니다.</p>

        <div className="dropdown-grid">
          <label>
            시/도
            <select value={selectedSido} onChange={(e) => setSelectedSido(e.target.value)}>
              <option value="">시/도 선택</option>
              {sidoList.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            구/군
            <select
              value={selectedSigungu}
              onChange={(e) => setSelectedSigungu(e.target.value)}
              disabled={!selectedSido}
            >
              <option value="">구/군 선택</option>
              {sigunguList.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            동/읍/면
            <select
              value={selectedEupmyeondong}
              onChange={(e) => handleEupmyeondongChange(e.target.value)}
              disabled={!selectedSigungu}
            >
              <option value="">동/읍/면 선택</option>
              {eupmyeondongList.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            기준연도
            <input
              value={form.stdrYear}
              onChange={(e) => setForm((p) => ({ ...p, stdrYear: e.target.value }))}
              placeholder="예: 2025"
              inputMode="numeric"
              required
            />
          </label>

          <label>
            법정동코드(10자리)
            <input
              value={form.legalDongCode}
              onChange={(e) => setForm((p) => ({ ...p, legalDongCode: e.target.value }))}
              placeholder="예: 4122010600"
              inputMode="numeric"
              required
            />
          </label>

          <label>
            본번
            <input
              value={form.mainNo}
              onChange={(e) => setForm((p) => ({ ...p, mainNo: e.target.value }))}
              placeholder="예: 449"
              inputMode="numeric"
              required
            />
          </label>

          <label>
            부번
            <input
              value={form.subNo}
              onChange={(e) => setForm((p) => ({ ...p, subNo: e.target.value }))}
              placeholder="예: 2"
              inputMode="numeric"
              required
            />
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.mountain}
              onChange={(e) => setForm((p) => ({ ...p, mountain: e.target.checked }))}
            />
            산 여부
          </label>

          <div className="pnu">PNU 미리보기: <strong>{pnuPreview || "-"}</strong></div>

          <button type="submit" disabled={loading}>
            {loading ? "조회 중..." : "토지특성 조회"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>법정동코드 검색</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            searchLegalCodes();
          }}
        >
          <input
            value={codeQuery}
            onChange={(e) => setCodeQuery(e.target.value)}
            placeholder="예: 수원 영통구 또는 41220"
          />
          <button type="submit" disabled={searchingCodes}>
            {searchingCodes ? "검색 중..." : "검색"}
          </button>
        </form>

        {codeResults.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>법정동코드</th>
                <th>법정동명</th>
                <th>폐지여부</th>
              </tr>
            </thead>
            <tbody>
              {codeResults.map((item) => (
                <tr key={item.code} onClick={() => applyCode(item)}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {codeSearched && codeResults.length === 0 && <p>검색 결과가 없습니다. 다른 키워드로 시도해 주세요.</p>}
      </section>

      {error && <section className="card error">{error}</section>}

      {result && (
        <section className="card">
          <h2>조회 결과</h2>
          <p>응답코드: {result.resultCode || "-"} / 메시지: {result.resultMsg || "-"}</p>
          <p>선택한 법정동: {form.legalDongName || "(미지정)"}</p>
          <table>
            <thead>
              <tr>
                <th>고유번호</th>
                <th>법정동명</th>
                <th>지번</th>
                <th>기준연도</th>
                <th>지목명</th>
                <th>토지면적</th>
                <th>토지이용상황</th>
                <th>용도지역1</th>
                <th>용도지역2</th>
                <th>도로접면</th>
                <th>지형형상</th>
                <th>지형높이</th>
                <th>공시지가</th>
                <th>기준일자</th>
              </tr>
            </thead>
            <tbody>
              {(result.items || []).map((item, idx) => (
                <tr key={`${item.pnu || "row"}-${idx}`}>
                  <td>{item.pnu || "-"}</td>
                  <td>{item.ldCodeNm || "-"}</td>
                  <td>{item.jibun || item.mnnmSlno || "-"}</td>
                  <td>{item.stdrYear || "-"}</td>
                  <td>{item.lndcgrCodeNm || "-"}</td>
                  <td>{item.lndpclAr || "-"}</td>
                  <td>{item.lnduseSittnCodeNm || "-"}</td>
                  <td>{item.tpgrphFrmCodeNm || "-"}</td>
                  <td>{item.tpgrphHgCodeNm || "-"}</td>
                  <td>{item.roadSideCodeNm || "-"}</td>
                  <td>{item.spfc1 || "-"}</td>
                  <td>{item.spfc2 || "-"}</td>
                  <td>{item.prrnk || "-"}</td>
                  <td>{item.lastUpdtDt || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

