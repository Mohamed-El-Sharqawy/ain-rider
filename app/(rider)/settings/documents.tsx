import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AuthApi } from '../../../lib/api/auth';
import { ApiError } from '../../../lib/api/client';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MeResponse } from '../../../lib/api/types';

export default function DocumentsSettingsScreen() {
  const [userData, setUserData] = useState<MeResponse | null>(null);
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const data = await AuthApi.getMe();
      setUserData(data);
      // Set existing images if available
      if (data.images?.identityFront?.url) {
        setFrontUri(data.images.identityFront.url);
      }
      if (data.images?.identityBack?.url) {
        setBackUri(data.images.identityBack.url);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async (side: 'front' | 'back') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (side === 'front') {
        setFrontUri(result.assets[0].uri);
      } else {
        setBackUri(result.assets[0].uri);
      }
    }
  };

  const handleUpload = async () => {
    if (!frontUri || !backUri) {
      Alert.alert('Missing Documents', 'Please upload both front and back of your ID card.');
      return;
    }

    // Check if these are new local files (not URLs from server)
    const isFrontNew = !frontUri.startsWith('http');
    const isBackNew = !backUri.startsWith('http');

    if (!isFrontNew && !isBackNew) {
      Alert.alert('No Changes', 'No new documents to upload.');
      return;
    }

    setIsUploading(true);
    try {
      // For now, we need both files to upload
      // In a real app, you might want to support partial updates
      if (isFrontNew || isBackNew) {
        const front = isFrontNew ? frontUri : frontUri;
        const back = isBackNew ? backUri : backUri;
        await AuthApi.uploadIdentityDocuments(front, back);
      }
      
      Alert.alert('Success', 'Your documents have been uploaded successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof ApiError) {
        Alert.alert('Upload Failed', error.message);
      } else {
        Alert.alert('Upload Failed', 'Please check your connection and try again.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const hasExistingDocs = userData?.images?.identityFront || userData?.images?.identityBack;
  const hasNewFiles = (frontUri && !frontUri.startsWith('http')) || (backUri && !backUri.startsWith('http'));
  const canSubmit = frontUri && backUri && hasNewFiles && !isUploading;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator color="#10b981" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center me-4"
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-white">Identity Documents</Text>
            <Text className="text-zinc-500 text-sm mt-1">Upload your ID card for verification</Text>
          </View>
        </View>

        <View className="px-6">
          {hasExistingDocs && (
            <View className="bg-emerald-900/30 p-4 rounded-2xl mb-6" style={{ borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text className="text-emerald-400 font-medium ms-2">Documents uploaded</Text>
              </View>
              <Text className="text-zinc-400 text-sm mt-1">You can update your documents by uploading new ones.</Text>
            </View>
          )}

          {/* Front of ID Card */}
          <View className="mb-4">
            <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-3">Front Side</Text>
            <TouchableOpacity 
              className="bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-700 overflow-hidden"
              style={{ height: 160 }}
              onPress={() => pickImage('front')}
            >
              {frontUri ? (
                <Image source={{ uri: frontUri }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <View className="flex-1 items-center justify-center flex-row">
                  <Ionicons name="image-outline" size={24} color="#3f3f46" />
                  <Text className="text-zinc-500 font-medium ms-2">Tap to upload front</Text>
                </View>
              )}
            </TouchableOpacity>
            {frontUri && (
              <TouchableOpacity className="mt-2 self-end" onPress={() => setFrontUri(null)}>
                <Text className="text-red-400 text-sm font-medium">Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Back of ID Card */}
          <View className="mb-8">
            <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-3">Back Side</Text>
            <TouchableOpacity 
              className="bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-700 overflow-hidden"
              style={{ height: 160 }}
              onPress={() => pickImage('back')}
            >
              {backUri ? (
                <Image source={{ uri: backUri }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <View className="flex-1 items-center justify-center flex-row">
                  <Ionicons name="image-outline" size={24} color="#3f3f46" />
                  <Text className="text-zinc-500 font-medium ms-2">Tap to upload back</Text>
                </View>
              )}
            </TouchableOpacity>
            {backUri && (
              <TouchableOpacity className="mt-2 self-end" onPress={() => setBackUri(null)}>
                <Text className="text-red-400 text-sm font-medium">Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            className={`h-14 rounded-2xl items-center justify-center flex-row ${canSubmit ? 'bg-emerald-600' : 'bg-zinc-800'}`}
            style={{ borderWidth: 1, borderColor: canSubmit ? 'rgba(52, 211, 153, 0.2)' : 'rgba(63, 63, 70, 0.5)' }}
            onPress={handleUpload}
            disabled={!canSubmit}
          >
            {isUploading ? (
              <>
                <ActivityIndicator color="#10b981" style={{ marginRight: 8 }} />
                <Text className="text-white text-lg font-bold">Uploading...</Text>
              </>
            ) : (
              <Text className={`text-lg font-bold ${canSubmit ? 'text-white' : 'text-zinc-500'}`}>
                {hasExistingDocs ? 'Update Documents' : 'Upload Documents'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
