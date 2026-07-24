import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  ImagePlus,
  LockKeyhole,
  Package,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'
import { getInventoryPage, type InventoryProduct } from './adminService'
import {
  deleteProductImage,
  getProductImages,
  setPrimaryProductImage,
  uploadProductImages,
  type ProductImage,
} from './productImageService'

const FALLBACK_IMAGE = '/bahia-nacho-favicon.png'

export function ProductImageManager({
  canManage,
  onCatalogChanged,
}: {
  canManage: boolean
  onCatalogChanged: () => Promise<void> | void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setProductsLoading(true)
      setError(null)
      void getInventoryPage({
        search: query,
        sort: 'name',
        ascending: true,
        page: 0,
        pageSize: 50,
      })
        .then(result => {
          if (active) setProducts(result.rows)
        })
        .catch(() => {
          if (active) setError('No fue posible consultar los productos.')
        })
        .finally(() => {
          if (active) setProductsLoading(false)
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])

  const loadImages = useCallback(async (product: InventoryProduct) => {
    setImagesLoading(true)
    setError(null)
    try {
      setImages(await getProductImages(product.id))
    } catch {
      setError('No fue posible consultar las imágenes del producto.')
    } finally {
      setImagesLoading(false)
    }
  }, [])

  const selectProduct = (product: InventoryProduct) => {
    setSelectedProduct(product)
    setSuccess(null)
    void loadImages(product)
  }

  const uploadFiles = async (files: File[]) => {
    if (!selectedProduct || files.length === 0 || !canManage) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      setImages(await uploadProductImages({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        files,
      }))
      setSuccess(`${files.length} ${files.length === 1 ? 'imagen agregada' : 'imágenes agregadas'} correctamente.`)
      await onCatalogChanged()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No fue posible subir las imágenes.')
    } finally {
      setSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const makePrimary = async (image: ProductImage) => {
    if (!selectedProduct || !canManage || image.isPrimary) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await setPrimaryProductImage(image.id)
      await loadImages(selectedProduct)
      setSuccess('Imagen principal actualizada.')
      await onCatalogChanged()
    } catch {
      setError('No fue posible cambiar la imagen principal.')
    } finally {
      setSaving(false)
    }
  }

  const removeImage = async (image: ProductImage) => {
    if (!canManage || !window.confirm('¿Eliminar esta imagen del producto?')) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      setImages(await deleteProductImage(image))
      setSuccess('Imagen eliminada.')
      await onCatalogChanged()
    } catch {
      setError('No fue posible eliminar la imagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {!canManage && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-800/60 bg-yellow-900/15 p-4 text-sm text-yellow-200">
          <LockKeyhole size={18} />
          Tu rol permite consultar productos, pero no modificar sus imágenes.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-800 bg-red-900/20 p-4 text-sm text-red-300" role="alert">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-green-800 bg-green-900/20 p-4 text-sm text-green-300">
          <CheckCircle size={18} /> {success}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="glass overflow-hidden rounded-xl border border-[#1e3a5f]">
          <div className="border-b border-[#1e3a5f] p-4">
            <h3 className="font-display font-bold text-white">Seleccionar producto</h3>
            <div className="relative mt-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Código, nombre, marca…"
                className="w-full rounded-lg border border-[#1e3a5f] bg-[#081426] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-[#1565ff]"
              />
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            {productsLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-[#64748b]">
                <RefreshCw size={15} className="animate-spin" /> Cargando productos…
              </div>
            ) : products.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#64748b]">No se encontraron productos.</div>
            ) : products.map(product => (
              <button
                key={product.id}
                type="button"
                onClick={() => selectProduct(product)}
                className={`flex w-full items-center gap-3 border-b border-[#1e3a5f]/60 p-3 text-left transition-colors ${
                  selectedProduct?.id === product.id ? 'bg-[#1565ff]/15' : 'hover:bg-white/[0.03]'
                }`}
              >
                <img
                  src={product.primaryImageUrl ?? FALLBACK_IMAGE}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg bg-[#0a1628] object-cover"
                  onError={event => { event.currentTarget.src = FALLBACK_IMAGE }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{product.name}</span>
                  <span className="mt-0.5 block font-mono text-xs text-[#64748b]">{product.internalCode} · {product.brandName}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="glass min-h-[480px] rounded-xl border border-[#1e3a5f] p-5">
          {!selectedProduct ? (
            <div className="flex min-h-[430px] flex-col items-center justify-center text-center text-[#64748b]">
              <Package size={42} className="mb-3 opacity-40" />
              <p className="font-semibold text-white">Selecciona un producto</p>
              <p className="mt-1 text-sm">Aquí podrás agregar, ordenar y elegir su fotografía principal.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1e3a5f] pb-4">
                <div>
                  <p className="font-mono text-xs text-[#00b4d8]">{selectedProduct.internalCode}</p>
                  <h3 className="mt-1 font-display text-xl font-bold text-white">{selectedProduct.name}</h3>
                  <p className="mt-1 text-xs text-[#64748b]">{images.length} de 12 imágenes</p>
                </div>
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={saving || images.length >= 12}
                      className="flex items-center gap-2 rounded-lg bg-[#1565ff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1252d3] disabled:opacity-50"
                    >
                      {saving ? <RefreshCw size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                      Agregar imágenes
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      multiple
                      className="hidden"
                      onChange={event => void uploadFiles(Array.from(event.target.files ?? []))}
                    />
                  </>
                )}
              </div>

              {imagesLoading ? (
                <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-[#64748b]">
                  <RefreshCw size={16} className="animate-spin" /> Consultando imágenes…
                </div>
              ) : images.length === 0 ? (
                <button
                  type="button"
                  onClick={() => canManage && fileInputRef.current?.click()}
                  className="mt-5 flex min-h-72 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#1e3a5f] text-center hover:border-[#1565ff]"
                >
                  <Upload size={34} className="mb-3 text-[#00b4d8]" />
                  <span className="font-semibold text-white">Este producto aún no tiene imágenes</span>
                  <span className="mt-1 text-xs text-[#64748b]">JPG, PNG, WebP o AVIF · máximo 10 MB por imagen</span>
                </button>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map(image => (
                    <article key={image.id} className="overflow-hidden rounded-xl border border-[#1e3a5f] bg-[#081426]">
                      <div className="relative aspect-[4/3]">
                        <img src={image.url} alt={image.altText ?? selectedProduct.name} className="h-full w-full object-cover" />
                        {image.isPrimary && (
                          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[#1565ff] px-2 py-1 text-xs font-semibold text-white">
                            <Star size={12} className="fill-white" /> Principal
                          </span>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex gap-2 p-3">
                          <button
                            type="button"
                            onClick={() => void makePrimary(image)}
                            disabled={saving || image.isPrimary}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#1e3a5f] px-2 py-2 text-xs text-[#93c5fd] hover:border-[#1565ff] hover:text-white disabled:opacity-40"
                          >
                            <Star size={13} /> Hacer principal
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeImage(image)}
                            disabled={saving}
                            className="rounded-lg border border-red-900/80 p-2 text-red-400 hover:bg-red-900/20 disabled:opacity-40"
                            aria-label="Eliminar imagen"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
