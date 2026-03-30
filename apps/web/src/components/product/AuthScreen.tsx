import { useState, type FormEvent } from 'react'
import { forgotPassword, type LoginInput, type RegisterInput } from '../../lib/api'
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
  mode: 'login' | 'signup' | 'forgot-password'
  copy: ProductUiCopy['auth']
  pending: boolean
  error: string | null
  onLogin: (input: LoginInput) => Promise<void>
  onSignup: (input: RegisterInput) => Promise<void>
  onSwitchMode: (mode: 'login' | 'signup' | 'forgot-password') => void
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <span className="text-xs font-medium text-red-600 dark:text-red-300">{message}</span>
}

interface InlineFeedback {
  tone: 'success' | 'error'
  message: string
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
    passwordPlaceholder: string
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
    passwordPlaceholder: 'At least 8 characters',
  },
  vi: {
    joinedBy: '\u0110\u00e3 c\u00f3 h\u01a1n 5.000 \u0111\u1ed9i ng\u0169 s\u1eed d\u1ee5ng',
    quote:
      '"M\u1ed9t lu\u1ed3ng review t\u1ed1t l\u00e0 khi \u0111\u1ed9i ng\u0169 nh\u00ecn ra \u0111i\u1ec1u quan tr\u1ecdng v\u00e0 h\u00e0nh \u0111\u1ed9ng nhanh h\u01a1n."',
    credit: 'Ghi ch\u00fa t\u1eeb \u0111\u1ed9i v\u1eadn h\u00e0nh',
    divider: 'Ho\u1eb7c ti\u1ebfp t\u1ee5c v\u1edbi email',
    privacy: 'Ch\u00ednh s\u00e1ch b\u1ea3o m\u1eadt',
    terms: '\u0110i\u1ec1u kho\u1ea3n d\u1ecbch v\u1ee5',
    showPassword: 'Hi\u1ec7n m\u1eadt kh\u1ea9u',
    hidePassword: '\u1ea8n m\u1eadt kh\u1ea9u',
    passwordPlaceholder: 'T\u1ed1i thi\u1ec3u 8 k\u00fd t\u1ef1',
  },
  ja: {
    joinedBy: '5,000\u4ee5\u4e0a\u306e\u30c1\u30fc\u30e0\u304c\u5229\u7528\u4e2d',
    quote:
      '\u300c\u3088\u3044\u30ec\u30d3\u30e5\u30fc\u904b\u7528\u3068\u306f\u3001\u30c1\u30fc\u30e0\u304c\u672c\u5f53\u306b\u91cd\u8981\u306a\u3053\u3068\u3092\u3059\u3070\u3084\u304f\u898b\u3064\u3051\u3089\u308c\u308b\u3053\u3068\u3067\u3059\u3002\u300d',
    credit: 'Sentify \u30aa\u30da\u30ec\u30fc\u30b7\u30e7\u30f3\u30ce\u30fc\u30c8',
    divider: '\u307e\u305f\u306f\u30e1\u30fc\u30eb\u3067\u7d9a\u884c',
    privacy: '\u30d7\u30e9\u30a4\u30d0\u30b7\u30fc\u30dd\u30ea\u30b7\u30fc',
    terms: '\u5229\u7528\u898f\u7d04',
    showPassword: '\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u8868\u793a',
    hidePassword: '\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u96a0\u3059',
    passwordPlaceholder: '8\u6587\u5b57\u4ee5\u4e0a',
  },
}

const authFormCopy: Record<
  Language,
  {
    loginTitle: string
    signupTitle: string
    loginDescription: string
    signupDescription: string
    fullNameLabel: string
    emailLabel: string
    passwordLabel: string
    submitLogin: string
    submitSignup: string
    loginAltPrompt: string
    signupAltPrompt: string
    loginAltAction: string
    signupAltAction: string
    forgotPasswordToggle: string
    forgotPasswordTitle: string
    forgotPasswordDescription: string
    forgotPasswordEmailLabel: string
    forgotPasswordSubmit: string
    forgotPasswordCancel: string
    forgotPasswordSuccess: string
    forgotPasswordError: string
    validation: {
      fullNameRequired: string
      fullNameTooLong: string
      emailRequired: string
      emailInvalid: string
      passwordRequired: string
      passwordTooShort: string
    }
  }
> = {
  en: {
    loginTitle: 'Return to the dashboard.',
    signupTitle: 'Start with one restaurant and one review source.',
    loginDescription:
      'Log in to continue reviewing sources, signals, and what should be fixed next.',
    signupDescription:
      'Create your account, connect one restaurant, save one Google Maps URL, and move straight into the dashboard.',
    fullNameLabel: 'Full name',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    submitLogin: 'Log in',
    submitSignup: 'Create account',
    loginAltPrompt: 'Need an account?',
    signupAltPrompt: 'Already have an account?',
    loginAltAction: 'Sign up',
    signupAltAction: 'Log in',
    forgotPasswordToggle: 'Forgot password?',
    forgotPasswordTitle: 'Reset your password',
    forgotPasswordDescription:
      'Enter the email on the account. Sentify will send reset instructions if the account exists.',
    forgotPasswordEmailLabel: 'Account email',
    forgotPasswordSubmit: 'Send reset link',
    forgotPasswordCancel: 'Cancel',
    forgotPasswordSuccess: 'If the email is registered, a reset link has been sent.',
    forgotPasswordError: 'Unable to send reset link.',
    validation: {
      fullNameRequired: 'Enter your full name.',
      fullNameTooLong: 'Full name must be 100 characters or fewer.',
      emailRequired: 'Enter your email address.',
      emailInvalid: 'Enter a valid email address.',
      passwordRequired: 'Enter your password.',
      passwordTooShort: 'Password must be at least 8 characters.',
    },
  },
  vi: {
    loginTitle: 'Quay lại bảng điều hành.',
    signupTitle: 'Bắt đầu với một nhà hàng và một nguồn review.',
    loginDescription:
      'Đăng nhập để tiếp tục xem nguồn review, tín hiệu và việc cần ưu tiên xử lý.',
    signupDescription:
      'Tạo tài khoản, kết nối một nhà hàng, lưu một URL Google Maps, rồi đi thẳng vào bảng điều hành.',
    fullNameLabel: 'Họ và tên',
    emailLabel: 'Email',
    passwordLabel: 'Mật khẩu',
    submitLogin: 'Đăng nhập',
    submitSignup: 'Tạo tài khoản',
    loginAltPrompt: 'Chưa có tài khoản?',
    signupAltPrompt: 'Đã có tài khoản?',
    loginAltAction: 'Đăng ký',
    signupAltAction: 'Đăng nhập',
    forgotPasswordToggle: 'Quên mật khẩu?',
    forgotPasswordTitle: 'Đặt lại mật khẩu',
    forgotPasswordDescription:
      'Nhập email của tài khoản. Sentify sẽ gửi hướng dẫn đặt lại nếu email đó tồn tại trong hệ thống.',
    forgotPasswordEmailLabel: 'Email tài khoản',
    forgotPasswordSubmit: 'Gửi liên kết đặt lại',
    forgotPasswordCancel: 'Đóng',
    forgotPasswordSuccess: 'Nếu email đã được đăng ký, một liên kết đặt lại đã được gửi.',
    forgotPasswordError: 'Không thể gửi liên kết đặt lại.',
    validation: {
      fullNameRequired: 'Hãy nhập họ và tên.',
      fullNameTooLong: 'Họ và tên không được vượt quá 100 ký tự.',
      emailRequired: 'Hãy nhập địa chỉ email.',
      emailInvalid: 'Email không hợp lệ.',
      passwordRequired: 'Hãy nhập mật khẩu.',
      passwordTooShort: 'Mật khẩu phải có ít nhất 8 ký tự.',
    },
  },
  ja: {
    loginTitle: 'ダッシュボードに戻る。',
    signupTitle: '1店舗、1つのレビューソースから始める。',
    loginDescription:
      'ログインすると、レビューソース、シグナル、次に直すべきことの確認にすぐ戻れます。',
    signupDescription:
      'アカウントを作成し、1店舗を接続してGoogle MapsのURLを保存すると、そのままダッシュボードに進めます。',
    fullNameLabel: '氏名',
    emailLabel: 'メールアドレス',
    passwordLabel: 'パスワード',
    submitLogin: 'ログイン',
    submitSignup: 'アカウントを作成',
    loginAltPrompt: 'アカウントをお持ちではないですか？',
    signupAltPrompt: 'すでにアカウントをお持ちですか？',
    loginAltAction: '登録',
    signupAltAction: 'ログイン',
    forgotPasswordToggle: 'パスワードを忘れた場合',
    forgotPasswordTitle: 'パスワードを再設定する',
    forgotPasswordDescription:
      'アカウントのメールアドレスを入力してください。登録済みであれば、Sentify が再設定手順を送信します。',
    forgotPasswordEmailLabel: 'アカウントのメール',
    forgotPasswordSubmit: '再設定リンクを送信',
    forgotPasswordCancel: '閉じる',
    forgotPasswordSuccess: '登録済みのメールであれば、再設定リンクを送信しました。',
    forgotPasswordError: '再設定リンクを送信できませんでした。',
    validation: {
      fullNameRequired: '氏名を入力してください。',
      fullNameTooLong: '氏名は100文字以内で入力してください。',
      emailRequired: 'メールアドレスを入力してください。',
      emailInvalid: '有効なメールアドレスを入力してください。',
      passwordRequired: 'パスワードを入力してください。',
      passwordTooShort: 'パスワードは8文字以上で入力してください。',
    },
  },
}

export function AuthScreen({
  language,
  mode,
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
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotEmailError, setForgotEmailError] = useState<string | undefined>(undefined)
  const [forgotPending, setForgotPending] = useState(false)
  const [forgotFeedback, setForgotFeedback] = useState<InlineFeedback | null>(null)

  const isLogin = mode === 'login'
  const isSignup = mode === 'signup'
  const isForgotPassword = mode === 'forgot-password'
  const scene = authSceneCopy[language]
  const authCopy = authFormCopy[language]
  const authTitle = isForgotPassword
    ? authCopy.forgotPasswordTitle
    : isLogin
      ? authCopy.loginTitle
      : authCopy.signupTitle
  const authDescription = isForgotPassword
    ? authCopy.forgotPasswordDescription
    : isLogin
      ? authCopy.loginDescription
      : authCopy.signupDescription
  const compactSignupLayout = isSignup && !isForgotPassword
  const authPanelClass =
    'flex w-full flex-col items-center justify-start overflow-y-auto bg-surface-white px-6 pt-[6.5rem] pb-10 dark:bg-surface-dark/96 md:px-12 md:pt-28 md:pb-12 lg:w-5/12 lg:px-16 lg:pt-28 lg:pb-12'
  const authContainerClass = compactSignupLayout ? 'w-full max-w-md lg:max-w-[28rem]' : 'w-full max-w-md'
  const authHeaderClass = compactSignupLayout ? 'mb-7 text-center lg:mb-6 lg:text-left' : 'mb-10 text-center lg:text-left'
  const socialButtonsClass = compactSignupLayout ? 'mb-6 grid grid-cols-2 gap-3' : 'mb-8 grid grid-cols-2 gap-4'
  const dividerClass = compactSignupLayout ? 'relative mb-6' : 'relative mb-8'
  const formClass = compactSignupLayout ? 'space-y-4' : 'space-y-5'
  const authInputClass = `w-full rounded-xl border-none bg-[#f7f3ee] px-5 text-base text-text-charcoal outline-none transition-all placeholder:text-outline/50 focus:ring-2 focus:ring-primary/20 dark:bg-bg-dark/55 dark:text-white dark:placeholder:text-text-silver-dark/50 ${
    compactSignupLayout ? 'py-3.5' : 'py-4'
  }`
  const authPasswordInputClass = `${authInputClass} pr-14`
  const socialButtonClass = `flex items-center justify-center gap-3 rounded-xl bg-[#ebe8e3] px-4 text-sm font-medium text-text-charcoal transition-colors hover:bg-[#e6e2dd] dark:bg-bg-dark/70 dark:text-white dark:hover:bg-surface-highlight/30 ${
    compactSignupLayout ? 'py-2.5' : 'py-3'
  }`
  const submitButtonClass = `inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-primary to-[#fa7025] px-6 text-sm font-bold tracking-tight text-white shadow-[0_18px_38px_-16px_rgba(235,122,28,0.34)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_22px_44px_-16px_rgba(235,122,28,0.42)] disabled:cursor-not-allowed disabled:opacity-70 dark:text-bg-dark ${
    compactSignupLayout ? 'py-4 lg:py-3.5' : 'py-5'
  }`
  const footerClass = compactSignupLayout ? 'mt-8 text-center lg:mt-6' : 'mt-12 text-center'
  const legalLinksClass = compactSignupLayout ? 'mt-8 flex items-center justify-center gap-6 lg:mt-6' : 'mt-12 flex items-center justify-center gap-6'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isForgotPassword) {
      return
    }

    const trimmedFullName = normalizeText(fullName)
    const normalizedEmail = normalizeEmail(email)
    const nextErrors: FieldErrors = {}

    if (!isLogin) {
      if (!trimmedFullName) {
        nextErrors.fullName = authCopy.validation.fullNameRequired
      } else if (trimmedFullName.length > FIELD_LIMITS.fullName) {
        nextErrors.fullName = authCopy.validation.fullNameTooLong
      }
    }

    if (!normalizedEmail) {
      nextErrors.email = authCopy.validation.emailRequired
    } else if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = authCopy.validation.emailInvalid
    }

    if (!password) {
      nextErrors.password = authCopy.validation.passwordRequired
    } else if (!isLogin && password.length < FIELD_LIMITS.passwordMin) {
      nextErrors.password = authCopy.validation.passwordTooShort
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

  async function handleForgotPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedForgotEmail = normalizeEmail(forgotEmail)

    if (!normalizedForgotEmail) {
      setForgotEmailError(authCopy.validation.emailRequired)
      setForgotFeedback(null)
      return
    }

    if (!isValidEmail(normalizedForgotEmail)) {
      setForgotEmailError(authCopy.validation.emailInvalid)
      setForgotFeedback(null)
      return
    }

    setForgotEmailError(undefined)
    setForgotFeedback(null)
    setForgotPending(true)

    try {
      const result = await forgotPassword({ email: normalizedForgotEmail })

      setForgotEmail(normalizedForgotEmail)
      setForgotFeedback({
        tone: 'success',
        message: result.message || authCopy.forgotPasswordSuccess,
      })
    } catch (error) {
      setForgotFeedback({
        tone: 'error',
        message: error instanceof Error && error.message ? error.message : authCopy.forgotPasswordError,
      })
    } finally {
      setForgotPending(false)
    }
  }

  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden bg-bg-light dark:bg-bg-dark">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(235,122,28,0.1),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(235,122,28,0.08),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_34%)]"></div>

      <div className="relative z-10 flex min-h-screen overflow-hidden">
        <section className="relative hidden min-h-screen items-end overflow-hidden p-12 lg:flex lg:w-7/12">
          <div className="absolute inset-0 z-0">
            <img
              className="h-full w-full object-cover grayscale-[20%] brightness-[0.85]"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7p3TZKZ4bBDiObnP8KCEDNMmReCwiJKwP0TMThZWoKaWloVbTrw2-AfTQEpv8qrwfxLLl5c0FiQ5sD_KTjvPqZlnqwFxIWM-qZegZdWxC1kOQVwT3ZTir_dBwyoPcRlp-O-j5wsyTBJbMf3Lwwo5J8CxMY1mjAivGV9Yszd1jKI1SMxm2MjMmKKK8FxmnHnn4xtyUekibeSbqhJ_kyVgGTjoJKvGvwFrSV8io0-Mw9CnalPUtuVRftf9lHE4BA7w6NDdnFjJuTA"
              alt=""
            />
            <div className="absolute inset-0 bg-gradient-to-t from-on-background/60 via-transparent to-transparent"></div>
          </div>

          <div className="relative z-10 w-full max-w-2xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-surface-white/10 px-4 py-2 outline outline-1 outline-white/20 backdrop-blur-md">
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
              <span className="px-2 text-sm font-medium tracking-tight text-white">
                {scene.joinedBy}
              </span>
            </div>

            <blockquote className="font-serif text-4xl italic leading-snug tracking-tight text-white">
              {scene.quote}
            </blockquote>
            <cite className="mt-4 block text-xs not-italic uppercase tracking-widest text-white/80">
              {scene.credit}
            </cite>
          </div>
        </section>

        <section className={authPanelClass}>
          <div className={authContainerClass}>
            <header className={authHeaderClass}>
              <h1 className="font-serif text-3xl tracking-tight text-[#8a3c10] dark:text-[#f2dfc7] md:text-4xl">
                {authTitle}
              </h1>
              <p className="mt-3 text-on-surface-variant dark:text-text-silver-dark">
                {authDescription}
              </p>
            </header>

            {!isForgotPassword ? (
              <>
                <div className={socialButtonsClass}>
                  <button
                    type="button"
                    className={socialButtonClass}
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
                    className={socialButtonClass}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-.5-.24-1.03-.37-1.58-.37-.58 0-1.12.14-1.63.41-1 .51-1.9.5-2.95-.45-3.15-3.15-2.66-8.72 1.05-10.7 1.77-.96 3.46-.38 4.45.02.4.15.7.26.9.26.2 0 .5-.11.9-.26 1.34-.54 3.22-.98 4.75.52.32.32 2.62 3.05 1.83 6.94-.15.4-.33.84-.54 1.28-.96 1.95-1.88 3.65-3.1 3.95h-.01zM12.03 7.25c-.02-2.23 1.54-4.22 3.65-4.5.21 2.31-1.46 4.44-3.65 4.5z" fill="currentColor"></path>
                    </svg>
                    <span>Apple</span>
                  </button>
                </div>

                <div className={dividerClass}>
                  <div className="absolute inset-0 flex items-center">
                    <div className="h-px w-full bg-border-light dark:bg-border-dark"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest">
                    <span className="bg-surface-white px-4 text-text-silver-light dark:bg-surface-dark dark:text-text-silver-dark">
                      {scene.divider}
                    </span>
                  </div>
                </div>

                <form className={formClass} onSubmit={handleSubmit}>
                  {!isLogin ? (
                    <label
                      htmlFor="auth-full-name"
                      className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
                    >
                      <span className="ml-1 text-xs uppercase tracking-[0.16em] text-text-silver-light dark:text-text-silver-dark">
                        {authCopy.fullNameLabel}
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
                        className={authInputClass}
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
                      {authCopy.emailLabel}
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
                      className={authInputClass}
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
                      {authCopy.passwordLabel}
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
                        className={authPasswordInputClass}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        placeholder={scene.passwordPlaceholder}
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

                  {isLogin ? (
                    <div className="-mt-1 flex justify-end">
                      <button
                        type="button"
                        className="text-sm font-semibold text-primary transition hover:text-[#cf5c1d] hover:underline"
                        onClick={() => onSwitchMode('forgot-password')}
                      >
                        {authCopy.forgotPasswordToggle}
                      </button>
                    </div>
                  ) : null}

                  {error ? (
                    <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                      {error}
                    </div>
                  ) : null}

                  <div className={compactSignupLayout ? 'pt-3' : 'pt-4'}>
                    <button
                      type="submit"
                      disabled={pending}
                      className={submitButtonClass}
                    >
                      {pending
                        ? isLogin
                          ? `${authCopy.submitLogin}...`
                          : `${authCopy.submitSignup}...`
                        : isLogin
                          ? authCopy.submitLogin
                          : authCopy.submitSignup}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <form className="space-y-5" onSubmit={handleForgotPasswordSubmit} noValidate>
                <div className="flex justify-start">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-[#cf5c1d]"
                    onClick={() => onSwitchMode('login')}
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    {authCopy.submitLogin}
                  </button>
                </div>

                <label
                  htmlFor="forgot-password-email"
                  className="grid gap-2 text-sm font-semibold text-text-charcoal dark:text-white"
                >
                  <span className="ml-1 text-xs uppercase tracking-[0.16em] text-text-silver-light dark:text-text-silver-dark">
                    {authCopy.forgotPasswordEmailLabel}
                  </span>
                  <input
                    id="forgot-password-email"
                    required
                    maxLength={FIELD_LIMITS.email}
                    value={forgotEmail}
                    onChange={(event) => {
                      setForgotEmail(event.target.value)
                      setForgotEmailError(undefined)
                      setForgotFeedback(null)
                    }}
                    aria-invalid={forgotEmailError ? 'true' : 'false'}
                    className={authInputClass}
                    type="email"
                    autoComplete="email"
                    placeholder="owner@sentify.app"
                  />
                  <FieldError message={forgotEmailError} />
                </label>

                {forgotFeedback ? (
                  <div
                    aria-live="polite"
                    className={`rounded-[1rem] border px-4 py-3 text-sm leading-6 ${
                      forgotFeedback.tone === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200'
                    }`}
                  >
                    {forgotFeedback.message}
                  </div>
                ) : null}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={forgotPending}
                    className={submitButtonClass}
                  >
                    {forgotPending
                      ? `${authCopy.forgotPasswordSubmit}...`
                      : authCopy.forgotPasswordSubmit}
                  </button>
                </div>
              </form>
            )}

            <footer className={footerClass}>
              {!isForgotPassword ? (
                <p className="text-sm text-text-silver-light dark:text-text-silver-dark">
                  {isLogin ? authCopy.loginAltPrompt : authCopy.signupAltPrompt}
                  <button
                    type="button"
                    className="ml-1 font-bold text-primary hover:underline"
                    onClick={() => onSwitchMode(isLogin ? 'signup' : 'login')}
                  >
                    {isLogin ? authCopy.loginAltAction : authCopy.signupAltAction}
                  </button>
                </p>
              ) : null}
              <div className={legalLinksClass}>
                <span className="text-[10px] uppercase tracking-widest text-text-silver-light/80 dark:text-text-silver-dark/80">
                  {scene.privacy}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-text-silver-light/80 dark:text-text-silver-dark/80">
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
