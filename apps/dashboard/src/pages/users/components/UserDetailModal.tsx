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
import { useUpdateUserStatus, useApproveDriver, useRejectDocument, useApproveDocument, useResetUploadAttempts } from '../services/mutations';
import { useGetOnboardingStatus } from '../services/queries';
import { formatDate } from '@/lib/utils';
import { Loader2, Star, Car, Phone, Mail, Calendar, Shield, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
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
  const [rejectStage, setRejectStage] = useState<'identity' | 'license' | 'vehicle' | null>(null);

  const { mutate: updateStatus, isPending } = useUpdateUserStatus();
  const { data: onboarding } = useGetOnboardingStatus(
    user?.role === 'DRIVER' ? (user?.id ?? '') : ''
  );
  const { mutate: approveDriver, isPending: isApproving } = useApproveDriver();
  const { mutate: rejectDocument, isPending: isRejecting } = useRejectDocument();
  const { mutate: approveDocument, isPending: isApprovingDoc } = useApproveDocument();
  const { mutate: resetAttempts, isPending: isResetting } = useResetUploadAttempts();

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

  const handleApproveDriver = () => {
    approveDriver(user.id);
  };

  const handleRejectDocument = () => {
    if (!rejectStage || !reason) return;
    rejectDocument(
      { id: user.id, stage: rejectStage, reason },
      {
        onSuccess: () => {
          setRejectStage(null);
          setReason('');
        },
      }
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

          {user.role === 'DRIVER' && onboarding && (
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">مراجعة الوثائق</h4>
                <div className="flex gap-2">
                  {onboarding.onboardingStatus === 'UNDER_REVIEW' && (
                    <Button
                      size="sm"
                      onClick={handleApproveDriver}
                      disabled={isApproving}
                    >
                      {isApproving && <Loader2 size={14} className="ml-2 animate-spin" />}
                      قبول السائق نهائياً
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resetAttempts(user.id)}
                    disabled={isResetting}
                  >
                    {isResetting && <Loader2 size={14} className="ml-2 animate-spin" />}
                    إعادة تعيين محاولات الرفع
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'identity', label: 'الهوية الشخصية', data: onboarding.documents.identity },
                  { id: 'license', label: 'رخصة القيادة', data: onboarding.documents.drivingLicense },
                  { id: 'vehicle', label: 'وثائق السيارة', data: onboarding.documents.vehicle },
                ].map((stage) => (
                  <div key={stage.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{stage.label}</span>
                        {stage.data.status === 'APPROVED' ? (
                          <CheckCircle2 size={14} className="text-green-500" />
                        ) : stage.data.status === 'REJECTED' ? (
                          <XCircle size={14} className="text-red-500" />
                        ) : (
                          <Clock size={14} className="text-yellow-500" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        {stage.data.status !== 'APPROVED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-green-500 hover:text-green-600 hover:bg-green-50"
                            onClick={() => approveDocument({ id: user.id, stage: stage.id })}
                            disabled={isApprovingDoc}
                          >
                             قبول
                          </Button>
                        )}
                        {stage.data.status !== 'REJECTED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setRejectStage(stage.id as any)}
                          >
                            رفض
                          </Button>
                        )}
                      </div>
                    </div>

                    {stage.data.rejectionReason && stage.data.status === 'REJECTED' && (
                      <p className="text-xs text-red-500 mb-2">سبب الرفض: {stage.data.rejectionReason}</p>
                    )}

                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {stage.id === 'vehicle' ? (
                        <>
                          {stage.data.carImage?.url && (
                            <a href={stage.data.carImage.url} target="_blank" rel="noreferrer" className="relative group">
                              <img src={stage.data.carImage.url} className="w-16 h-12 object-cover rounded border" alt="Car" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                                <ExternalLink size={12} className="text-white" />
                              </div>
                            </a>
                          )}
                          {stage.data.carLicenseImage?.url && (
                            <a href={stage.data.carLicenseImage.url} target="_blank" rel="noreferrer" className="relative group">
                              <img src={stage.data.carLicenseImage.url} className="w-16 h-12 object-cover rounded border" alt="License" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                                <ExternalLink size={12} className="text-white" />
                              </div>
                            </a>
                          )}
                        </>
                      ) : (
                        stage.data.images?.map((img: any, idx: number) => (
                          <a key={idx} href={img.url} target="_blank" rel="noreferrer" className="relative group">
                            <img src={img.url} className="w-16 h-12 object-cover rounded border" alt={`${stage.label} ${idx + 1}`} />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                              <ExternalLink size={12} className="text-white" />
                            </div>
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {rejectStage && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg space-y-3">
                  <div className="flex items-center justify-between font-medium text-sm text-red-900">
                    <span>رفض {rejectStage === 'identity' ? 'الهوية' : rejectStage === 'license' ? 'الرخصة' : 'السيارة'}</span>
                  </div>
                  <Textarea
                    placeholder="أدخل سبب الرفض بالتفصيل ليتمكن السائق من التعديل..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="bg-white border-red-200 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={handleRejectDocument}
                      disabled={!reason || isRejecting}
                    >
                      {isRejecting && <Loader2 size={12} className="ml-2 animate-spin" />}
                      تأكيد الرفض
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRejectStage(null);
                        setReason('');
                      }}
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              )}
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
                      <SelectItem value="UNDER_REVIEW">قيد المراجعة</SelectItem>
                      <SelectItem value="PENDING_DOCUMENTS">انتظار الوثائق</SelectItem>
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
