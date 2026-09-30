import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateUser } from '../services/mutations'
import type { CreateUserDTO } from '../services/dto'

interface CreateUserModalProps {
  open: boolean
  onClose: () => void
}

export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const { mutate: createUser, isPending } = useCreateUser()
  const [formData, setFormData] = useState<CreateUserDTO>({
    email: '',
    phoneNumber: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'RIDER',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createUser(formData, {
      onSuccess: () => {
        onClose()
        setFormData({
          email: '',
          phoneNumber: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'RIDER',
        })
      },
    })
  }

  const handleClose = () => {
    if (!isPending) {
      onClose()
      setFormData({
        email: '',
        phoneNumber: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'RIDER',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>إضافة مستخدم جديد</DialogTitle>
          <DialogDescription>
            قم بإنشاء حساب مستخدم جديد (مشرف، دعم فني، راكب، أو سائق)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">الاسم الأول</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">الاسم الأخير</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">رقم الهاتف</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="+964XXXXXXXXXX"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">يجب أن تكون 6 أحرف على الأقل</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">الدور</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value as CreateUserDTO['role'] })}
              disabled={isPending}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">مشرف (Admin)</SelectItem>
                <SelectItem value="SUPPORT">دعم فني (Support)</SelectItem>
                <SelectItem value="RIDER">راكب (Rider)</SelectItem>
                <SelectItem value="DRIVER">سائق (Driver)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
