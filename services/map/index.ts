import { MapProvider } from './map.provider';
import { OsmProvider } from './osm.provider';
import { GoogleMapProvider } from './google.provider';

const MAP_PROVIDER = process.env.EXPO_PUBLIC_MAP_PROVIDER || 'osm';

export function getMapProvider(): MapProvider {
  return MAP_PROVIDER === 'google' ? new GoogleMapProvider() : new OsmProvider();
}

export const mapProvider = getMapProvider();
