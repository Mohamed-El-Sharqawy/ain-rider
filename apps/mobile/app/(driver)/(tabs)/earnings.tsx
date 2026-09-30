import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { TripApi } from '../../../lib/api/trip.api';
import { TripResponse } from '../../../lib/api/types';
import { SupportApi } from '../../../lib/api/support.api';

type Period = 'today' | 'week' | 'month';

function formatFare(fare: number): string {
  return fare.toLocaleString() + ' EGP';
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' +
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatFullDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
    ' at ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDistance(km: number | undefined): string {
  if (km == null) return '';
  return `${km} km`;
}

function formatDuration(min: number | undefined): string {
  if (min == null) return '';
  return `${min} min`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function isThisWeek(date: Date): boolean {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek;
}

function isThisMonth(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

const periods: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

type ReportType = 'LOST_ITEM' | 'RIDER_BEHAVIOR' | 'PAYMENT_ISSUE' | 'ROUTE_ISSUE' | 'VEHICLE_CONDITION' | 'SAFETY_CONCERN' | 'APP_ISSUE' | 'OTHER';

const reportTypes: { key: ReportType; label: string; icon: string; description: string }[] = [
  { key: 'LOST_ITEM', label: 'Lost Item Found', icon: 'search-outline', description: 'Report an item left behind by a rider' },
  { key: 'RIDER_BEHAVIOR', label: 'Rider Behavior', icon: 'person-outline', description: 'Report inappropriate rider behavior' },
  { key: 'PAYMENT_ISSUE', label: 'Payment Issue', icon: 'card-outline', description: 'Report a payment or fare problem' },
  { key: 'ROUTE_ISSUE', label: 'Route Issue', icon: 'map-outline', description: 'Report a problem with the route' },
  { key: 'VEHICLE_CONDITION', label: 'Vehicle Condition', icon: 'car-outline', description: 'Report vehicle-related issues' },
  { key: 'SAFETY_CONCERN', label: 'Safety Concern', icon: 'shield-outline', description: 'Report a safety issue' },
  { key: 'APP_ISSUE', label: 'App Issue', icon: 'phone-portrait-outline', description: 'Report a technical problem' },
  { key: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-outline', description: 'Something else' },
];

export default function DriverEarnings() {
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week');
  const [selectedTrip, setSelectedTrip] = useState<TripResponse | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTrips = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await TripApi.getMyTrips();
      setTrips(data);
    } catch (err) {
      console.error('Failed to load trips:', err);
      setError('Failed to load earnings');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const dateField = trip.completedAt || trip.requestedAt;
      const date = new Date(dateField);
      switch (selectedPeriod) {
        case 'today': return isToday(date);
        case 'week': return isThisWeek(date);
        case 'month': return isThisMonth(date);
      }
    });
  }, [trips, selectedPeriod]);

  const stats = useMemo(() => {
    const totalEarnings = filteredTrips.reduce(
      (sum, trip) => sum + (trip.actualFare ?? trip.estimatedFare), 0
    );
    const tripCount = filteredTrips.length;
    const avgFare = tripCount > 0 ? totalEarnings / tripCount : 0;
    const totalDistance = filteredTrips.reduce((sum, trip) => sum + (trip.distance ?? 0), 0);
    return { totalEarnings, tripCount, avgFare, totalDistance };
  }, [filteredTrips]);

  const handleTripPress = (trip: TripResponse) => {
    setSelectedTrip(trip);
    setShowDetail(true);
  };

  const handleReportPress = () => {
    setShowDetail(false);
    setReportType(null);
    setReportDescription('');
    setShowReport(true);
  };

  const handleSubmitReport = async () => {
    if (!reportType || !selectedTrip) return;

    const selectedReport = reportTypes.find((r) => r.key === reportType);
    if (!reportDescription.trim()) {
      Alert.alert('Missing Details', 'Please provide a description of the issue.');
      return;
    }

    setIsSubmitting(true);
    try {
      await SupportApi.createComplaint({
        tripId: selectedTrip.id,
        againstUserId: selectedTrip.riderId,
        type: reportType,
        subject: selectedReport?.label || 'Trip Report',
        description: reportDescription.trim(),
        priority: reportType === 'SAFETY_CONCERN' ? 'HIGH' : reportType === 'LOST_ITEM' ? 'MEDIUM' : 'LOW',
      });
      Alert.alert('Report Submitted', 'Your report has been sent to our support team. We will review it shortly.');
      setShowReport(false);
      setReportType(null);
      setReportDescription('');
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Could not submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && trips.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
        <View className="flex-1 items-center justify-center px-10">
          <View className="bg-zinc-900/50 w-32 h-32 rounded-full items-center justify-center mb-6 border border-zinc-800/50">
            <Ionicons name="alert-circle" color="#3f3f46" size={64} />
          </View>
          <Text className="text-2xl font-bold text-white mb-3 text-center">Something went wrong</Text>
          <Text className="text-zinc-500 text-center leading-6 mb-8">
            We couldn't load your earnings. Please try again.
          </Text>
          <TouchableOpacity onPress={loadTrips} className="bg-emerald-600 px-8 py-4 rounded-2xl">
            <Text className="text-white font-bold text-lg">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <View className="px-6 pt-6 pb-2">
        <Text className="text-3xl font-bold text-white tracking-tight">Earnings</Text>
        <Text className="text-zinc-500 mt-1">Your trip revenue</Text>
      </View>

      <ScrollView
        className="flex-1 mt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="px-6 mb-5">
          <View className="flex-row bg-zinc-900 rounded-2xl p-1 border border-zinc-800/50">
            {periods.map((period) => (
              <TouchableOpacity
                key={period.key}
                className={`flex-1 py-3 rounded-xl items-center ${selectedPeriod === period.key ? 'bg-emerald-500' : ''}`}
                onPress={() => setSelectedPeriod(period.key)}
                activeOpacity={0.7}
              >
                <Text className={`font-bold text-sm ${selectedPeriod === period.key ? 'text-white' : 'text-zinc-500'}`}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isLoading ? (
          <View className="mt-20 items-center">
            <ActivityIndicator color="#10b981" size="large" />
            <Text className="text-zinc-500 mt-4">Loading earnings...</Text>
          </View>
        ) : (
          <>
            <View className="px-6 mb-5">
              <View className="bg-zinc-900 rounded-[32px] border border-zinc-800/50 p-6">
                <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-2">
                  {periods.find((p) => p.key === selectedPeriod)?.label}
                </Text>
                <Text className="text-4xl font-black text-white tracking-tight mb-6">
                  {formatFare(stats.totalEarnings)}
                </Text>

                <View className="flex-row border-t border-zinc-800/50 pt-5">
                  <View className="flex-1 items-center">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Trips</Text>
                    <Text className="text-white font-black text-xl">{stats.tripCount}</Text>
                  </View>
                  <View className="w-px bg-zinc-800/50" />
                  <View className="flex-1 items-center">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Avg Fare</Text>
                    <Text className="text-white font-black text-xl">{stats.tripCount > 0 ? formatFare(Math.round(stats.avgFare)) : '0 EGP'}</Text>
                  </View>
                  <View className="w-px bg-zinc-800/50" />
                  <View className="flex-1 items-center">
                    <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Distance</Text>
                    <Text className="text-white font-black text-xl">
                      {stats.totalDistance > 0 ? `${stats.totalDistance.toFixed(1)} km` : '0 km'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="px-6 mb-5">
              <View className="bg-zinc-900/60 rounded-2xl border border-zinc-800/30 p-4 flex-row items-center">
                <View className="bg-emerald-500/10 w-10 h-10 rounded-xl items-center justify-center me-3">
                  <Ionicons name="cash-outline" color="#10b981" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Payment Method</Text>
                  <Text className="text-white/90 font-medium text-sm">Cash Collection</Text>
                </View>
                <View className="bg-emerald-500/20 px-3 py-1 rounded-full">
                  <Text className="text-emerald-400 text-xs font-bold">Active</Text>
                </View>
              </View>
            </View>

            <View className="px-6">
              <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-4">
                Trip History ({filteredTrips.length})
              </Text>

              {filteredTrips.length === 0 ? (
                <View className="items-center py-16">
                  <View className="bg-zinc-900/50 w-24 h-24 rounded-full items-center justify-center mb-5 border border-zinc-800/50">
                    <Ionicons name="wallet-outline" color="#3f3f46" size={48} />
                  </View>
                  <Text className="text-xl font-bold text-white mb-2 text-center">No trips yet</Text>
                  <Text className="text-zinc-500 text-center leading-6 px-6">
                    {selectedPeriod === 'today'
                      ? "You haven't completed any trips today."
                      : selectedPeriod === 'week'
                        ? "You haven't completed any trips this week."
                        : "You haven't completed any trips this month."}
                  </Text>
                </View>
              ) : (
                <View className="gap-4">
                  {filteredTrips.map((trip) => {
                    const fare = trip.actualFare ?? trip.estimatedFare;
                    return (
                      <TouchableOpacity
                        key={trip.id}
                        className="bg-zinc-900/60 rounded-[28px] overflow-hidden border border-zinc-800/50"
                        activeOpacity={0.8}
                        onPress={() => handleTripPress(trip)}
                      >
                        <View className="p-5">
                          <View className="flex-row justify-between items-center mb-5">
                            <View className="flex-row items-center flex-1">
                              <View className="bg-emerald-500/20 px-2.5 py-1 rounded-full me-2">
                                <Text className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                                  Completed
                                </Text>
                              </View>
                              <Text className="text-zinc-500 text-xs font-medium" numberOfLines={1}>
                                {formatDate(trip.completedAt || trip.requestedAt)}
                              </Text>
                            </View>
                            <Text className="text-lg font-bold text-white tracking-tight ms-3">
                              {formatFare(fare)}
                            </Text>
                          </View>

                          <View className="flex-row gap-3 mb-4">
                            <View className="items-center py-0.5">
                              <View className="w-2 h-2 rounded-full border-2 border-emerald-500 bg-zinc-950" />
                              <View className="w-[1px] h-8 bg-zinc-800 my-0.5" />
                              <View className="w-2 h-2 rounded-full bg-blue-500" />
                            </View>
                            <View className="flex-1 gap-3">
                              <View>
                                <Text className="text-zinc-500 text-[9px] font-bold uppercase tracking-[2px] mb-0.5">Pickup</Text>
                                <Text className="text-white/90 text-sm font-semibold" numberOfLines={1}>{trip.pickupAddress}</Text>
                              </View>
                              <View>
                                <Text className="text-zinc-500 text-[9px] font-bold uppercase tracking-[2px] mb-0.5">Drop-off</Text>
                                <Text className="text-white/90 text-sm font-semibold" numberOfLines={1}>{trip.dropoffAddress}</Text>
                              </View>
                            </View>
                          </View>

                          <View className="pt-4 border-t border-zinc-800/50 flex-row items-center">
                            <View className="flex-row items-center flex-1 gap-3">
                              <View className="flex-row items-center">
                                <Ionicons name="navigate-outline" color="#71717a" size={14} />
                                <Text className="text-zinc-500 text-xs ms-1">
                                  {trip.distance != null ? formatDistance(trip.distance) : 'N/A'}
                                </Text>
                              </View>
                              <View className="flex-row items-center">
                                <Ionicons name="time-outline" color="#71717a" size={14} />
                                <Text className="text-zinc-500 text-xs ms-1">
                                  {trip.duration != null ? formatDuration(trip.duration) : 'N/A'}
                                </Text>
                              </View>
                            </View>
                            <View className="flex-row items-center">
                              <Ionicons name="cash" color="#10b981" size={14} />
                              <Text className="text-emerald-400 text-xs font-bold ms-1">Cash</Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Trip Detail Modal */}
      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-zinc-950 rounded-t-[32px] max-h-[85%] border-t border-zinc-800">
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {selectedTrip && (
                <View className="p-6 pb-10">
                  <View className="w-12 h-1.5 bg-zinc-800 rounded-full self-center mb-6" />

                  <View className="flex-row justify-between items-start mb-6">
                    <View>
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Trip Details</Text>
                      <Text className="text-white text-xl font-black">Completed Trip</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowDetail(false)} className="p-2">
                      <Ionicons name="close" color="#a1a1aa" size={24} />
                    </TouchableOpacity>
                  </View>

                  <View className="bg-zinc-900 rounded-2xl border border-zinc-800/50 p-5 mb-5">
                    <View className="flex-row justify-between items-center mb-4">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Date</Text>
                      <Text className="text-white text-sm font-medium">
                        {formatFullDate(selectedTrip.completedAt || selectedTrip.requestedAt)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center mb-4">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Fare</Text>
                      <Text className="text-white text-lg font-black">
                        {formatFare(selectedTrip.actualFare ?? selectedTrip.estimatedFare)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center mb-4">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Distance</Text>
                      <Text className="text-white text-sm font-medium">
                        {selectedTrip.distance != null ? `${selectedTrip.distance} km` : 'N/A'}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center mb-4">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Duration</Text>
                      <Text className="text-white text-sm font-medium">
                        {selectedTrip.duration != null ? `${selectedTrip.duration} min` : 'N/A'}
                      </Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Payment</Text>
                      <View className="flex-row items-center">
                        <Ionicons name="cash" color="#10b981" size={14} />
                        <Text className="text-emerald-400 text-sm font-bold ms-1">Cash</Text>
                      </View>
                    </View>
                  </View>

                  <View className="bg-zinc-900 rounded-2xl border border-zinc-800/50 p-5 mb-5">
                    <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-4">Route</Text>
                    <View className="flex-row gap-3">
                      <View className="items-center py-0.5">
                        <View className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-zinc-950" />
                        <View className="w-[1.5px] h-12 bg-zinc-800 my-1" />
                        <View className="w-3 h-3 rounded-full bg-blue-500" />
                      </View>
                      <View className="flex-1 gap-4">
                        <View>
                          <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-[2px] mb-1">Pickup</Text>
                          <Text className="text-white/90 text-sm font-medium">{selectedTrip.pickupAddress}</Text>
                        </View>
                        <View>
                          <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-[2px] mb-1">Drop-off</Text>
                          <Text className="text-white/90 text-sm font-medium">{selectedTrip.dropoffAddress}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View className="bg-zinc-900 rounded-2xl border border-zinc-800/50 p-5 mb-6">
                    <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-4">Rider</Text>
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center me-3 border border-zinc-700">
                        <Ionicons name="person" color="#71717a" size={20} />
                      </View>
                      <View>
                        <Text className="text-white font-bold text-sm">Rider #{selectedTrip.riderId.slice(0, 8)}</Text>
                        {selectedTrip.driverRating != null && (
                          <View className="flex-row items-center mt-0.5">
                            <Ionicons name="star" color="#fbbf24" size={12} />
                            <Text className="text-zinc-500 text-xs ms-1">{selectedTrip.driverRating}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    className="bg-red-500/10 rounded-2xl p-4 flex-row items-center border border-red-500/20 mb-4"
                    activeOpacity={0.7}
                    onPress={handleReportPress}
                  >
                    <View className="bg-red-500/20 p-2.5 rounded-xl me-3">
                      <Ionicons name="flag-outline" color="#ef4444" size={20} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-red-400 font-bold text-sm">Report an Issue</Text>
                      <Text className="text-red-400/60 text-xs mt-0.5">Lost item, rider behavior, payment issue, etc.</Text>
                    </View>
                    <Ionicons name="chevron-forward" color="#ef4444" size={20} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="bg-zinc-900 border border-zinc-800 py-4 rounded-2xl items-center"
                    onPress={() => setShowDetail(false)}
                  >
                    <Text className="text-zinc-400 font-medium">Close</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-1 justify-end bg-black/60">
            <View className="bg-zinc-950 rounded-t-[32px] max-h-[90%] border-t border-zinc-800">
              <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
                <View className="p-6 pb-10">
                  <View className="w-12 h-1.5 bg-zinc-800 rounded-full self-center mb-6" />

                  <View className="flex-row justify-between items-start mb-6">
                    <View>
                      <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Trip Report</Text>
                      <Text className="text-white text-xl font-black">Report an Issue</Text>
                      {selectedTrip && (
                        <Text className="text-zinc-600 text-xs mt-1">
                          Trip from {selectedTrip.pickupAddress.slice(0, 30)}...
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => setShowReport(false)} className="p-2">
                      <Ionicons name="close" color="#a1a1aa" size={24} />
                    </TouchableOpacity>
                  </View>

                  {!reportType ? (
                    <>
                      <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-4">
                        What happened?
                      </Text>
                      <View className="gap-2">
                        {reportTypes.map((type) => (
                          <TouchableOpacity
                            key={type.key}
                            className="bg-zinc-900 rounded-2xl border border-zinc-800/50 p-4 flex-row items-center"
                            activeOpacity={0.7}
                            onPress={() => setReportType(type.key)}
                          >
                            <View className="bg-zinc-800/50 p-2.5 rounded-xl me-3">
                              <Ionicons name={type.icon as any} color="#a1a1aa" size={20} />
                            </View>
                            <View className="flex-1">
                              <Text className="text-white/90 font-medium text-sm">{type.label}</Text>
                              <Text className="text-zinc-500 text-xs mt-0.5">{type.description}</Text>
                            </View>
                            <Ionicons name="chevron-forward" color="#3f3f46" size={18} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        className="flex-row items-center mb-5"
                        onPress={() => { setReportType(null); setReportDescription(''); }}
                      >
                        <Ionicons name="arrow-back" color="#a1a1aa" size={20} />
                        <Text className="text-zinc-400 font-medium ms-2">Back to categories</Text>
                      </TouchableOpacity>

                      <View className="bg-zinc-900 rounded-2xl border border-zinc-800/50 p-4 mb-5 flex-row items-center">
                        <View className="bg-zinc-800/50 p-2 rounded-xl me-3">
                          <Ionicons name={reportTypes.find((r) => r.key === reportType)?.icon as any} color="#a1a1aa" size={20} />
                        </View>
                        <Text className="text-white font-bold">
                          {reportTypes.find((r) => r.key === reportType)?.label}
                        </Text>
                      </View>

                      {reportType === 'LOST_ITEM' && (
                        <View className="bg-amber-500/10 rounded-2xl border border-amber-500/20 p-4 mb-5">
                          <View className="flex-row items-start">
                            <Ionicons name="information-circle" color="#f59e0b" size={20} />
                            <Text className="text-amber-400/80 text-xs flex-1 ms-2 leading-4">
                              Please describe the item you found and where in the vehicle it was located. Our support team will contact the rider.
                            </Text>
                          </View>
                        </View>
                      )}

                      <Text className="text-zinc-400 text-xs font-bold uppercase tracking-[2px] mb-3">
                        Description
                      </Text>
                      <TextInput
                        className="bg-zinc-900 rounded-2xl border border-zinc-800/50 p-4 text-white text-sm min-h-[120px] text-top"
                        multiline
                        textAlignVertical="top"
                        placeholder={reportType === 'LOST_ITEM' 
                          ? "e.g. Found a black iPhone 15 on the back seat after the trip..."
                          : "Please describe what happened..."}
                        placeholderTextColor="#52525b"
                        value={reportDescription}
                        onChangeText={setReportDescription}
                        autoFocus
                      />

                      <TouchableOpacity
                        className={`mt-5 py-4 rounded-2xl items-center ${reportDescription.trim() ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                        disabled={!reportDescription.trim() || isSubmitting}
                        onPress={handleSubmitReport}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <Text className={`font-bold text-lg ${reportDescription.trim() ? 'text-white' : 'text-zinc-500'}`}>
                            Submit Report
                          </Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
