import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { SupportApi, ComplaintResponse, ComplaintComment } from '../../lib/api/support.api';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getStatusStyle(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'RESOLVED': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Resolved' };
    case 'UNDER_REVIEW': return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Under Review' };
    case 'REJECTED': return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' };
    case 'ESCALATED': return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Escalated' };
    default: return { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Pending' };
  }
}

function getTypeLabel(type: string): string {
  const map: Record<string, string> = {
    RIDER_BEHAVIOR: 'Rider Behavior',
    DRIVER_BEHAVIOR: 'Driver Behavior',
    VEHICLE_CONDITION: 'Vehicle Condition',
    ROUTE_ISSUE: 'Route Issue',
    PAYMENT_ISSUE: 'Payment Issue',
    SAFETY_CONCERN: 'Safety Concern',
    APP_ISSUE: 'App Issue',
    LOST_ITEM: 'Lost Item Found',
    OTHER: 'Other',
  };
  return map[type] || type;
}

export default function ComplaintsScreen() {
  const [complaints, setComplaints] = useState<ComplaintResponse[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const loadComplaints = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await SupportApi.getMyComplaints();
      setComplaints(data);
    } catch (err) {
      console.error('Failed to load complaints:', err);
      setError('Failed to load complaints');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadComplaints();
    }, [])
  );

  const handleOpenComplaint = async (complaint: ComplaintResponse) => {
    try {
      const detail = await SupportApi.getComplaint(complaint.id);
      setSelectedComplaint(detail);
    } catch (err) {
      console.error('Failed to load complaint detail:', err);
      Alert.alert('Error', 'Could not load complaint details.');
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedComplaint) return;
    setIsSending(true);
    try {
      const newComment = await SupportApi.addComment(selectedComplaint.id, replyText.trim());
      setSelectedComplaint({
        ...selectedComplaint,
        comments: [...(selectedComplaint.comments || []), newComment],
      });
      setReplyText('');
    } catch (err) {
      console.error('Failed to send reply:', err);
      Alert.alert('Error', 'Could not send your message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (selectedComplaint) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          {/* Header */}
          <View className="px-6 pt-4 pb-3 flex-row items-center border-b border-zinc-800/50">
            <TouchableOpacity onPress={() => setSelectedComplaint(null)} className="mr-3 p-1">
              <Ionicons name="arrow-back" color="#a1a1aa" size={24} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white font-bold text-lg" numberOfLines={1}>{selectedComplaint.subject}</Text>
              <Text className="text-zinc-500 text-xs">{getTypeLabel(selectedComplaint.type)}</Text>
            </View>
            <View className={`${getStatusStyle(selectedComplaint.status).bg} px-3 py-1.5 rounded-full`}>
              <Text className={`${getStatusStyle(selectedComplaint.status).text} text-xs font-bold`}>
                {getStatusStyle(selectedComplaint.status).label}
              </Text>
            </View>
          </View>

          {/* Messages */}
          <ScrollView className="flex-1 px-6 py-4" showsVerticalScrollIndicator={false}>
            {/* Original complaint */}
            <View className="bg-zinc-900 rounded-2xl border border-zinc-800/50 p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <View className="bg-emerald-500/20 w-8 h-8 rounded-full items-center justify-center mr-2">
                  <Ionicons name="person" color="#10b981" size={16} />
                </View>
                <Text className="text-emerald-400 text-xs font-bold">You</Text>
                <Text className="text-zinc-600 text-xs ml-2">{formatDate(selectedComplaint.createdAt)}</Text>
              </View>
              <Text className="text-white/90 text-sm leading-5">{selectedComplaint.description}</Text>
            </View>

            {/* Resolution note */}
            {selectedComplaint.resolution && (
              <View className="bg-emerald-500/10 rounded-2xl border border-emerald-500/20 p-4 mb-4">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="checkmark-circle" color="#10b981" size={16} />
                  <Text className="text-emerald-400 text-xs font-bold ml-1">Resolution</Text>
                </View>
                <Text className="text-white/80 text-sm leading-5">{selectedComplaint.resolution}</Text>
              </View>
            )}

            {/* Comments thread */}
            {(selectedComplaint.comments || []).map((comment: ComplaintComment) => {
              const isAdmin = comment.userRole === 'ADMIN' || comment.userRole === 'SUPPORT';
              return (
                <View
                  key={comment.id}
                  className={`${isAdmin ? 'bg-zinc-800/80 border-blue-500/20' : 'bg-zinc-900 border-zinc-800/50'} rounded-2xl border p-4 mb-3`}
                >
                  <View className="flex-row items-center mb-2">
                    <View className={`${isAdmin ? 'bg-blue-500/20' : 'bg-emerald-500/20'} w-8 h-8 rounded-full items-center justify-center mr-2`}>
                      <Ionicons name={isAdmin ? 'headset' : 'person'} color={isAdmin ? '#3b82f6' : '#10b981'} size={16} />
                    </View>
                    <Text className={`${isAdmin ? 'text-blue-400' : 'text-emerald-400'} text-xs font-bold`}>
                      {isAdmin ? 'Support Team' : 'You'}
                    </Text>
                    <Text className="text-zinc-600 text-xs ml-2">{formatDate(comment.createdAt)}</Text>
                  </View>
                  <Text className="text-white/90 text-sm leading-5">{comment.comment}</Text>
                </View>
              );
            })}

            {/* Response time note */}
            {selectedComplaint.status !== 'RESOLVED' && selectedComplaint.status !== 'REJECTED' && (
              <View className="bg-zinc-900/40 rounded-xl p-3 flex-row items-center mt-2 mb-4">
                <Ionicons name="time-outline" color="#71717a" size={14} />
                <Text className="text-zinc-500 text-xs ml-1.5">
                  Support typically replies within 1-24 hours
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Reply input */}
          {selectedComplaint.status !== 'RESOLVED' && selectedComplaint.status !== 'REJECTED' && (
            <View className="px-4 py-3 border-t border-zinc-800/50 flex-row items-end gap-2">
              <TextInput
                className="flex-1 bg-zinc-900 rounded-2xl border border-zinc-800/50 px-4 py-3 text-white text-sm max-h-24"
                multiline
                placeholder="Type a message..."
                placeholderTextColor="#52525b"
                value={replyText}
                onChangeText={setReplyText}
                editable={!isSending}
              />
              <TouchableOpacity
                className={`${replyText.trim() ? 'bg-emerald-500' : 'bg-zinc-800'} w-11 h-11 rounded-full items-center justify-center mb-0.5`}
                disabled={!replyText.trim() || isSending}
                onPress={handleSendReply}
              >
                {isSending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="send" color={replyText.trim() ? 'white' : '#52525b'} size={18} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (error && complaints.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
        <View className="flex-1 items-center justify-center px-10">
          <View className="bg-zinc-900/50 w-28 h-28 rounded-full items-center justify-center mb-6 border border-zinc-800/50">
            <Ionicons name="alert-circle" color="#3f3f46" size={56} />
          </View>
          <Text className="text-xl font-bold text-white mb-2 text-center">Something went wrong</Text>
          <Text className="text-zinc-500 text-center leading-6 mb-8">
            We couldn't load your complaints. Please try again.
          </Text>
          <TouchableOpacity onPress={loadComplaints} className="bg-emerald-600 px-8 py-4 rounded-2xl">
            <Text className="text-white font-bold text-lg">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={['top']}>
      <View className="px-6 pt-4 pb-3 flex-row items-center border-b border-zinc-800/50">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" color="#a1a1aa" size={24} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Support Tickets</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#10b981" size="large" />
          <Text className="text-zinc-500 mt-4">Loading tickets...</Text>
        </View>
      ) : complaints.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="bg-zinc-900/50 w-28 h-28 rounded-full items-center justify-center mb-6 border border-zinc-800/50">
            <Ionicons name="chatbubbles-outline" color="#3f3f46" size={56} />
          </View>
          <Text className="text-xl font-bold text-white mb-2 text-center">No tickets yet</Text>
          <Text className="text-zinc-500 text-center leading-6">
            Your support tickets will appear here. You can report issues from any completed trip.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <View className="gap-3">
            {complaints.map((complaint) => {
              const statusStyle = getStatusStyle(complaint.status);
              const adminReplies = (complaint.comments || []).filter(
                (c) => c.userRole === 'ADMIN' || c.userRole === 'SUPPORT'
              ).length;
              return (
                <TouchableOpacity
                  key={complaint.id}
                  className="bg-zinc-900 rounded-2xl border border-zinc-800/50 p-4"
                  activeOpacity={0.7}
                  onPress={() => handleOpenComplaint(complaint)}
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1 mr-3">
                      <Text className="text-white font-bold text-sm" numberOfLines={1}>{complaint.subject}</Text>
                      <Text className="text-zinc-500 text-xs mt-0.5">{getTypeLabel(complaint.type)}</Text>
                    </View>
                    <View className={`${statusStyle.bg} px-2.5 py-1 rounded-full`}>
                      <Text className={`${statusStyle.text} text-[10px] font-bold`}>{statusStyle.label}</Text>
                    </View>
                  </View>

                  <Text className="text-zinc-400 text-xs leading-4 mb-3" numberOfLines={2}>
                    {complaint.description}
                  </Text>

                  <View className="flex-row items-center justify-between border-t border-zinc-800/30 pt-3">
                    <Text className="text-zinc-600 text-xs">{formatDate(complaint.updatedAt)}</Text>
                    <View className="flex-row items-center gap-2">
                      {adminReplies > 0 && (
                        <View className="bg-blue-500/20 px-2 py-0.5 rounded-full flex-row items-center">
                          <Ionicons name="chatbubble" color="#3b82f6" size={10} />
                          <Text className="text-blue-400 text-[10px] font-bold ml-1">{adminReplies}</Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" color="#3f3f46" size={16} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
