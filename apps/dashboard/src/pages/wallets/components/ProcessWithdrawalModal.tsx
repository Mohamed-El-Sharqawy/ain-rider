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
import { Label } from '@/components/ui/label';
import { useProcessWithdrawal } from '../services/mutations';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { Withdrawal } from '../services/transformers';

interface ProcessWithdrawalModalProps {
  withdrawal: Withdrawal | null;
  open: boolean;
  onClose: () => void;
}

export function ProcessWithdrawalModal({ withdrawal, open, onClose }: ProcessWithdrawalModalProps) {
  const [approve, setApprove] = useState<boolean | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { mutate: processWithdrawal, isPending } = useProcessWithdrawal();

  if (!withdrawal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // submit is disabled until a decision is picked
    processWithdrawal(
      {
        id: withdrawal.id,
        data: {
          approve: approve!,
          rejectionReason: !approve && rejectionReason ? rejectionReason : undefined,
        },
      },
      {
        onSuccess: () => {
          onClose();
          setApprove(null);
          setRejectionReason('');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>معالجة طلب السحب</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                المبلغ
              </p>
              <p className="text-lg font-bold">{formatCurrency(withdrawal.amount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                الحالة الحالية
              </p>
              <p className="text-sm">{withdrawal.status}</p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                تاريخ الطلب
              </p>
              <p className="text-sm">{formatDate(withdrawal.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
                معرف المستخدم
              </p>
              <p className="text-xs font-mono">{withdrawal.userId.slice(0, 8)}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="decision">القرار</Label>
            <Select value={approve === null ? '' : approve.toString()} onValueChange={(v) => setApprove(v === 'true')} required>
              <SelectTrigger id="decision">
                <SelectValue placeholder="اختر القرار" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">قبول</SelectItem>
                <SelectItem value="false">رفض</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {approve === false && (
            <div>
              <Label htmlFor="reason">سبب الرفض</Label>
              <Textarea
                id="reason"
                placeholder="أدخل سبب الرفض..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={approve === null || isPending || (approve === false && !rejectionReason.trim())}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              معالجة
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
