import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppInformationTab } from './tabs/AppInformationTab'
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab'
import { LanguagesTab } from './tabs/LanguagesTab'
import { CancellationReasonTab } from './tabs/CancellationReasonTab'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('app-info')

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإعدادات"
        description="إدارة إعدادات التطبيق والنظام"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="app-info">معلومات التطبيق</TabsTrigger>
          <TabsTrigger value="general">الإعدادات العامة</TabsTrigger>
          <TabsTrigger value="languages">اللغات</TabsTrigger>
          <TabsTrigger value="cancellation">أسباب الإلغاء</TabsTrigger>
        </TabsList>

        <TabsContent value="app-info" className="mt-6">
          <AppInformationTab />
        </TabsContent>

        <TabsContent value="general" className="mt-6">
          <GeneralSettingsTab />
        </TabsContent>

        <TabsContent value="languages" className="mt-6">
          <LanguagesTab />
        </TabsContent>

        <TabsContent value="cancellation" className="mt-6">
          <CancellationReasonTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
