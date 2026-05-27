export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { query } = req.query;
  if (!query) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  const key = (process.env.VWORLD_API_KEY || '').trim();
  const domain = (process.env.VWORLD_DOMAIN || req.headers.host || 'localhost').trim();

  if (!key) {
    res.status(500).json({ error: 'VWORLD_API_KEY is not configured' });
    return;
  }

  const url =
    `https://api.vworld.kr/req/search?SERVICE=search&REQUEST=search&VERSION=2.0` +
    `&crs=EPSG:4326&size=10&page=1&query=${encodeURIComponent(query)}` +
    `&type=ADDRESS&category=PARCEL` +
    `&KEY=${key}&DOMAIN=${encodeURIComponent(domain)}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
