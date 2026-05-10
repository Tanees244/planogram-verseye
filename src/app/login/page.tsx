'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'
import { loginWithEmailPassword } from '@verseye/auth-client'

// Custom UI Components for Planogram App
const Label = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
    {children}
  </label>
)

const Input = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${className}`}
  />
)

const Button = ({
  children,
  className = '',
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    disabled={disabled}
    className={`flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
)

const Checkbox = ({
  id,
  checked,
  onCheckedChange,
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) => (
  <input
    type="checkbox"
    id={id}
    checked={checked}
    onChange={(event) => onCheckedChange(event.target.checked)}
    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
  />
)

function Spinner() {
  return <div className="w-5 h-5 border-2 border-t-2 border-t-white border-gray-200 rounded-full animate-spin" />
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [rememberMe, setRememberMe] = useState<boolean>(false)

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)

    const result = await loginWithEmailPassword({ email, password })

    if (!result.ok) {
      toast.error(result.message ?? 'Invalid credentials')
      setLoading(false)
      return
    }

    toast.success(result.message ?? 'Signed in successfully')
    router.push('/')
    setLoading(false)
  }

  return (
        <div className="min-h-screen flex bg-white text-primary">
            <Toaster position="top-right" />
            {/* Left Side - Form */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 mb-6">
                            <Image src="/images/login-logo.svg" alt="Logo" width={100} height={100} />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Welcome Back</h1>
                        <p className="mt-2 text-sm text-slate-500">
                            Enter your credentials to access your account
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-11 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 h-11 border border-slate-200 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="remember"
                                    checked={rememberMe}
                                    onCheckedChange={(checked) => setRememberMe(checked)}
                                />
                                <label
                                    htmlFor="remember"
                                    className="text-sm font-medium text-slate-600 cursor-pointer"
                                >
                                    Remember me
                                </label>
                            </div>
                            <button
                                type="button"
                                className="text-sm font-medium text-teal-600 hover:underline"
                            >
                                Forgot password?
                            </button>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 bg-[#002952] hover:bg-[#001f3d] text-white flex items-center justify-center transition-colors font-semibold"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <Spinner />
                                    <span>Signing In...</span>
                                </div>
                            ) : (
                                'Sign In'
                            )}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-slate-500">
                        Don't have an account?{' '}
                        <button className="font-medium text-teal-600 hover:underline">
                            Sign up
                        </button>
                    </p>

                    <div className="pt-6 border-t border-slate-100">
                        <p className="text-center text-xs text-slate-400">
                            Powered by <span className="font-semibold text-slate-600">QBS Co.</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:flex lg:flex-1 relative overflow-hidden bg-primary">
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-80"
                    style={{ backgroundImage: "url('/images/login-right-ban.svg')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#002952]/80 via-teal-900/60 to-primary/80" />

                <div className="relative z-10 flex items-center justify-center p-12">
                    <div className="max-w-md text-white">
                        <h2 className="text-4xl font-bold mb-6">
                            AI-Powered Business Intelligence
                        </h2>
                        <p className="text-lg text-white/90 mb-8">
                            Leverage advanced analytics and machine learning to gain insights,
                            automate processes, and make data-driven decisions.
                        </p>
                        <div className="space-y-4">
                            {[
                                'Real-time Analytics & Monitoring',
                                'Intelligent Automation',
                                'Predictive Insights',
                            ].map((feature) => (
                                <div key={feature} className="flex items-center space-x-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                                        <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="text-white/90">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
