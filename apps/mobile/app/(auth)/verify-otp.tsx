import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { useAuthStore } from '../../stores/auth.store';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AuthApi } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { SecureStorage } from '../../lib/storage/secure';

const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_LOCKOUT_MS = 60_000;

export default function VerifyOtpScreen() {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Resend timer state
  const [resendTimer, setResendTimer] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [isExpired, setIsExpired] = useState(false);
  const otpSentAt = useRef<Date>(new Date());
  const verifyAttempts = useRef(0);
  const verifyLockedUntil = useRef(0);

  const { phone } = useOnboardingStore();
  const { setAuth, setOnboardingStatus } = useAuthStore();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - otpSentAt.current.getTime();
      if (elapsed >= 120000) {
        setIsExpired(true);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // FR-009: Background/Foreground session expiry check
  useEffect(() => {
    const checkExpiry = () => {
      const fiveMinutes = 5 * 60 * 1000;
      if (Date.now() - sessionStartTime > fiveMinutes) {
        setIsExpired(true);
        setErrorMessage('Your code has expired.');
      }
    };

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkExpiry();
      }
    });

    // Also check on initial mount
    checkExpiry();

    return () => subscription.remove();
  }, [sessionStartTime]);

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) return;

    setIsResending(true);
    setErrorMessage(null);
    try {
      const formattedPhone = phone?.startsWith('+') ? phone : `+20${phone.replace(/^0+/, '')}`;
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

    const now = Date.now();
    if (now < verifyLockedUntil.current) {
      const remaining = Math.ceil((verifyLockedUntil.current - now) / 1000);
      setErrorMessage(`Too many attempts. Try again in ${remaining}s`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!phone) {
        throw new Error('Phone number missing. Please restart authentication.');
      }

      // 1. Verify token with our abstract backend 
      const formattedPhone = phone?.startsWith('+') ? phone : `+20${phone.replace(/^0+/, '')}`;
      const result = await AuthApi.verifyOtp(formattedPhone, otp);

      // 2. Handle based on registration status
      if (result.isRegistered && result.accessToken && result.refreshToken) {
        // Existing user: Persist tokens and go home
        await SecureStorage.saveTokens(result.accessToken, result.refreshToken);

        const isDriverOnboarding = 
          result.user?.role === 'DRIVER' && 
          (result.user?.status === 'PENDING_DOCUMENTS' || 
           result.user?.status === 'UNDER_REVIEW' || 
           result.user?.status === 'REJECTED' ||
           result.user?.status === 'PENDING');

        setAuth(true, result.user?.role || null);
        setOnboardingStatus(isDriverOnboarding);

        if (isDriverOnboarding) {
          // If they are in onboarding, route them to a safe onboarding screen 
          // to trigger the layout's smart redirection or stay on onboarding flow.
          router.replace('/(auth)/vehicle-info');
        } else {
          // Fix SecureStore error by ensuring tokens are strings (redundant but safe)
          const targetPath = result.user?.role === 'DRIVER' ? '/(driver)/(tabs)/home' : '/(rider)/(tabs)/home';
          router.replace(targetPath as any);
        }
      } else {
        // New user: Go to basic info
        router.replace('/(auth)/basic-info');
      }
    } catch (err: unknown) {
      verifyAttempts.current += 1;
      if (verifyAttempts.current >= MAX_VERIFY_ATTEMPTS) {
        verifyLockedUntil.current = Date.now() + VERIFY_LOCKOUT_MS;
        setErrorMessage('Too many failed attempts. Please wait 60 seconds.');
      } else {
        setErrorMessage(err instanceof ApiError ? err.message : 'Invalid code or connection error.');
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
      <Text className="text-4xl font-extrabold text-white mb-2">Enter the code</Text>
      <Text className="text-xl text-zinc-400 mb-8">Sent to +20 {phone}</Text>

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
            otp.length === 6 && !isLoading && !isExpired ? 'bg-emerald-500' : 'bg-zinc-800 border border-zinc-700'
          }`}
          onPress={handleVerify}
          disabled={otp.length < 6 || isLoading || isExpired}
        >
          {isLoading && <ActivityIndicator color="#10b981" className="me-2" />}
          <Text className={`text-xl font-bold ${otp.length === 6 && !isLoading && !isExpired ? 'text-white' : 'text-zinc-600'}`}>
            {isLoading ? 'Verifying...' : 'Verify & Continue'}
          </Text>
        </TouchableOpacity>

        {isExpired && (
          <Text className="text-red-400 text-center mt-4 text-base font-medium">OTP expired. Request a new one.</Text>
        )}

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
