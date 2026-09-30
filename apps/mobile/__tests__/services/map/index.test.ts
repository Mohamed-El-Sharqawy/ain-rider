describe('getMapProvider', () => {
  const originalProvider = process.env.EXPO_PUBLIC_MAP_PROVIDER;

  const freshMapModule = () => {
    const map = require('../../../services/map');
    const { OsmProvider } = require('../../../services/map/osm.provider');
    const { GoogleMapProvider } = require('../../../services/map/google.provider');
    return { map, OsmProvider, GoogleMapProvider };
  };

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.EXPO_PUBLIC_MAP_PROVIDER;
    } else {
      process.env.EXPO_PUBLIC_MAP_PROVIDER = originalProvider;
    }
    jest.resetModules();
  });

  it('defaults to the OSM provider', () => {
    delete process.env.EXPO_PUBLIC_MAP_PROVIDER;
    const { map, OsmProvider } = freshMapModule();

    expect(map.getMapProvider()).toBeInstanceOf(OsmProvider);
  });

  it('uses the google provider when configured', () => {
    process.env.EXPO_PUBLIC_MAP_PROVIDER = 'google';
    const { map, GoogleMapProvider } = freshMapModule();

    expect(map.getMapProvider()).toBeInstanceOf(GoogleMapProvider);
  });

  it('falls back to OSM with a warning for an unknown provider', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    process.env.EXPO_PUBLIC_MAP_PROVIDER = 'mapbox';
    const { map, OsmProvider } = freshMapModule();

    expect(map.getMapProvider()).toBeInstanceOf(OsmProvider);
    expect(warnSpy).toHaveBeenCalledWith(
      '[MapService] Invalid map provider "mapbox", falling back to "osm"',
    );
    warnSpy.mockRestore();
  });
});
