import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserRole } from '../../lib/api/types';
import { AuthApi } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/client';
import { SecureStorage } from '../../lib/storage/secure';
import { router } from 'expo-router';

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage('Please enter email and password');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await AuthApi.login(email, password);
      
      // Save tokens
      await SecureStorage.saveTokens(result.accessToken, result.refreshToken);
      
      // Set auth state with user's actual role from backend
      setAuth(true, result.user.role as UserRole);
      
      // Navigate based on role
      if (result.user.role === 'DRIVER') {
        router.replace('/(driver)/(tabs)/home');
      } else {
        router.replace('/(rider)/(tabs)/home');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage(err instanceof ApiError ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }} 
          className="px-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="pt-12 pb-10">
            <View className="w-20 h-20 rounded-[32px] items-center justify-center mb-8" style={{ backgroundColor: 'rgba(5, 150, 105, 0.1)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <Ionicons name="car-sport" size={40} color="#10b981" />
            </View>
            <Text className="text-white text-5xl font-extrabold tracking-tighter">Welcome</Text>
            <Text className="text-zinc-500 text-xl mt-3 font-medium leading-relaxed">Log in to your account to continue</Text>
          </View>

          <View className="flex-1">
            {errorMessage && (
              <View className="bg-red-900/30 p-4 rounded-2xl mb-6" style={{ borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <Text className="text-red-400 text-center font-medium">{errorMessage}</Text>
              </View>
            )}

            <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-4 ml-1">Email</Text>
            <View className="bg-zinc-900 h-16 rounded-2xl flex-row items-center px-5 mb-6" style={{ borderWidth: 1, borderColor: 'rgba(39, 39, 42, 0.5)' }}>
              <Ionicons name="mail-outline" size={20} color="#71717a" />
              <TextInput 
                className="flex-1 text-white text-lg font-medium ml-3"
                placeholder="email@example.com"
                placeholderTextColor="#3f3f46"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />
            </View>

            <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-4 ml-1">Password</Text>
            <View className="bg-zinc-900 h-16 rounded-2xl flex-row items-center px-5 mb-10" style={{ borderWidth: 1, borderColor: 'rgba(39, 39, 42, 0.5)' }}>
              <Ionicons name="lock-closed-outline" size={20} color="#71717a" />
              <TextInput 
                className="flex-1 text-white text-lg font-medium ml-3"
                placeholder="••••••••"
                placeholderTextColor="#3f3f46"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#71717a" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="pb-12">
            <TouchableOpacity 
              className={`h-16 rounded-2xl items-center justify-center flex-row ${isLoading ? 'bg-zinc-800' : 'bg-emerald-600'}`}
              style={{ borderWidth: 1, borderColor: isLoading ? 'rgba(63, 63, 70, 0.5)' : 'rgba(52, 211, 153, 0.2)' }}
              onPress={handleLogin}
              activeOpacity={0.9}
              disabled={isLoading}
            >
              {isLoading && <ActivityIndicator color="#10b981" style={{ marginRight: 8 }} />}
              <Text className="text-white text-xl font-bold">{isLoading ? 'Signing in...' : 'Sign In'}</Text>
            </TouchableOpacity>
            
            <View className="mt-10 flex-row justify-center items-center">
               <Text className="text-zinc-600 font-medium text-lg">New to Ain? </Text>
               <TouchableOpacity onPress={() => router.push('/(auth)/role-selection')}>
                  <Text className="text-emerald-500 font-bold text-lg">Create Account</Text>
               </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
