import { useState, type FormEvent } from 'react'
import type { LoginInput, RegisterInput } from '../../lib/api'
import type { Language } from '../../content/landingContent'
import type { ProductUiCopy } from '../../content/productUiCopy'
import {
  FIELD_LIMITS,
  isValidEmail,
  normalizeEmail,
  normalizeText,
  type FieldErrors,
} from '../../lib/validation'

interface AuthScreenProps {
  language: Language
  mode: 'login' | 'signup'
  copy: ProductUiCopy['auth']
  pending: boolean
  error: string | null
  onLogin: (input: LoginInput) => Promise<void>
  onSignup: (input: RegisterInput) => Promise<void>
  onSwitchMode: (mode: 'login' | 'signup') => void
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <span className="text-xs font-medium text-red-600 dark:text-red-300">{message}</span>
}

const authSceneCopy: Record<
  Language,
  {
    joinedBy: string
    quote: string
    credit: string
    divider: string
    privacy: string
    terms: string
    showPassword: string
    hidePassword: string
  }
> = {
  en: {
    joinedBy: 'Joined by 5,000+ operators',
    quote:
      '"The best review workflow is the one that helps a team see what matters, faster."',
    credit: 'Sentify operator note',
    divider: 'Or continue with email',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
  },
  vi: {
    joinedBy: 'Đã có hơn 5.000 đội ngũ sử dụng',
    quote:
      '"Một luồng review tốt là khi đội ngũ nhìn ra điều quan trọng và hành động nhanh hơn."',
    credit: 'Ghi chú từ đội vận hành',
    divider: 'Hoặc tiếp tục với email',
    privacy: 'Chính sách bảo mật',
    terms: 'Điều khoản dịch vụ',
    showPassword: 'Hiện mật khẩu',
    hidePassword: 'Ẩn mật khẩu',
  },
  ja: {
    joinedBy: '5,000以上のチームが利用中',
    quote:
      '「よいレビュー運用とは、チームが本当に重要なことをすばやく見つけられることです。」',
    credit: 'Sentify オペレーションノート',
    divider: 'またはメールで続行',
    privacy: 'プライバシーポリシー',
    terms: '利用規約',
    showPassword: 'パスワードを表示',
    hidePassword: 'パスワードを隠す',
  },
}

export function AuthScreen({
  language,
  mode,
  copy,
  pending,
  error,
  onLogin,
  onSignup,
  onSwitchMode,
}: AuthScreenProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [showPassword, setShowPassword] = useState(false)

  const isLogin = mode === 'login'
  const authTitle = isLogin ? copy.loginTitle : copy.signupTitle
  const authDescription = isLogin ? copy.loginDescription : copy.signupDescription
  const scene = authSceneCopy[language]

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedFullName = normalizeText(fullName)
    const normalizedEmail = normalizeEmail(email)
    const nextErrors: FieldErrors = {}

    if (!isLogin) {
      if (!trimmedFullName) {
        nextErrors.fullName = copy.validation.fullNameRequired
      } else if (trimmedFullName.length > FIELD_LIMITS.fullName) {
        nextErrors.fullName = copy.validation.fullNameTooLong
      }
    }

    if (!normalizedEmail) {
      nextErrors.email = copy.validation.emailRequired
    } else if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = copy.validation.emailInvalid
    }

    if (!password) {
      nextErrors.password = copy.validation.passwordRequired
    } else if (!isLogin && password.length < FIELD_LIMITS.passwordMin) {
      nextErrors.password = copy.validation.passwordTooShort
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})

    if (isLogin) {
      await onLogin({
        email: normalizedEmail,
        password,
      })
      return
    }

    await onSignup({
      fullName: trimmedFullName,
      email: normalizedEmail,
      password,
    })
  }

  return (
    <main
      id="main-content"
      className="relative min-h-screen overflow-hidden bg-bg-light pt-20 dark:bg-bg-dark sm:pt-24"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(235,122,28,0.1),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(235,122,28,0.08),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_34%)]"></div>

      <div className="relative z-10 flex min-h-[calc(100vh-5rem)] overflow-hidden">
        <section className="relative hidden min-h-[calc(100vh-5rem)] lg:flex lg:w-7/12 lg:items-end lg:overflow-hidden lg:p-10 xl:p-12">
          <img
            className="absolute inset-0 h-full w-full object-cover brightness-[0.78] saturate-[0.92]"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7p3TZKZ4bBDiObnP8KCEDNMmReCwiJKwP0TMThZWoKaWloVbTrw2-AfTQEpv8qrwfxLLl5c0FiQ5sD_KTjvPqZlnqwFxIWM-qZegZdWxC1kOQVwT3ZTir_dBwyoPcRlp-O-j5wsyTBJbMf3Lwwo5J8CxMY1mjAivGV9Yszd1jKI1SMxm2MjMmKKK8FxmnHnn4xtyUekibeSbqhJ_kyVgGTjoJKvGvwFrSV8io0-Mw9CnalPUtuVRftf9lHE4BA7w6NDdnFjJuTA"
            alt=""
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,12,8,0.12)_0%,rgba(16,12,8,0.28)_46%,rgba(16,12,8,0.78)_100%)] dark:bg-[linear-gradient(180deg,rgba(0,0,0,0.16)_0%,rgba(0,0,0,0.4)_38%,rgba(0,0,0,0.84)_100%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(235,122,28,0.18),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.14),transparent_40%)]"></div>

          <div className="relative z-10 w-full max-w-2xl">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/18 bg-surface-white/10 px-4 py-2 outline outline-1 outline-white/10 backdrop-blur-md">
              <div className="flex -space-x-2">
                <img
                  className="size-8 rounded-full border-2 border-surface-white object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzN5WmhLFc9HOpDJjuQNjTpibeHI4hE0CcuGO0--wqv6dGasqV6l_7tCMnxV9mqsKKQNO6iXdq4z2tsD1kuA06HiXNkXbPJ3z3_OXZxTGQMycMOaeNI6G0cH6fY3OuVD5_OX9gvwXDut0nXwymclT3Xw1V80fRO8H666UW8ezUZa2wygUPLg2wmvoY2dodiy1LJdDoYHzDqTE5vo_2o7YjwSFl7W57UbgGYwqGq2eIn1CH_p4CQi0MNyjUsKzeXNOvcLt7l6d_-g"
                  alt=""
                />
                <img
                  className="size-8 rounded-full border-2 border-surface-white object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCCz9nZt3AC04fzh71g4J7eEEzxCp59X6n4xzIlh3U9qgnUjyMKDApjCkKpRj2wjKswmmhmoLGHwbxBYGeU9qt7w2zShxWSJB3L_kuK3stKtEJX78LRl_eIY41gVI-tUPv9_bToK8WvVZiebjlCidXdAj2eJ1uPxa49ccak7DTycVvqFap_y2lDkkQsFaLy6-wyIPM6Vr6DC2Vi04EwC3WgZonNt57MDiMHSGlBEHKhyl4i6GrPpqLb7fdRrvqtP6awGBQMAiPXnA"
                  alt=""
                />
                <img
                  className="size-8 rounded-full border-2 border-surface-white object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOkUQzNeb7tokcN0vJJOXkprGyPThP8g585n-BZ6WZ75HPb_j7CDJaOWs7qRHg-IeYisuhU92jVzd7ORy0y-0WkmcQr88inPpespFUpT2DNOe7UYtiaYbpeN1LO7l7kpynFTH_M6fRTGhyexKbWJG95xxHTfIO2-ccjgWL6o6dIKLDKzfthJT112OXSOyz9Rlp3uFWLFeGW7aqshWX-Rd9BXCjBWJMPZ6O_BiAFPVlB-N8brxT8i88pg4CsvB91Y5DSLk3NZqgjA"
                  alt=""
                />
              </div>
              <span className="pr-1 text-sm font-medium tracking-tight text-white">
                {scene.joinedBy}
              </span>
            </div>

            <blockquote className="font-serif text-[2.55rem] italic leading-[1.18] tracking-tight text-white xl:text-[3.05rem]">
              {scene.quote}
            </blockquote>
            <cite className="mt-4 block text-xs font-semibold not-italic uppercase tracking-[0.28em] text-white/80">
              {scene.credit}
            </cite>
          </div>
        </section>

        <section className="flex w-full flex-col items-center justify-center bg-surface-white px-6 py-10 dark:bg-surface-dark/96 md:px-10 lg:w-5/12 lg:px-12 lg:py-12 xl:px-16">
          <div className="w-full max-w-md">
            <header className="mb-10 text-center lg:text-left">
              <h1 className="font-serif text-[2.3rem] tracking-tight text-[#8a3c10] dark:text-[#f2dfc7] md:text-[2.7rem]">
                {authTitle}
              </h1>
              <p className="mt-3 text-base leading-7 text-text-silver-light dark:text-text-silver-dark">
                {authDescription}
              </p>
            </header>

            <div className="mb-8 grid grid-cols-2 gap-4">
              <button
                type="button"
                className="flex items-center justify-center gap-3 rounded-xl bg-[#ebe8e3] px-4 py-3 text-sm font-medium text-text-charcoal transition-colors hover:bg-[#e6e2dd] dark:bg-bg-dark/70 dark:text-white dark:hover:bg-surface-highlight/30"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"></path>
                </svg>
                <span>Google</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-3 rounded-xl bg-[#ebe8e3] px-4 py-3 text-sm font-medium text-text-charcoal transition-colors hover:bg-[#e6e2dd] dark:bg-bg-dark/70 dark:text-white dark:hover:bg-surface-highlight/30"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-.5-.24-1.03-.37-1.58-.37-.58 0-1.12.14-1.63.41-1 .51-1.9.5-2.95-.45-3.15-3.15-2.66-8.72 1.05-10.7 1.77-.96 3.46-.38 4.45.02.4.15.7.26.9.26.2 0 .5-.11.9-.26 1.34-.54 3.22-.98 4.75.52.32.32 2.62 3.05 1.83 6.94-.15.4-.33.84-.54 1.28-.96 1.95-1.88 3.65-3.1 3.95h-.01zM12.03 7.25c-.02-2.23 1.54-4.22 3.65-4.5.21 2.31-1.46 4.44-3.65 4.5z" fill="currentColor"></path>
                </svg>
                <span>Apple</span>
              </button>
            </div>

            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="h-px w-full bg-[#e6e2dd] dark:bg-border-dark"></div>
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-[0.24em]">
                <span className="bg-surface-white px-4 text-[#564337] dark:bg-surface-dark dark:text-text-silver-dark">
                  {scene.divider}
                </span>
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {!isLogin ? (
                <label
                  htmlFor="auth-full-name"
                  className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
                >
                  <span className="ml-1 text-xs uppercase tracking-[0.16em] text-text-silver-light dark:text-text-silver-dark">
                    {copy.fullNameLabel}
                  </span>
                  <input
                    id="auth-full-name"
                    required
                    maxLength={FIELD_LIMITS.fullName}
                    value={fullName}
                    onChange={(event) => {
                      setFullName(event.target.value)
                      setFieldErrors((current) => ({ ...current, fullName: undefined }))
                    }}
                    aria-invalid={fieldErrors.fullName ? 'true' : 'false'}
                    autoComplete="name"
                    className="h-14 rounded-xl border-none bg-[#f7f3ee] px-5 text-base text-text-charcoal outline-none transition placeholder:text-text-silver-light/55 focus:ring-2 focus:ring-primary/20 dark:bg-bg-dark/55 dark:text-white dark:placeholder:text-text-silver-dark/50"
                    type="text"
                    placeholder="Elias Vance"
                  />
                  <FieldError message={fieldErrors.fullName} />
                </label>
              ) : null}

              <label
                htmlFor="auth-email"
                className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
              >
                <span className="ml-1 text-xs uppercase tracking-[0.16em] text-text-silver-light dark:text-text-silver-dark">
                  {copy.emailLabel}
                </span>
                <input
                  id="auth-email"
                  required
                  maxLength={FIELD_LIMITS.email}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setFieldErrors((current) => ({ ...current, email: undefined }))
                  }}
                  aria-invalid={fieldErrors.email ? 'true' : 'false'}
                  className="h-14 rounded-xl border-none bg-[#f7f3ee] px-5 text-base text-text-charcoal outline-none transition placeholder:text-text-silver-light/55 focus:ring-2 focus:ring-primary/20 dark:bg-bg-dark/55 dark:text-white dark:placeholder:text-text-silver-dark/50"
                  type="email"
                  autoComplete="email"
                  placeholder="elias@sentify.app"
                />
                <FieldError message={fieldErrors.email} />
              </label>

              <label
                htmlFor="auth-password"
                className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
              >
                <span className="ml-1 text-xs uppercase tracking-[0.16em] text-text-silver-light dark:text-text-silver-dark">
                  {copy.passwordLabel}
                </span>
                <div className="relative">
                  <input
                    id="auth-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setFieldErrors((current) => ({ ...current, password: undefined }))
                    }}
                    aria-invalid={fieldErrors.password ? 'true' : 'false'}
                    className="h-14 w-full rounded-xl border-none bg-[#f7f3ee] px-5 pr-14 text-base text-text-charcoal outline-none transition placeholder:text-text-silver-light/55 focus:ring-2 focus:ring-primary/20 dark:bg-bg-dark/55 dark:text-white dark:placeholder:text-text-silver-dark/50"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-silver-light transition hover:text-primary dark:text-text-silver-dark"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? scene.hidePassword : scene.showPassword}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <FieldError message={fieldErrors.password} />
              </label>

              {error ? (
                <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </div>
              ) : null}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-primary to-[#fa7025] px-6 text-sm font-bold tracking-tight text-white shadow-[0_20px_40px_-18px_rgba(235,122,28,0.55)] transition hover:scale-[1.01] hover:shadow-[0_24px_48px_-18px_rgba(235,122,28,0.62)] disabled:cursor-not-allowed disabled:opacity-70 dark:text-bg-dark"
                >
                  {pending
                    ? isLogin
                      ? `${copy.submitLogin}...`
                      : `${copy.submitSignup}...`
                    : isLogin
                      ? copy.submitLogin
                      : copy.submitSignup}
                </button>
              </div>
            </form>

            <footer className="mt-12 text-center">
              <p className="text-sm text-text-silver-light dark:text-text-silver-dark">
                {isLogin ? copy.loginAltPrompt : copy.signupAltPrompt}
                <button
                  type="button"
                    className="ml-1 font-bold text-primary hover:underline"
                    onClick={() => onSwitchMode(isLogin ? 'signup' : 'login')}
                  >
                  {isLogin ? copy.loginAltAction : copy.signupAltAction}
                </button>
              </p>
              <div className="mt-10 flex items-center justify-center gap-6">
                <span className="text-[10px] uppercase tracking-[0.22em] text-text-silver-light/80 dark:text-text-silver-dark/80">
                  {scene.privacy}
                </span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-text-silver-light/80 dark:text-text-silver-dark/80">
                  {scene.terms}
                </span>
              </div>
            </footer>
          </div>
        </section>
      </div>
    </main>
  )
}
