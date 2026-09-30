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
import { Loader2, Plus, AlertCircle } from 'lucide-react';
import {
  validatePromoCode,
  validateDiscountValue,
  validateUsageLimit,
  validateDateRange,
} from '@/lib/validation';

export function CreatePromoModal() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED' | ''>('');
  const [value, setValue] = useState('');
  const [totalUsageLimit, setTotalUsageLimit] = useState('');
  const [description, setDescription] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { mutate: createPromo, isPending } = useCreatePromo();

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const codeError = validatePromoCode(code);
    if (codeError) errors.code = codeError;

    if (!type) {
      errors.type = 'نوع الخصم مطلوب';
    }

    const valueError = validateDiscountValue(parseFloat(value) || 0, type as 'PERCENTAGE' | 'FIXED');
    if (valueError) errors.value = valueError;

    const limitError = validateUsageLimit(parseInt(totalUsageLimit, 10) || 0);
    if (limitError) errors.totalUsageLimit = limitError;

    if (!description || description.trim().length === 0) {
      errors.description = 'الوصف مطلوب';
    } else if (description.trim().length < 5) {
      errors.description = 'الوصف يجب أن يكون 5 أحرف على الأقل';
    }

    const dateError = validateDateRange(validFrom || undefined, validUntil || undefined);
    if (dateError) errors.dateRange = dateError;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

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
          setValidationErrors({});
        },
      },
    );
  };

  const clearFieldError = (field: string) => {
    if (validationErrors[field]) {
      const newErrors = { ...validationErrors };
      delete newErrors[field];
      setValidationErrors(newErrors);
    }
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
          {validationErrors.dateRange && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-600">
              <AlertCircle size={16} />
              <span className="text-sm">{validationErrors.dateRange}</span>
            </div>
          )}

          <div>
            <Label htmlFor="code">الكود</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                clearFieldError('code');
              }}
              placeholder="SUMMER2026"
              className={validationErrors.code ? 'border-red-500' : ''}
            />
            {validationErrors.code && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.code}</p>
            )}
          </div>

          <div>
            <Label htmlFor="type">نوع الخصم</Label>
            <Select 
              value={type} 
              onValueChange={(v) => {
                setType(v as 'PERCENTAGE' | 'FIXED');
                clearFieldError('type');
              }}
            >
              <SelectTrigger id="type" className={validationErrors.type ? 'border-red-500' : ''}>
                <SelectValue placeholder="اختر نوع الخصم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENTAGE">نسبة مئوية</SelectItem>
                <SelectItem value="FIXED">مبلغ ثابت</SelectItem>
              </SelectContent>
            </Select>
            {validationErrors.type && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.type}</p>
            )}
          </div>

          <div>
            <Label htmlFor="value">
              {type === 'PERCENTAGE' ? 'النسبة المئوية (%)' : 'المبلغ (EGP)'}
            </Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                clearFieldError('value');
              }}
              className={validationErrors.value ? 'border-red-500' : ''}
            />
            {validationErrors.value && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.value}</p>
            )}
          </div>

          <div>
            <Label htmlFor="totalUsageLimit">الحد الأقصى للاستخدامات</Label>
            <Input
              id="totalUsageLimit"
              type="number"
              value={totalUsageLimit}
              onChange={(e) => {
                setTotalUsageLimit(e.target.value);
                clearFieldError('totalUsageLimit');
              }}
              className={validationErrors.totalUsageLimit ? 'border-red-500' : ''}
            />
            {validationErrors.totalUsageLimit && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.totalUsageLimit}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">الوصف</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearFieldError('description');
              }}
              placeholder="وصف العرض الترويجي"
              rows={2}
              className={validationErrors.description ? 'border-red-500' : ''}
            />
            {validationErrors.description && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.description}</p>
            )}
          </div>

          <div>
            <Label htmlFor="validFrom">صالح من (اختياري)</Label>
            <Input
              id="validFrom"
              type="datetime-local"
              value={validFrom}
              onChange={(e) => {
                setValidFrom(e.target.value);
                clearFieldError('dateRange');
              }}
            />
          </div>

          <div>
            <Label htmlFor="validUntil">صالح حتى (اختياري)</Label>
            <Input
              id="validUntil"
              type="datetime-local"
              value={validUntil}
              onChange={(e) => {
                setValidUntil(e.target.value);
                clearFieldError('dateRange');
              }}
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
