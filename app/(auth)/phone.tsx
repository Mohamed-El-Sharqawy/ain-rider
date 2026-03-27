import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { auth, firebaseConfig } from '../../lib/firebase';
import { PhoneAuthProvider } from 'firebase/auth';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { useRef } from 'react';

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const recaptchaVerifier = useRef(null);

  const { setPhone, setVerificationId } = useOnboardingStore();

  const handleNext = async () => {
    if (phoneNumber.length > 8) {
      setIsLoading(true);
      try {
        const formattedPhone = `+964${phoneNumber}`;
        console.log("Sending SMS to: ", formattedPhone);
        
        const phoneProvider = new PhoneAuthProvider(auth);
        const verificationId = await phoneProvider.verifyPhoneNumber(
          formattedPhone,
          recaptchaVerifier.current!
        );
        
        setVerificationId(verificationId);
        setPhone(phoneNumber);
        router.push('/(auth)/verify-otp');
      } catch (err: any) {
        console.error('Firebase Phone Auth Error:', err);
        alert(`Failed to send SMS: ${err.message}`);
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
      <Text className="text-4xl font-extrabold text-white mb-2">What's your number?</Text>
      <Text className="text-lg text-zinc-400 mb-12">We'll send a code to verify your phone.</Text>

      <View className="flex-row items-center border-b-2 border-emerald-500 pb-2 mb-10">
        <Text className="text-3xl text-zinc-300 font-medium mr-4">+1</Text>
        <TextInput
          className="flex-1 text-3xl text-white font-medium tracking-wide"
          placeholder="650-555-1234"
          placeholderTextColor="#52525b"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          autoFocus
        />
      </View>

      <TouchableOpacity
        className={`py-4 mt-6 rounded-xl items-center shadow-sm ${phoneNumber.length > 8 && !isLoading ? 'bg-emerald-500' : 'bg-zinc-800 border border-zinc-700'}`}
        onPress={handleNext}
        disabled={phoneNumber.length <= 8 || isLoading}
      >
        <Text className={`text-xl font-bold ${phoneNumber.length > 8 && !isLoading ? 'text-white' : 'text-zinc-600'}`}>
          {isLoading ? 'Sending SMS...' : 'Next'}
        </Text>
      </TouchableOpacity>

      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
      />
    </KeyboardAwareScrollView>
  );
}
