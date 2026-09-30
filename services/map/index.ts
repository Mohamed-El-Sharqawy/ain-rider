import { MapProvider } from './map.provider';
import { OsmProvider } from './osm.provider';
import { GoogleMapProvider } from './google.provider';

const VALID_PROVIDERS = new Set(['osm', 'google']);
const MAP_PROVIDER = process.env.EXPO_PUBLIC_MAP_PROVIDER || 'osm';

export function getMapProvider(): MapProvider {
  const provider = VALID_PROVIDERS.has(MAP_PROVIDER) ? MAP_PROVIDER : 'osm';
  if (provider !== MAP_PROVIDER) {
    console.warn(`[MapService] Invalid map provider "${MAP_PROVIDER}", falling back to "osm"`);
  }
  return provider === 'google' ? new GoogleMapProvider() : new OsmProvider();
}

export const mapProvider = getMapProvider();
