export const ApiConfig = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  wsUrl: process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws',
  osmNominatimUrl: 'https://nominatim.openstreetmap.org',
  osmRouterUrl: process.env.EXPO_PUBLIC_OSM_ROUTER_URL || 'http://localhost:5000',
} as const;

export const RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
} as const;

export const DEFAULT_LOCATION = {
  latitude: 30.0444,
  longitude: 31.2357,
} as const;

export const DRIVER_DEFAULT_LOCATION = {
  latitude: 30.1471979,
  longitude: 31.3938551,
} as const;
