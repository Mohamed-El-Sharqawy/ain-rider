import { GoogleMapProvider } from '../../../services/map/google.provider';

describe('GoogleMapProvider', () => {
  const provider = new GoogleMapProvider();

  it.each([
    ['getRoute', () => provider.getRoute()],
    ['geocode', () => provider.geocode()],
    ['reverseGeocode', () => provider.reverseGeocode()],
    ['searchPlaces', () => provider.searchPlaces()],
  ] as const)('%s is not implemented', async (_name, call) => {
    await expect(call()).rejects.toThrow('Google provider not implemented');
  });
});
