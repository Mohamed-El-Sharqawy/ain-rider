import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

interface PickupDropoffPinsProps {
  pickup?: { latitude: number; longitude: number; address?: string };
  dropoff?: { latitude: number; longitude: number; address?: string };
}

export function PickupDropoffPins({ pickup, dropoff }: PickupDropoffPinsProps) {
  return (
    <>
      {pickup && (
        <MapLibreGL.MarkerView coordinate={[pickup.longitude, pickup.latitude]}>
          <View style={[styles.pin, styles.pickupPin]} accessibilityLabel="نقطة الاستلام" accessibilityRole="image">
            <View style={[styles.pinDot, styles.pickupDot]} />
            <Text style={styles.pinLabel} numberOfLines={1}>
              نقطة الاستلام
            </Text>
            {pickup.address && (
              <Text style={[styles.pinAddress, { writingDirection: 'ltr' }]} numberOfLines={1}>
                {pickup.address}
              </Text>
            )}
          </View>
        </MapLibreGL.MarkerView>
      )}
      {dropoff && (
        <MapLibreGL.MarkerView coordinate={[dropoff.longitude, dropoff.latitude]}>
          <View style={[styles.pin, styles.dropoffPin]} accessibilityLabel="نقطة التوصيل" accessibilityRole="image">
            <View style={[styles.pinDot, styles.dropoffDot]} />
            <Text style={styles.pinLabel} numberOfLines={1}>
              نقطة التوصيل
            </Text>
            {dropoff.address && (
              <Text style={[styles.pinAddress, { writingDirection: 'ltr' }]} numberOfLines={1}>
                {dropoff.address}
              </Text>
            )}
          </View>
        </MapLibreGL.MarkerView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pin: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
  },
  pickupPin: {
    backgroundColor: '#dcfce7',
  },
  dropoffPin: {
    backgroundColor: '#fee2e2',
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  pickupDot: {
    backgroundColor: '#22c55e',
  },
  dropoffDot: {
    backgroundColor: '#ef4444',
  },
  pinLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#18181b',
  },
  pinAddress: {
    fontSize: 9,
    color: '#52525b',
    maxWidth: 80,
  },
});
