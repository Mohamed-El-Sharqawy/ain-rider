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

interface Language {
  id: string
  name: string
  locale: string
  dateLocal: string
  isDefault: boolean
}

export function LanguagesTab() {
  const { data: settings, isLoading } = useGetSettings('languages')
  const { mutate: upsertSetting } = useUpsertSetting()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLanguage, setEditingLanguage] = useState<Language | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    locale: '',
    dateLocal: '',
  })

  const languages: Language[] = settings
    ? JSON.parse(settings.find((s) => s.key === 'languages.list')?.value || '[]')
    : []

  const columns: Column<Language>[] = [
    { key: 'name', label: 'اسم اللغة' },
    { key: 'locale', label: 'رمز اللغة' },
    { key: 'dateLocal', label: 'تنسيق التاريخ' },
    {
      key: 'id',
      label: 'الإجراءات',
      render: (_, row) => (
        <div className="flex gap-2">
          {row.isDefault && (
            <Button size="sm" variant="outline" disabled>
              افتراضي
            </Button>
          )}
          {!row.isDefault && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSetDefault(row.id)}
            >
              تعيين كافتراضي
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(row)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {!row.isDefault && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const handleEdit = (language: Language) => {
    setEditingLanguage(language)
    setFormData({
      name: language.name,
      locale: language.locale,
      dateLocal: language.dateLocal,
    })
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه اللغة؟')) return

    const updatedLanguages = languages.filter((l) => l.id !== id)
    upsertSetting({
      key: 'languages.list',
      data: {
        value: updatedLanguages,
        type: 'JSON',
        category: 'languages',
      },
    })
  }

  const handleSetDefault = (id: string) => {
    const updatedLanguages = languages.map((l) => ({
      ...l,
      isDefault: l.id === id,
    }))
    upsertSetting({
      key: 'languages.list',
      data: {
        value: JSON.stringify(updatedLanguages),
        type: 'JSON',
        category: 'languages',
      },
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.locale || !formData.dateLocal) {
      toast.error('يرجى ملء جميع الحقول')
      return
    }

    let updatedLanguages: Language[]

    if (editingLanguage) {
      updatedLanguages = languages.map((l) =>
        l.id === editingLanguage.id
          ? { ...l, ...formData }
          : l
      )
    } else {
      const newLanguage: Language = {
        id: Date.now().toString(),
        ...formData,
        isDefault: languages.length === 0,
      }
      updatedLanguages = [...languages, newLanguage]
    }

    upsertSetting({
      key: 'languages.list',
      data: {
        value: updatedLanguages,
        type: 'JSON',
        category: 'languages',
      },
    })

    setIsModalOpen(false)
    setEditingLanguage(null)
    setFormData({ name: '', locale: '', dateLocal: '' })
  }

  const handleOpenModal = () => {
    setEditingLanguage(null)
    setFormData({ name: '', locale: '', dateLocal: '' })
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
          <CardTitle>اللغات</CardTitle>
          <Button onClick={handleOpenModal}>
            <Plus className="ml-2 h-4 w-4" />
            إضافة لغة
          </Button>
        </CardHeader>
        <CardContent>
          {languages.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              لا توجد لغات. قم بإضافة لغة جديدة.
            </div>
          ) : (
            <DataTable data={languages} columns={columns} />
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLanguage ? 'تعديل اللغة' : 'إضافة لغة جديدة'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">اسم اللغة *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="English"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="locale">رمز اللغة *</Label>
              <Input
                id="locale"
                value={formData.locale}
                onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                placeholder="en"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateLocal">تنسيق التاريخ *</Label>
              <Input
                id="dateLocal"
                value={formData.dateLocal}
                onChange={(e) => setFormData({ ...formData, dateLocal: e.target.value })}
                placeholder="en-gb"
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
                {editingLanguage ? 'حفظ التغييرات' : 'إضافة'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
