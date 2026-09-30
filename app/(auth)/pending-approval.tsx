import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

function getEstimatedCompletion(): string {
  const now = new Date();
  const hour = now.getHours();
  if (hour < 14) {
    return 'اليوم';
  }
  return 'غداً';
}

export default function PendingApprovalScreen() {
  return (
    <View className="flex-1 bg-zinc-900 justify-center items-center px-10">
      <Text className="text-8xl mb-10">⏳</Text>
      <Text className="text-4xl font-extrabold text-white mb-6 text-center leading-tight">تم استلام الطلب</Text>
      
      <Text className="text-center text-zinc-400 text-lg mb-12 leading-relaxed font-medium">
        نراجع الآن ملفك الشخصي ومعلومات مركبتك. عادةً ما تستغرق هذه العملية 24-48 ساعة. سنقوم بإشعارك بمجرد الموافقة!
      </Text>

      <View className="w-full bg-zinc-800 rounded-3xl p-8 mb-16 border border-zinc-700 shadow-xl">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-zinc-400 font-semibold text-lg">الحالة</Text>
          <View className="bg-amber-400/20 px-3 py-1 rounded-full border border-amber-400/40">
            <Text className="text-amber-400 font-bold tracking-wider">قيد المراجعة</Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-zinc-400 font-semibold text-lg">الإنجاز المتوقع</Text>
          <Text className="text-white font-medium text-lg">{getEstimatedCompletion()}</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        className="bg-indigo-500 py-4 px-10 rounded-xl items-center active:opacity-80 w-full shadow-lg"
        onPress={() => router.replace('/(auth)/welcome')}
      >
        <Text className="text-white text-xl font-bold">العودة للبداية</Text>
      </TouchableOpacity>
    </View>
  );
}
