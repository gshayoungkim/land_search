export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { url } = req.query;
  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  const allowed = ["daumcdn.net", "kakao.com", "kakaocdn.net", "vworld.kr", "api.vworld.kr"];
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const isAllowed = allowed.some(d => host.endsWith(d));
    if (!isAllowed) {
      res.status(403).json({ error: 'Forbidden domain' });
      return;
    }

    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) {
      res.status(r.status).end();
      return;
    }
    const blob = await r.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    res.status(r.status)
      .setHeader('Content-Type', r.headers.get('Content-Type') || 'image/png')
      .end(buffer);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
