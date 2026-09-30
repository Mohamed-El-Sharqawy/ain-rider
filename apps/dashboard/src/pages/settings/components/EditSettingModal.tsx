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
import { Textarea } from '@/components/ui/textarea';
import { useUpsertSetting } from '../services/mutations';
import { Loader2 } from 'lucide-react';
import type { Setting } from '../services/transformers';

interface EditSettingModalProps {
  setting: Setting | null;
  open: boolean;
  onClose: () => void;
}

export function EditSettingModal({ setting, open, onClose }: EditSettingModalProps) {
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');

  const { mutate: upsertSetting, isPending } = useUpsertSetting();

  useEffect(() => {
    if (setting) {
      setValue(typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value));
      setDescription(setting.description ?? '');
    }
  }, [setting]);

  if (!setting) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let parsedValue: unknown = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value;
    }

    upsertSetting(
      {
        key: setting.key,
        data: {
          value: parsedValue,
          type: setting.type,
          category: setting.category,
          description: description || undefined,
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
          <DialogTitle>تعديل الإعداد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>المفتاح</Label>
            <Input value={setting.key} disabled />
          </div>
          <div>
            <Label>الفئة</Label>
            <Input value={setting.category} disabled />
          </div>
          <div>
            <Label htmlFor="value">القيمة</Label>
            <Textarea
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={4}
              required
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
              يمكنك إدخال قيمة JSON أو نص عادي
            </p>
          </div>
          <div>
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
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
