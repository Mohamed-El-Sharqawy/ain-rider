import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, AppState, type AppStateStatus } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

interface LocationMarkerProps {
  coordinate: { latitude: number; longitude: number; heading?: number };
  type?: 'rider' | 'driver';
}

export function LocationMarker({ coordinate, type = 'rider' }: LocationMarkerProps) {
  const scale = useSharedValue(1);
  const appState = useRef(AppState.currentState);

  const startAnimation = () => {
    scale.value = withRepeat(withTiming(1.2, { duration: 2000 }), -1, true);
  };

  const stopAnimation = () => {
    // Stop at current value or reset to 1
    scale.value = withTiming(1, { duration: 300 });
  };

  useEffect(() => {
    startAnimation();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        startAnimation();
      } else if (nextAppState.match(/inactive|background/)) {
        stopAnimation();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [1, 1.2], [0.4, 0]),
  }));

  const markerRotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${coordinate.heading || 0}deg` }],
  }));

  return (
    <MapLibreGL.MarkerView coordinate={[coordinate.longitude, coordinate.latitude]}>
      <View style={styles.container} accessibilityLabel={type === 'driver' ? 'موقع السائق' : 'موقعك الحالي'} accessibilityRole="image">
        <Animated.View style={[styles.pulse, pulseStyle]} />
        <Animated.View style={[styles.markerContainer, type === 'driver' && markerRotationStyle]}>
          <View style={styles.iconCircle} accessibilityLabel={type === 'driver' ? 'سيارة' : 'شخص'}>
            <Ionicons 
              name={type === 'driver' ? "car" : "person"} 
              size={type === 'driver' ? 18 : 16} 
              color="white" 
            />
          </View>
        </Animated.View>
      </View>
    </MapLibreGL.MarkerView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.4)', // Emerald pulse
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10b981', // Emerald-500
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
