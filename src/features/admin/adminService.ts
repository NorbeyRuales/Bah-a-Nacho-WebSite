import { supabase } from '../../lib/supabase'

export type DashboardSnapshot = {
  stats: {
    products: number
    totalStock: number
    outOfStock: number
    lowStock: number
    inquiriesToday: number
    activeBrands: number
  }
  inventoryActivity: Array<{
    month: string
    entries: number
    exits: number
    net: number
  }>
  categoryDistribution: Array<{ name: string; value: number }>
  recentActivity: Array<{
    id: number
    action: 'insert' | 'update' | 'delete'
    table_name: string
    record_id: string | null
    changed_fields: string[] | null
    created_at: string
    user_email: string | null
  }>
  generatedAt: string
}

export type InventoryProduct = {
  id: string
  internalCode: string
  oemCode: string | null
  name: string
  brandName: string
  categoryName: string
  salePrice: number
  currencyCode: string
  stock: number
  availableStock: number
  minStock: number
  status: string
  primaryImageUrl: string | null
}

export type InventorySort = 'internal_code' | 'name' | 'brand_name' | 'category_name' | 'stock' | 'sale_price'

export type AuditEntry = {
  id: number
  action: 'insert' | 'update' | 'delete'
  tableName: string
  recordId: string | null
  changedFields: string[]
  createdAt: string
  ipAddress: string | null
  userEmail: string | null
}

export type ImportHistoryEntry = {
  id: string
  fileName: string
  status: string
  totalRows: number
  createdCount: number
  updatedCount: number
  errorCount: number
  createdAt: string
  completedAt: string | null
  userEmail: string | null
}

export type InventoryAlert = {
  productId: string
  internalCode: string
  productName: string
  stock: number
  minStock: number
  alertType: 'out_of_stock' | 'low_stock'
  updatedAt: string
}

function safeSearchTerm(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s._/-]/gu, '')
    .trim()
    .slice(0, 80)
}

function toNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const { data, error } = await supabase.rpc('admin_dashboard_snapshot')
  if (error || !data) throw error ?? new Error('Dashboard unavailable')

  const snapshot = data as Record<string, unknown>
  const stats = (snapshot.stats ?? {}) as Record<string, unknown>

  return {
    stats: {
      products: toNumber(stats.products),
      totalStock: toNumber(stats.totalStock),
      outOfStock: toNumber(stats.outOfStock),
      lowStock: toNumber(stats.lowStock),
      inquiriesToday: toNumber(stats.inquiriesToday),
      activeBrands: toNumber(stats.activeBrands),
    },
    inventoryActivity: ((snapshot.inventoryActivity ?? []) as Array<Record<string, unknown>>).map(row => ({
      month: String(row.month ?? ''),
      entries: toNumber(row.entries),
      exits: toNumber(row.exits),
      net: toNumber(row.net),
    })),
    categoryDistribution: ((snapshot.categoryDistribution ?? []) as Array<Record<string, unknown>>).map(row => ({
      name: String(row.name ?? ''),
      value: toNumber(row.value),
    })),
    recentActivity: (snapshot.recentActivity ?? []) as DashboardSnapshot['recentActivity'],
    generatedAt: String(snapshot.generatedAt ?? new Date().toISOString()),
  }
}

export async function getInventoryPage(options: {
  search: string
  sort: InventorySort
  ascending: boolean
  page: number
  pageSize: number
}): Promise<{ rows: InventoryProduct[]; count: number }> {
  const from = options.page * options.pageSize
  const to = from + options.pageSize - 1
  const search = safeSearchTerm(options.search)

  let query = supabase
    .from('product_catalog')
    .select(
      'id, internal_code, oem_code, name, brand_name, category_name, sale_price, currency_code, stock, available_stock, min_stock, status, primary_image_url',
      { count: 'exact' },
    )

  if (search) {
    const pattern = `%${search}%`
    query = query.or(`name.ilike.${pattern},internal_code.ilike.${pattern},oem_code.ilike.${pattern},brand_name.ilike.${pattern}`)
  }

  const { data, count, error } = await query
    .order(options.sort, { ascending: options.ascending, nullsFirst: false })
    .range(from, to)

  if (error) throw error

  return {
    count: count ?? 0,
    rows: (data ?? []).map(row => ({
      id: row.id,
      internalCode: row.internal_code,
      oemCode: row.oem_code,
      name: row.name,
      brandName: row.brand_name,
      categoryName: row.category_name,
      salePrice: toNumber(row.sale_price),
      currencyCode: row.currency_code,
      stock: toNumber(row.stock),
      availableStock: toNumber(row.available_stock),
      minStock: toNumber(row.min_stock),
      status: row.status,
      primaryImageUrl: row.primary_image_url,
    })),
  }
}

export async function getInventoryExport(): Promise<InventoryProduct[]> {
  const { data, error } = await supabase
    .from('product_catalog')
    .select('id, internal_code, oem_code, name, brand_name, category_name, sale_price, currency_code, stock, available_stock, min_stock, status, primary_image_url')
    .order('internal_code')
    .range(0, 9999)

  if (error) throw error

  return (data ?? []).map(row => ({
    id: row.id,
    internalCode: row.internal_code,
    oemCode: row.oem_code,
    name: row.name,
    brandName: row.brand_name,
    categoryName: row.category_name,
    salePrice: toNumber(row.sale_price),
    currencyCode: row.currency_code,
    stock: toNumber(row.stock),
    availableStock: toNumber(row.available_stock),
    minStock: toNumber(row.min_stock),
    status: row.status,
    primaryImageUrl: row.primary_image_url,
  }))
}

export async function getAuditPage(options: {
  search: string
  page: number
  pageSize: number
}): Promise<{ rows: AuditEntry[]; count: number }> {
  const from = options.page * options.pageSize
  const to = from + options.pageSize - 1
  const search = safeSearchTerm(options.search)

  let query = supabase
    .from('audit_logs')
    .select(
      'id, action, table_name, record_id, changed_fields, ip_address, created_at, user:profiles!audit_logs_user_id_fkey(email)',
      { count: 'exact' },
    )

  if (search) {
    const pattern = `%${search}%`
    query = query.or(`table_name.ilike.${pattern},action.ilike.${pattern},record_id.ilike.${pattern}`)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  return {
    count: count ?? 0,
    rows: (data ?? []).map(row => {
      const user = Array.isArray(row.user) ? row.user[0] : row.user
      return {
        id: row.id,
        action: row.action,
        tableName: row.table_name,
        recordId: row.record_id,
        changedFields: row.changed_fields ?? [],
        createdAt: row.created_at,
        ipAddress: row.ip_address,
        userEmail: user?.email ?? null,
      }
    }),
  }
}

export async function getImportHistory(): Promise<ImportHistoryEntry[]> {
  const { data, error } = await supabase
    .from('excel_imports')
    .select('id, file_name, status, total_rows, created_count, updated_count, error_count, created_at, completed_at, user:profiles!excel_imports_user_id_fkey(email)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  return (data ?? []).map(row => {
    const user = Array.isArray(row.user) ? row.user[0] : row.user
    return {
      id: row.id,
      fileName: row.file_name,
      status: row.status,
      totalRows: row.total_rows,
      createdCount: row.created_count,
      updatedCount: row.updated_count,
      errorCount: row.error_count,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      userEmail: user?.email ?? null,
    }
  })
}

export async function getInventoryAlerts(limit = 50): Promise<InventoryAlert[]> {
  const { data, error } = await supabase.rpc('admin_inventory_alerts', { max_rows: limit })
  if (error) throw error

  return (data ?? []).map((row: {
    product_id: string
    internal_code: string
    product_name: string
    stock: unknown
    min_stock: unknown
    alert_type: 'out_of_stock' | 'low_stock'
    updated_at: string
  }) => ({
    productId: row.product_id,
    internalCode: row.internal_code,
    productName: row.product_name,
    stock: toNumber(row.stock),
    minStock: toNumber(row.min_stock),
    alertType: row.alert_type,
    updatedAt: row.updated_at,
  }))
}
