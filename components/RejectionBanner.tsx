import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RejectionBannerProps {
  reason: string;
}

export const RejectionBanner = ({ reason }: RejectionBannerProps) => {
  if (!reason) return null;

  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle" size={20} color="#EF4444" />
      <View style={styles.content}>
        <Text style={styles.title}>Documents Rejected</Text>
        <Text style={styles.reason}>{reason}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 2,
  },
  reason: {
    color: 'rgba(248, 113, 113, 0.8)',
    fontSize: 12,
    lineHeight: 16,
  },
});
