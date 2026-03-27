import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AuthApi } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { SecureStorage } from '../../lib/storage/secure';

export default function VerifyOtpScreen() {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Resend timer state
  const [resendTimer, setResendTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);

  const { phone } = useOnboardingStore();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) return;

    setIsResending(true);
    setErrorMessage(null);
    try {
      const formattedPhone = `+964${phone}`;
      await AuthApi.requestOtp(formattedPhone);
      setResendTimer(60);
    } catch (err: unknown) {
      console.error('OTP Resend Error:', err);
      if (err instanceof ApiError && err.status === 429 && err.data?.retryAfterSeconds) {
        setResendTimer(err.data.retryAfterSeconds);
      } else {
        setErrorMessage(err instanceof ApiError ? err.message : 'Failed to resend code');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!phone) {
        throw new Error('Phone number missing. Please restart authentication.');
      }

      // 1. Verify token with our abstract backend 
      const formattedPhone = `+964${phone}`;
      const result = await AuthApi.verifyOtp(formattedPhone, otp);

      // 2. Persist backend-provided tokens
      await SecureStorage.saveTokens(result.accessToken, result.refreshToken);

      // 3. Move to basic info
      router.replace('/(auth)/basic-info');
    } catch (err: unknown) {
      console.error('OTP Verification Error:', err);
      // Specific messaging for incorrect codes vs general errors
      setErrorMessage(err instanceof ApiError ? err.message : 'Invalid code or connection error.');
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
      <Text className="text-4xl font-extrabold text-white mb-2">Enter the code</Text>
      <Text className="text-xl text-zinc-400 mb-8">Sent to +964 {phone}</Text>

      {errorMessage && (
        <View className="bg-red-500/10 border border-red-500 p-4 rounded-lg mb-6 mx-6">
          <Text className="text-red-500 text-center">{errorMessage}</Text>
        </View>
      )}

      <TextInput
        className="text-5xl text-white font-bold tracking-widest text-center border-b-2 border-emerald-500 pb-2 mb-8 mx-6"
        placeholder="------"
        placeholderTextColor="#52525b"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={(text) => {
          setOtp(text);
          if (errorMessage) setErrorMessage(null);
        }}
        autoFocus
      />

      <TouchableOpacity 
        className={`py-4 rounded-xl items-center shadow-sm flex-row justify-center ${
          otp.length === 6 && !isLoading ? 'bg-emerald-500' : 'bg-zinc-800 border border-zinc-700'
        }`}
        onPress={handleVerify}
        disabled={otp.length < 6 || isLoading}
      >
        {isLoading && <ActivityIndicator color="#10b981" className="mr-2" />}
        <Text className={`text-xl font-bold ${otp.length === 6 && !isLoading ? 'text-white' : 'text-zinc-600'}`}>
          {isLoading ? 'Verifying...' : 'Verify & Continue'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="mt-8 items-center" 
        onPress={handleResend}
        disabled={resendTimer > 0 || isResending}
      >
        <Text className={`text-lg font-medium ${resendTimer > 0 ? 'text-zinc-600' : 'text-emerald-500'}`}>
          {isResending ? 'Sending...' : resendTimer > 0 ? `Resend Code in ${resendTimer}s` : 'Resend Code'}
        </Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}
