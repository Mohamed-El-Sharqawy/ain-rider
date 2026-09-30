import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { useAuthStore } from '../../stores/auth.store';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { isValidEmail } from '../../lib/validation';

export default function BasicInfoScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { role, phone } = useOnboardingStore();
  const { registerUser } = useAuthStore();

  const isFormValid = firstName && lastName && email && password.length >= 6;

  const handleNext = async () => {
    if (!isFormValid) return;

    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    
    setIsLoading(true);
    try {
      await registerUser({
        firstName,
        lastName,
        email,
        password,
        phoneNumber: phone?.startsWith('+') ? phone : `+964${phone}`,
        role: (role || 'RIDER') as any // Cast to match UserRole enum from types
      });

      if (role === 'DRIVER') {
        router.push('/(auth)/driver-profile-extra');
      } else {
        router.replace('/(auth)/documents');
      }
    } catch (err: any) {
      alert(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView 
      style={{ flex: 1, backgroundColor: '#18181b' }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 96, paddingBottom: 60 }}
      enableOnAndroid={true}
      enableAutomaticScroll={true}
      extraHeight={140}
      extraScrollHeight={60}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text className="text-4xl font-extrabold text-white mb-2">About you</Text>
      <Text className="text-xl text-zinc-400 mb-10">We need this for your profile and receipts.</Text>

      <Text className="text-base font-semibold text-zinc-400 mb-2 ms-1">First Name</Text>
      <TextInput
        className="bg-zinc-800 px-5 py-4 rounded-2xl border border-zinc-700 mb-6 text-white font-medium text-lg shadow-sm"
        placeholder="Ali"
        placeholderTextColor="#52525b"
        value={firstName}
        onChangeText={setFirstName}
      />

      <Text className="text-base font-semibold text-zinc-400 mb-2 ms-1">Last Name</Text>
      <TextInput
        className="bg-zinc-800 px-5 py-4 rounded-2xl border border-zinc-700 mb-6 text-white font-medium text-lg shadow-sm"
        placeholder="Hassan"
        placeholderTextColor="#52525b"
        value={lastName}
        onChangeText={setLastName}
      />

      <Text className="text-base font-semibold text-zinc-400 mb-2 ms-1">Email</Text>
      <TextInput
        className="bg-zinc-800 px-5 py-4 rounded-2xl border border-zinc-700 mb-6 text-white font-medium text-lg shadow-sm"
        placeholder="ali@example.com"
        placeholderTextColor="#52525b"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <Text className="text-base font-semibold text-zinc-400 mb-2 ms-1">Password</Text>
      <View className="flex-row items-center bg-zinc-800 rounded-2xl border border-zinc-700 mb-12 shadow-sm pe-5">
        <TextInput
          className="flex-1 px-5 py-4 text-white font-medium text-lg"
          placeholder="Minimum 6 characters"
          placeholderTextColor="#52525b"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity 
          onPress={() => setShowPassword(!showPassword)}
          className="ps-4 py-2"
        >
          <Text className="text-zinc-400 font-bold tracking-wider text-sm">{showPassword ? 'HIDE' : 'SHOW'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        className={`py-4 rounded-xl items-center shadow-md ${isFormValid && !isLoading ? 'bg-emerald-500' : 'bg-zinc-800 border border-zinc-700'}`}
        onPress={handleNext}
        disabled={!isFormValid || isLoading}
      >
        <Text className={`text-xl font-bold ${isFormValid && !isLoading ? 'text-white' : 'text-zinc-600'}`}>
          {isLoading ? 'Registering...' : (role === 'DRIVER' ? 'Next: Vehicle Info' : 'Complete Registration')}
        </Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}
