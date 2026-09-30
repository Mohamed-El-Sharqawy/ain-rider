import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Animated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LatLng } from '../../services/map/map.provider';
import { useAnimatedCoordinate } from '../../hooks/useAnimatedCoordinate';

/**
 * DriverMarker represents a vehicle on the map with Uber-style smooth animation.
 *
 * Position and heading interpolate smoothly between WebSocket updates (~3s intervals)
 * via the useAnimatedCoordinate hook. The marker glides at ~20fps rather than jumping.
 *
 * IMPORTANT: When rendering multiple markers, ensure the React 'key' prop
 * is set to the driver's unique ID to maintain proper animation state.
 */
interface DriverMarkerProps {
  coordinate: LatLng;
  heading?: number;
}

export function DriverMarker({ coordinate, heading }: DriverMarkerProps) {
  const { coord, sharedHeading } = useAnimatedCoordinate(
    coordinate,
    heading,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sharedHeading.value}deg` }],
  }));

  return (
    <MapLibreGL.MarkerView coordinate={[coord.longitude, coord.latitude]}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.carIcon}>
          <View style={styles.carBody} />
          <View style={styles.carFront} />
        </View>
      </Animated.View>
    </MapLibreGL.MarkerView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carIcon: {
    width: 28,
    height: 28,
    backgroundColor: '#22c55e',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carBody: {
    width: 16,
    height: 10,
    backgroundColor: 'white',
    borderRadius: 3,
  },
  carFront: {
    width: 8,
    height: 4,
    backgroundColor: 'white',
    borderRadius: 2,
    marginTop: -2,
  },
});
