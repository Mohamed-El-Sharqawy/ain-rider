import React from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { LatLng } from '../../services/map/map.provider';

interface RoutePolylineProps {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
}

export function RoutePolyline({
  coordinates,
  strokeColor = '#3b82f6',
  strokeWidth = 4,
}: RoutePolylineProps) {
  const isValidCoordinate = (c: LatLng) => 
    typeof c.latitude === 'number' && 
    typeof c.longitude === 'number' &&
    !isNaN(c.latitude) && 
    !isNaN(c.longitude);

  const validCoords = coordinates.filter(isValidCoordinate);
  if (validCoords.length < 2) return null;

  const geoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: validCoords.map((c) => [c.longitude, c.latitude]),
    },
  };

  return (
    <MapLibreGL.ShapeSource id="routeSource" shape={geoJSON}>
      <MapLibreGL.LineLayer
        id="routeLine"
        style={{
          lineColor: strokeColor,
          lineWidth: strokeWidth,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </MapLibreGL.ShapeSource>
  );
}
