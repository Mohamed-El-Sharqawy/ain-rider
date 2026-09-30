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
import { useCreateVehicleType } from '../services/mutations';
import { Loader2, Plus } from 'lucide-react';

export function CreateVehicleTypeModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [baseFare, setBaseFare] = useState('');
  const [perKmRate, setPerKmRate] = useState('');
  const [perMinuteRate, setPerMinuteRate] = useState('');
  const [minFare, setMinFare] = useState('');
  const [maxPassengers, setMaxPassengers] = useState('');

  const { mutate: createType, isPending } = useCreateVehicleType();

  const resetForm = () => {
    setName('');
    setType('');
    setBaseFare('');
    setPerKmRate('');
    setPerMinuteRate('');
    setMinFare('');
    setMaxPassengers('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createType(
      {
        name,
        type,
        baseFare: parseFloat(baseFare),
        perKmRate: parseFloat(perKmRate),
        perMinuteRate: parseFloat(perMinuteRate),
        minFare: parseFloat(minFare),
        maxPassengers: parseInt(maxPassengers, 10),
        isActive: true,
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} />
          إضافة نوع مركبة
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة نوع مركبة جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">الاسم</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: سيدان اقتصادي"
                required
              />
            </div>
            <div>
              <Label htmlFor="type">النوع</Label>
              <Select value={type} onValueChange={setType} required>
                <SelectTrigger id="type">
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ECONOMY">اقتصادي</SelectItem>
                  <SelectItem value="COMFORT">مريح</SelectItem>
                  <SelectItem value="PREMIUM">مميز</SelectItem>
                  <SelectItem value="SUV">دفع رباعي</SelectItem>
                  <SelectItem value="VAN">فان</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="baseFare">الأجرة الأساسية (EGP)</Label>
              <Input
                id="baseFare"
                type="number"
                step="100"
                min="0"
                value={baseFare}
                onChange={(e) => setBaseFare(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="minFare">الحد الأدنى للأجرة (EGP)</Label>
              <Input
                id="minFare"
                type="number"
                step="100"
                min="0"
                value={minFare}
                onChange={(e) => setMinFare(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="perKmRate">السعر لكل كم (EGP)</Label>
              <Input
                id="perKmRate"
                type="number"
                step="10"
                min="0"
                value={perKmRate}
                onChange={(e) => setPerKmRate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="perMinuteRate">السعر لكل دقيقة (EGP)</Label>
              <Input
                id="perMinuteRate"
                type="number"
                step="10"
                min="0"
                value={perMinuteRate}
                onChange={(e) => setPerMinuteRate(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="maxPassengers">أقصى عدد ركاب</Label>
            <Input
              id="maxPassengers"
              type="number"
              min="1"
              max="20"
              value={maxPassengers}
              onChange={(e) => setMaxPassengers(e.target.value)}
              required
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
