import { supabase } from '../../lib/supabase'

const BUCKET = 'product-images'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMAGES_PER_PRODUCT = 12

export type ProductImage = {
  id: string
  productId: string
  url: string
  storagePath: string | null
  altText: string | null
  sortOrder: number
  isPrimary: boolean
}

type ValidatedImage = {
  file: File
  extension: 'jpg' | 'png' | 'webp' | 'avif'
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'
}

function mapImage(row: {
  id: string
  product_id: string
  url: string
  storage_path: string | null
  alt_text: string | null
  sort_order: number
  is_primary: boolean
}): ProductImage {
  return {
    id: row.id,
    productId: row.product_id,
    url: row.url,
    storagePath: row.storage_path,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    isPrimary: row.is_primary,
  }
}

function detectImageType(bytes: Uint8Array): Pick<ValidatedImage, 'extension' | 'mimeType'> | null {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (jpeg) return { extension: 'jpg', mimeType: 'image/jpeg' }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const png = bytes.length >= 8 && pngSignature.every((byte, index) => bytes[index] === byte)
  if (png) return { extension: 'png', mimeType: 'image/png' }

  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length))
  const webp = bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
  if (webp) return { extension: 'webp', mimeType: 'image/webp' }

  const avifBrand = bytes.length >= 12 ? ascii(8, 4) : ''
  const avif = bytes.length >= 12 && ascii(4, 4) === 'ftyp' && ['avif', 'avis'].includes(avifBrand)
  if (avif) return { extension: 'avif', mimeType: 'image/avif' }

  return null
}

async function validateImage(file: File): Promise<ValidatedImage> {
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name}: la imagen debe pesar menos de 10 MB.`)
  }

  const detected = detectImageType(new Uint8Array(await file.slice(0, 32).arrayBuffer()))
  if (!detected) {
    throw new Error(`${file.name}: formato no permitido. Usa JPG, PNG, WebP o AVIF.`)
  }

  return { file, ...detected }
}

export async function getProductImages(productId: string): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('id, product_id, url, storage_path, alt_text, sort_order, is_primary')
    .eq('product_id', productId)
    .order('is_primary', { ascending: false })
    .order('sort_order')

  if (error) throw error
  return (data ?? []).map(mapImage)
}

export async function setPrimaryProductImage(imageId: string) {
  const { error } = await supabase.rpc('set_product_primary_image', {
    target_image_id: imageId,
  })
  if (error) throw error
}

export async function uploadProductImages(options: {
  productId: string
  productName: string
  files: File[]
}) {
  const existing = await getProductImages(options.productId)
  if (options.files.length < 1) return existing
  if (existing.length + options.files.length > MAX_IMAGES_PER_PRODUCT) {
    throw new Error(`Cada producto admite máximo ${MAX_IMAGES_PER_PRODUCT} imágenes.`)
  }

  const validated = await Promise.all(options.files.map(validateImage))
  const uploaded: ProductImage[] = []

  for (let index = 0; index < validated.length; index += 1) {
    const image = validated[index]
    const path = `products/${options.productId}/${crypto.randomUUID()}.${image.extension}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, image.file, {
        contentType: image.mimeType,
        cacheControl: '31536000',
        upsert: false,
      })

    if (uploadError) throw new Error(`No fue posible subir ${image.file.name}.`)

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { data, error: insertError } = await supabase
      .from('product_images')
      .insert({
        product_id: options.productId,
        url: urlData.publicUrl,
        storage_bucket: BUCKET,
        storage_path: path,
        alt_text: options.productName.slice(0, 240),
        sort_order: existing.length + index,
        is_primary: false,
      })
      .select('id, product_id, url, storage_path, alt_text, sort_order, is_primary')
      .single()

    if (insertError || !data) {
      await supabase.storage.from(BUCKET).remove([path])
      throw new Error(`No fue posible registrar ${image.file.name}.`)
    }

    uploaded.push(mapImage(data))
  }

  if (!existing.some(image => image.isPrimary) && uploaded[0]) {
    await setPrimaryProductImage(uploaded[0].id)
  }

  return getProductImages(options.productId)
}

export async function deleteProductImage(image: ProductImage) {
  const { error: deleteError } = await supabase
    .from('product_images')
    .delete()
    .eq('id', image.id)

  if (deleteError) throw deleteError

  if (image.storagePath) {
    await supabase.storage.from(BUCKET).remove([image.storagePath])
  }

  const remaining = await getProductImages(image.productId)
  if (image.isPrimary && remaining[0]) {
    await setPrimaryProductImage(remaining[0].id)
    return getProductImages(image.productId)
  }

  return remaining
}
