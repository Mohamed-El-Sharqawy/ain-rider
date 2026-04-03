import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { LatLng } from '../../services/map/map.provider';

interface DriverMarkerProps {
  id: string;
  coordinate: LatLng;
  heading?: number;
}

export function DriverMarker({ id, coordinate, heading = 0 }: DriverMarkerProps) {
  const rotation = useSharedValue(heading);

  useEffect(() => {
    rotation.value = withTiming(heading, { duration: 500 });
  }, [heading]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <MapLibreGL.MarkerView coordinate={[coordinate.longitude, coordinate.latitude]}>
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
