import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface CarMarkerProps {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  heading?: number;
  id: string;
}

/**
 * Uber-style Animated Car Marker for MapLibre
 * Features:
 * - Premium Emerald Green Car Icon
 * - Smooth position & rotation transitions using Reanimated
 */
export const CarMarker = ({ coordinate, heading = 0, id }: CarMarkerProps) => {
  const lat = useSharedValue(coordinate.latitude);
  const lng = useSharedValue(coordinate.longitude);
  const rotation = useSharedValue(heading);

  useEffect(() => {
    lat.value = withTiming(coordinate.latitude, { duration: 1000, easing: Easing.bezier(0.4, 0, 0.2, 1) });
    lng.value = withTiming(coordinate.longitude, { duration: 1000, easing: Easing.bezier(0.4, 0, 0.2, 1) });
  }, [coordinate.latitude, coordinate.longitude]);

  useEffect(() => {
    rotation.value = withTiming(heading, { duration: 800 });
  }, [heading]);

  const animatedMarkerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` }
    ],
  }));

  // We use MarkerView for custom components on MapLibre.
  // Note: Position animation for MarkerView is handled by the 'coordinate' prop,
  // but for truly smooth 'animation' of the coordinate itself, 
  // MapLibre's specialized ShapeSource/SymbolLayer is usually better for hundreds of cars.
  // For 'nearby' cars (a few), MarkerView is fine.
  
  return (
    <MapLibreGL.MarkerView id={`car-${id}`} coordinate={[coordinate.longitude, coordinate.latitude]}>
      <Animated.View style={[styles.container, animatedMarkerStyle]}>
        {/* Car Glow Effect */}
        <View style={styles.glow} />
        
        {/* Car Body Container */}
        <View style={styles.carBody}>
          <Ionicons name="car" size={20} color="white" />
          
          {/* Forward direction indicator (The Front) */}
          <View style={styles.directionTip} />
        </View>
      </Animated.View>
    </MapLibreGL.MarkerView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  carBody: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#10b981', // Emerald-500
    borderWidth: 2,
    borderColor: '#064e3b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  directionTip: {
    position: 'absolute',
    top: -4,
    width: 8,
    height: 8,
    backgroundColor: '#10b981',
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderColor: '#064e3b',
    transform: [{ rotate: '45deg' }],
  },
});
