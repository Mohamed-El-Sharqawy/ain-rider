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
import { useCreateVehicleMake } from '../services/mutations';
import { Loader2, Plus } from 'lucide-react';

export function CreateVehicleMakeModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const { mutate: createMake, isPending } = useCreateVehicleMake();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMake({ name, isActive: true }, {
      onSuccess: () => {
        setOpen(false);
        setName('');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} />
          إضافة ماركة
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة ماركة جديدة</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          <div className="space-y-2">
            <Label htmlFor="make-name">اسم الماركة</Label>
            <Input
              id="make-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: Toyota"
              required
              className="text-right"
            />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Loader2 size={14} className="animate-spin ml-2" />}
            إضافة
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
