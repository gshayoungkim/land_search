export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const { typename, bbox } = req.query;
  if (!typename || !bbox) {
    res.status(400).json({ error: 'typename and bbox are required' });
    return;
  }

  const key = (process.env.VWORLD_API_KEY || '').trim();
  const domain = (process.env.VWORLD_DOMAIN || req.headers.host || 'localhost').trim();

  if (!key) {
    res.status(500).json({ error: 'VWORLD_API_KEY is not configured' });
    return;
  }

  const url =
    `https://api.vworld.kr/req/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
    `&TYPENAME=${encodeURIComponent(typename)}&SRSNAME=EPSG:4326&OUTPUT=application/json` +
    `&BBOX=${bbox},EPSG:4326` +
    `&COUNT=50` +
    `&KEY=${key}&DOMAIN=${encodeURIComponent(domain)}`;

  try {
    const r = await fetch(url);
    const text = await r.text();

    // Vworld returns XML on auth failure or bad params — surface it as a readable error
    if (text.trimStart().startsWith('<')) {
      const msg = extractXmlError(text);
      res.status(502).json({ error: msg });
      return;
    }

    res.status(r.status)
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .end(text);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}

function extractXmlError(xml) {
  // Pull text from <ExceptionText> or <ows:ExceptionText>, fallback to first 200 chars
  const m = xml.match(/<(?:[^:]+:)?ExceptionText[^>]*>([^<]+)</) ||
            xml.match(/<message[^>]*>([^<]+)</i);
  return m ? m[1].trim() : `Vworld XML error: ${xml.slice(0, 120)}`;
}
