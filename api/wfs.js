const DATASETS = Object.freeze({
  lp_pa_cbnd_bonbun: 200,
  lp_pa_cbnd_bubun: 200,
  lt_c_uq111: 100,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const typename = singleQueryValue(req.query.typename).toLowerCase();
  const bbox = singleQueryValue(req.query.bbox);
  if (!typename || !bbox) {
    res.status(400).json({ error: 'typename and bbox are required' });
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(DATASETS, typename)) {
    res.status(400).json({ error: 'Unsupported WFS dataset' });
    return;
  }

  const bboxError = validateBbox(bbox);
  if (bboxError) {
    res.status(400).json({ error: bboxError });
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
    `&BBOX=${encodeURIComponent(bbox)},EPSG:4326` +
    `&COUNT=${DATASETS[typename]}` +
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

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(r.status)
      .setHeader('Content-Type', 'application/json; charset=utf-8')
      .end(text);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}

function singleQueryValue(value) {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

function validateBbox(raw) {
  const values = raw.split(',').map(Number);
  if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
    return 'bbox must contain four numeric values';
  }
  const [south, west, north, east] = values;
  if (south < -90 || north > 90 || west < -180 || east > 180 || south >= north || west >= east) {
    return 'bbox coordinates are invalid';
  }
  if (north - south > 0.2 || east - west > 0.2) {
    return 'bbox is too large';
  }
  return '';
}

function extractXmlError(xml) {
  // Pull text from <ExceptionText> or <ows:ExceptionText>, fallback to first 200 chars
  const m = xml.match(/<(?:[^:]+:)?ExceptionText[^>]*>([^<]+)</) ||
            xml.match(/<message[^>]*>([^<]+)</i);
  return m ? m[1].trim() : `Vworld XML error: ${xml.slice(0, 120)}`;
}
