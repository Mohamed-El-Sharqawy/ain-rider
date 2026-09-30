import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useUpdateComplaintStatus, useAddComplaintComment } from '../services/mutations';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/utils';
import { validateStatusTransition, validateComplaintResolution } from '@/lib/validation';
import type { Complaint } from '../services/transformers';

function omitKey(obj: Record<string, string>, key: string): Record<string, string> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

interface ComplaintDetailModalProps {
  complaint: Complaint | null;
  open: boolean;
  onClose: () => void;
}

export function ComplaintDetailModal({ complaint, open, onClose }: ComplaintDetailModalProps) {
  const { user } = useAuthStore();
  const [newStatus, setNewStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [comment, setComment] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateComplaintStatus();
  const { mutate: addComment, isPending: isCommenting } = useAddComplaintComment();

  if (!complaint) return null;

  const handleUpdateStatus = () => {
    if (!newStatus) return;

    const errors: Record<string, string> = {};

    const transitionError = validateStatusTransition(complaint.status, newStatus);
    if (transitionError) errors.status = transitionError;

    const resolutionError = validateComplaintResolution(newStatus, resolution);
    if (resolutionError) errors.resolution = resolutionError;

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    updateStatus(
      {
        id: complaint.id,
        data: {
          status: newStatus,
          assignedTo: user?.id,
          resolution: newStatus === 'RESOLVED' ? resolution : undefined,
        },
      },
      {
        onSuccess: () => {
          setNewStatus('');
          setResolution('');
        },
      },
    );
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    setValidationErrors({});
    addComment(
      {
        id: complaint.id,
        data: {
          comment: comment.trim(),
          isInternal: false,
        },
      },
      {
        onSuccess: () => {
          setComment('');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تفاصيل الشكوى</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                المعرف
              </p>
              <p className="font-mono text-sm">{complaint.id}</p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                الحالة
              </p>
              <StatusBadge status={complaint.status} />
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                الأولوية
              </p>
              <StatusBadge status={complaint.priority} />
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                التاريخ
              </p>
              <p className="text-sm">{formatDate(complaint.createdAt)}</p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
              الموضوع
            </p>
            <p className="text-sm font-semibold">{complaint.subject}</p>
          </div>

          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
              الوصف
            </p>
            <p className="text-sm">{complaint.description}</p>
          </div>

          {complaint.resolution && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                الحل
              </p>
              <p className="text-sm">{complaint.resolution}</p>
            </div>
          )}

          <Separator />

          <div>
            <h3 className="text-sm font-semibold mb-3">التعليقات ({complaint.comments.length})</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {complaint.comments.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: 'var(--color-muted)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium">{c.userRole}</p>
                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                      {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm">{c.comment}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="أضف تعليقاً..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <Button onClick={handleAddComment} disabled={!comment.trim() || isCommenting} size="sm">
              {isCommenting ? 'جاري الإرسال...' : 'إضافة تعليق'}
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">تحديث الحالة</h3>
            {validationErrors.status && (
              <p className="text-sm text-red-500">{validationErrors.status}</p>
            )}
            <Select value={newStatus} onValueChange={(v) => { setNewStatus(v); setValidationErrors((prev) => omitKey(prev, 'status')); }}>
              <SelectTrigger>
                <SelectValue placeholder="اختر حالة جديدة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN_PROGRESS" disabled={complaint.status === 'RESOLVED'}>قيد المعالجة</SelectItem>
                <SelectItem value="RESOLVED" disabled={complaint.status === 'RESOLVED'}>محلول</SelectItem>
              </SelectContent>
            </Select>

            {newStatus === 'RESOLVED' && (
              <div>
                <Textarea
                  placeholder="ملاحظات الحل..."
                  value={resolution}
                  onChange={(e) => { setResolution(e.target.value); setValidationErrors((prev) => omitKey(prev, 'resolution')); }}
                  rows={3}
                />
                {validationErrors.resolution && (
                  <p className="text-sm text-red-500 mt-1">{validationErrors.resolution}</p>
                )}
              </div>
            )}

            <Button onClick={handleUpdateStatus} disabled={!newStatus || isUpdating}>
              {isUpdating ? 'جاري التحديث...' : 'تحديث الحالة'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
