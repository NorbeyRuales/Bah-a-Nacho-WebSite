import { supabase } from '../../lib/supabase'

export type CatalogProduct = {
  id: string
  code: string
  oemCode: string
  name: string
  category: string
  brand: string
  compatibility: string[]
  price: number
  currencyCode: string
  stock: number
  minStock: number
  image: string
  images: string[]
  description: string
  specs: Record<string, string>
  available: boolean
  featured: boolean
  weight: string
  location: string
}

type CatalogRow = {
  id: string
  internal_code: string
  oem_code: string | null
  manufacturer_code: string | null
  name: string
  description: string | null
  category_name: string
  subcategory_name: string | null
  brand_name: string
  sale_price: unknown
  currency_code: string
  stock: unknown
  available_stock: unknown
  min_stock: unknown
  status: string
  weight_kg: unknown
  length_cm: unknown
  width_cm: unknown
  height_cm: unknown
  primary_image_url: string | null
}

type ProductImageRow = {
  product_id: string
  url: string
  sort_order: number
  is_primary: boolean
}

const FALLBACK_IMAGE = '/bahia-nacho-favicon.png'

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function getImagesByProduct(productIds: string[]) {
  const images = new Map<string, string[]>()

  for (let start = 0; start < productIds.length; start += 100) {
    const chunk = productIds.slice(start, start + 100)
    const { data, error } = await supabase
      .from('product_images')
      .select('product_id, url, sort_order, is_primary')
      .in('product_id', chunk)
      .order('is_primary', { ascending: false })
      .order('sort_order')

    if (error) throw error

    for (const row of (data ?? []) as ProductImageRow[]) {
      const productImages = images.get(row.product_id) ?? []
      productImages.push(row.url)
      images.set(row.product_id, productImages)
    }
  }

  return images
}

export async function getPublicCatalog(): Promise<CatalogProduct[]> {
  const { data, error } = await supabase
    .from('product_catalog')
    .select(
      'id, internal_code, oem_code, manufacturer_code, name, description, category_name, subcategory_name, brand_name, sale_price, currency_code, stock, available_stock, min_stock, status, weight_kg, length_cm, width_cm, height_cm, primary_image_url',
    )
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .range(0, 1999)

  if (error) throw error

  const rows = (data ?? []) as CatalogRow[]
  const imagesByProduct = await getImagesByProduct(rows.map(row => row.id))

  return rows.map((row, index) => {
    const allImages = imagesByProduct.get(row.id) ?? []
    const primaryImage = row.primary_image_url ?? allImages[0] ?? FALLBACK_IMAGE
    const dimensions = [row.length_cm, row.width_cm, row.height_cm]
      .map(toNumber)
      .filter(value => value > 0)
    const specs: Record<string, string> = {
      Marca: row.brand_name,
      Categoría: row.category_name,
    }

    if (row.subcategory_name) specs.Subcategoría = row.subcategory_name
    if (row.oem_code) specs.OEM = row.oem_code
    if (row.manufacturer_code) specs.Fabricante = row.manufacturer_code
    if (dimensions.length === 3) specs.Dimensiones = `${dimensions.join(' × ')} cm`

    return {
      id: row.id,
      code: row.internal_code,
      oemCode: row.oem_code ?? row.manufacturer_code ?? 'Sin referencia',
      name: row.name,
      category: row.category_name,
      brand: row.brand_name,
      compatibility: [],
      price: toNumber(row.sale_price),
      currencyCode: row.currency_code,
      stock: toNumber(row.stock),
      minStock: toNumber(row.min_stock),
      image: primaryImage,
      images: allImages.filter(image => image !== primaryImage),
      description: row.description ?? 'Producto disponible para consulta. Comunícate con nosotros para confirmar especificaciones y compatibilidad.',
      specs,
      available: toNumber(row.available_stock) > 0,
      featured: index < 4,
      weight: toNumber(row.weight_kg) > 0 ? `${toNumber(row.weight_kg)} kg` : 'No informado',
      location: 'Consulta con nuestro equipo',
    }
  })
}
