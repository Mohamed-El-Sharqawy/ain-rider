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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateVehicleModel } from '../services/mutations';
import { useGetVehicleMakes, useGetVehicleTypes } from '../services/queries';
import { Loader2, Plus } from 'lucide-react';

export function CreateVehicleModelModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [makeId, setMakeId] = useState('');
  const [vehicleTypeId, setVehicleTypeId] = useState<string | undefined>('none');

  const { data: makes } = useGetVehicleMakes(true);
  const { data: types } = useGetVehicleTypes();
  const { mutate: createModel, isPending } = useCreateVehicleModel();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createModel({ 
      name, 
      makeId, 
      vehicleTypeId: vehicleTypeId === 'none' ? null : vehicleTypeId,
      isActive: true 
    }, {
      onSuccess: () => {
        setOpen(false);
        setName('');
        setMakeId('');
        setVehicleTypeId('none');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} />
          إضافة موديل
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة موديل جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          <div className="space-y-2">
            <Label htmlFor="model-make">الماركة</Label>
            <Select value={makeId} onValueChange={setMakeId} required>
              <SelectTrigger id="model-make">
                <SelectValue placeholder="اختر الماركة" />
              </SelectTrigger>
              <SelectContent>
                {makes?.map((make) => (
                  <SelectItem key={make.id} value={make.id}>{make.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-name">اسم الموديل</Label>
            <Input
              id="model-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: Corolla"
              required
              className="text-right"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-type">نوع المركبة التلقائي (اختياري)</Label>
            <Select value={vehicleTypeId} onValueChange={setVehicleTypeId}>
              <SelectTrigger id="model-type">
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="none">بدون تخصص</SelectItem>
                {types?.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending || !makeId} className="w-full">
            {isPending && <Loader2 size={14} className="animate-spin ml-2" />}
            إضافة
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
