import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AuthApi } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [waitTime, setWaitTime] = useState<number | null>(null);

  const { setPhone } = useOnboardingStore();

  const handleNext = async () => {
    if (phoneNumber.length < 8) return;

    setIsLoading(true);
    setErrorMessage(null);
    setWaitTime(null);

    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+964${phoneNumber}`;
      
      // Request abstract OTP from our backend
      await AuthApi.requestOtp(formattedPhone);
      
      // Save global state for the verify and basic info screens
      setPhone(phoneNumber);

      router.push('/(auth)/verify-otp');
    } catch (err: unknown) {
      console.error('OTP Request Error:', err);
      if (err instanceof ApiError) {
        if (err.status === 429 && err.data?.retryAfterSeconds) {
          setWaitTime(err.data.retryAfterSeconds);
          setErrorMessage(`Too many requests. Please wait ${err.data.retryAfterSeconds} seconds.`);
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('Failed to request OTP. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: '#18181b' }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 96, paddingBottom: 40 }}
      enableOnAndroid={true}
      enableAutomaticScroll={true}
      extraHeight={120}
      extraScrollHeight={40}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-4xl font-extrabold text-white mb-2">What's your number?</Text>
      <Text className="text-lg text-zinc-400 mb-8">We'll send a code to verify your phone.</Text>

      {errorMessage && (
        <View className="bg-red-500/10 border border-red-500 p-4 rounded-lg mb-6">
          <Text className="text-red-500">{errorMessage}</Text>
        </View>
      )}

      <View className="flex-row items-center border-b-2 border-emerald-500 pb-2 mb-10">
        <Text className="text-3xl text-zinc-300 font-medium mr-4">+964</Text>
        <TextInput
          className="flex-1 text-3xl text-white font-medium tracking-wide"
          placeholder="750 123 4567"
          placeholderTextColor="#52525b"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={(text) => {
            setPhoneNumber(text);
            if (errorMessage) setErrorMessage(null);
          }}
          autoFocus
        />
      </View>

      <TouchableOpacity
        className={`py-4 mt-6 rounded-xl items-center shadow-sm flex-row justify-center ${
          phoneNumber.length > 8 && !isLoading && !waitTime ? 'bg-emerald-500' : 'bg-zinc-800 border border-zinc-700'
        }`}
        onPress={handleNext}
        disabled={phoneNumber.length <= 8 || isLoading || !!waitTime}
      >
        {isLoading && <ActivityIndicator color="#10b981" className="mr-2" />}
        <Text className={`text-xl font-bold ${phoneNumber.length > 8 && !isLoading && !waitTime ? 'text-white' : 'text-zinc-600'}`}>
          {isLoading ? 'Requesting...' : waitTime ? `Wait ${waitTime}s` : 'Next'}
        </Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}
