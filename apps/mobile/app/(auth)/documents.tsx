import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AuthApi } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { useAuthStore } from '../../stores/auth.store';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from '../../lib/validation';

export default function DocumentsScreen() {
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { completeOnboarding } = useAuthStore();

  const pickProfileImage = async () => {
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
      setProfileImageUri(result.assets[0].uri);
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

    setIsUploading(true);
    try {
      const uris = [frontUri, backUri, profileImageUri].filter(Boolean) as string[];
      for (const uri of uris) {
        const fileInfo = await fetch(uri);
        const blob = await fileInfo.blob();
        if (blob.size > MAX_FILE_SIZE_BYTES) {
          Alert.alert('File Too Large', `Each file must be under ${MAX_FILE_SIZE_LABEL}.`);
          setIsUploading(false);
          return;
        }
      }

      if (profileImageUri) {
        await AuthApi.uploadProfileImage(profileImageUri);
      }
      
      const result = await AuthApi.uploadIdentityDocuments(frontUri, backUri);
      
      if (result.success) {
        completeOnboarding();
        Alert.alert('Success', 'Your documents have been uploaded successfully!', [
          { text: 'Continue', onPress: () => router.replace('/(rider)/(tabs)/home') }
        ]);
      }
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

  const handleSkip = () => {
    Alert.alert(
      'Skip Upload?',
      'You can upload your documents later from your profile settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'default', onPress: () => {
          completeOnboarding();
          router.replace('/(rider)/(tabs)/home');
        }}
      ]
    );
  };

  const canSubmit = frontUri && backUri && !isUploading;

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-6">
          <View className="flex-row justify-between items-start mb-2">
            <Text className="text-3xl font-bold text-white">Complete Profile</Text>
            <TouchableOpacity onPress={handleSkip} className="bg-zinc-800 px-4 py-2 rounded-full border border-zinc-700">
              <Text className="text-zinc-400 font-bold">Skip</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-zinc-500 mt-1 mb-8">Upload your photo and ID card to verify your account.</Text>

          {/* Profile Image */}
          <View className="items-center mb-8">
            <TouchableOpacity 
              className="relative"
              onPress={pickProfileImage}
            >
              <View 
                className="w-28 h-28 rounded-full bg-zinc-800 items-center justify-center overflow-hidden border-4 border-zinc-700"
                style={{ borderWidth: 4 }}
              >
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <Ionicons name="person" size={48} color="#52525b" />
                )}
              </View>
              <View className="absolute bottom-0 end-0 bg-emerald-600 w-9 h-9 rounded-full items-center justify-center border-4 border-zinc-950">
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text className="text-zinc-400 text-sm mt-3">Profile Photo</Text>
            {profileImageUri && (
              <TouchableOpacity onPress={() => setProfileImageUri(null)}>
                <Text className="text-red-400 text-sm mt-1">Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ID Card Section */}
          <View className="mb-6">
            <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-4">ID Card</Text>
            
            {/* Front of ID Card */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-zinc-300 mb-2">Front Side</Text>
              <TouchableOpacity 
                className="bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-700 overflow-hidden"
                style={{ height: 140 }}
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
            <View>
              <Text className="text-sm font-medium text-zinc-300 mb-2">Back Side</Text>
              <TouchableOpacity 
                className="bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-700 overflow-hidden"
                style={{ height: 140 }}
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
                <ActivityIndicator color="#10b981" className="me-2" />
                <Text className="text-white text-lg font-bold">Uploading...</Text>
              </>
            ) : (
              <Text className={`text-lg font-bold ${canSubmit ? 'text-white' : 'text-zinc-500'}`}>
                Submit Documents
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
