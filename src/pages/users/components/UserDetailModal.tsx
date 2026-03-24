import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useUpdateUserStatus } from '../services/mutations';
import { formatDate } from '@/lib/utils';
import { Loader2, Star, Car, Phone, Mail, Calendar, Shield } from 'lucide-react';
import type { User } from '../services/transformers';

interface UserDetailModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

export function UserDetailModal({ user, open, onClose }: UserDetailModalProps) {
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');
  const [showStatusForm, setShowStatusForm] = useState(false);

  const { mutate: updateStatus, isPending } = useUpdateUserStatus();

  if (!user) return null;

  const handleUpdateStatus = () => {
    if (!newStatus) return;
    updateStatus(
      {
        id: user.id,
        data: {
          status: newStatus as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BANNED',
          reason: reason || undefined,
        },
      },
      {
        onSuccess: () => {
          setShowStatusForm(false);
          setNewStatus('');
          setReason('');
        },
      },
    );
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'RIDER': return 'راكب';
      case 'DRIVER': return 'سائق';
      case 'ADMIN': return 'مدير';
      case 'SUPPORT': return 'دعم فني';
      default: return role;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>تفاصيل المستخدم</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.fullName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {user.firstName.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold">{user.fullName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={user.status} />
                <span className="text-sm text-muted-foreground">
                  {getRoleLabel(user.role)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-muted-foreground" />
              <span className="text-sm">{user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-muted-foreground" />
              <span className="text-sm" dir="ltr">{user.phoneNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-muted-foreground" />
              <span className="text-sm">{formatDate(user.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-muted-foreground" />
              <span className="text-sm">{getRoleLabel(user.role)}</span>
            </div>
          </div>

          {(user.role === 'DRIVER' || user.role === 'RIDER') && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">إحصائيات</h4>
              <div className="grid grid-cols-3 gap-4">
                {user.rating !== undefined && (
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Star size={16} className="text-yellow-500 fill-yellow-500" />
                      <span className="font-bold">{user.rating.toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">التقييم</p>
                  </div>
                )}
                {user.totalTrips !== undefined && (
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Car size={16} className="text-primary" />
                      <span className="font-bold">{user.totalTrips}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">الرحلات</p>
                  </div>
                )}
                {user.role === 'DRIVER' && user.isOnline !== undefined && (
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${user.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <p className="text-xs text-muted-foreground">
                      {user.isOnline ? 'متصل' : 'غير متصل'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            {!showStatusForm ? (
              <Button onClick={() => setShowStatusForm(true)} variant="outline" className="w-full">
                تغيير الحالة
              </Button>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>الحالة الجديدة</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">نشط</SelectItem>
                      <SelectItem value="INACTIVE">غير نشط</SelectItem>
                      <SelectItem value="SUSPENDED">موقوف</SelectItem>
                      <SelectItem value="BANNED">محظور</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>السبب (اختياري)</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="أدخل سبب تغيير الحالة..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpdateStatus}
                    disabled={!newStatus || isPending}
                    className="flex-1"
                  >
                    {isPending && <Loader2 size={14} className="animate-spin" />}
                    حفظ
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowStatusForm(false);
                      setNewStatus('');
                      setReason('');
                    }}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
