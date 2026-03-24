import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreatePromo } from '../services/mutations';
import { Loader2, Plus } from 'lucide-react';

export function CreatePromoModal() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [totalUsageLimit, setTotalUsageLimit] = useState('');
  const [description, setDescription] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const { mutate: createPromo, isPending } = useCreatePromo();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPromo(
      {
        code,
        type,
        value: parseFloat(value),
        totalUsageLimit: parseInt(totalUsageLimit, 10),
        description,
        validFrom: validFrom ? new Date(validFrom).toISOString() : undefined,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setCode('');
          setType('');
          setValue('');
          setTotalUsageLimit('');
          setDescription('');
          setValidFrom('');
          setValidUntil('');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} />
          إضافة عرض ترويجي
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة عرض ترويجي جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code">الكود</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER2026"
              required
            />
          </div>
          <div>
            <Label htmlFor="type">نوع الخصم</Label>
            <Select value={type} onValueChange={setType} required>
              <SelectTrigger id="type">
                <SelectValue placeholder="اختر نوع الخصم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENTAGE">نسبة مئوية</SelectItem>
                <SelectItem value="FIXED">مبلغ ثابت</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="value">
              {type === 'PERCENTAGE' ? 'النسبة المئوية (%)' : 'المبلغ (IQD)'}
            </Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
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
          <div>
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف العرض الترويجي"
              rows={2}
              required
            />
          </div>
          <div>
            <Label htmlFor="validFrom">صالح من (اختياري)</Label>
            <Input
              id="validFrom"
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="validUntil">صالح حتى (اختياري)</Label>
            <Input
              id="validUntil"
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            إضافة
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
