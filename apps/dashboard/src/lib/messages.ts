export const Messages = {
  success: {
    complaintCreated: 'تم إنشاء الشكوى بنجاح',
    complaintStatusUpdated: 'تم تحديث حالة الشكوى بنجاح',
    commentAdded: 'تم إضافة التعليق بنجاح',
    promoCreated: 'تم إنشاء العرض الترويجي بنجاح',
    promoUpdated: 'تم تحديث العرض الترويجي بنجاح',
    profileUpdated: 'تم تحديث الملف الشخصي بنجاح',
    settingsUpdated: 'تم تحديث الإعدادات بنجاح',
    saved: 'تم الحفظ بنجاح',
    deleted: 'تم الحذف بنجاح',
  },
  error: {
    network: 'خطأ في الاتصال بالخادم',
    unauthorized: 'غير مصرح لك. يرجى تسجيل الدخول مرة أخرى',
    forbidden: 'ليس لديك صلاحية للقيام بهذا الإجراء',
    notFound: 'لم يتم العثور على البيانات المطلوبة',
    server: 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً',
    validation: 'يرجى التحقق من البيانات المدخلة',
    generic: 'حدث خطأ غير متوقع',
  },
  loading: {
    saving: 'جاري الحفظ...',
    deleting: 'جاري الحذف...',
    updating: 'جاري التحديث...',
    uploading: 'جاري الرفع...',
    loading: 'جاري التحميل...',
  },
} as const;
