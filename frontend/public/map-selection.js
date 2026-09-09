(function initLandMapSelection(global) {
  function featurePnu(feature) {
    const properties = feature?.properties || {};
    return String(properties.PNU || properties.pnu || properties.A1 || '');
  }

  function pointInRing([x, y], ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function pointInGeometry([lng, lat], geometry) {
    const polygons = geometry?.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
    return polygons.some(polygon => {
      if (!polygon[0] || !pointInRing([lng, lat], polygon[0])) return false;
      return !polygon.slice(1).some(hole => pointInRing([lng, lat], hole));
    });
  }

  function selectParcelFeature(features, { lat, lng, pnu = '' }) {
    const candidates = (features || []).filter(feature => feature?.geometry);
    if (pnu) {
      const exactPnuMatch = candidates.find(feature => featurePnu(feature) === String(pnu));
      if (exactPnuMatch) return exactPnuMatch;
    }
    return candidates.find(feature => pointInGeometry([lng, lat], feature.geometry)) || null;
  }

  global.LandMapSelection = Object.freeze({ featurePnu, pointInGeometry, selectParcelFeature });
})(globalThis);
