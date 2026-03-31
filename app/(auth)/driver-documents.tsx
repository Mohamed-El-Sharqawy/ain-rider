import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { DriverApi } from '../../lib/api/driver';
import { ApiError } from '../../lib/api/client';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { RejectionBanner } from '../../components/RejectionBanner';

export default function DriverDocumentsScreen() {
  const { onboardingStatus, documentsStatus, fetchOnboardingStatus, vehicle: storeVehicle } = useOnboardingStore();
  
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idBackUri, setIdBackUri] = useState<string | null>(null);
  
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseFrontUri, setLicenseFrontUri] = useState<string | null>(null);
  const [licenseBackUri, setLicenseBackUri] = useState<string | null>(null);

  const [carImageUri, setCarImageUri] = useState<string | null>(null);
  const [carLicenseUri, setCarLicenseUri] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const { completeOnboarding } = useAuthStore();

  useEffect(() => {
    if (documentsStatus) {
      // Identity - check if property exists before accessing
      const identity = documentsStatus.identity as any;
      if (identity.images?.length >= 3) {
        setIdFrontUri(identity.images[0].url);
        setIdBackUri(identity.images[1].url);
        setSelfieUri(identity.images[2].url);
      }
      
      // License
      const license = documentsStatus.drivingLicense as any;
      if (license.images?.length >= 2) {
        setLicenseFrontUri(license.images[0].url);
        setLicenseBackUri(license.images[1].url);
      }
      
      // Vehicle
      const vehicleDoc = documentsStatus.vehicle as any;
      if (vehicleDoc.carImage) setCarImageUri(vehicleDoc.carImage.url);
      if (vehicleDoc.carLicenseImage) setCarLicenseUri(vehicleDoc.carLicenseImage.url);
    }
  }, [documentsStatus]);

  const pickImage = async (setter: (uri: string) => void, aspect: [number, number] = [4, 3]) => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!selfieUri || !idFrontUri || !idBackUri || !licenseNumber || !licenseFrontUri || !licenseBackUri || !carImageUri || !carLicenseUri) {
      Alert.alert('Missing Documents', 'Please complete all fields and upload all required images.');
      return;
    }

    if (!storeVehicle) {
      Alert.alert('Error', 'Vehicle information is missing. Please go back and re-enter it.');
      return;
    }

    setIsUploading(true);
    try {
      // 1. Identity
      await DriverApi.uploadIdentityDocuments(idFrontUri, idBackUri, selfieUri);
      
      // 2. License
      await DriverApi.uploadDrivingLicense(licenseNumber, licenseFrontUri, licenseBackUri);

      // 3. Vehicle
      await DriverApi.registerVehicle(storeVehicle, carImageUri, carLicenseUri);
      
      Alert.alert('Success', 'Your documents have been uploaded and are under review!', [
        { text: 'Continue', onPress: async () => {
          await fetchOnboardingStatus();
          router.replace('/(auth)/pending-approval');
        }}
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

  const canSubmit = selfieUri && idFrontUri && idBackUri && licenseNumber && licenseFrontUri && licenseBackUri && carImageUri && carLicenseUri && !isUploading;

  const ImageUploadBox = ({ uri, label, onPress, onClear }: any) => (
    <View className="mb-4 flex-1">
      <Text className="text-sm font-medium text-zinc-400 mb-2">{label}</Text>
      <TouchableOpacity 
        className="bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-800 overflow-hidden"
        style={{ height: 120 }}
        onPress={onPress}
      >
        {uri ? (
          <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="camera-outline" size={28} color="#3f3f46" />
          </View>
        )}
      </TouchableOpacity>
      {uri && (
        <TouchableOpacity className="mt-1 self-end" onPress={onClear}>
          <Text className="text-red-500 text-xs font-bold">Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <KeyboardAwareScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="px-6 pt-8">
          <Text className="text-3xl font-black text-white">Verification</Text>
          <Text className="text-zinc-500 text-lg mb-8">We need some documents to get you on the road.</Text>

          {/* Identity Section */}
          <View className="mb-10 bg-zinc-900/50 p-5 rounded-3xl border border-zinc-900">
            <Text className="text-emerald-500 text-xs font-black uppercase tracking-[2px] mb-4">1. Identity Verification</Text>
            
            {documentsStatus?.identity.status === 'REJECTED' && (
              <RejectionBanner reason={documentsStatus.identity.rejectionReason || 'Invalid documents'} />
            )}

            <View className="flex-row gap-4">
              <ImageUploadBox label="Front ID" uri={idFrontUri} onPress={() => pickImage(setIdFrontUri)} onClear={() => setIdFrontUri(null)} />
              <ImageUploadBox label="Back ID" uri={idBackUri} onPress={() => pickImage(setIdBackUri)} onClear={() => setIdBackUri(null)} />
            </View>
            <ImageUploadBox label="Selfie with ID" uri={selfieUri} onPress={() => pickImage(setSelfieUri, [1, 1])} onClear={() => setSelfieUri(null)} />
          </View>

          {/* License Section */}
          <View className="mb-10 bg-zinc-900/50 p-5 rounded-3xl border border-zinc-900">
            <Text className="text-emerald-500 text-xs font-black uppercase tracking-[2px] mb-4">2. Driving License</Text>

            {documentsStatus?.drivingLicense.status === 'REJECTED' && (
              <RejectionBanner reason={documentsStatus.drivingLicense.rejectionReason || 'Invalid license'} />
            )}

            <TextInput
              className="bg-zinc-950 px-5 py-4 rounded-xl border border-zinc-800 mb-6 text-white font-bold text-lg"
              placeholder="License Number"
              placeholderTextColor="#3f3f46"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
            />
            <View className="flex-row gap-4">
              <ImageUploadBox label="License Front" uri={licenseFrontUri} onPress={() => pickImage(setLicenseFrontUri)} onClear={() => setLicenseFrontUri(null)} />
              <ImageUploadBox label="License Back" uri={licenseBackUri} onPress={() => pickImage(setLicenseBackUri)} onClear={() => setLicenseBackUri(null)} />
            </View>
          </View>

          {/* Vehicle Section */}
          <View className="mb-10 bg-zinc-900/50 p-5 rounded-3xl border border-zinc-900">
            <Text className="text-emerald-500 text-xs font-black uppercase tracking-[2px] mb-4">3. Vehicle Images</Text>

            {documentsStatus?.vehicle.status === 'REJECTED' && (
              <RejectionBanner reason={documentsStatus.vehicle.rejectionReason || 'Invalid vehicle documents'} />
            )}

            <View className="flex-row gap-4">
              <ImageUploadBox label="Car Exterior" uri={carImageUri} onPress={() => pickImage(setCarImageUri)} onClear={() => setCarImageUri(null)} />
              <ImageUploadBox label="Vehicle Card" uri={carLicenseUri} onPress={() => pickImage(setCarLicenseUri)} onClear={() => setCarLicenseUri(null)} />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            className={`h-16 rounded-2xl items-center justify-center flex-row ${canSubmit ? 'bg-emerald-600' : 'bg-zinc-900 border border-zinc-800'}`}
            onPress={handleUpload}
            disabled={!canSubmit || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className={`text-xl font-black ${canSubmit ? 'text-white' : 'text-zinc-700'}`}>
                {canSubmit ? 'SUBMIT FOR REVIEW' : 'COMPLETE ALL STEPS'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
