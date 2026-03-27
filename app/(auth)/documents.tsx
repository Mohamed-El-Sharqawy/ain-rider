import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function DocumentsScreen() {
  
  const handleComplete = () => {
    router.replace('/(auth)/pending-approval');
  };

  return (
    <View className="flex-1 bg-zinc-900 px-6 pt-24">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-4xl font-extrabold text-white">Documents</Text>
        <TouchableOpacity onPress={handleComplete} className="bg-zinc-800 px-4 py-2 rounded-full mt-1 border border-zinc-700">
          <Text className="text-zinc-400 font-bold">Skip</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-xl text-zinc-400 mb-12 leading-snug">You can safely skip this step and upload these required documents later from your settings profile.</Text>

      <TouchableOpacity 
        className="bg-zinc-800 p-8 rounded-3xl border-2 border-dashed border-zinc-700 items-center justify-center mb-6 active:bg-zinc-700"
      >
        <Text className="text-5xl mb-4">🪪</Text>
        <Text className="text-white text-xl font-bold">Driver's License</Text>
        <Text className="text-zinc-400 font-medium mt-1">Both Front & Back</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="bg-zinc-800 p-8 rounded-3xl border-2 border-dashed border-zinc-700 items-center justify-center mb-12 active:bg-zinc-700"
      >
        <Text className="text-5xl mb-4">📄</Text>
        <Text className="text-white text-xl font-bold">Vehicle Registration</Text>
        <Text className="text-zinc-400 font-medium mt-1">Official state document</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="bg-indigo-500 py-4 rounded-xl items-center shadow-lg w-full absolute bottom-12 self-center mx-6"
        onPress={handleComplete}
      >
        <Text className="text-white text-xl font-bold">Submit Registration</Text>
      </TouchableOpacity>
    </View>
  );
}
