import { useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useLogin } from './services/mutations';

interface LoginForm {
  email: string;
  password: string;
}

interface FieldError {
  email?: string;
  password?: string;
}

function validate(form: LoginForm): FieldError {
  const errors: FieldError = {};
  if (!form.email) errors.email = 'البريد الإلكتروني مطلوب';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'أدخل بريداً إلكترونياً صحيحاً';
  if (!form.password) errors.password = 'كلمة المرور مطلوبة';
  else if (form.password.length < 6) errors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  return errors;
}

export function LoginPage() {
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldError>({});
  const [showPassword, setShowPassword] = useState(false);

  const { mutate: login, isPending } = useLogin();

  const handleChange = (field: keyof LoginForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    login(form);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-surface-2)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            عين رايدر — الإدارة
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            سجّل دخولك للوصول إلى لوحة التحكم
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                البريد الإلكتروني
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={form.email}
                onChange={handleChange('email')}
                disabled={isPending}
                placeholder="admin@ainrider.com"
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: errors.email
                    ? '1.5px solid var(--color-danger)'
                    : '1.5px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={(e) => {
                  if (!errors.email) e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onBlur={(e) => {
                  if (!errors.email) e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
              />
              {errors.email && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange('password')}
                  disabled={isPending}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-11 rounded-lg text-sm outline-none transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--color-surface-2)',
                    border: errors.password
                      ? '1.5px solid var(--color-danger)'
                      : '1.5px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    if (!errors.password) e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }}
                  onBlur={(e) => {
                    if (!errors.password) e.currentTarget.style.borderColor = 'var(--color-border)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-70 mt-2"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
              }}
            >
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {isPending ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--color-text-secondary)' }}>
          الوصول مقصور على موظفي الإدارة والدعم الفني فقط.
        </p>
      </div>
    </div>
  );
}
