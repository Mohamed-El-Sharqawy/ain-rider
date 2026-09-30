import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { useGetSettings } from '../services/queries'
import { useUpsertSetting } from '../services/mutations'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

interface CancellationReason {
  id: string
  reason: string
}

export function CancellationReasonTab() {
  const { data: settings, isLoading } = useGetSettings('cancellation')
  const { mutate: upsertSetting } = useUpsertSetting()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReason, setEditingReason] = useState<CancellationReason | null>(null)
  const [formData, setFormData] = useState({
    reason: '',
  })

  const reasons: CancellationReason[] = settings
    ? JSON.parse(settings.find((s) => s.key === 'cancellation.reasons')?.value || '[]')
    : []

  const columns: Column<CancellationReason>[] = [
    { key: 'reason', label: 'السبب' },
    {
      key: 'id',
      label: 'الإجراءات',
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(row)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const handleEdit = (reason: CancellationReason) => {
    setEditingReason(reason)
    setFormData({
      reason: reason.reason,
    })
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السبب؟')) return

    const updatedReasons = reasons.filter((r) => r.id !== id)
    upsertSetting({
      key: 'cancellation.reasons',
      data: {
        value: updatedReasons,
        type: 'JSON',
        category: 'cancellation',
      },
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.reason.trim()) {
      toast.error('يرجى إدخال السبب')
      return
    }

    let updatedReasons: CancellationReason[]

    if (editingReason) {
      updatedReasons = reasons.map((r) =>
        r.id === editingReason.id
          ? { ...r, reason: formData.reason }
          : r
      )
    } else {
      const newReason: CancellationReason = {
        id: Date.now().toString(),
        reason: formData.reason,
      }
      updatedReasons = [...reasons, newReason]
    }

    upsertSetting({
      key: 'cancellation.reasons',
      data: {
        value: updatedReasons,
        type: 'JSON',
        category: 'cancellation',
      },
    })

    setIsModalOpen(false)
    setEditingReason(null)
    setFormData({ reason: '' })
  }

  const handleOpenModal = () => {
    setEditingReason(null)
    setFormData({ reason: '' })
    setIsModalOpen(true)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>أسباب الإلغاء</CardTitle>
          <Button onClick={handleOpenModal}>
            <Plus className="ml-2 h-4 w-4" />
            إضافة سبب
          </Button>
        </CardHeader>
        <CardContent>
          {reasons.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              لا توجد أسباب إلغاء. قم بإضافة سبب جديد.
            </div>
          ) : (
            <DataTable data={reasons} columns={columns} />
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingReason ? 'تعديل سبب الإلغاء' : 'إضافة سبب إلغاء جديد'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">السبب *</Label>
              <Input
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Unable to Contact Driver"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit">
                {editingReason ? 'حفظ التغييرات' : 'إضافة'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
