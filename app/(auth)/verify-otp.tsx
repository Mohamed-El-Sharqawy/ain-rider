import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { ApiClient } from '../../lib/api';
import { auth } from '../../lib/firebase';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';

export default function VerifyOtpScreen() {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { phone, verificationId } = useOnboardingStore();

  const handleVerify = async () => {
    if (otp.length === 6) {
      setIsLoading(true);
      try {
        if (!verificationId) {
          throw new Error('No SMS initiated. Please go back and resend the code.');
        }

        // 1. Verify with Firebase
        const credential = PhoneAuthProvider.credential(verificationId, otp);
        const result = await signInWithCredential(auth, credential);
        const idToken = await result.user.getIdToken();

        // 2. Validate token with our backend wrapper to publish event
        await ApiClient.verifyOtp(idToken);

        // 3. Move to basic info
        router.push('/(auth)/basic-info');
      } catch (err: any) {
        console.error('OTP Verification Error:', err);
        alert(`Verification failed: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
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
      <Text className="text-4xl font-extrabold text-white mb-2">Enter the code</Text>
      <Text className="text-xl text-zinc-400 mb-12">Sent to +964 {phone}</Text>

      <TextInput
        className="text-5xl text-white font-bold tracking-widest text-center border-b-2 border-emerald-500 pb-2 mb-12 mx-6"
        placeholder="------"
        placeholderTextColor="#52525b"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={setOtp}
        autoFocus
      />

      <TouchableOpacity 
        className={`py-4 mt-4 rounded-xl items-center shadow-sm ${otp.length === 6 && !isLoading ? 'bg-emerald-500' : 'bg-zinc-800 border border-zinc-700'}`}
        onPress={handleVerify}
        disabled={otp.length < 6 || isLoading}
      >
        <Text className={`text-xl font-bold ${otp.length === 6 && !isLoading ? 'text-white' : 'text-zinc-600'}`}>
          {isLoading ? 'Verifying...' : 'Verify & Continue'}
        </Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}
