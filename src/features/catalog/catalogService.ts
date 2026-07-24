import { supabase } from '../../lib/supabase'

export type ProductAvailability = 'available' | 'low_stock' | 'out_of_stock'

export type CatalogProduct = {
  id: string
  oemCode: string
  name: string
  category: string
  brand: string
  compatibility: string[]
  price: number
  currencyCode: string
  availability: ProductAvailability
  image: string
  images: string[]
  description: string
  specs: Record<string, string>
  featured: boolean
}

type CatalogRow = {
  product_id: string
  reference_code: string | null
  product_name: string
  product_slug: string
  product_description: string | null
  category_name: string
  subcategory_name: string | null
  brand_name: string
  sale_price: unknown
  currency_code: string
  availability: string
  image_urls: unknown
  compatibility_labels: unknown
}

const FALLBACK_IMAGE = '/bahia-nacho-favicon.png'

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizeAvailability(value: string): ProductAvailability {
  if (value === 'low_stock' || value === 'out_of_stock') return value
  return 'available'
}

export async function getPublicCatalog(): Promise<CatalogProduct[]> {
  const { data, error } = await supabase.rpc('get_public_catalog')
  if (error) throw error

  return ((data ?? []) as CatalogRow[]).map((row, index) => {
    const allImages = toStringArray(row.image_urls)
    const primaryImage = allImages[0] ?? FALLBACK_IMAGE
    const reference = row.reference_code?.trim() || 'Sin referencia'
    const specs: Record<string, string> = {
      Marca: row.brand_name,
      Categoría: row.category_name,
      Referencia: reference,
    }

    if (row.subcategory_name) specs.Subcategoría = row.subcategory_name

    return {
      id: row.product_id,
      oemCode: reference,
      name: row.product_name,
      category: row.category_name,
      brand: row.brand_name,
      compatibility: toStringArray(row.compatibility_labels),
      price: toNumber(row.sale_price),
      currencyCode: row.currency_code,
      availability: normalizeAvailability(row.availability),
      image: primaryImage,
      images: allImages.slice(1),
      description: row.product_description?.trim()
        || 'Producto disponible para consulta. Comunícate con nosotros para confirmar especificaciones y compatibilidad.',
      specs,
      featured: index < 4,
    }
  })
}
