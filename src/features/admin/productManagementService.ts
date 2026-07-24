import { supabase } from '../../lib/supabase'

export type EditorOption = {
  id: string
  name: string
  isActive: boolean
}

export type SubcategoryOption = EditorOption & {
  categoryId: string
  parentId: string | null
}

export type WarehouseLocationOption = {
  id: string
  code: string
  description: string | null
  warehouseId: string
  warehouseCode: string
  warehouseName: string
}

export type ProductEditorOptions = {
  brands: EditorOption[]
  categories: EditorOption[]
  subcategories: SubcategoryOption[]
  locations: WarehouseLocationOption[]
}

export type ProductStockBalance = {
  locationId: string
  quantity: number
  reservedQuantity: number
}

export type ProductEditorRecord = {
  id: string
  internalCode: string
  oemCode: string
  manufacturerCode: string
  name: string
  description: string
  categoryId: string
  subcategoryId: string
  brandId: string
  purchasePrice: number
  salePrice: number
  currencyCode: string
  taxRate: number
  minStock: number
  maxStock: number | null
  status: 'active' | 'inactive' | 'discontinued'
  weightKg: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  balances: ProductStockBalance[]
}

export type ProductSaveInput = Omit<ProductEditorRecord, 'id' | 'balances'> & {
  id: string | null
  inventoryLocationId: string | null
  inventoryTargetStock: number | null
}

export type ProductSaveResult = {
  productId: string
  created: boolean
  internalCode: string
  totalStock: number
  locationId: string | null
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export async function getProductEditorOptions(): Promise<ProductEditorOptions> {
  const [brandsResult, categoriesResult, subcategoriesResult, locationsResult] = await Promise.all([
    supabase
      .from('brands')
      .select('id, name, is_active')
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, is_active')
      .order('name'),
    supabase
      .from('subcategories')
      .select('id, category_id, parent_id, name, is_active')
      .order('sort_order')
      .order('name'),
    supabase
      .from('warehouse_locations')
      .select(
        'id, code, description, warehouse:warehouses!warehouse_locations_warehouse_id_fkey(id, code, name, is_active)',
      )
      .eq('is_active', true)
      .order('code'),
  ])

  const error = brandsResult.error
    ?? categoriesResult.error
    ?? subcategoriesResult.error
    ?? locationsResult.error
  if (error) throw error

  return {
    brands: (brandsResult.data ?? []).map(row => ({
      id: row.id,
      name: String(row.name),
      isActive: row.is_active,
    })),
    categories: (categoriesResult.data ?? []).map(row => ({
      id: row.id,
      name: String(row.name),
      isActive: row.is_active,
    })),
    subcategories: (subcategoriesResult.data ?? []).map(row => ({
      id: row.id,
      categoryId: row.category_id,
      parentId: row.parent_id,
      name: String(row.name),
      isActive: row.is_active,
    })),
    locations: (locationsResult.data ?? []).flatMap(row => {
      const warehouse = firstRelation(row.warehouse)
      if (!warehouse || !warehouse.is_active) return []

      return [{
        id: row.id,
        code: String(row.code),
        description: row.description,
        warehouseId: warehouse.id,
        warehouseCode: String(warehouse.code),
        warehouseName: warehouse.name,
      }]
    }),
  }
}

export async function getProductEditorRecord(productId: string): Promise<ProductEditorRecord> {
  const [productResult, balancesResult] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, internal_code, oem_code, manufacturer_code, name, description, category_id, subcategory_id, brand_id, purchase_price, sale_price, currency_code, tax_rate, min_stock, max_stock, status, weight_kg, length_cm, width_cm, height_cm',
      )
      .eq('id', productId)
      .single(),
    supabase
      .from('inventory_balances')
      .select('location_id, quantity, reserved_quantity')
      .eq('product_id', productId),
  ])

  if (productResult.error || !productResult.data) {
    throw productResult.error ?? new Error('Producto no encontrado.')
  }
  if (balancesResult.error) throw balancesResult.error

  const product = productResult.data
  const status = product.status === 'inactive' || product.status === 'discontinued'
    ? product.status
    : 'active'

  return {
    id: product.id,
    internalCode: String(product.internal_code),
    oemCode: product.oem_code ? String(product.oem_code) : '',
    manufacturerCode: product.manufacturer_code ? String(product.manufacturer_code) : '',
    name: product.name,
    description: product.description ?? '',
    categoryId: product.category_id,
    subcategoryId: product.subcategory_id ?? '',
    brandId: product.brand_id,
    purchasePrice: toNumber(product.purchase_price),
    salePrice: toNumber(product.sale_price),
    currencyCode: product.currency_code,
    taxRate: toNumber(product.tax_rate),
    minStock: toNumber(product.min_stock),
    maxStock: product.max_stock === null ? null : toNumber(product.max_stock),
    status,
    weightKg: product.weight_kg === null ? null : toNumber(product.weight_kg),
    lengthCm: product.length_cm === null ? null : toNumber(product.length_cm),
    widthCm: product.width_cm === null ? null : toNumber(product.width_cm),
    heightCm: product.height_cm === null ? null : toNumber(product.height_cm),
    balances: (balancesResult.data ?? []).map(row => ({
      locationId: row.location_id,
      quantity: toNumber(row.quantity),
      reservedQuantity: toNumber(row.reserved_quantity),
    })),
  }
}

export async function saveProduct(input: ProductSaveInput): Promise<ProductSaveResult> {
  const { data, error } = await supabase.rpc('admin_save_product', {
    target_product_id: input.id,
    product_internal_code: input.internalCode,
    product_oem_code: input.oemCode || null,
    product_manufacturer_code: input.manufacturerCode || null,
    product_name: input.name,
    product_description: input.description || null,
    product_category_id: input.categoryId,
    product_subcategory_id: input.subcategoryId || null,
    product_brand_id: input.brandId,
    product_purchase_price: input.purchasePrice,
    product_sale_price: input.salePrice,
    product_currency_code: input.currencyCode,
    product_tax_rate: input.taxRate,
    product_min_stock: input.minStock,
    product_max_stock: input.maxStock,
    product_status: input.status,
    product_weight_kg: input.weightKg,
    product_length_cm: input.lengthCm,
    product_width_cm: input.widthCm,
    product_height_cm: input.heightCm,
    inventory_location_id: input.inventoryLocationId,
    inventory_target_stock: input.inventoryTargetStock,
  })

  if (error) throw error

  const result = (data ?? {}) as Record<string, unknown>
  return {
    productId: String(result.productId ?? ''),
    created: result.created === true,
    internalCode: String(result.internalCode ?? input.internalCode),
    totalStock: toNumber(result.totalStock),
    locationId: typeof result.locationId === 'string' ? result.locationId : null,
  }
}
