import { useState, useRef } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetProfile } from './services/queries'
import { useUpdateProfile, useUploadProfileImage, useDeleteProfileImage } from './services/mutations'
import { User, Mail, Phone, Upload, Trash2 } from 'lucide-react'

export function ProfilePage() {
  const { data: profile, isLoading } = useGetProfile()
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateProfile()
  const { mutate: uploadImage, isPending: isUploading } = useUploadProfileImage()
  const { mutate: deleteImage, isPending: isDeleting } = useDeleteProfileImage()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
  })

  const [isEditing, setIsEditing] = useState(false)

  const handleEdit = () => {
    if (profile) {
      setFormData({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
      })
      setIsEditing(true)
    }
  }

  const handleSave = () => {
    updateProfile(formData, {
      onSuccess: () => setIsEditing(false),
    })
  }

  const handleCancel = () => {
    setIsEditing(false)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
    })
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('حجم الملف يجب أن يكون أقل من 5 ميجابايت')
        return
      }
      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار ملف صورة')
        return
      }
      uploadImage(file)
    }
  }

  const handleDeleteImage = () => {
    if (confirm('هل أنت متأكد من حذف الصورة الشخصية؟')) {
      deleteImage()
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="الملف الشخصي" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="الملف الشخصي" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            لم يتم العثور على بيانات الملف الشخصي
          </CardContent>
        </Card>
      </div>
    )
  }

  const initials = `${profile.firstName[0] || ''}${profile.lastName[0] || ''}`.toUpperCase()

  return (
    <div className="space-y-6">
      <PageHeader title="الملف الشخصي" />

      <Card>
        <CardHeader>
          <CardTitle>معلومات الحساب</CardTitle>
          <CardDescription>إدارة معلوماتك الشخصية وصورة الملف الشخصي</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Image */}
          <div className="flex items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.profileImage || undefined} alt={profile.firstName} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isUploading}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="ml-2 h-4 w-4" />
                {isUploading ? 'جاري الرفع...' : 'رفع صورة'}
              </Button>
              {profile.profileImage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteImage}
                  disabled={isDeleting}
                >
                  <Trash2 className="ml-2 h-4 w-4" />
                  {isDeleting ? 'جاري الحذف...' : 'حذف الصورة'}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                JPG, PNG أو GIF (حد أقصى 5 ميجابايت)
              </p>
            </div>
          </div>

          {/* Profile Form */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                <User className="ml-2 inline h-4 w-4" />
                الاسم الأول
              </Label>
              <Input
                id="firstName"
                value={isEditing ? formData.firstName : profile.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">
                <User className="ml-2 inline h-4 w-4" />
                الاسم الأخير
              </Label>
              <Input
                id="lastName"
                value={isEditing ? formData.lastName : profile.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="ml-2 inline h-4 w-4" />
                البريد الإلكتروني
              </Label>
              <Input
                id="email"
                type="email"
                value={isEditing ? formData.email : profile.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">
                <Phone className="ml-2 inline h-4 w-4" />
                رقم الهاتف
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={isEditing ? formData.phoneNumber : profile.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={isUpdating}>
                  إلغاء
                </Button>
                <Button onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </Button>
              </>
            ) : (
              <Button onClick={handleEdit}>تعديل الملف الشخصي</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>معلومات الحساب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">الدور:</span>
            <span className="font-medium">{profile.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">الحالة:</span>
            <span className="font-medium">{profile.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">تاريخ الإنشاء:</span>
            <span className="font-medium">
              {new Date(profile.createdAt).toLocaleDateString('ar-EG')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
