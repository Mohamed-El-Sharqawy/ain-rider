import React, { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import MapLibreGL, { type CameraRef } from '@maplibre/maplibre-react-native';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import mapStyle from '../../assets/map-style.json';
import { DEFAULT_LOCATION } from '../../lib/config/constants';

interface MapRegionChangeEvent {
  properties: {
    visibleBounds: number[][];
    zoomLevel: number;
    isUserInteraction: boolean;
  };
  type: string;
}

export interface AppMapViewRef {
  flyTo: (center: { latitude: number; longitude: number }, zoom?: number) => void;
  fitBounds: (ne: [number, number], sw: [number, number], padding?: number) => void;
}

interface MapViewProps {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  onPress?: (feature: { geometry: { coordinates: number[] }; properties: Record<string, unknown> }) => void;
  onRegionChange?: (feature: MapRegionChangeEvent) => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const AppMapView = forwardRef<AppMapViewRef, MapViewProps>(function AppMapView(
  {
    center = DEFAULT_LOCATION,
    zoom = 13,
    onPress,
    onRegionChange,
    children,
    style,
  },
  ref,
) {
  const cameraRef = useRef<CameraRef>(null);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
