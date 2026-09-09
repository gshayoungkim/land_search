import assert from 'node:assert/strict';
import './public/map-selection.js';

const polygon = (west, south, east, north) => ({
  type: 'Polygon',
  coordinates: [[
    [west, south], [east, south], [east, north], [west, north], [west, south],
  ]],
});

const wrongFirst = {
  properties: { pnu: '1171010800106410001', addr: '서울특별시 송파구 문정동 641-1' },
  geometry: polygon(127.1205, 37.4837, 127.1208, 37.4843),
};
const expected = {
  properties: { pnu: '1171010800106510003', addr: '서울특별시 송파구 문정동 651-3' },
  geometry: polygon(127.1208, 37.4838, 127.1212, 37.4843),
};

const selectedByPnu = globalThis.LandMapSelection.selectParcelFeature(
  [wrongFirst, expected],
  { lat: 37.48403138393304, lng: 127.12095556978474, pnu: '1171010800106510003' },
);
assert.equal(selectedByPnu, expected, '검색 PNU와 정확히 일치하는 필지를 선택해야 한다');

const selectedByPoint = globalThis.LandMapSelection.selectParcelFeature(
  [wrongFirst, expected],
  { lat: 37.48403, lng: 127.1210 },
);
assert.equal(selectedByPoint, expected, '일반 클릭은 클릭점을 실제로 포함하는 필지를 선택해야 한다');

const noContainingParcel = globalThis.LandMapSelection.selectParcelFeature(
  [wrongFirst, expected],
  { lat: 37.49, lng: 127.13 },
);
assert.equal(noContainingParcel, null, 'bbox에 걸쳤지만 클릭점을 포함하지 않는 필지는 선택하지 않아야 한다');

console.log('map selection regression tests passed');
