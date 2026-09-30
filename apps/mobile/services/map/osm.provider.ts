import { LatLng, RouteResult, GeocodingResult, MapProvider } from './map.provider';
import { decodePolyline } from './polyline';
import { ApiConfig } from '../../lib/config/constants';

const OSRM_URL = ApiConfig.osmRouterUrl;
const NOMINATIM_BASE = ApiConfig.osmNominatimUrl;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

export class OsmProvider implements MapProvider {
  async getRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
    try {
      const url = `${OSRM_URL}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline&steps=true`;
      const res = await fetchWithTimeout(url);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = decodePolyline(route.geometry);
        return {
          coordinates,
          distanceMeters: route.distance,
          durationSeconds: route.duration,
          polyline: route.geometry,
        };
      }
    } catch {
    }

    const R = 6371e3;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(destination.latitude - origin.latitude);
    const dLon = toRad(destination.longitude - origin.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(origin.latitude)) * Math.cos(toRad(destination.latitude)) * Math.sin(dLon / 2) ** 2;
    const distanceMeters = 2 * R * Math.asin(Math.sqrt(a)) * 1.3;
    const durationSeconds = (distanceMeters / 1000 / 30) * 3600;

    return {
      coordinates: [origin, destination],
      distanceMeters: Math.round(distanceMeters),
      durationSeconds: Math.round(durationSeconds),
      polyline: '',
    };
  }

  async geocode(address: string): Promise<GeocodingResult[]> {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '10',
    });

    const res = await fetchWithTimeout(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { 'User-Agent': 'ain-rider/1.0' },
    });
    const data = await res.json();

    return data.map((item: any) => ({
      placeId: item.place_id?.toString() || '',
      displayName: item.display_name || '',
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: item.type,
    }));
  }

  async reverseGeocode(location: LatLng): Promise<string> {
    const params = new URLSearchParams({
      lat: location.latitude.toString(),
      lon: location.longitude.toString(),
      format: 'json',
    });

    const res = await fetchWithTimeout(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { 'User-Agent': 'ain-rider/1.0' },
    });
    const data = await res.json();

    return data.display_name || 'Unknown location';
  }

  async searchPlaces(query: string, near?: LatLng): Promise<GeocodingResult[]> {
    const params: Record<string, string> = {
      q: query,
      format: 'json',
      limit: '10',
    };

    if (near) {
      const delta = 0.1;
      params.viewbox = `${near.longitude - delta},${near.latitude + delta},${near.longitude + delta},${near.latitude - delta}`;
      params.bounded = '0';
    }

    const res = await fetchWithTimeout(`${NOMINATIM_BASE}/search?${new URLSearchParams(params)}`, {
      headers: { 'User-Agent': 'ain-rider/1.0' },
    });
    const data = await res.json();

    return data.map((item: any) => ({
      placeId: item.place_id?.toString() || '',
      displayName: item.display_name || '',
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: item.type,
    }));
  }
}
