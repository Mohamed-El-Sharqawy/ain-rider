import React, { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { View } from 'react-native';
import mapStyle from '../../assets/map-style.json';

const BAGHDAD = { latitude: 30.147719, longitude: 31.394327 };

export interface AppMapViewRef {
  flyTo: (center: { latitude: number; longitude: number }, zoom?: number) => void;
  fitBounds: (ne: [number, number], sw: [number, number], padding?: number) => void;
}

interface MapViewProps {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  onPress?: (feature: { geometry: { coordinates: [number, number] } }) => void;
  onRegionChange?: (feature: { properties: { visibleBounds: any; zoomLevel: number; isUserInteraction: boolean } }) => void;
  children?: React.ReactNode;
  style?: any;
}

export const AppMapView = forwardRef<AppMapViewRef, MapViewProps>(function AppMapView(
  {
    center = BAGHDAD,
    zoom = 13,
    onPress,
    onRegionChange,
    children,
    style,
  },
  ref,
) {
  const cameraRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (target, targetZoom) => {
      cameraRef.current?.setCamera({
        centerCoordinate: [target.longitude, target.latitude],
        zoomLevel: targetZoom ?? zoom,
        animationDuration: 800,
        animationMode: 'flyTo',
      });
    },
    fitBounds: (ne, sw, padding = 60) => {
      cameraRef.current?.fitBounds(ne, sw, padding, 800);
    },
  }));

  const handlePress = useCallback(
    (event: any) => {
      if (onPress) {
        onPress(event);
      }
    },
    [onPress],
  );

  return (
    <View style={[{ flex: 1 }, style]}>
      <MapLibreGL.MapView
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        onPress={handlePress}
        onRegionDidChange={(e) => onRegionChange?.(e)}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [center.longitude, center.latitude],
            zoomLevel: zoom,
          }}
          animationMode="moveTo"
          animationDuration={300}
        />
        {children}
      </MapLibreGL.MapView>
    </View>
  );
});
