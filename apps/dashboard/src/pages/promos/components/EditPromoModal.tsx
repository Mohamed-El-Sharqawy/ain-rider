import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdatePromo } from '../services/mutations';
import { Loader2 } from 'lucide-react';
import type { Promo } from '../services/transformers';

interface EditPromoModalProps {
  promo: Promo | null;
  open: boolean;
  onClose: () => void;
}

export function EditPromoModal({ promo, open, onClose }: EditPromoModalProps) {
  const [status, setStatus] = useState('');
  const [totalUsageLimit, setTotalUsageLimit] = useState('');

  const { mutate: updatePromo, isPending } = useUpdatePromo();

  useEffect(() => {
    if (promo) {
      setStatus(promo.status);
      setTotalUsageLimit(promo.totalUsageLimit.toString());
    }
  }, [promo]);

  if (!promo) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePromo(
      {
        id: promo.id,
        data: {
          status,
          totalUsageLimit: parseInt(totalUsageLimit, 10),
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل العرض الترويجي</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>الكود</Label>
            <Input value={promo.code} disabled />
          </div>
          <div>
            <Label htmlFor="status">الحالة</Label>
            <Select value={status} onValueChange={setStatus} required>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">نشط</SelectItem>
                <SelectItem value="INACTIVE">غير نشط</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="totalUsageLimit">الحد الأقصى للاستخدامات</Label>
            <Input
              id="totalUsageLimit"
              type="number"
              value={totalUsageLimit}
              onChange={(e) => setTotalUsageLimit(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              حفظ
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
