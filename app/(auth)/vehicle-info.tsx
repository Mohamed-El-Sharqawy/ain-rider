import { View, Text, TextInput, TouchableOpacity, Platform, Modal, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { DriverApi } from '../../lib/api/driver';
import { VehicleMake, VehicleModel } from '../../lib/api/types';
import { SafeAreaView } from 'react-native-safe-area-context';

// Constants
const COLORS = [
  { name: 'White', hex: '#FFFFFF', icon: 'square' },
  { name: 'Black', hex: '#18181b', icon: 'square' },
  { name: 'Silver', hex: '#d4d4d8', icon: 'square' },
  { name: 'Grey', hex: '#71717a', icon: 'square' },
  { name: 'Blue', hex: '#3b82f6', icon: 'square' },
  { name: 'Red', hex: '#ef4444', icon: 'square' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 25 }, (_, i) => (CURRENT_YEAR + 1 - i).toString());

export default function VehicleInfoScreen() {
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);

  const [selectedMake, setSelectedMake] = useState<VehicleMake | null>(null);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [year, setYear] = useState(CURRENT_YEAR.toString());
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState('White');

  const [isLoading, setIsLoading] = useState(true);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState<'make' | 'model' | 'year' | 'color' | null>(null);

  const { setVehicle } = useOnboardingStore();

  useEffect(() => {
    fetchMakes();
  }, []);

  const fetchMakes = async () => {
    try {
      setIsLoading(true);
      const data = await DriverApi.getMakes();
      setMakes(data);
    } catch (error) {
      console.error('Failed to fetch makes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModels = async (makeId: string) => {
    try {
      setIsModelsLoading(true);
      const data = await DriverApi.getModels(makeId);
      setModels(data);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setIsModelsLoading(false);
    }
  };

  const handleMakeSelect = (make: VehicleMake) => {
    setSelectedMake(make);
    setSelectedModel(null);
    setModels([]);
    fetchModels(make.id);
    setModalVisible('model'); // Auto-transition to model selection
  };

  const handleModelSelect = (model: VehicleModel) => {
    setSelectedModel(model);
    setModalVisible(null);
  };

  const isFormValid = selectedMake && selectedModel && year && plate && plate.length >= 4;

  const handleNext = () => {
    if (isFormValid) {
      setVehicle({
        make: selectedMake.name,
        model: selectedModel.name,
        year: parseInt(year, 10),
        color: color,
        plateNumber: plate,
      });
      router.push('/(auth)/driver-documents');
    }
  };

  const renderSelectionItem = ({ item, type }: { item: any; type: string }) => {
    let label = '';
    let isSelected = false;

    if (type === 'make') {
      label = item.name;
      isSelected = selectedMake?.id === item.id;
    } else if (type === 'model') {
      label = item.name;
      isSelected = selectedModel?.id === item.id;
    } else if (type === 'year') {
      label = item;
      isSelected = year === item;
    } else if (type === 'color') {
      label = item.name;
      isSelected = color === item.name;
    }

    return (
      <TouchableOpacity
        className={`py-4 px-6 mb-2 rounded-2xl flex-row items-center justify-between ${isSelected ? 'bg-emerald-600/20 border-emerald-600' : 'bg-zinc-900 border-zinc-800'}`}
        style={{ borderWidth: 1 }}
        onPress={() => {
          if (type === 'make') handleMakeSelect(item);
          else if (type === 'model') handleModelSelect(item);
          else if (type === 'year') { setYear(item); setModalVisible(null); }
          else if (type === 'color') { setColor(item.name); setModalVisible(null); }
        }}
      >
        <View className="flex-row items-center">
          {type === 'color' && <View className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: item.hex, borderWidth: item.name === 'White' ? 1 : 0, borderColor: '#3f3f46' }} />}
          <Text className={`text-lg font-medium ${isSelected ? 'text-emerald-400' : 'text-zinc-300'}`}>{label}</Text>
        </View>
        {isSelected && <Ionicons name="checkmark-circle" size={24} color="#10b981" />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 60 }}
        enableOnAndroid={true}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} className="mb-8 w-10 h-10 rounded-full bg-zinc-900 items-center justify-center">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text className="text-4xl font-extrabold text-white mb-2 tracking-tighter">Identity your vehicle</Text>
        <Text className="text-xl text-zinc-500 mb-10 font-medium">Please provide accurate vehicle details for approval</Text>

        {/* Brand/Make */}
        <Text className="text-zinc-500 text-xs font-bold uppercase tracking-[2px] mb-3 ml-1">Car Brand</Text>
        <TouchableOpacity
          className="bg-zinc-900 h-16 rounded-2xl flex-row items-center px-5 mb-6 border border-zinc-800/50"
          onPress={() => setModalVisible('make')}
          disabled={isLoading}
        >
          <Ionicons name="business-outline" size={20} color="#71717a" />
          <Text className={`flex-1 text-lg font-medium ml-3 ${selectedMake ? 'text-white' : 'text-zinc-600'}`}>
            {isLoading ? 'Loading brands...' : selectedMake ? selectedMake.name : 'Select car brand'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#3f3f46" />
        </TouchableOpacity>

        {/* Model */}
        <Text className="text-zinc-500 text-xs font-bold uppercase tracking-[2px] mb-3 ml-1">Car Model</Text>
        <TouchableOpacity
          className="bg-zinc-900 h-16 rounded-2xl flex-row items-center px-5 mb-6 border border-zinc-800/50"
          onPress={() => selectedMake && setModalVisible('model')}
          disabled={!selectedMake || isModelsLoading}
        >
          <Ionicons name="car-outline" size={20} color="#71717a" />
          <Text className={`flex-1 text-lg font-medium ml-3 ${selectedModel ? 'text-white' : 'text-zinc-600'}`}>
            {isModelsLoading ? 'Loading models...' : selectedModel ? selectedModel.name : selectedMake ? 'Select model' : 'Pick a brand first'}
          </Text>
          {isModelsLoading ? <ActivityIndicator size="small" color="#10b981" /> : <Ionicons name="chevron-down" size={20} color="#3f3f46" />}
        </TouchableOpacity>

        <View className="flex-row gap-4 mb-6">
          {/* Year */}
          <View className="flex-1">
            <Text className="text-zinc-500 text-xs font-bold uppercase tracking-[2px] mb-3 ml-1">Year</Text>
            <TouchableOpacity
              className="bg-zinc-900 h-16 rounded-2xl flex-row items-center px-5 border border-zinc-800/50"
              onPress={() => setModalVisible('year')}
            >
              <Text className="flex-1 text-lg font-medium text-white text-center">{year}</Text>
              <Ionicons name="calendar-outline" size={16} color="#3f3f46" />
            </TouchableOpacity>
          </View>

          {/* Color */}
          <View className="flex-1">
            <Text className="text-zinc-500 text-xs font-bold uppercase tracking-[2px] mb-3 ml-1">Car Color</Text>
            <TouchableOpacity
              className="bg-zinc-900 h-16 rounded-2xl flex-row items-center px-5 border border-zinc-800/50"
              onPress={() => setModalVisible('color')}
            >
              <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS.find(c => c.name === color)?.hex }} />
              <Text className="flex-1 text-lg font-medium text-white capitalize">{color}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* License Plate */}
        <Text className="text-zinc-500 text-xs font-bold uppercase tracking-[2px] mb-3 ml-1">License Plate</Text>
        <View className="bg-zinc-900 h-16 rounded-2xl flex-row items-center px-5 mb-12 border border-zinc-800/50">
          <Ionicons name="card-outline" size={20} color="#71717a" />
          <TextInput
            className="flex-1 text-white text-lg font-bold ml-3"
            placeholder="ABC-1234"
            placeholderTextColor="#3f3f46"
            autoCapitalize="characters"
            maxLength={10}
            value={plate}
            onChangeText={setPlate}
          />
        </View>

        <TouchableOpacity
          className={`h-16 rounded-2xl items-center justify-center shadow-lg ${isFormValid ? 'bg-emerald-600' : 'bg-zinc-900 border border-zinc-800'}`}
          onPress={handleNext}
          disabled={!isFormValid}
        >
          <Text className={`text-xl font-bold ${isFormValid ? 'text-white' : 'text-zinc-600'}`}>Next: Upload Documents</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* Selection Modals */}
      <Modal visible={!!modalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-zinc-950 rounded-t-[40px] px-6 pt-8 pb-10" style={{ maxHeight: '80%' }}>
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-white capitalize">Select {modalVisible}</Text>
              <TouchableOpacity onPress={() => setModalVisible(null)}>
                <Ionicons name="close-circle" size={32} color="#3f3f46" />
              </TouchableOpacity>
            </View>

            {modalVisible === 'model' && isModelsLoading ? (
              <View className="flex-1 items-center justify-center py-20">
                <ActivityIndicator size="large" color="#10b981" />
                <Text className="text-zinc-500 mt-4 font-medium">Loading models...</Text>
              </View>
            ) : (
              <FlatList
                data={(
                  modalVisible === 'make' ? makes :
                    modalVisible === 'model' ? models :
                      modalVisible === 'year' ? YEARS :
                        modalVisible === 'color' ? COLORS : []
                ) as any[]}
                keyExtractor={(item, index) => (typeof item === 'string' ? item : (item as any).id || index.toString())}
                renderItem={(info) => renderSelectionItem({ ...info, type: modalVisible! })}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View className="items-center justify-center py-10">
                    <Text className="text-zinc-500 font-medium">No results found</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
