import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export default function VehicleInfoScreen() {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');

  const isFormValid = make && model && year && plate;

  const handleNext = () => {
    if (isFormValid) {
      router.push('/(auth)/documents');
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
      <Text className="text-4xl font-extrabold text-white mb-2">Vehicle details</Text>
      <Text className="text-xl text-zinc-400 mb-10">What car will you be driving?</Text>

      <Text className="text-base font-semibold text-zinc-400 mb-2 ml-1">Make (e.g., Toyota)</Text>
      <TextInput
        className="bg-zinc-800 px-5 py-4 rounded-2xl border border-zinc-700 mb-6 text-white font-medium text-lg shadow-sm"
        value={make}
        onChangeText={setMake}
      />

      <Text className="text-base font-semibold text-zinc-400 mb-2 ml-1">Model (e.g., Camry)</Text>
      <TextInput
        className="bg-zinc-800 px-5 py-4 rounded-2xl border border-zinc-700 mb-6 text-white font-medium text-lg shadow-sm"
        value={model}
        onChangeText={setModel}
      />

      <View className="flex-row gap-4 mb-12">
        <View className="flex-1">
          <Text className="text-base font-semibold text-zinc-400 mb-2 ml-1">Year</Text>
          <TextInput
            className="bg-zinc-800 px-5 py-4 rounded-2xl border border-zinc-700 text-white font-medium text-lg shadow-sm text-center"
            keyboardType="number-pad"
            maxLength={4}
            value={year}
            onChangeText={setYear}
          />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-zinc-400 mb-2 ml-1">License Plate</Text>
          <TextInput
            className="bg-zinc-800 px-5 py-4 rounded-2xl border border-zinc-700 text-white font-medium text-lg shadow-sm text-center"
            autoCapitalize="characters"
            value={plate}
            onChangeText={setPlate}
          />
        </View>
      </View>

      <TouchableOpacity 
        className={`py-4 rounded-xl items-center shadow-md ${isFormValid ? 'bg-indigo-500' : 'bg-zinc-800 border border-zinc-700'}`}
        onPress={handleNext}
        disabled={!isFormValid}
      >
        <Text className={`text-xl font-bold ${isFormValid ? 'text-white' : 'text-zinc-600'}`}>Next: Documents</Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}
