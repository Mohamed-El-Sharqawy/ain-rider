import { OsmProvider } from '../../../services/map/osm.provider';

const jsonResponse = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response);

describe('OsmProvider', () => {
  let provider: OsmProvider;
  const fetchMock = jest.fn();

  beforeEach(() => {
    provider = new OsmProvider();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('getRoute', () => {
    const origin = { latitude: 30.0444, longitude: 31.2357 };
    const destination = { latitude: 30.1472, longitude: 31.3939 };

    it('returns the decoded OSRM route', async () => {
      fetchMock.mockReturnValue(jsonResponse({
        routes: [{ distance: 24500, duration: 1980, geometry: '_p~iF~ps|U_ulLnnqC' }],
      }));

      const route = await provider.getRoute(origin, destination);

      expect(route.distanceMeters).toBe(24500);
      expect(route.durationSeconds).toBe(1980);
      expect(route.polyline).toBe('_p~iF~ps|U_ulLnnqC');
      expect(route.coordinates).toEqual([
        { latitude: 38.5, longitude: -120.2 },
        { latitude: 40.7, longitude: -120.95 },
      ]);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain(
        '/route/v1/driving/31.2357,30.0444;31.3939,30.1472?overview=full&geometries=polyline&steps=true',
      );
    });

    it('falls back to a haversine estimate when OSRM returns no routes', async () => {
      fetchMock.mockReturnValue(jsonResponse({ routes: [] }));

      const route = await provider.getRoute(origin, destination);

      expect(route.coordinates).toEqual([origin, destination]);
      expect(route.distanceMeters).toBe(24744);
      expect(route.durationSeconds).toBe(2969);
      expect(route.polyline).toBe('');
    });

    it('falls back to a haversine estimate when the routes key is missing', async () => {
      fetchMock.mockReturnValue(jsonResponse({ code: 'NoRoute' }));

      await expect(provider.getRoute(origin, destination)).resolves.toEqual({
        coordinates: [origin, destination],
        distanceMeters: 24744,
        durationSeconds: 2969,
        polyline: '',
      });
    });

    it('falls back to a haversine estimate when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      const route = await provider.getRoute(origin, destination);

      expect(route.distanceMeters).toBe(24744);
    });
  });

  describe('geocode', () => {
    it('maps Nominatim results', async () => {
      fetchMock.mockReturnValue(jsonResponse([
        { place_id: 123, display_name: 'Cairo, Egypt', lat: '30.0444', lon: '31.2357', type: 'city' },
      ]));

      const results = await provider.geocode('cairo');

      expect(results).toEqual([
        { placeId: '123', displayName: 'Cairo, Egypt', latitude: 30.0444, longitude: 31.2357, type: 'city' },
      ]);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/search?');
      expect(url).toContain('q=cairo');
      expect(init.headers).toEqual({ 'User-Agent': 'ain-rider/1.0' });
    });

    it('defaults missing fields to empty strings', async () => {
      fetchMock.mockReturnValue(jsonResponse([{ lat: '1.5', lon: '2.5' }]));

      const results = await provider.geocode('x');

      expect(results).toEqual([
        { placeId: '', displayName: '', latitude: 1.5, longitude: 2.5, type: undefined },
      ]);
    });
  });

  describe('reverseGeocode', () => {
    it('returns the display name', async () => {
      fetchMock.mockReturnValue(jsonResponse({ display_name: 'Tahrir Square, Cairo' }));

      await expect(provider.reverseGeocode({ latitude: 30.0444, longitude: 31.2357 })).resolves.toBe(
        'Tahrir Square, Cairo',
      );
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('lat=30.0444');
      expect(url).toContain('lon=31.2357');
    });

    it('returns a placeholder when the response has no display name', async () => {
      fetchMock.mockReturnValue(jsonResponse({ error: 'unable to geocode' }));

      await expect(provider.reverseGeocode({ latitude: 1, longitude: 2 })).resolves.toBe(
        'Unknown location',
      );
    });
  });

  describe('searchPlaces', () => {
    it('searches without a bounding box when near is omitted', async () => {
      fetchMock.mockReturnValue(jsonResponse([]));

      await provider.searchPlaces('coffee');

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/search?');
      expect(url).not.toContain('viewbox');
    });

    it('biases the search to a viewbox around the nearby point', async () => {
      fetchMock.mockReturnValue(jsonResponse([
        { place_id: 9, display_name: 'Cafe', lat: '30.05', lon: '31.24', type: 'cafe' },
      ]));

      const results = await provider.searchPlaces('coffee', { latitude: 30.0444, longitude: 31.2357 });

      expect(results).toEqual([
        { placeId: '9', displayName: 'Cafe', latitude: 30.05, longitude: 31.24, type: 'cafe' },
      ]);
      const url = new URL(fetchMock.mock.calls[0][0] as string);
      const [left, top, right, bottom] = url.searchParams.get('viewbox')!.split(',').map(Number);
      expect(left).toBeCloseTo(31.1357, 6);
      expect(top).toBeCloseTo(30.1444, 6);
      expect(right).toBeCloseTo(31.3357, 6);
      expect(bottom).toBeCloseTo(29.9444, 6);
      expect(url.searchParams.get('bounded')).toBe('0');
    });

    it('defaults missing fields to empty strings', async () => {
      fetchMock.mockReturnValue(jsonResponse([{ lat: '1.5', lon: '2.5' }]));

      await expect(provider.searchPlaces('coffee')).resolves.toEqual([
        { placeId: '', displayName: '', latitude: 1.5, longitude: 2.5, type: undefined },
      ]);
    });
  });

  describe('request timeout', () => {
    it('aborts requests that exceed the timeout window', async () => {
      jest.useFakeTimers();
      fetchMock.mockReturnValue(new Promise<Response>(() => {}));

      const pending = provider.geocode('cairo');
      jest.advanceTimersByTime(5000);

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.signal!.aborted).toBe(true);

      jest.useRealTimers();
      await expect(Promise.race([pending, Promise.resolve(null)])).resolves.toBeNull();
    });
  });
});
