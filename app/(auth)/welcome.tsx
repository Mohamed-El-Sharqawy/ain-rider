import { View, Text, TouchableOpacity, ScrollView, Dimensions, Image, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useState, useRef } from 'react';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: 1,
    title: 'Ain Rider',
    description: 'Your trusted journey starts here. Fast, reliable, and safe.',
    // Replace with your local require flow later e.g., require('../../assets/images/rider.png')
    image: require('../../assets/images/rider.jpg'), 
  },
  {
    id: 2,
    title: 'Earn on your terms',
    description: 'Drive when you want, earn what you need. Maximum flexibility.',
    // Replace with your local require flow later e.g., require('../../assets/images/driver.png')
    image: require('../../assets/images/driver.jpg'), 
  }
];

export default function WelcomeScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / width);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <View className="flex-1 bg-zinc-950 pt-16">
      <View className="absolute top-16 right-6 z-10">
        <TouchableOpacity onPress={() => router.push('/(auth)/role-selection')}>
          <Text className="text-zinc-600 font-bold tracking-wider text-sm px-4 py-2 uppercase">SKIP</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        horizontal 
        pagingEnabled 
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {slides.map((slide) => (
          <View key={slide.id} style={{ width }} className="flex-1 justify-end p-8 pt-16">
            <View className="w-full flex-1 rounded-[40px] mb-10 bg-zinc-900 overflow-hidden border border-zinc-900/50">
              <Image 
                source={slide.image}
                className="w-full h-full opacity-80"
                resizeMode="cover"
              />
            </View>
            <Text className="text-5xl text-white font-extrabold tracking-tighter mb-4">{slide.title}</Text>
            <Text className="text-xl text-zinc-500 leading-snug font-medium">{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Pagination Indicators */}
      <View className="flex-row justify-center mt-4 mb-2">
        {slides.map((_, index) => (
          <View 
            key={index}
            className={`h-1.5 rounded-full mx-1 transition-all duration-300 ${index === currentIndex ? 'w-8 bg-emerald-500' : 'w-2 bg-zinc-800'}`}
          />
        ))}
      </View>

      <View className="w-full px-8 pb-16 pt-4">
        <TouchableOpacity 
          className={`h-20 mb-6 rounded-[32px] items-center justify-center shadow-xl active:opacity-90 transition-all duration-300 ${isLastSlide ? 'bg-emerald-500' : 'bg-emerald-500/10'}`}
          onPress={() => router.push('/(auth)/role-selection')}
          disabled={!isLastSlide}
        >
          <Text className={`text-2xl font-bold ${isLastSlide ? 'text-white' : 'text-emerald-500/30'}`}>
            Get Started
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="py-3 items-center"
          onPress={() => router.push('/(auth)/login')}
        >
          <Text className="text-zinc-600 text-lg font-medium">Already have an account? <Text className="text-white font-bold">Log In</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
