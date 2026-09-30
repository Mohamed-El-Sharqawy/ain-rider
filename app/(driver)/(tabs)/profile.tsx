import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../../stores/auth.store';
import { AuthApi } from '../../../lib/api/auth';
import { DriverApi } from '../../../lib/api/driver';
import { MeResponse, OnboardingStatusResponse } from '../../../lib/api/types';

type OnboardingStatus = 'PENDING_DOCUMENTS' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

function getStatusColor(status: OnboardingStatus): string {
  switch (status) {
    case 'APPROVED': return 'bg-emerald-500/20';
    case 'UNDER_REVIEW': return 'bg-amber-500/20';
    case 'REJECTED': return 'bg-red-500/20';
    default: return 'bg-zinc-500/20';
  }
}

function getStatusTextColor(status: OnboardingStatus): string {
  switch (status) {
    case 'APPROVED': return 'text-emerald-400';
    case 'UNDER_REVIEW': return 'text-amber-400';
    case 'REJECTED': return 'text-red-400';
    default: return 'text-zinc-400';
  }
}

function getStatusLabel(status: OnboardingStatus): string {
  switch (status) {
    case 'APPROVED': return 'Approved';
    case 'UNDER_REVIEW': return 'Under Review';
    case 'REJECTED': return 'Rejected';
    default: return 'Pending';
  }
}

function getStatusIcon(status: OnboardingStatus): 'checkmark-circle' | 'time-outline' | 'close-circle' | 'ellipse-outline' {
  switch (status) {
    case 'APPROVED': return 'checkmark-circle';
    case 'UNDER_REVIEW': return 'time-outline';
    case 'REJECTED': return 'close-circle';
    default: return 'ellipse-outline';
  }
}

interface MenuSection {
  id: string;
  label: string;
  icon: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  route?: string;
}

const menuItems: MenuSection[] = [
  { id: 'identity', label: 'Identity Documents', icon: 'id-card-outline', subtitle: 'National ID verification' },
  { id: 'license', label: 'Driving License', icon: 'document-text-outline', subtitle: 'License documents' },
  { id: 'vehicle', label: 'About Vehicle', icon: 'car-sport-outline', subtitle: 'Vehicle registration' },
  { id: 'emergency', label: 'Emergency Contact', icon: 'call-outline', subtitle: 'Emergency contact info' },
  { id: 'help', label: 'Help & Support', icon: 'help-circle-outline', route: '/support/complaints' },
];

export default function DriverProfile() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [userData, setUserData] = useState<MeResponse | null>(null);
  const [onboardingData, setOnboardingData] = useState<OnboardingStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [me, onboarding] = await Promise.all([
        AuthApi.getMe(),
        DriverApi.getOnboardingStatus(),
      ]);
      setUserData(me);
      setOnboardingData(onboarding);
    } catch (err) {
      console.error('Failed to load driver profile:', err);
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/welcome' as any);
  };

  const handleMenuPress = (item: MenuSection) => {
    if (item.route) {
      router.push(item.route as any);
      return;
    }
    setExpandedSection(expandedSection === item.id ? null : item.id);
  };

  const profileImageUrl = userData?.images?.profileImage?.url;
  const vehicle = onboardingData?.documents?.vehicle?.details;
  const onboardingStatus = (onboardingData?.onboardingStatus ?? 'PENDING_DOCUMENTS') as OnboardingStatus;
  const identityStatus = onboardingData?.documents?.identity?.status;
  const licenseStatus = onboardingData?.documents?.drivingLicense?.status;
  const vehicleStatus = onboardingData?.documents?.vehicle?.status;

  function getDocBadge(status: string | undefined): { label: string; color: string } | null {
    if (!status) return null;
    switch (status) {
      case 'APPROVED': return { label: 'Verified', color: 'bg-emerald-600/20' };
      case 'REJECTED': return { label: 'Rejected', color: 'bg-red-500/20' };
      default: return { label: 'Pending', color: 'bg-zinc-600/20' };
    }
  }

  if (error && !userData) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
        <View className="flex-1 items-center justify-center px-10">
          <View className="bg-zinc-900/50 w-32 h-32 rounded-full items-center justify-center mb-6 border border-zinc-800/50">
            <Ionicons name="alert-circle" color="#3f3f46" size={64} />
          </View>
          <Text className="text-2xl font-bold text-white mb-3 text-center">Something went wrong</Text>
          <Text className="text-zinc-500 text-center leading-6 mb-8">
            We couldn't load your profile. Please try again.
          </Text>
          <TouchableOpacity onPress={loadData} className="bg-emerald-600 px-8 py-4 rounded-2xl">
            <Text className="text-white font-bold text-lg">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-6 mb-6">
          <Text className="text-3xl font-bold text-white tracking-tight">Profile</Text>
          <Text className="text-zinc-500 mt-1">Your driver account</Text>
        </View>

        <View className="px-6">
          {isLoading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator color="#10b981" size="large" />
              <Text className="text-zinc-500 mt-4 font-medium">Loading your profile...</Text>
            </View>
          ) : (
            <>
              {/* Profile Header Card */}
              <View className="bg-zinc-900 rounded-[32px] p-8 items-center border border-zinc-800/50 mb-6">
                <View className="w-24 h-24 rounded-full bg-zinc-800 items-center justify-center mb-4 border-4 border-zinc-700 overflow-hidden">
                  {profileImageUrl ? (
                    <Image
                      source={{ uri: profileImageUrl.replace('localhost', '192.168.1.3') }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="person" color="#10b981" size={48} />
                  )}
                </View>
                <Text className="text-2xl font-bold text-white">
                  {userData?.firstName} {userData?.lastName}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="call-outline" color="#71717a" size={14} />
                  <Text className="text-zinc-500 font-medium ms-1">{userData?.phoneNumber}</Text>
                </View>
                <Text className="text-zinc-600 text-sm mt-0.5">{userData?.email}</Text>

                {/* Onboarding Status Badge */}
                <View className="flex-row items-center mt-4">
                  <View className={`${getStatusColor(onboardingStatus)} px-4 py-2 rounded-full flex-row items-center`}>
                    <Ionicons
                      name={getStatusIcon(onboardingStatus)}
                      color={onboardingStatus === 'APPROVED' ? '#10b981' : onboardingStatus === 'UNDER_REVIEW' ? '#f59e0b' : onboardingStatus === 'REJECTED' ? '#ef4444' : '#71717a'}
                      size={16}
                    />
                    <Text className={`${getStatusTextColor(onboardingStatus)} text-sm font-bold ms-1.5`}>
                      {getStatusLabel(onboardingStatus)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Vehicle Info Card */}
              {vehicle && (
                <View className="bg-zinc-900 rounded-[32px] border border-zinc-800/50 mb-6 p-6">
                  <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-4">
                    Vehicle
                  </Text>
                  <View className="flex-row items-center mb-4">
                    <View className="bg-emerald-500/10 w-12 h-12 rounded-2xl items-center justify-center me-4">
                      <Ionicons name="car-sport" color="#10b981" size={24} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-bold text-lg">
                        {vehicle.make} {vehicle.model}
                      </Text>
                      <Text className="text-zinc-500 text-sm">
                        {vehicle.year} • {vehicle.color}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-zinc-800/50 rounded-2xl p-4">
                    <View className="flex-row justify-between items-center">
                      <View>
                        <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Plate Number</Text>
                        <Text className="text-white font-bold text-lg mt-0.5">{vehicle.plateNumber}</Text>
                      </View>
                      {(() => {
                        const badge = getDocBadge(vehicleStatus);
                        return badge ? (
                          <View className={`${badge.color} px-3 py-1.5 rounded-full`}>
                            <Text className={`text-xs font-bold ${badge.label === 'Verified' ? 'text-emerald-400' : badge.label === 'Rejected' ? 'text-red-400' : 'text-zinc-400'}`}>
                              {badge.label}
                            </Text>
                          </View>
                        ) : null;
                      })()}
                    </View>
                  </View>
                </View>
              )}

              {/* Menu Items */}
              <View className="bg-zinc-900 rounded-[32px] border border-zinc-800/50 mb-6 overflow-hidden">
                {menuItems.map((item, index) => {
                  const badge = item.id === 'identity'
                    ? getDocBadge(identityStatus)
                    : item.id === 'license'
                      ? getDocBadge(licenseStatus)
                      : item.id === 'vehicle'
                        ? getDocBadge(vehicleStatus)
                        : null;

                  const isExpanded = expandedSection === item.id;

                  return (
                    <View key={item.id}>
                      <TouchableOpacity
                        className={`flex-row items-center p-5 ${index < menuItems.length - 1 ? 'border-b border-zinc-800/30' : ''}`}
                        activeOpacity={0.7}
                        onPress={() => handleMenuPress(item)}
                      >
                        <View className="bg-zinc-800/50 p-2.5 rounded-xl me-4">
                          <Ionicons name={item.icon as any} color="#a1a1aa" size={22} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-lg text-white/90 font-medium">{item.label}</Text>
                          {item.subtitle && (
                            <Text className="text-zinc-500 text-xs mt-0.5">{item.subtitle}</Text>
                          )}
                        </View>
                        {badge && (
                          <View className={`${badge.color} px-2 py-1 rounded-full me-2`}>
                            <Text className={`text-xs font-bold ${badge.label === 'Verified' ? 'text-emerald-400' : badge.label === 'Rejected' ? 'text-red-400' : 'text-zinc-400'}`}>
                              {badge.label}
                            </Text>
                          </View>
                        )}
                        <Ionicons
                          name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                          color="#3f3f46"
                          size={20}
                        />
                      </TouchableOpacity>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <View className="px-5 pb-5 pt-1 border-b border-zinc-800/30">
                          {item.id === 'identity' && (
                            <DocumentInfo
                              status={identityStatus}
                              uploadAttempts={onboardingData?.documents?.identity?.uploadAttempts}
                              rejectionReason={onboardingData?.documents?.identity?.rejectionReason}
                              images={onboardingData?.documents?.identity?.images}
                            />
                          )}
                          {item.id === 'license' && (
                            <DocumentInfo
                              status={licenseStatus}
                              uploadAttempts={onboardingData?.documents?.drivingLicense?.uploadAttempts}
                              rejectionReason={onboardingData?.documents?.drivingLicense?.rejectionReason}
                              images={onboardingData?.documents?.drivingLicense?.images}
                            />
                          )}
                          {item.id === 'vehicle' && vehicle && (
                            <VehicleDetails vehicle={vehicle} status={vehicleStatus} />
                          )}
                          {item.id === 'emergency' && (
                            <EmergencyContactInfo />
                          )}
                          {item.id === 'help' && (
                            <HelpInfo />
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Sign Out Button */}
              <TouchableOpacity
                className="bg-red-500/10 rounded-[32px] p-5 flex-row items-center border border-red-500/20"
                activeOpacity={0.7}
                onPress={handleLogout}
              >
                <View className="bg-red-500/20 p-2.5 rounded-xl me-4">
                  <Ionicons name="log-out-outline" color="#ef4444" size={22} />
                </View>
                <Text className="flex-1 text-lg text-red-500 font-bold">Sign Out</Text>
              </TouchableOpacity>

              {/* Version */}
              <View className="mt-8 items-center mb-6">
                <Text className="text-zinc-600 text-xs font-bold uppercase tracking-widest">Ain Driver v1.0.0</Text>
                <Text className="text-zinc-700 text-[10px] mt-1">Made with ❤️ in Baghdad</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DocumentInfo({
  status,
  uploadAttempts,
  rejectionReason,
  images,
}: {
  status?: string;
  uploadAttempts?: number;
  rejectionReason?: string;
  images?: { url: string; expiresAt: string }[];
}) {
  return (
    <View className="bg-zinc-800/30 rounded-2xl p-4 gap-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Status</Text>
        <Text className={`text-sm font-bold ${status === 'APPROVED' ? 'text-emerald-400' : status === 'REJECTED' ? 'text-red-400' : 'text-zinc-400'
          }`}>
          {status || 'Unknown'}
        </Text>
      </View>
      <View className="flex-row justify-between items-center">
        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Upload Attempts</Text>
        <Text className="text-zinc-300 text-sm font-medium">{uploadAttempts ?? 0} / 3</Text>
      </View>
      {rejectionReason && (
        <View className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
          <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Rejection Reason</Text>
          <Text className="text-red-400 text-sm">{rejectionReason}</Text>
        </View>
      )}
      {images && images.length > 0 && (
        <View>
          <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">
            Uploaded Images ({images.length})
          </Text>
          <View className="flex-row gap-2">
            {images.map((img, idx) => (
              <View key={idx} className="w-16 h-16 rounded-xl bg-zinc-800 overflow-hidden border border-zinc-700/50">
                <Image
                  source={{ uri: img.url.replace('localhost', '192.168.1.3') }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function VehicleDetails({
  vehicle,
  status,
}: {
  vehicle: NonNullable<OnboardingStatusResponse['documents']['vehicle']['details']>;
  status?: string;
}) {
  return (
    <View className="bg-zinc-800/30 rounded-2xl p-4 gap-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Make</Text>
        <Text className="text-white text-sm font-medium">{vehicle.make}</Text>
      </View>
      <View className="flex-row justify-between items-center">
        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Model</Text>
        <Text className="text-white text-sm font-medium">{vehicle.model}</Text>
      </View>
      <View className="flex-row justify-between items-center">
        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Year</Text>
        <Text className="text-white text-sm font-medium">{vehicle.year}</Text>
      </View>
      <View className="flex-row justify-between items-center">
        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Color</Text>
        <Text className="text-white text-sm font-medium">{vehicle.color}</Text>
      </View>
      <View className="flex-row justify-between items-center">
        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Plate</Text>
        <Text className="text-white text-sm font-bold">{vehicle.plateNumber}</Text>
      </View>
      <View className="flex-row justify-between items-center">
        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Registration Status</Text>
        <Text className={`text-sm font-bold ${status === 'APPROVED' ? 'text-emerald-400' : status === 'REJECTED' ? 'text-red-400' : 'text-zinc-400'
          }`}>
          {status || 'Pending'}
        </Text>
      </View>
    </View>
  );
}

function EmergencyContactInfo() {
  return (
    <View className="bg-zinc-800/30 rounded-2xl p-4 gap-2">
      <Text className="text-zinc-500 text-sm leading-5">
        Emergency contact information can be updated during onboarding or by contacting support.
      </Text>
    </View>
  );
}

function HelpInfo() {
  return (
    <View className="bg-zinc-800/30 rounded-2xl p-4 gap-2">
      <Text className="text-zinc-500 text-sm leading-5">
        For help and support, contact us through the app or visit our support center.
      </Text>
    </View>
  );
}