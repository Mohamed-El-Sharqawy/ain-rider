import { decodePolyline } from '../../../services/map/polyline';

describe('decodePolyline', () => {
  it('decodes the documented Google polyline example', () => {
    // Worked example from Google's Encoded Polyline Algorithm Format docs:
    // (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

    expect(decodePolyline(encoded)).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('decodes negative deltas produced by real encoders', () => {
    // Encoded by the reference algorithm for (35.6762, 139.6503) -> (35.6812, 139.6473)
    const encoded = 'g_wxEkmjsYg^vQ';

    expect(decodePolyline(encoded)).toEqual([
      { latitude: 35.6762, longitude: 139.6503 },
      { latitude: 35.6812, longitude: 139.6473 },
    ]);
  });

  it('decodes negative latitude deltas', () => {
    // Reference-algorithm encoding of the documented Google example reversed:
    // (43.252, -126.453) -> (40.7, -120.95) -> (38.5, -120.2)
    const encoded = '_t~fGfzxbW~lqNwxq`@~tlLonqC';

    expect(decodePolyline(encoded)).toEqual([
      { latitude: 43.252, longitude: -126.453 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 38.5, longitude: -120.2 },
    ]);
  });
});
