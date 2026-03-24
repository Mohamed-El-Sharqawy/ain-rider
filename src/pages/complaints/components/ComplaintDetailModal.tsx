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
import { Loader2 } from 'lucide-react';
import type { Complaint } from '../services/transformers';

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

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateComplaintStatus();
  const { mutate: addComment, isPending: isCommenting } = useAddComplaintComment();

  if (!complaint) return null;

  const handleUpdateStatus = () => {
    if (!newStatus) return;
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
              {isCommenting && <Loader2 size={14} className="animate-spin" />}
              إضافة تعليق
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">تحديث الحالة</h3>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="اختر حالة جديدة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">قيد الانتظار</SelectItem>
                <SelectItem value="IN_PROGRESS">قيد المعالجة</SelectItem>
                <SelectItem value="RESOLVED">محلول</SelectItem>
              </SelectContent>
            </Select>

            {newStatus === 'RESOLVED' && (
              <Textarea
                placeholder="ملاحظات الحل..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
              />
            )}

            <Button onClick={handleUpdateStatus} disabled={!newStatus || isUpdating}>
              {isUpdating && <Loader2 size={14} className="animate-spin" />}
              تحديث الحالة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
