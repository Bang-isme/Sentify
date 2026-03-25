import { useState, type FormEvent } from 'react'
import type { LoginInput, RegisterInput } from '../../lib/api'
import type { ProductUiCopy } from '../../content/productUiCopy'
import {
  FIELD_LIMITS,
  isValidEmail,
  normalizeEmail,
  normalizeText,
  type FieldErrors,
} from '../../lib/validation'

interface AuthScreenProps {
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

export function AuthScreen({
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

  const isLogin = mode === 'login'

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
      data-testid="auth-shell"
      className="relative min-h-screen overflow-hidden bg-bg-light pt-28 pb-14 dark:bg-bg-dark"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(212,175,55,0.06),transparent_36%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(242,208,13,0.09),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(242,208,13,0.06),transparent_36%)]"></div>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:px-10">
        <section className="rounded-[2rem] border border-border-light/70 bg-surface-white/80 p-8 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.3)] backdrop-blur dark:border-border-dark/70 dark:bg-surface-dark/75">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
            <span className="size-2 rounded-full bg-primary"></span>
            {copy.eyebrow}
          </div>

          <h1 className="max-w-xl text-4xl font-black leading-tight tracking-tight text-text-charcoal dark:text-white md:text-5xl">
            {isLogin ? copy.loginTitle : copy.signupTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-text-silver-light dark:text-text-silver-dark">
            {isLogin ? copy.loginDescription : copy.signupDescription}
          </p>

          <div className="mt-8 grid gap-3">
            {copy.trustPoints.map((point) => (
              <div
                key={point}
                className="rounded-2xl border border-border-light/70 bg-bg-light/80 px-4 py-3 text-sm text-text-charcoal dark:border-border-dark dark:bg-bg-dark/60 dark:text-text-silver-dark"
              >
                {point}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-border-light/70 bg-surface-white/92 p-8 shadow-[0_24px_90px_-36px_rgba(0,0,0,0.28)] backdrop-blur dark:border-border-dark/70 dark:bg-[#16130e]/90">
          <form className="grid gap-5" onSubmit={handleSubmit}>
            {!isLogin ? (
              <label
                htmlFor="auth-full-name"
                className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
              >
                <span>{copy.fullNameLabel}</span>
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
                  className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base text-text-charcoal outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
                  type="text"
                />
                <FieldError message={fieldErrors.fullName} />
              </label>
            ) : null}

            <label
              htmlFor="auth-email"
              className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
            >
              <span>{copy.emailLabel}</span>
                <input
                  id="auth-email"
                  data-testid="auth-email"
                  required
                  maxLength={FIELD_LIMITS.email}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setFieldErrors((current) => ({ ...current, email: undefined }))
                }}
                aria-invalid={fieldErrors.email ? 'true' : 'false'}
                className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base text-text-charcoal outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
                type="email"
                autoComplete="email"
              />
              <FieldError message={fieldErrors.email} />
            </label>

            <label
              htmlFor="auth-password"
              className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
            >
              <span>{copy.passwordLabel}</span>
                <input
                  id="auth-password"
                  data-testid="auth-password"
                  required
                  minLength={8}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setFieldErrors((current) => ({ ...current, password: undefined }))
                }}
                aria-invalid={fieldErrors.password ? 'true' : 'false'}
                className="h-12 rounded-2xl border border-border-light bg-surface-white px-4 text-base text-text-charcoal outline-none transition focus:border-primary dark:border-border-dark dark:bg-surface-dark dark:text-white"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <FieldError message={fieldErrors.password} />
            </label>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              data-testid="auth-submit"
              disabled={pending}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 dark:text-bg-dark"
            >
              {pending
                ? isLogin
                  ? `${copy.submitLogin}...`
                  : `${copy.submitSignup}...`
                : isLogin
                  ? copy.submitLogin
                  : copy.submitSignup}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-text-silver-light dark:text-text-silver-dark">
            <span>{isLogin ? copy.loginAltPrompt : copy.signupAltPrompt}</span>
            <button
              type="button"
              className="font-semibold text-primary"
              onClick={() => onSwitchMode(isLogin ? 'signup' : 'login')}
            >
              {isLogin ? copy.loginAltAction : copy.signupAltAction}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
