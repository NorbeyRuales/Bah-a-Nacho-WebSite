import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  FilePenLine,
  ImagePlus,
  Images,
  Info,
  LockKeyhole,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  Trash2,
  Upload,
  Warehouse,
} from 'lucide-react'
import { getInventoryPage, type InventoryProduct } from './adminService'
import {
  deleteProductImage,
  getProductImages,
  setPrimaryProductImage,
  uploadProductImages,
  type ProductImage,
} from './productImageService'
import {
  getProductEditorOptions,
  getProductEditorRecord,
  saveProduct,
  type ProductEditorOptions,
  type ProductEditorRecord,
} from './productManagementService'
import {
  parseBoundedString,
  useAdminSessionState,
} from './useAdminSessionState'

const FALLBACK_IMAGE = '/bahia-nacho-favicon.png'

type EditorTab = 'data' | 'images'

type ProductDraft = {
  id: string | null
  internalCode: string
  oemCode: string
  manufacturerCode: string
  name: string
  description: string
  categoryId: string
  subcategoryId: string
  brandId: string
  purchasePrice: string
  salePrice: string
  currencyCode: string
  taxRate: string
  minStock: string
  maxStock: string
  status: 'active' | 'inactive' | 'discontinued'
  weightKg: string
  lengthCm: string
  widthCm: string
  heightCm: string
  inventoryLocationId: string
  inventoryTargetStock: string
}

const PRODUCT_DRAFT_STRING_FIELDS = [
  'internalCode',
  'oemCode',
  'manufacturerCode',
  'name',
  'description',
  'categoryId',
  'subcategoryId',
  'brandId',
  'purchasePrice',
  'salePrice',
  'currencyCode',
  'taxRate',
  'minStock',
  'maxStock',
  'weightKg',
  'lengthCm',
  'widthCm',
  'heightCm',
  'inventoryLocationId',
  'inventoryTargetStock',
] as const

function parseProductDraft(value: unknown): ProductDraft | null | undefined {
  if (value === null) return null
  if (!value || typeof value !== 'object') return undefined
  const draft = value as Record<string, unknown>
  if (
    (draft.id !== null && typeof draft.id !== 'string')
    || (draft.status !== 'active' && draft.status !== 'inactive' && draft.status !== 'discontinued')
    || PRODUCT_DRAFT_STRING_FIELDS.some(
      field => typeof draft[field] !== 'string' || (draft[field] as string).length > 5_000,
    )
  ) {
    return undefined
  }
  return draft as ProductDraft
}

function parseInventoryProduct(value: unknown): InventoryProduct | null | undefined {
  if (value === null) return null
  if (!value || typeof value !== 'object') return undefined
  const product = value as Record<string, unknown>
  const requiredStrings = [
    'id',
    'internalCode',
    'name',
    'brandName',
    'categoryName',
    'currencyCode',
    'status',
  ]
  const requiredNumbers = [
    'salePrice',
    'stock',
    'availableStock',
    'minStock',
  ]

  if (
    requiredStrings.some(
      field => typeof product[field] !== 'string' || (product[field] as string).length > 2_048,
    )
    || requiredNumbers.some(
      field => typeof product[field] !== 'number' || !Number.isFinite(product[field]),
    )
    || (product.oemCode !== null && typeof product.oemCode !== 'string')
    || (product.primaryImageUrl !== null && typeof product.primaryImageUrl !== 'string')
  ) {
    return undefined
  }
  return product as InventoryProduct
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#93c5fd]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-[#64748b]">{hint}</span>}
    </label>
  )
}

const inputClassName = 'w-full rounded-lg border border-[#1e3a5f] bg-[#081426] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#1565ff] disabled:cursor-not-allowed disabled:opacity-55'

function optionalNumber(value: string, label: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label} debe ser un número válido.`)
  return parsed
}

function requiredNumber(value: string, label: string) {
  const parsed = optionalNumber(value, label)
  if (parsed === null) throw new Error(`${label} es obligatorio.`)
  return parsed
}

function numberText(value: number | null) {
  return value === null ? '' : String(value)
}

function defaultLocationId(options: ProductEditorOptions) {
  return options.locations.find(location =>
    location.warehouseCode.toUpperCase() === 'MAIN'
    && location.code.toUpperCase() === 'GENERAL',
  )?.id ?? options.locations[0]?.id ?? ''
}

function createBlankDraft(options: ProductEditorOptions): ProductDraft {
  return {
    id: null,
    internalCode: '',
    oemCode: '',
    manufacturerCode: '',
    name: '',
    description: '',
    categoryId: options.categories.find(category => category.isActive)?.id ?? '',
    subcategoryId: '',
    brandId: options.brands.find(brand => brand.isActive)?.id ?? '',
    purchasePrice: '0',
    salePrice: '0',
    currencyCode: 'COP',
    taxRate: '19',
    minStock: '0',
    maxStock: '',
    status: 'active',
    weightKg: '',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    inventoryLocationId: defaultLocationId(options),
    inventoryTargetStock: '0',
  }
}

function createDraft(record: ProductEditorRecord, options: ProductEditorOptions): ProductDraft {
  const preferredLocation = record.balances[0]?.locationId ?? defaultLocationId(options)
  const selectedBalance = record.balances.find(balance => balance.locationId === preferredLocation)

  return {
    id: record.id,
    internalCode: record.internalCode,
    oemCode: record.oemCode,
    manufacturerCode: record.manufacturerCode,
    name: record.name,
    description: record.description,
    categoryId: record.categoryId,
    subcategoryId: record.subcategoryId,
    brandId: record.brandId,
    purchasePrice: String(record.purchasePrice),
    salePrice: String(record.salePrice),
    currencyCode: record.currencyCode,
    taxRate: String(record.taxRate),
    minStock: String(record.minStock),
    maxStock: numberText(record.maxStock),
    status: record.status,
    weightKg: numberText(record.weightKg),
    lengthCm: numberText(record.lengthCm),
    widthCm: numberText(record.widthCm),
    heightCm: numberText(record.heightCm),
    inventoryLocationId: preferredLocation,
    inventoryTargetStock: String(selectedBalance?.quantity ?? 0),
  }
}

function ProductImagesEditor({
  product,
  canManage,
  onChanged,
}: {
  product: InventoryProduct
  canManage: boolean
  onChanged: () => Promise<void> | void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadImages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setImages(await getProductImages(product.id))
    } catch {
      setError('No fue posible consultar las imágenes del producto.')
    } finally {
      setLoading(false)
    }
  }, [product.id])

  useEffect(() => {
    void loadImages()
  }, [loadImages])

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0 || !canManage) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      setImages(await uploadProductImages({
        productId: product.id,
        productName: product.name,
        files,
      }))
      setSuccess(`${files.length} ${files.length === 1 ? 'imagen agregada' : 'imágenes agregadas'} correctamente.`)
      await onChanged()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No fue posible subir las imágenes.')
    } finally {
      setSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const makePrimary = async (image: ProductImage) => {
    if (!canManage || image.isPrimary) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await setPrimaryProductImage(image.id)
      await loadImages()
      setSuccess('Imagen principal actualizada.')
      await onChanged()
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
      await onChanged()
    } catch {
      setError('No fue posible eliminar la imagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-white">Fotografías del producto</h3>
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

      {loading ? (
        <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-[#64748b]">
          <RefreshCw size={16} className="animate-spin" /> Consultando imágenes…
        </div>
      ) : images.length === 0 ? (
        <button
          type="button"
          disabled={!canManage}
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-72 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#1e3a5f] text-center hover:border-[#1565ff] disabled:cursor-default disabled:hover:border-[#1e3a5f]"
        >
          <Upload size={34} className="mb-3 text-[#00b4d8]" />
          <span className="font-semibold text-white">Este producto aún no tiene imágenes</span>
          <span className="mt-1 text-xs text-[#64748b]">JPG, PNG, WebP o AVIF · máximo 10 MB por imagen</span>
        </button>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map(image => (
            <article key={image.id} className="overflow-hidden rounded-xl border border-[#1e3a5f] bg-[#081426]">
              <div className="relative aspect-[4/3]">
                <img src={image.url} alt={image.altText ?? product.name} className="h-full w-full object-cover" />
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
    </div>
  )
}

export function ProductImageManager({
  canManage,
  canManageStock,
  onCatalogChanged,
}: {
  canManage: boolean
  canManageStock: boolean
  onCatalogChanged: () => Promise<void> | void
}) {
  const [query, setQuery] = useAdminSessionState(
    'products.search',
    '',
    parseBoundedString(80),
  )
  const [reloadKey, setReloadKey] = useState(0)
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [selectedProduct, setSelectedProduct] =
    useAdminSessionState<InventoryProduct | null>(
      'products.selected',
      null,
      parseInventoryProduct,
    )
  const [options, setOptions] = useState<ProductEditorOptions | null>(null)
  const [record, setRecord] = useState<ProductEditorRecord | null>(null)
  const [draft, setDraft] = useAdminSessionState<ProductDraft | null>(
    'products.draft',
    null,
    parseProductDraft,
  )
  const [tab, setTab] = useAdminSessionState<EditorTab>(
    'products.tab',
    'data',
    value => (value === 'data' || value === 'images' ? value : undefined),
  )
  const [productsLoading, setProductsLoading] = useState(true)
  const [editorLoading, setEditorLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getProductEditorOptions()
      .then(nextOptions => {
        if (active) setOptions(nextOptions)
      })
      .catch(() => {
        if (active) setError('No fue posible cargar marcas, categorías y ubicaciones.')
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setProductsLoading(true)
      void getInventoryPage({
        search: query,
        sort: 'name',
        ascending: true,
        page: 0,
        pageSize: 100,
      })
        .then(result => {
          if (!active) return
          setProducts(result.rows)
          setSelectedProduct(current =>
            current ? result.rows.find(product => product.id === current.id) ?? current : null,
          )
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
  }, [query, reloadKey])

  useEffect(() => {
    if (!draft?.id || record?.id === draft.id) return
    let active = true
    setEditorLoading(true)

    void getProductEditorRecord(draft.id)
      .then(nextRecord => {
        if (active) setRecord(nextRecord)
      })
      .catch(() => {
        if (active) setError('No fue posible actualizar la ficha del producto.')
      })
      .finally(() => {
        if (active) setEditorLoading(false)
      })

    return () => {
      active = false
    }
  }, [draft?.id, record?.id])

  const filteredSubcategories = useMemo(
    () => options?.subcategories.filter(subcategory =>
      subcategory.categoryId === draft?.categoryId,
    ) ?? [],
    [draft?.categoryId, options?.subcategories],
  )

  const selectProduct = async (product: InventoryProduct) => {
    if (!options) return
    setSelectedProduct(product)
    setEditorLoading(true)
    setError(null)
    setSuccess(null)
    setTab('data')

    try {
      const nextRecord = await getProductEditorRecord(product.id)
      setRecord(nextRecord)
      setDraft(createDraft(nextRecord, options))
    } catch {
      setError('No fue posible cargar todos los datos del producto.')
    } finally {
      setEditorLoading(false)
    }
  }

  const startNewProduct = () => {
    if (!options || !canManage) return
    setSelectedProduct(null)
    setRecord(null)
    setDraft(createBlankDraft(options))
    setTab('data')
    setError(null)
    setSuccess(null)
  }

  const updateDraft = <Key extends keyof ProductDraft>(
    key: Key,
    value: ProductDraft[Key],
  ) => {
    setDraft(current => current ? { ...current, [key]: value } : current)
  }

  const changeCategory = (categoryId: string) => {
    setDraft(current => {
      if (!current) return current
      const subcategoryStillValid = options?.subcategories.some(
        subcategory =>
          subcategory.id === current.subcategoryId
          && subcategory.categoryId === categoryId,
      )
      return {
        ...current,
        categoryId,
        subcategoryId: subcategoryStillValid ? current.subcategoryId : '',
      }
    })
  }

  const changeLocation = (locationId: string) => {
    const balance = record?.balances.find(item => item.locationId === locationId)
    setDraft(current => current
      ? {
          ...current,
          inventoryLocationId: locationId,
          inventoryTargetStock: String(balance?.quantity ?? 0),
        }
      : current)
  }

  const saveCurrentProduct = async () => {
    if (!draft || !options || !canManage || saving) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      if (!/^[A-Za-z0-9._/-]{2,80}$/.test(draft.internalCode.trim())) {
        throw new Error('El código interno debe tener entre 2 y 80 caracteres válidos.')
      }
      if (draft.name.trim().length < 2) throw new Error('El nombre del producto es obligatorio.')
      if (!draft.brandId || !draft.categoryId) throw new Error('Selecciona la marca y la categoría.')

      const result = await saveProduct({
        id: draft.id,
        internalCode: draft.internalCode.trim(),
        oemCode: draft.oemCode.trim(),
        manufacturerCode: draft.manufacturerCode.trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId,
        brandId: draft.brandId,
        purchasePrice: requiredNumber(draft.purchasePrice, 'Precio de compra'),
        salePrice: requiredNumber(draft.salePrice, 'Precio de venta'),
        currencyCode: draft.currencyCode.trim().toUpperCase(),
        taxRate: requiredNumber(draft.taxRate, 'IVA'),
        minStock: requiredNumber(draft.minStock, 'Stock mínimo'),
        maxStock: optionalNumber(draft.maxStock, 'Stock máximo'),
        status: draft.status,
        weightKg: optionalNumber(draft.weightKg, 'Peso'),
        lengthCm: optionalNumber(draft.lengthCm, 'Largo'),
        widthCm: optionalNumber(draft.widthCm, 'Ancho'),
        heightCm: optionalNumber(draft.heightCm, 'Alto'),
        inventoryLocationId: canManageStock ? draft.inventoryLocationId || null : null,
        inventoryTargetStock: canManageStock
          ? requiredNumber(draft.inventoryTargetStock, 'Stock actual')
          : null,
      })

      const nextRecord = await getProductEditorRecord(result.productId)
      const brandName = options.brands.find(brand => brand.id === nextRecord.brandId)?.name ?? 'Sin marca'
      const categoryName = options.categories.find(category => category.id === nextRecord.categoryId)?.name ?? 'Otros'
      const nextSummary: InventoryProduct = {
        id: nextRecord.id,
        internalCode: nextRecord.internalCode,
        oemCode: nextRecord.oemCode || null,
        name: nextRecord.name,
        brandName,
        categoryName,
        salePrice: nextRecord.salePrice,
        currencyCode: nextRecord.currencyCode,
        stock: result.totalStock,
        availableStock: result.totalStock,
        minStock: nextRecord.minStock,
        status: nextRecord.status,
        primaryImageUrl: selectedProduct?.primaryImageUrl ?? null,
      }

      setRecord(nextRecord)
      setDraft(createDraft(nextRecord, options))
      setSelectedProduct(nextSummary)
      setSuccess(result.created ? 'Producto creado correctamente.' : 'Producto actualizado correctamente.')
      setReloadKey(value => value + 1)
      await onCatalogChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No fue posible guardar el producto.')
    } finally {
      setSaving(false)
    }
  }

  const notifyImagesChanged = async () => {
    setReloadKey(value => value + 1)
    await onCatalogChanged()
  }

  return (
    <div className="space-y-5">
      {!canManage && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-800/60 bg-yellow-900/15 p-4 text-sm text-yellow-200">
          <LockKeyhole size={18} />
          Tu rol permite consultar productos, pero no modificarlos.
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-[#1565ff]/30 bg-[#1565ff]/10 p-4 text-sm text-[#b7d4ff]">
        <Info size={18} className="mt-0.5 shrink-0 text-[#00b4d8]" />
        <p>
          Los cambios manuales no afectan la importación. El código interno identifica el producto frente al ERP
          y queda protegido después de crearlo. Nombre, referencia, marca, categoría, precios y stock pueden volver
          a actualizarse con el próximo Excel.
        </p>
      </div>

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
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display font-bold text-white">Productos</h3>
              {canManage && (
                <button
                  type="button"
                  onClick={startNewProduct}
                  disabled={!options}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1565ff] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1252d3] disabled:opacity-50"
                >
                  <Plus size={14} /> Nuevo
                </button>
              )}
            </div>
            <div className="relative mt-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                maxLength={80}
                placeholder="Código, nombre, referencia o marca…"
                className="w-full rounded-lg border border-[#1e3a5f] bg-[#081426] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-[#1565ff]"
              />
            </div>
            <p className="mt-2 text-[11px] text-[#64748b]">Se muestran hasta 100 resultados. Usa la búsqueda para localizar cualquier producto.</p>
          </div>

          <div className="max-h-[760px] overflow-y-auto">
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
                onClick={() => void selectProduct(product)}
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
                  <span className="mt-0.5 block truncate font-mono text-xs text-[#64748b]">
                    {product.internalCode} · {product.brandName}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="glass min-h-[560px] rounded-xl border border-[#1e3a5f] p-5">
          {editorLoading ? (
            <div className="flex min-h-[520px] items-center justify-center gap-2 text-sm text-[#64748b]">
              <RefreshCw size={16} className="animate-spin" /> Cargando ficha completa…
            </div>
          ) : !draft ? (
            <div className="flex min-h-[520px] flex-col items-center justify-center text-center text-[#64748b]">
              <Package size={42} className="mb-3 opacity-40" />
              <p className="font-semibold text-white">Selecciona un producto</p>
              <p className="mt-1 max-w-sm text-sm">
                Podrás editar sus datos, ajustar el inventario y administrar sus fotografías.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1e3a5f] pb-4">
                <div>
                  <p className="font-mono text-xs text-[#00b4d8]">{draft.id ? draft.internalCode : 'NUEVO PRODUCTO'}</p>
                  <h3 className="mt-1 font-display text-xl font-bold text-white">
                    {draft.name || 'Producto sin nombre'}
                  </h3>
                </div>
                <div className="flex rounded-lg border border-[#1e3a5f] bg-[#081426] p-1">
                  <button
                    type="button"
                    onClick={() => setTab('data')}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${
                      tab === 'data' ? 'bg-[#1565ff] text-white' : 'text-[#93c5fd] hover:text-white'
                    }`}
                  >
                    <FilePenLine size={14} /> Datos
                  </button>
                  <button
                    type="button"
                    onClick={() => draft.id && setTab('images')}
                    disabled={!draft.id}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                      tab === 'images' ? 'bg-[#1565ff] text-white' : 'text-[#93c5fd] hover:text-white'
                    }`}
                  >
                    <Images size={14} /> Imágenes
                  </button>
                </div>
              </div>

              {tab === 'images' && selectedProduct ? (
                <div className="mt-5">
                  <ProductImagesEditor
                    product={selectedProduct}
                    canManage={canManage}
                    onChanged={notifyImagesChanged}
                  />
                </div>
              ) : (
                <form
                  className="mt-5 space-y-6"
                  onSubmit={event => {
                    event.preventDefault()
                    void saveCurrentProduct()
                  }}
                >
                  <div>
                    <h4 className="mb-3 text-sm font-bold text-white">Identificación y catálogo</h4>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Field
                        label="Código interno"
                        hint={draft.id ? 'Protegido porque es la clave utilizada por el Excel.' : 'Debe coincidir con el código que utilizará el ERP.'}
                      >
                        <input
                          value={draft.internalCode}
                          onChange={event => updateDraft('internalCode', event.target.value)}
                          disabled={!canManage || Boolean(draft.id)}
                          maxLength={80}
                          className={inputClassName}
                          required
                        />
                      </Field>
                      <Field label="Referencia / código OEM">
                        <input
                          value={draft.oemCode}
                          onChange={event => updateDraft('oemCode', event.target.value)}
                          disabled={!canManage}
                          maxLength={120}
                          className={inputClassName}
                        />
                      </Field>
                      <Field label="Código del fabricante">
                        <input
                          value={draft.manufacturerCode}
                          onChange={event => updateDraft('manufacturerCode', event.target.value)}
                          disabled={!canManage}
                          maxLength={120}
                          className={inputClassName}
                        />
                      </Field>
                      <Field label="Nombre">
                        <input
                          value={draft.name}
                          onChange={event => updateDraft('name', event.target.value)}
                          disabled={!canManage}
                          maxLength={240}
                          className={inputClassName}
                          required
                        />
                      </Field>
                      <Field label="Marca">
                        <select
                          value={draft.brandId}
                          onChange={event => updateDraft('brandId', event.target.value)}
                          disabled={!canManage}
                          className={inputClassName}
                          required
                        >
                          <option value="">Seleccionar marca</option>
                          {options?.brands.map(brand => (
                            <option key={brand.id} value={brand.id}>
                              {brand.name}{brand.isActive ? '' : ' (inactiva)'}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Categoría">
                        <select
                          value={draft.categoryId}
                          onChange={event => changeCategory(event.target.value)}
                          disabled={!canManage}
                          className={inputClassName}
                          required
                        >
                          <option value="">Seleccionar categoría</option>
                          {options?.categories.map(category => (
                            <option key={category.id} value={category.id}>
                              {category.name}{category.isActive ? '' : ' (inactiva)'}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Subcategoría">
                        <select
                          value={draft.subcategoryId}
                          onChange={event => updateDraft('subcategoryId', event.target.value)}
                          disabled={!canManage || !draft.categoryId}
                          className={inputClassName}
                        >
                          <option value="">Sin subcategoría</option>
                          {filteredSubcategories.map(subcategory => (
                            <option key={subcategory.id} value={subcategory.id}>
                              {subcategory.name}{subcategory.isActive ? '' : ' (inactiva)'}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Estado">
                        <select
                          value={draft.status}
                          onChange={event => updateDraft(
                            'status',
                            event.target.value as ProductDraft['status'],
                          )}
                          disabled={!canManage}
                          className={inputClassName}
                        >
                          <option value="active">Activo y visible</option>
                          <option value="inactive">Inactivo</option>
                          <option value="discontinued">Descontinuado</option>
                        </select>
                      </Field>
                      <Field label="Moneda">
                        <input
                          value={draft.currencyCode}
                          onChange={event => updateDraft('currencyCode', event.target.value.toUpperCase())}
                          disabled={!canManage}
                          minLength={3}
                          maxLength={3}
                          className={inputClassName}
                          required
                        />
                      </Field>
                    </div>
                    <div className="mt-4">
                      <Field label="Descripción">
                        <textarea
                          value={draft.description}
                          onChange={event => updateDraft('description', event.target.value)}
                          disabled={!canManage}
                          maxLength={5000}
                          rows={4}
                          className={inputClassName}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="border-t border-[#1e3a5f] pt-5">
                    <h4 className="mb-3 text-sm font-bold text-white">Precios e inventario</h4>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Precio de compra">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.purchasePrice}
                          onChange={event => updateDraft('purchasePrice', event.target.value)}
                          disabled={!canManage}
                          className={inputClassName}
                          required
                        />
                      </Field>
                      <Field label="Precio de venta">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.salePrice}
                          onChange={event => updateDraft('salePrice', event.target.value)}
                          disabled={!canManage}
                          className={inputClassName}
                          required
                        />
                      </Field>
                      <Field label="IVA (%)">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={draft.taxRate}
                          onChange={event => updateDraft('taxRate', event.target.value)}
                          disabled={!canManage}
                          className={inputClassName}
                          required
                        />
                      </Field>
                      <Field label="Stock mínimo">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={draft.minStock}
                          onChange={event => updateDraft('minStock', event.target.value)}
                          disabled={!canManage}
                          className={inputClassName}
                          required
                        />
                      </Field>
                      <Field label="Stock máximo">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={draft.maxStock}
                          onChange={event => updateDraft('maxStock', event.target.value)}
                          disabled={!canManage}
                          className={inputClassName}
                          placeholder="Sin límite"
                        />
                      </Field>
                      <Field label="Ubicación de inventario">
                        <select
                          value={draft.inventoryLocationId}
                          onChange={event => changeLocation(event.target.value)}
                          disabled={!canManageStock}
                          className={inputClassName}
                        >
                          {options?.locations.map(location => (
                            <option key={location.id} value={location.id}>
                              {location.warehouseName} / {location.code}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="Stock actual"
                        hint={canManageStock
                          ? 'Al guardar se registra un movimiento de ajuste; nunca se modifica el saldo directamente.'
                          : 'Tu rol no permite ajustar inventario.'}
                      >
                        <div className="relative">
                          <Warehouse size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={draft.inventoryTargetStock}
                            onChange={event => updateDraft('inventoryTargetStock', event.target.value)}
                            disabled={!canManageStock}
                            className={`${inputClassName} pl-9`}
                          />
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="border-t border-[#1e3a5f] pt-5">
                    <h4 className="mb-3 text-sm font-bold text-white">Peso y dimensiones</h4>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {([
                        ['weightKg', 'Peso (kg)'],
                        ['lengthCm', 'Largo (cm)'],
                        ['widthCm', 'Ancho (cm)'],
                        ['heightCm', 'Alto (cm)'],
                      ] as const).map(([key, label]) => (
                        <Field key={key} label={label}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft[key]}
                            onChange={event => updateDraft(key, event.target.value)}
                            disabled={!canManage}
                            className={inputClassName}
                            placeholder="Sin especificar"
                          />
                        </Field>
                      ))}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex justify-end border-t border-[#1e3a5f] pt-5">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 rounded-lg bg-[#1565ff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1252d3] disabled:opacity-50"
                      >
                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Guardando…' : draft.id ? 'Guardar cambios' : 'Crear producto'}
                      </button>
                    </div>
                  )}
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
