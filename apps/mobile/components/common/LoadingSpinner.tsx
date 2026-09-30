import { View, Text, ActivityIndicator, type ViewProps } from 'react-native';

interface LoadingSpinnerProps extends ViewProps {
  size?: 'small' | 'large';
  message?: string;
}

export function LoadingSpinner({ size = 'large', message, className, style, ...rest }: LoadingSpinnerProps) {
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', padding: 24 }, style]} {...rest}>
      <View className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800/50 items-center shadow-2xl">
        <ActivityIndicator color="#10b981" size={size} />
        {message ? (
          <Text className="text-zinc-400 text-sm font-medium mt-4 tracking-tight">{message}</Text>
        ) : (
          <Text className="text-zinc-500 text-xs font-bold mt-3 uppercase tracking-widest">Loading</Text>
        )}
      </View>
    </View>
  );
}
