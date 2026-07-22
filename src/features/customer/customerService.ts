import { supabase } from '../../lib/supabase'

export type CustomerPortalSnapshot = {
  customer: {
    id: string
    firstName: string
    lastName: string | null
    email: string | null
    phone: string | null
    company: string | null
  }
  stats: {
    inquiries: number
    activeQuotations: number
  }
  recentInquiries: Array<{
    id: string
    status: string
    message: string
    createdAt: string
  }>
  recentQuotations: Array<{
    id: string
    quoteNumber: number
    status: string
    total: number
    currencyCode: string
    createdAt: string
  }>
  generatedAt: string
}

function toNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export async function getCustomerPortalSnapshot(): Promise<CustomerPortalSnapshot> {
  const { data, error } = await supabase.rpc('customer_portal_snapshot')
  if (error || !data) throw error ?? new Error('Customer portal unavailable')

  const snapshot = toRecord(data)
  const customer = toRecord(snapshot.customer)
  const stats = toRecord(snapshot.stats)

  return {
    customer: {
      id: String(customer.id ?? ''),
      firstName: String(customer.firstName ?? ''),
      lastName: customer.lastName ? String(customer.lastName) : null,
      email: customer.email ? String(customer.email) : null,
      phone: customer.phone ? String(customer.phone) : null,
      company: customer.company ? String(customer.company) : null,
    },
    stats: {
      inquiries: toNumber(stats.inquiries),
      activeQuotations: toNumber(stats.activeQuotations),
    },
    recentInquiries: (Array.isArray(snapshot.recentInquiries) ? snapshot.recentInquiries : []).map(value => {
      const row = toRecord(value)
      return {
        id: String(row.id ?? ''),
        status: String(row.status ?? ''),
        message: String(row.message ?? ''),
        createdAt: String(row.created_at ?? ''),
      }
    }),
    recentQuotations: (Array.isArray(snapshot.recentQuotations) ? snapshot.recentQuotations : []).map(value => {
      const row = toRecord(value)
      return {
        id: String(row.id ?? ''),
        quoteNumber: toNumber(row.quote_number),
        status: String(row.status ?? ''),
        total: toNumber(row.total),
        currencyCode: String(row.currency_code ?? 'COP'),
        createdAt: String(row.created_at ?? ''),
      }
    }),
    generatedAt: String(snapshot.generatedAt ?? new Date().toISOString()),
  }
}
