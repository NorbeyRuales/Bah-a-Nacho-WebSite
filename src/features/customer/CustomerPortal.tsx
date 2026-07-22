import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  LoaderCircle,
  LogOut,
  Mail,
  MessageCircle,
  PackageSearch,
  Phone,
  RefreshCw,
  UserRound,
} from 'lucide-react'
import type { UserProfile } from '../auth/AuthProvider'
import { getCustomerPortalSnapshot, type CustomerPortalSnapshot } from './customerService'
import logoImg from '../../imports/image.png'

const INQUIRY_STATUS: Record<string, string> = {
  new: 'Nueva',
  in_progress: 'En revisión',
  answered: 'Respondida',
  closed: 'Cerrada',
  spam: 'Descartada',
}

const QUOTATION_STATUS: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date)
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function CustomerPortal({
  profile,
  onCatalog,
  onPublic,
  onSignOut,
}: {
  profile: UserProfile
  onCatalog: () => void
  onPublic: () => void
  onSignOut: () => void
}) {
  const [snapshot, setSnapshot] = useState<CustomerPortalSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSnapshot = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSnapshot(await getCustomerPortalSnapshot())
    } catch {
      setError('No fue posible cargar tu información. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  const displayName = useMemo(() => {
    if (snapshot?.customer.firstName) {
      return `${snapshot.customer.firstName} ${snapshot.customer.lastName ?? ''}`.trim()
    }
    return `${profile.firstName} ${profile.lastName}`.trim() || profile.email
  }, [profile, snapshot])

  return (
    <div className="min-h-screen bg-[#060d1a] text-white">
      <header className="glass border-b border-[#1e3a5f] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto h-16 px-4 flex items-center justify-between gap-4">
          <button type="button" onClick={onPublic} aria-label="Volver al sitio público">
            <img src={logoImg} alt="Bahía Nacho" className="h-11 object-contain" />
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onPublic} className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm text-[#93c5fd] hover:text-white">
              <ArrowLeft size={15} /> Ver sitio
            </button>
            <button type="button" onClick={onSignOut} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-950/40">
              <LogOut size={15} /> Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-[#00b4d8] text-xs font-semibold uppercase tracking-widest mb-2">Portal de clientes</div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">Hola, {displayName}</h1>
            <p className="text-[#64748b] mt-2">Consulta tus solicitudes y cotizaciones asociadas a esta cuenta.</p>
          </div>
          <button type="button" onClick={onCatalog} className="inline-flex items-center justify-center gap-2 bg-[#1565ff] hover:bg-[#1252d3] px-4 py-2.5 rounded-xl text-sm font-semibold">
            <PackageSearch size={17} /> Explorar catálogo
          </button>
        </section>

        {loading && (
          <div className="glass border border-[#1e3a5f] rounded-2xl min-h-64 flex items-center justify-center gap-3 text-[#93c5fd]" role="status">
            <LoaderCircle size={20} className="animate-spin text-[#1565ff]" /> Cargando tu cuenta…
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="glass border border-red-800/70 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-3 text-red-300">
            <AlertTriangle size={20} />
            <span className="flex-1 text-sm">{error}</span>
            <button type="button" onClick={loadSnapshot} className="inline-flex items-center gap-2 text-sm text-white">
              <RefreshCw size={15} /> Reintentar
            </button>
          </div>
        )}

        {!loading && snapshot && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass border border-[#1e3a5f] rounded-2xl p-5">
                <div className="w-10 h-10 rounded-xl bg-[#1565ff]/15 text-[#00b4d8] flex items-center justify-center mb-4"><UserRound size={20} /></div>
                <h2 className="font-display font-bold text-lg">Mi perfil</h2>
                <div className="mt-3 space-y-2 text-sm text-[#93c5fd]">
                  <div className="flex items-center gap-2"><Mail size={14} className="text-[#64748b]" /> {snapshot.customer.email ?? profile.email}</div>
                  <div className="flex items-center gap-2"><Phone size={14} className="text-[#64748b]" /> {snapshot.customer.phone ?? 'Teléfono no registrado'}</div>
                </div>
              </div>
              <div className="glass border border-[#1e3a5f] rounded-2xl p-5">
                <div className="w-10 h-10 rounded-xl bg-[#00b4d8]/15 text-[#00b4d8] flex items-center justify-center mb-4"><MessageCircle size={20} /></div>
                <div className="text-[#64748b] text-sm">Consultas registradas</div>
                <div className="font-display text-4xl font-bold mt-2">{snapshot.stats.inquiries}</div>
              </div>
              <div className="glass border border-[#1e3a5f] rounded-2xl p-5">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 text-violet-300 flex items-center justify-center mb-4"><FileText size={20} /></div>
                <div className="text-[#64748b] text-sm">Cotizaciones activas</div>
                <div className="font-display text-4xl font-bold mt-2">{snapshot.stats.activeQuotations}</div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass border border-[#1e3a5f] rounded-2xl p-5">
                <h2 className="font-display font-bold text-lg mb-4">Consultas recientes</h2>
                {snapshot.recentInquiries.length === 0 ? (
                  <p className="text-[#64748b] text-sm py-6 text-center">Todavía no tienes consultas vinculadas.</p>
                ) : snapshot.recentInquiries.map(inquiry => (
                  <article key={inquiry.id} className="py-3 border-b border-[#1e3a5f] last:border-0">
                    <div className="flex items-center justify-between gap-3 text-xs mb-1">
                      <span className="text-[#00b4d8]">{INQUIRY_STATUS[inquiry.status] ?? inquiry.status}</span>
                      <time className="text-[#64748b]">{formatDate(inquiry.createdAt)}</time>
                    </div>
                    <p className="text-[#93c5fd] text-sm line-clamp-2">{inquiry.message}</p>
                  </article>
                ))}
              </div>

              <div className="glass border border-[#1e3a5f] rounded-2xl p-5">
                <h2 className="font-display font-bold text-lg mb-4">Cotizaciones recientes</h2>
                {snapshot.recentQuotations.length === 0 ? (
                  <p className="text-[#64748b] text-sm py-6 text-center">Todavía no tienes cotizaciones vinculadas.</p>
                ) : snapshot.recentQuotations.map(quotation => (
                  <article key={quotation.id} className="py-3 border-b border-[#1e3a5f] last:border-0 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-white text-sm font-medium">Cotización #{quotation.quoteNumber}</div>
                      <div className="text-[#64748b] text-xs mt-1">{QUOTATION_STATUS[quotation.status] ?? quotation.status} · {formatDate(quotation.createdAt)}</div>
                    </div>
                    <div className="text-[#00b4d8] text-sm font-semibold">{formatCurrency(quotation.total, quotation.currencyCode)}</div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
