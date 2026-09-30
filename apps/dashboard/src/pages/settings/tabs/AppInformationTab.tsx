import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useGetSettings } from '../services/queries'
import { useBatchUpsertSettings } from '../services/mutations'
import { Skeleton } from '@/components/ui/skeleton'

interface AppInfoSettings {
  appName: string
  companyName: string
  companyAddress: string
  companyWebsite: string
  contactEmail: string
  companyPhone: string
  privacyPolicy: string
  termsConditions: string
  facebookPage: string
  twitterPage: string
  instagramPage: string
  appleStoreLink: string
  playStoreLink: string
}

export function AppInformationTab() {
  const { data: settings, isLoading } = useGetSettings('app-info')
  const { mutate: batchUpsert, isPending } = useBatchUpsertSettings()
  
  const initialFormData = useMemo(() => {
    if (!settings) {
      return {
        appName: '',
        companyName: '',
        companyAddress: '',
        companyWebsite: '',
        contactEmail: '',
        companyPhone: '',
        privacyPolicy: '',
        termsConditions: '',
        facebookPage: '',
        twitterPage: '',
        instagramPage: '',
        appleStoreLink: '',
        playStoreLink: '',
      }
    }
    
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
    return {
      appName: settingsMap['app.name'] || '',
      companyName: settingsMap['company.name'] || '',
      companyAddress: settingsMap['company.address'] || '',
      companyWebsite: settingsMap['company.website'] || '',
      contactEmail: settingsMap['company.email'] || '',
      companyPhone: settingsMap['company.phone'] || '',
      privacyPolicy: settingsMap['app.privacy_policy'] || '',
      termsConditions: settingsMap['app.terms_conditions'] || '',
      facebookPage: settingsMap['social.facebook'] || '',
      twitterPage: settingsMap['social.twitter'] || '',
      instagramPage: settingsMap['social.instagram'] || '',
      appleStoreLink: settingsMap['app.apple_store'] || '',
      playStoreLink: settingsMap['app.play_store'] || '',
    }
  }, [settings])

  const [formData, setFormData] = useState<AppInfoSettings>(initialFormData)

  useEffect(() => {
    setFormData(initialFormData)
  }, [initialFormData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const updates = [
      { key: 'app.name', value: formData.appName, type: 'STRING', category: 'app-info' },
      { key: 'company.name', value: formData.companyName, type: 'STRING', category: 'app-info' },
      { key: 'company.address', value: formData.companyAddress, type: 'STRING', category: 'app-info' },
      { key: 'company.website', value: formData.companyWebsite, type: 'STRING', category: 'app-info' },
      { key: 'company.email', value: formData.contactEmail, type: 'STRING', category: 'app-info' },
      { key: 'company.phone', value: formData.companyPhone, type: 'STRING', category: 'app-info' },
      { key: 'app.privacy_policy', value: formData.privacyPolicy, type: 'STRING', category: 'app-info' },
      { key: 'app.terms_conditions', value: formData.termsConditions, type: 'STRING', category: 'app-info' },
      { key: 'social.facebook', value: formData.facebookPage, type: 'STRING', category: 'app-info' },
      { key: 'social.twitter', value: formData.twitterPage, type: 'STRING', category: 'app-info' },
      { key: 'social.instagram', value: formData.instagramPage, type: 'STRING', category: 'app-info' },
      { key: 'app.apple_store', value: formData.appleStoreLink, type: 'STRING', category: 'app-info' },
      { key: 'app.play_store', value: formData.playStoreLink, type: 'STRING', category: 'app-info' },
    ]

    batchUpsert(updates)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>معلومات التطبيق</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appName">اسم التطبيق *</Label>
              <Input
                id="appName"
                value={formData.appName}
                onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                placeholder="Exicube"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">اسم الشركة *</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Exicube App Solutions"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyAddress">عنوان الشركة *</Label>
              <Input
                id="companyAddress"
                value={formData.companyAddress}
                onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                placeholder="Kolkata, India"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyWebsite">موقع الشركة *</Label>
              <Input
                id="companyWebsite"
                type="url"
                value={formData.companyWebsite}
                onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                placeholder="https://exicubetaxi.web.app"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail">البريد الإلكتروني</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="info@exicubecodehub.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyPhone">هاتف الشركة *</Label>
              <Input
                id="companyPhone"
                type="tel"
                value={formData.companyPhone}
                onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                placeholder="+919998887777"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">روابط التطبيق</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="privacyPolicy">سياسة الخصوصية *</Label>
                <Input
                  id="privacyPolicy"
                  type="url"
                  value={formData.privacyPolicy}
                  onChange={(e) => setFormData({ ...formData, privacyPolicy: e.target.value })}
                  placeholder="https://exicubetaxi.web.app/privacy-policy"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="termsConditions">الشروط والأحكام *</Label>
                <Input
                  id="termsConditions"
                  type="url"
                  value={formData.termsConditions}
                  onChange={(e) => setFormData({ ...formData, termsConditions: e.target.value })}
                  placeholder="https://exicubetaxi.web.app/term-condition"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facebookPage">رابط صفحة Facebook</Label>
                <Input
                  id="facebookPage"
                  type="url"
                  value={formData.facebookPage}
                  onChange={(e) => setFormData({ ...formData, facebookPage: e.target.value })}
                  placeholder="https://facebook.com/exicube"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterPage">رابط صفحة Twitter</Label>
                <Input
                  id="twitterPage"
                  type="url"
                  value={formData.twitterPage}
                  onChange={(e) => setFormData({ ...formData, twitterPage: e.target.value })}
                  placeholder="https://twitter.com/exicube"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagramPage">رابط صفحة Instagram</Label>
                <Input
                  id="instagramPage"
                  type="url"
                  value={formData.instagramPage}
                  onChange={(e) => setFormData({ ...formData, instagramPage: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appleStoreLink">رابط Apple Store</Label>
                <Input
                  id="appleStoreLink"
                  type="url"
                  value={formData.appleStoreLink}
                  onChange={(e) => setFormData({ ...formData, appleStoreLink: e.target.value })}
                  placeholder="https://apps.apple.com/app/id1501332146?platform=iphone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="playStoreLink">رابط Play Store</Label>
                <Input
                  id="playStoreLink"
                  type="url"
                  value={formData.playStoreLink}
                  onChange={(e) => setFormData({ ...formData, playStoreLink: e.target.value })}
                  placeholder="https://play.google.com/store/apps/details?id=com.exicube.taxi"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} size="lg">
              {isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
