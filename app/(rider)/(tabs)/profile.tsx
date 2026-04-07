import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../stores/auth.store';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { AuthApi } from '../../../lib/api/auth';
import { ApiError } from '../../../lib/api/client';
import { MeResponse } from '../../../lib/api/types';

const menuItems = [
  { id: 'documents', label: 'Identity Documents', icon: 'id-card-outline', route: '/(rider)/settings/documents' },
  { id: 'payment', label: 'Payment Methods', icon: 'card-outline' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { id: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline' },
  { id: 'help', label: 'Help & Support', icon: 'help-circle-outline', route: '/support/complaints' },
];

export default function ProfileScreen() {
  const { logout } = useAuthStore();
  const [userData, setUserData] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const loadUserData = async () => {
    try {
      const data = await AuthApi.getMe();
      setUserData(data);
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/welcome');
  };

  const handleMenuPress = (item: typeof menuItems[0]) => {
    if (item.route) {
      router.push(item.route as any);
    }
  };

  const handleProfileImagePress = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploadingImage(true);
      try {
        await AuthApi.uploadProfileImage(result.assets[0].uri);
        // Reload user data to get new image URL
        await loadUserData();
        Alert.alert('Success', 'Profile image updated!');
      } catch (error) {
        console.error('Upload error:', error);
        Alert.alert('Upload Failed', error instanceof ApiError ? error.message : 'Please try again.');
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  const profileImageUrl = userData?.images?.profileImage?.url;
  const hasDocuments = userData?.images?.identityFront || userData?.images?.identityBack;

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <ScrollView className="flex-1">
        <View className="px-6 pt-6 mb-6">
          <Text className="text-3xl font-bold text-white tracking-tight">Profile</Text>
        </View>

        <View className="px-6">
          {/* Profile Header */}
          <View className="bg-zinc-900 rounded-[32px] p-8 items-center border border-zinc-800/50 mb-6">
            <TouchableOpacity
              className="relative"
              onPress={handleProfileImagePress}
              disabled={isUploadingImage}
            >
              <View className="w-24 h-24 rounded-full bg-zinc-800 items-center justify-center mb-4 border-4 border-zinc-700 overflow-hidden">
                {isUploadingImage ? (
                  <ActivityIndicator color="#10b981" size="large" />
                ) : profileImageUrl ? (
                  <Image source={{ uri: profileImageUrl.replace("localhost", "192.168.1.3") }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <Ionicons name="person" color="#10b981" size={48} />
                )}
              </View>
              <View className="absolute bottom-3 right-0 bg-emerald-600 w-8 h-8 rounded-full items-center justify-center border-4 border-zinc-900">
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            {isLoading ? (
              <View className="h-16 justify-center">
                <ActivityIndicator color="#10b981" />
              </View>
            ) : (
              <>
                <Text className="text-2xl font-bold text-white">
                  {userData?.firstName} {userData?.lastName}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="call-outline" color="#71717a" size={14} />
                  <Text className="text-zinc-500 font-medium ml-1">{userData?.phoneNumber}</Text>
                </View>
                <Text className="text-zinc-600 text-sm mt-0.5">{userData?.email}</Text>
              </>
            )}
          </View>

          {/* Menu Items */}
          <View className="bg-zinc-900 rounded-[32px] border border-zinc-800/50 mb-6 overflow-hidden">
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                className={`flex-row items-center p-5 ${index < menuItems.length - 1 ? 'border-b border-zinc-800/30' : ''}`}
                activeOpacity={0.7}
                onPress={() => handleMenuPress(item)}
              >
                <View className="bg-zinc-800/50 p-2.5 rounded-xl mr-4">
                  <Ionicons name={item.icon as any} color="#a1a1aa" size={22} />
                </View>
                <Text className="flex-1 text-lg text-white/90 font-medium">{item.label}</Text>
                {item.id === 'documents' && hasDocuments && (
                  <View className="bg-emerald-600/20 px-2 py-1 rounded-full mr-2">
                    <Text className="text-emerald-400 text-xs font-bold">Verified</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" color="#3f3f46" size={20} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            className="bg-red-500/10 rounded-[32px] p-5 flex-row items-center border border-red-500/20"
            activeOpacity={0.7}
            onPress={handleLogout}
          >
            <View className="bg-red-500/20 p-2.5 rounded-xl mr-4">
              <Ionicons name="log-out-outline" color="#ef4444" size={22} />
            </View>
            <Text className="flex-1 text-lg text-red-500 font-bold">Sign Out</Text>
          </TouchableOpacity>

          {/* Version */}
          <View className="mt-8 items-center">
            <Text className="text-zinc-600 text-xs font-bold uppercase tracking-widest">Ain Rider v1.0.0</Text>
            <Text className="text-zinc-700 text-[10px] mt-1">Made with ❤️ in Baghdad</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
