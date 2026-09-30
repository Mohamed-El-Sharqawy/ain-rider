import { ApiClient } from './client';

export interface PublicSetting {
  id: string;
  key: string;
  value: string;
  type: string;
  category: string;
  description: string;
}

export const SettingsApi = {
  async getPublicSettings(category?: string): Promise<PublicSetting[]> {
    const url = category ? `/settings/public?category=${category}` : '/settings/public';
    return ApiClient.get<PublicSetting[]>(url);
  },

  async getPublicSetting(key: string): Promise<PublicSetting> {
    return ApiClient.get<PublicSetting>(`/settings/public/${key}`);
  },

  /**
   * Helper to fetch cancellation reasons and parse them based on language
   * Expected format: {"en": ["Reason 1"], "ar": ["Reason 1"]}
   */
  async getCancellationReasons(lang: 'en' | 'ar' = 'en'): Promise<string[]> {
    try {
      const setting = await this.getPublicSetting('cancellation_reasons');
      if (!setting || !setting.value) return this.getDefaultReasons(lang);
      
      const reasons = JSON.parse(setting.value);
      if (typeof reasons !== 'object' || reasons === null || Array.isArray(reasons)) {
        return this.getDefaultReasons(lang);
      }
      return reasons[lang] || reasons['en'] || this.getDefaultReasons(lang);
    } catch (err) {
      console.warn('[SettingsApi] Failed to parse cancellation reasons, using defaults:', err);
      return this.getDefaultReasons(lang);
    }
  },

  getDefaultReasons(lang: 'en' | 'ar' = 'en'): string[] {
    const defaults = {
      en: [
        'Change of plans',
        'Wait time too long',
        'Driver is too far',
        'Found another ride',
        'Safety concerns',
        'Incorrect pickup location'
      ],
      ar: [
        'تغيير الخطط',
        'وقت الانتظار طويل جداً',
        'السائق بعيد جداً',
        'وجدت وسيلة نقل أخرى',
        'مخاوف تتعلق بالسلامة',
        'موقع الاستلام غير صحيح'
      ]
    };
    return defaults[lang] || defaults.en;
  }
};
