import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { DriverApi } from '../../lib/api/driver';
import { ApiError } from '../../lib/api/client';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DriverProfileExtraScreen() {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [dob, setDob] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isFormValid = address && city && dob && emergencyName && emergencyPhone;

  const handleNext = async () => {
    if (!isFormValid) return;
    
    setIsLoading(true);
    try {
      await DriverApi.updateProfile({
        address,
        city,
        dateOfBirth: dob,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
      });
      router.push('/(auth)/vehicle-info');
    } catch (err: any) {
      alert(err.message || 'Update failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <KeyboardAwareScrollView 
        className="flex-1 px-6"
        contentContainerStyle={{ flexGrow: 1, paddingTop: 40, paddingBottom: 60 }}
        enableOnAndroid={true}
      >
        <Text className="text-3xl font-black text-white mb-2">Almost there!</Text>
        <Text className="text-zinc-500 text-lg mb-10">We need a few more details for verification.</Text>

        <View className="mb-6">
          <Text className="text-zinc-400 font-bold mb-2 ml-1">Address</Text>
          <TextInput
            className="bg-zinc-900 px-5 py-4 rounded-2xl border border-zinc-800 text-white font-medium text-lg"
            placeholder="Street address"
            placeholderTextColor="#3f3f46"
            value={address}
            onChangeText={setAddress}
          />
        </View>

        <View className="mb-6 text-zinc-400">
           <Text className="text-zinc-400 font-bold mb-2 ml-1">City</Text>
          <TextInput
            className="bg-zinc-900 px-5 py-4 rounded-2xl border border-zinc-800 text-white font-medium text-lg"
            placeholder="Baghdad"
            placeholderTextColor="#3f3f46"
            value={city}
            onChangeText={setCity}
          />
        </View>

        <View className="mb-6 text-zinc-400">
           <Text className="text-zinc-400 font-bold mb-2 ml-1">Date of Birth</Text>
          <TextInput
            className="bg-zinc-900 px-5 py-4 rounded-2xl border border-zinc-800 text-white font-medium text-lg"
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#3f3f46"
            value={dob}
            onChangeText={setDob}
          />
        </View>

        <View className="mb-10 p-5 bg-zinc-900/50 rounded-3xl border border-zinc-900">
          <Text className="text-emerald-500 text-xs font-black uppercase tracking-[2px] mb-4">Emergency Contact</Text>
          
          <TextInput
            className="bg-zinc-950 px-5 py-4 rounded-xl border border-zinc-800 mb-4 text-white"
            placeholder="Contact Name"
            placeholderTextColor="#3f3f46"
            value={emergencyName}
            onChangeText={setEmergencyName}
          />
          <TextInput
            className="bg-zinc-950 px-5 py-4 rounded-xl border border-zinc-800 text-white"
            placeholder="Contact Phone"
            placeholderTextColor="#3f3f46"
            keyboardType="phone-pad"
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
          />
        </View>

        <TouchableOpacity 
          className={`h-16 rounded-2xl items-center justify-center flex-row ${isFormValid && !isLoading ? 'bg-emerald-600' : 'bg-zinc-900 border border-zinc-800'}`}
          onPress={handleNext}
          disabled={!isFormValid || isLoading}
        >
          <Text className={`text-xl font-black ${isFormValid && !isLoading ? 'text-white' : 'text-zinc-800'}`}>
            {isLoading ? 'SAVING...' : 'NEXT: VEHICLE INFO'}
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
