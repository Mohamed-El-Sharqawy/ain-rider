import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RejectionBannerProps {
  reason: string;
}

export const RejectionBanner = ({ reason }: RejectionBannerProps) => {
  if (!reason) return null;

  return (
    <View className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex-row items-center gap-3 mb-6">
      <Ionicons name="alert-circle" size={20} color="#EF4444" />
      <View className="flex-1">
        <Text className="text-red-500 font-bold text-sm mb-0.5">Documents Rejected</Text>
        <Text className="text-red-400/80 text-xs leading-4">{reason}</Text>
      </View>
    </View>
  );
};
