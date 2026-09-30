import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useGetSettings } from '../services/queries'
import { useBatchUpsertSettings } from '../services/mutations'
import { Skeleton } from '@/components/ui/skeleton'

interface GeneralSettings {
  currencySymbol: string
  currencyCode: string
  setDecimal: string
  swipeSymbolDirection: boolean
  disableOnlinePayments: boolean
  disableCashPayments: boolean
  allowMultiCountrySelection: boolean
  autocompleteCountryRestriction: string
  convertToMile: boolean
  customerWithdraw: boolean
  carListViewHorizontal: boolean
  useDistanceMatrixAPI: boolean
  repeatSoundOnNewTrip: boolean
  prepaid: boolean
  disableTips: boolean
  autoDispatch: boolean
  allowDriverNegativeBalance: boolean
  driverLiveLocation: boolean
  bankRegFields: boolean
  showLiveRoute: boolean
  carIsRequired: boolean
  termRequired: boolean
  licenseImageRequired: boolean
  referralBonus: string
  walletDenominations: string
  tipDenominations: string
  driverThreshold: string
  panicDialNumber: string
  emailLogin: boolean
  mobileLogin: boolean
  socialLogin: boolean
  driverRadius: string
}

export function GeneralSettingsTab() {
  const { data: settings, isLoading } = useGetSettings('general')
  const { mutate: batchUpsert, isPending } = useBatchUpsertSettings()
  
  const initialFormData = useMemo(() => {
    if (!settings) {
      return {
        currencySymbol: '$',
        currencyCode: 'USD',
        setDecimal: '2',
        swipeSymbolDirection: false,
        disableOnlinePayments: false,
        disableCashPayments: false,
        allowMultiCountrySelection: false,
        autocompleteCountryRestriction: 'India',
        convertToMile: false,
        customerWithdraw: false,
        carListViewHorizontal: false,
        useDistanceMatrixAPI: false,
        repeatSoundOnNewTrip: false,
        prepaid: false,
        disableTips: false,
        autoDispatch: false,
        allowDriverNegativeBalance: false,
        driverLiveLocation: false,
        bankRegFields: false,
        showLiveRoute: false,
        carIsRequired: false,
        termRequired: false,
        licenseImageRequired: false,
        referralBonus: '10',
        walletDenominations: '',
        tipDenominations: '',
        driverThreshold: '',
        panicDialNumber: '',
        emailLogin: true,
        mobileLogin: true,
        socialLogin: true,
        driverRadius: '10',
      }
    }
    
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]))
    return {
      currencySymbol: settingsMap['currency.symbol'] || '$',
      currencyCode: settingsMap['currency.code'] || 'USD',
      setDecimal: settingsMap['currency.decimal'] || '2',
      swipeSymbolDirection: settingsMap['currency.swipe_direction'] === 'true',
      disableOnlinePayments: settingsMap['payment.disable_online'] === 'true',
      disableCashPayments: settingsMap['payment.disable_cash'] === 'true',
      allowMultiCountrySelection: settingsMap['location.multi_country'] === 'true',
      autocompleteCountryRestriction: settingsMap['location.country_restriction'] || 'India',
      convertToMile: settingsMap['distance.convert_to_mile'] === 'true',
      customerWithdraw: settingsMap['wallet.customer_withdraw'] === 'true',
      carListViewHorizontal: settingsMap['ui.car_list_horizontal'] === 'true',
      useDistanceMatrixAPI: settingsMap['api.distance_matrix'] === 'true',
      repeatSoundOnNewTrip: settingsMap['sound.repeat_new_trip'] === 'true',
      prepaid: settingsMap['payment.prepaid'] === 'true',
      disableTips: settingsMap['payment.disable_tips'] === 'true',
      autoDispatch: settingsMap['driver.auto_dispatch'] === 'true',
      allowDriverNegativeBalance: settingsMap['driver.negative_balance'] === 'true',
      driverLiveLocation: settingsMap['driver.live_location'] === 'true',
      bankRegFields: settingsMap['driver.bank_reg_fields'] === 'true',
      showLiveRoute: settingsMap['driver.show_live_route'] === 'true',
      carIsRequired: settingsMap['driver.car_required'] === 'true',
      termRequired: settingsMap['driver.term_required'] === 'true',
      licenseImageRequired: settingsMap['driver.license_image_required'] === 'true',
      referralBonus: settingsMap['referral.bonus'] || '10',
      walletDenominations: settingsMap['wallet.denominations'] || '',
      tipDenominations: settingsMap['tip.denominations'] || '',
      driverThreshold: settingsMap['driver.threshold'] || '',
      panicDialNumber: settingsMap['panic.dial_number'] || '',
      emailLogin: settingsMap['login.email'] !== 'false',
      mobileLogin: settingsMap['login.mobile'] !== 'false',
      socialLogin: settingsMap['login.social'] !== 'false',
      driverRadius: settingsMap['driver.radius'] || '10',
    }
  }, [settings])

  const [formData, setFormData] = useState<GeneralSettings>(initialFormData)

  useEffect(() => {
    setFormData(initialFormData)
  }, [initialFormData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const updates = [
      { key: 'currency.symbol', value: formData.currencySymbol, type: 'STRING', category: 'general' },
      { key: 'currency.code', value: formData.currencyCode, type: 'STRING', category: 'general' },
      { key: 'currency.decimal', value: formData.setDecimal, type: 'STRING', category: 'general' },
      { key: 'currency.swipe_direction', value: String(formData.swipeSymbolDirection), type: 'STRING', category: 'general' },
      { key: 'payment.disable_online', value: String(formData.disableOnlinePayments), type: 'STRING', category: 'general' },
      { key: 'payment.disable_cash', value: String(formData.disableCashPayments), type: 'STRING', category: 'general' },
      { key: 'location.multi_country', value: String(formData.allowMultiCountrySelection), type: 'STRING', category: 'general' },
      { key: 'location.country_restriction', value: formData.autocompleteCountryRestriction, type: 'STRING', category: 'general' },
      { key: 'distance.convert_to_mile', value: String(formData.convertToMile), type: 'STRING', category: 'general' },
      { key: 'wallet.customer_withdraw', value: String(formData.customerWithdraw), type: 'STRING', category: 'general' },
      { key: 'ui.car_list_horizontal', value: String(formData.carListViewHorizontal), type: 'STRING', category: 'general' },
      { key: 'api.distance_matrix', value: String(formData.useDistanceMatrixAPI), type: 'STRING', category: 'general' },
      { key: 'sound.repeat_new_trip', value: String(formData.repeatSoundOnNewTrip), type: 'STRING', category: 'general' },
      { key: 'payment.prepaid', value: String(formData.prepaid), type: 'STRING', category: 'general' },
      { key: 'payment.disable_tips', value: String(formData.disableTips), type: 'STRING', category: 'general' },
      { key: 'driver.auto_dispatch', value: String(formData.autoDispatch), type: 'STRING', category: 'general' },
      { key: 'driver.negative_balance', value: String(formData.allowDriverNegativeBalance), type: 'STRING', category: 'general' },
      { key: 'driver.live_location', value: String(formData.driverLiveLocation), type: 'STRING', category: 'general' },
      { key: 'driver.bank_reg_fields', value: String(formData.bankRegFields), type: 'STRING', category: 'general' },
      { key: 'driver.show_live_route', value: String(formData.showLiveRoute), type: 'STRING', category: 'general' },
      { key: 'driver.car_required', value: String(formData.carIsRequired), type: 'STRING', category: 'general' },
      { key: 'driver.term_required', value: String(formData.termRequired), type: 'STRING', category: 'general' },
      { key: 'driver.license_image_required', value: String(formData.licenseImageRequired), type: 'STRING', category: 'general' },
      { key: 'referral.bonus', value: formData.referralBonus, type: 'STRING', category: 'general' },
      { key: 'wallet.denominations', value: formData.walletDenominations, type: 'STRING', category: 'general' },
      { key: 'tip.denominations', value: formData.tipDenominations, type: 'STRING', category: 'general' },
      { key: 'driver.threshold', value: formData.driverThreshold, type: 'STRING', category: 'general' },
      { key: 'panic.dial_number', value: formData.panicDialNumber, type: 'STRING', category: 'general' },
      { key: 'login.email', value: String(formData.emailLogin), type: 'STRING', category: 'general' },
      { key: 'login.mobile', value: String(formData.mobileLogin), type: 'STRING', category: 'general' },
      { key: 'login.social', value: String(formData.socialLogin), type: 'STRING', category: 'general' },
      { key: 'driver.radius', value: formData.driverRadius, type: 'STRING', category: 'general' },
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
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>الإعدادات العامة</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Currency Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">إعدادات العملة</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="currencySymbol">رمز العملة *</Label>
                <Input
                  id="currencySymbol"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  placeholder="$"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currencyCode">كود العملة *</Label>
                <Input
                  id="currencyCode"
                  value={formData.currencyCode}
                  onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                  placeholder="USD"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="setDecimal">عدد الخانات العشرية</Label>
                <Input
                  id="setDecimal"
                  type="number"
                  value={formData.setDecimal}
                  onChange={(e) => setFormData({ ...formData, setDecimal: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <Label htmlFor="swipeSymbolDirection" className="cursor-pointer">
                اتجاه رمز العملة
              </Label>
              <Switch
                id="swipeSymbolDirection"
                checked={formData.swipeSymbolDirection}
                onCheckedChange={(checked) => setFormData({ ...formData, swipeSymbolDirection: checked })}
              />
            </div>
          </div>

          {/* Advance Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">الإعدادات المتقدمة</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="allowMultiCountrySelection" className="cursor-pointer">
                  السماح باختيار عدة دول
                </Label>
                <Switch
                  id="allowMultiCountrySelection"
                  checked={formData.allowMultiCountrySelection}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowMultiCountrySelection: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="autocompleteCountryRestriction">تحديد الدولة</Label>
                <Input
                  id="autocompleteCountryRestriction"
                  value={formData.autocompleteCountryRestriction}
                  onChange={(e) => setFormData({ ...formData, autocompleteCountryRestriction: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="convertToMile" className="cursor-pointer">
                  التحويل إلى ميل
                </Label>
                <Switch
                  id="convertToMile"
                  checked={formData.convertToMile}
                  onCheckedChange={(checked) => setFormData({ ...formData, convertToMile: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="customerWithdraw" className="cursor-pointer">
                  سحب العميل
                </Label>
                <Switch
                  id="customerWithdraw"
                  checked={formData.customerWithdraw}
                  onCheckedChange={(checked) => setFormData({ ...formData, customerWithdraw: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="disableOnlinePayments" className="cursor-pointer">
                  تعطيل الدفع الإلكتروني
                </Label>
                <Switch
                  id="disableOnlinePayments"
                  checked={formData.disableOnlinePayments}
                  onCheckedChange={(checked) => setFormData({ ...formData, disableOnlinePayments: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="disableCashPayments" className="cursor-pointer">
                  تعطيل الدفع النقدي
                </Label>
                <Switch
                  id="disableCashPayments"
                  checked={formData.disableCashPayments}
                  onCheckedChange={(checked) => setFormData({ ...formData, disableCashPayments: checked })}
                />
              </div>
            </div>
          </div>

          {/* Login Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">إعدادات تسجيل الدخول</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="emailLogin" className="cursor-pointer">
                  تسجيل الدخول بالبريد
                </Label>
                <Switch
                  id="emailLogin"
                  checked={formData.emailLogin}
                  onCheckedChange={(checked) => setFormData({ ...formData, emailLogin: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="mobileLogin" className="cursor-pointer">
                  تسجيل الدخول بالهاتف
                </Label>
                <Switch
                  id="mobileLogin"
                  checked={formData.mobileLogin}
                  onCheckedChange={(checked) => setFormData({ ...formData, mobileLogin: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="socialLogin" className="cursor-pointer">
                  تسجيل الدخول الاجتماعي
                </Label>
                <Switch
                  id="socialLogin"
                  checked={formData.socialLogin}
                  onCheckedChange={(checked) => setFormData({ ...formData, socialLogin: checked })}
                />
              </div>
            </div>
          </div>

          {/* Driver Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">إعدادات السائق</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="driverRadius">نطاق السائق</Label>
                <Input
                  id="driverRadius"
                  type="number"
                  value={formData.driverRadius}
                  onChange={(e) => setFormData({ ...formData, driverRadius: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="autoDispatch" className="cursor-pointer">
                  الإرسال التلقائي
                </Label>
                <Switch
                  id="autoDispatch"
                  checked={formData.autoDispatch}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoDispatch: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="driverLiveLocation" className="cursor-pointer">
                  الموقع المباشر للسائق
                </Label>
                <Switch
                  id="driverLiveLocation"
                  checked={formData.driverLiveLocation}
                  onCheckedChange={(checked) => setFormData({ ...formData, driverLiveLocation: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="showLiveRoute" className="cursor-pointer">
                  عرض المسار المباشر
                </Label>
                <Switch
                  id="showLiveRoute"
                  checked={formData.showLiveRoute}
                  onCheckedChange={(checked) => setFormData({ ...formData, showLiveRoute: checked })}
                />
              </div>
            </div>
          </div>

          {/* Other Settings */}
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="referralBonus">مكافأة الإحالة</Label>
                <Input
                  id="referralBonus"
                  type="number"
                  value={formData.referralBonus}
                  onChange={(e) => setFormData({ ...formData, referralBonus: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="panicDialNumber">رقم الطوارئ</Label>
                <Input
                  id="panicDialNumber"
                  type="tel"
                  value={formData.panicDialNumber}
                  onChange={(e) => setFormData({ ...formData, panicDialNumber: e.target.value })}
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
