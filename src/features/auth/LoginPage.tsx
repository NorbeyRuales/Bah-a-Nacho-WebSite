import { useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowLeft, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from './AuthProvider'
import logoImg from '../../imports/image.png'

export function LoginPage({ onBack }: { onBack: () => void }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)
    const result = await signIn(email, password)
    setSubmitting(false)
    if (result.error) setError(result.error)
  }

  return (
    <main className="min-h-screen bg-[#060d1a] relative overflow-hidden flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-32 w-96 h-96 rounded-full bg-[#1565ff]/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 w-96 h-96 rounded-full bg-[#00b4d8]/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-2 text-sm text-[#93c5fd] hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Volver al sitio
        </button>

        <section className="glass border border-[#1e3a5f] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          <div className="text-center mb-7">
            <img src={logoImg} alt="Bahía Nacho" className="h-16 mx-auto object-contain mb-4" />
            <div className="inline-flex items-center gap-2 text-[#00b4d8] text-xs font-semibold uppercase tracking-widest mb-2">
              <ShieldCheck size={14} /> Acceso protegido
            </div>
            <h1 className="font-display text-3xl font-bold text-white">Inicia sesión</h1>
            <p className="text-[#64748b] text-sm mt-2">
              El sistema abrirá el área correspondiente a tu rol de usuario.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="account-email" className="block text-sm font-medium text-[#93c5fd] mb-1.5">Correo</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
                <input
                  id="account-email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  required
                  maxLength={254}
                  placeholder="tu@correo.com"
                  className="w-full bg-[#081426] border border-[#1e3a5f] focus:border-[#1565ff] rounded-xl pl-10 pr-4 py-3 text-white placeholder-[#64748b] outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="account-password" className="block text-sm font-medium text-[#93c5fd] mb-1.5">Contraseña</label>
              <div className="relative">
                <LockKeyhole size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" />
                <input
                  id="account-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  maxLength={128}
                  placeholder="Tu contraseña"
                  className="w-full bg-[#081426] border border-[#1e3a5f] focus:border-[#1565ff] rounded-xl pl-10 pr-11 py-3 text-white placeholder-[#64748b] outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(current => !current)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-800 bg-red-950/40 px-3.5 py-3 text-sm text-red-300">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !email.trim() || !password}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1565ff] hover:bg-[#1252d3] disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 text-white font-semibold transition-colors glow-blue"
            >
              {submitting && <LoaderCircle size={17} className="animate-spin" />}
              {submitting ? 'Verificando…' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="text-center text-xs text-[#64748b] mt-5">
            Clientes y personal autorizado ingresan desde este mismo acceso.
          </p>
        </section>
      </div>
    </main>
  )
}
