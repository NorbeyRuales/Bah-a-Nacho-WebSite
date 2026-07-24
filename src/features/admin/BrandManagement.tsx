import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import {
  AlertTriangle,
  Award,
  CheckCircle,
  Edit2,
  ImageOff,
  Info,
  ListFilter,
  LockKeyhole,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
  X,
} from "lucide-react"
import {
  createBrandSlug,
  deleteBrand,
  getBrands,
  normalizeBrandLogoUrl,
  saveBrand,
  setBrandActive,
  type BrandInput,
  type BrandRecord,
} from "./brandService"
import {
  parseBoundedString,
  useAdminSessionState,
} from "./useAdminSessionState"

type StatusFilter = "all" | "active" | "inactive"

function parseStatusFilter(value: unknown): StatusFilter | undefined {
  return value === "all" || value === "active" || value === "inactive"
    ? value
    : undefined
}

function parseBrandEditor(value: unknown): BrandInput | null | undefined {
  if (value === null) return null
  if (!value || typeof value !== "object") return undefined
  const editor = value as Record<string, unknown>
  if (
    (editor.id !== null && typeof editor.id !== "string") ||
    typeof editor.name !== "string" ||
    editor.name.length > 100 ||
    typeof editor.slug !== "string" ||
    editor.slug.length > 120 ||
    typeof editor.description !== "string" ||
    editor.description.length > 1_000 ||
    typeof editor.logoUrl !== "string" ||
    editor.logoUrl.length > 2_048 ||
    typeof editor.isActive !== "boolean"
  ) {
    return undefined
  }

  return {
    id: editor.id,
    name: editor.name,
    slug: editor.slug,
    description: editor.description,
    logoUrl: editor.logoUrl,
    isActive: editor.isActive,
  }
}

const inputClassName =
  "w-full rounded-lg border border-[#1e3a5f] bg-[#081426] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#425674] focus:border-[#1565ff] disabled:cursor-not-allowed disabled:opacity-55"

function blankBrand(): BrandInput {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    logoUrl: "",
    isActive: true,
  }
}

function brandInput(brand: BrandRecord): BrandInput {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    description: brand.description,
    logoUrl: brand.logoUrl,
    isActive: brand.isActive,
  }
}

function sanitizeSlugDraft(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
}

function safeLogoUrl(value: string) {
  try {
    return normalizeBrandLogoUrl(value)
  } catch {
    return ""
  }
}

function BrandLogo({
  name,
  url,
  large = false,
}: {
  name: string
  url: string
  large?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const safeUrl = safeLogoUrl(url)

  useEffect(() => setFailed(false), [safeUrl])

  const sizeClass = large ? "h-20 w-20 rounded-2xl" : "h-12 w-12 rounded-xl"
  const iconSize = large ? 25 : 18
  const initial = name.trim().charAt(0).toLocaleUpperCase("es") || "M"

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden border border-[#1e3a5f] bg-white/[0.04] text-[#93c5fd]`}
    >
      {safeUrl && !failed ? (
        <img
          src={safeUrl}
          alt={`Logo de ${name || "la marca"}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-2"
        />
      ) : name.trim() ? (
        <span
          aria-label={`Marca ${name}`}
          className={`${
            large ? "text-2xl" : "text-base"
          } font-display font-bold`}
        >
          {initial}
        </span>
      ) : (
        <ImageOff size={iconSize} aria-label="Sin logo" />
      )}
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
        active
          ? "border-green-800 bg-green-900/35 text-green-400"
          : "border-slate-700 bg-slate-800/70 text-slate-400"
      }`}
    >
      {active ? "Activa" : "Inactiva"}
    </span>
  )
}

function Notice({
  type,
  children,
  onClose,
}: {
  type: "error" | "success"
  children: string
  onClose: () => void
}) {
  const isError = type === "error"
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
        isError
          ? "border-red-800 bg-red-900/20 text-red-300"
          : "border-green-800 bg-green-900/20 text-green-300"
      }`}
    >
      {isError ? (
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircle size={18} className="mt-0.5 shrink-0" />
      )}
      <span className="flex-1">{children}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar mensaje"
        className="rounded p-0.5 transition-colors hover:bg-white/10"
      >
        <X size={15} />
      </button>
    </div>
  )
}

function BrandEditor({
  value,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  value: BrandInput
  saving: boolean
  error: string | null
  onChange: (next: BrandInput) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}) {
  const title = value.id ? "Editar marca" : "Nueva marca"
  const update = <Key extends keyof BrandInput,>(
    key: Key,
    nextValue: BrandInput[Key],
  ) => onChange({ ...value, [key]: nextValue })

  const changeName = (name: string) => {
    const previousAutoSlug = createBrandSlug(value.name)
    const shouldUpdateSlug = !value.slug || value.slug === previousAutoSlug
    onChange({
      ...value,
      name,
      slug: shouldUpdateSlug ? createBrandSlug(name) : value.slug,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-editor-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#1e3a5f] bg-[#0a1628] shadow-2xl shadow-black/50"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1e3a5f] px-5 py-4">
          <div>
            <h2
              id="brand-editor-title"
              className="font-display text-xl font-bold text-white"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-[#64748b]">
              Identidad comercial utilizada en productos y motores.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar formulario"
            className="rounded-lg p-2 text-[#64748b] hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-800 bg-red-900/20 p-3.5 text-sm text-red-300"
            >
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[#93c5fd]">
                Vista previa
              </span>
              <BrandLogo name={value.name} url={value.logoUrl} large />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#93c5fd]">
                  Nombre
                </span>
                <input
                  autoFocus
                  value={value.name}
                  onChange={(event) => changeName(event.target.value)}
                  minLength={2}
                  maxLength={100}
                  className={inputClassName}
                  placeholder="Ej. Yamaha"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#93c5fd]">
                  Slug
                </span>
                <input
                  value={value.slug}
                  onChange={(event) =>
                    update("slug", sanitizeSlugDraft(event.target.value))
                  }
                  maxLength={120}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  className={`${inputClassName} font-mono`}
                  placeholder="yamaha"
                  required
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-[#93c5fd]">
                  URL del logo
                </span>
                <input
                  type="url"
                  value={value.logoUrl}
                  onChange={(event) => update("logoUrl", event.target.value)}
                  maxLength={2_048}
                  pattern="https://.*"
                  className={inputClassName}
                  placeholder="https://ejemplo.com/logo.png"
                />
                <span className="mt-1 block text-[11px] text-[#64748b]">
                  Opcional. Por seguridad solo se aceptan recursos HTTPS.
                </span>
              </label>
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#93c5fd]">
              Descripción
            </span>
            <textarea
              value={value.description}
              onChange={(event) => update("description", event.target.value)}
              maxLength={1_000}
              rows={4}
              className={`${inputClassName} resize-y`}
              placeholder="Información comercial o técnica de la marca…"
            />
            <span className="mt-1 block text-right text-[11px] text-[#64748b]">
              {value.description.length}/1.000
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-[#1e3a5f] bg-[#081426] p-3.5">
            <input
              type="checkbox"
              checked={value.isActive}
              onChange={(event) => update("isActive", event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#1565ff]"
            />
            <span>
              <span className="block text-sm font-medium text-white">
                Marca activa
              </span>
              <span className="mt-0.5 block text-xs text-[#64748b]">
                Las marcas inactivas y sus productos no aparecen en el catálogo
                público.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-3 border-t border-[#1e3a5f] pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-[#1e3a5f] px-4 py-2.5 text-sm font-medium text-[#93c5fd] hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1565ff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1252d3] disabled:opacity-50"
            >
              {saving && <RefreshCw size={16} className="animate-spin" />}
              {saving ? "Guardando…" : value.id ? "Guardar cambios" : "Crear"}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function BrandManagement({
  canManage,
  onCatalogChanged,
}: {
  canManage: boolean
  onCatalogChanged: () => Promise<void> | void
}) {
  const [brands, setBrands] = useState<BrandRecord[]>([])
  const [query, setQuery] = useAdminSessionState(
    "brands.search",
    "",
    parseBoundedString(120),
  )
  const [status, setStatus] = useAdminSessionState<StatusFilter>(
    "brands.status",
    "all",
    parseStatusFilter,
  )
  const [editor, setEditor] = useAdminSessionState<BrandInput | null>(
    "brands.editor",
    null,
    parseBrandEditor,
  )
  const [deleteTarget, setDeleteTarget] = useState<BrandRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadBrands = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBrands(await getBrands())
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible consultar las marcas.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBrands()
  }, [loadBrands])

  useEffect(() => {
    if (!editor && !deleteTarget) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return
      setEditor(null)
      setDeleteTarget(null)
      setError(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [deleteTarget, editor, saving])

  const filteredBrands = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return brands.filter((brand) => {
      if (status === "active" && !brand.isActive) return false
      if (status === "inactive" && brand.isActive) return false
      if (!normalizedQuery) return true
      return [brand.name, brand.slug, brand.description].some((value) =>
        value.toLocaleLowerCase("es").includes(normalizedQuery),
      )
    })
  }, [brands, query, status])

  const activeBrands = brands.filter((brand) => brand.isActive).length
  const productCount = brands.reduce(
    (total, brand) => total + brand.productCount,
    0,
  )
  const engineCount = brands.reduce(
    (total, brand) => total + brand.engineCount,
    0,
  )

  const closeEditor = () => {
    if (saving) return
    setEditor(null)
    setError(null)
  }

  const startBrand = () => {
    setEditor(blankBrand())
    setError(null)
    setSuccess(null)
  }

  const editBrand = (brand: BrandRecord) => {
    setEditor(brandInput(brand))
    setError(null)
    setSuccess(null)
  }

  const submitEditor = async (event: FormEvent) => {
    event.preventDefault()
    if (!editor || !canManage || saving) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const wasEditing = Boolean(editor.id)
      await saveBrand(editor)
      setEditor(null)
      setSuccess(
        `Marca ${wasEditing ? "actualizada" : "creada"} correctamente.`,
      )
      await loadBrands()
      await onCatalogChanged()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible guardar la marca.",
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (brand: BrandRecord) => {
    if (!canManage || saving) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await setBrandActive(brand.id, !brand.isActive)
      setSuccess(`Marca ${brand.isActive ? "desactivada" : "activada"}.`)
      await loadBrands()
      await onCatalogChanged()
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No fue posible cambiar el estado de la marca.",
      )
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !canManage || saving) return
    if (deleteTarget.productCount > 0 || deleteTarget.engineCount > 0) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await deleteBrand(deleteTarget.id)
      setDeleteTarget(null)
      setSuccess("Marca eliminada correctamente.")
      await loadBrands()
      await onCatalogChanged()
    } catch (deleteError) {
      setDeleteTarget(null)
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar la marca.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {!canManage && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-800/60 bg-yellow-900/15 p-4 text-sm text-yellow-200">
          <LockKeyhole size={18} className="shrink-0" />
          Tu rol permite consultar las marcas, pero no modificarlas.
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-[#1565ff]/30 bg-[#1565ff]/10 p-4 text-sm text-[#b7d4ff]">
        <Info size={18} className="mt-0.5 shrink-0 text-[#00b4d8]" />
        <p>
          Desactivar conserva productos, motores e historial, pero retira la
          marca del catálogo público. Solo se puede eliminar una marca sin
          relaciones.
        </p>
      </div>

      {!editor && error && (
        <Notice type="error" onClose={() => setError(null)}>
          {error}
        </Notice>
      )}
      {success && (
        <Notice type="success" onClose={() => setSuccess(null)}>
          {success}
        </Notice>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Marcas",
            value: brands.length,
            detail: "registradas",
            icon: Award,
          },
          {
            label: "Marcas activas",
            value: activeBrands,
            detail: `${brands.length - activeBrands} inactivas`,
            icon: CheckCircle,
          },
          {
            label: "Productos vinculados",
            value: productCount,
            detail: "en el catálogo",
            icon: Package,
          },
          {
            label: "Motores vinculados",
            value: engineCount,
            detail: "modelos registrados",
            icon: Wrench,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <article
            key={label}
            className="glass rounded-xl border border-[#1e3a5f] p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748b]">{label}</p>
                <p className="mt-1 font-display text-3xl font-bold text-white">
                  {value}
                </p>
                <p className="text-xs text-[#93c5fd]">{detail}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1565ff]/15 text-[#00b4d8]">
                <Icon size={21} />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="glass overflow-hidden rounded-xl border border-[#1e3a5f]">
        <div className="flex flex-col gap-3 border-b border-[#1e3a5f] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <label className="relative max-w-md flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]"
              />
              <span className="sr-only">Buscar marcas</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={120}
                className={`${inputClassName} pl-9`}
                placeholder="Buscar por nombre, slug o descripción…"
              />
            </label>
            <label className="relative">
              <ListFilter
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]"
              />
              <span className="sr-only">Filtrar por estado</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as StatusFilter)
                }
                className={`${inputClassName} min-w-44 pl-9`}
              >
                <option value="all">Todos los estados</option>
                <option value="active">Solo activas</option>
                <option value="inactive">Solo inactivas</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadBrands()}
              disabled={loading}
              aria-label="Actualizar marcas"
              className="rounded-lg border border-[#1e3a5f] p-2.5 text-[#93c5fd] hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
            {canManage && (
              <button
                type="button"
                onClick={startBrand}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1565ff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1252d3]"
              >
                <Plus size={17} /> Nueva marca
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div
            className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#93c5fd]"
            role="status"
          >
            <RefreshCw size={18} className="animate-spin text-[#1565ff]" />
            Cargando marcas…
          </div>
        ) : filteredBrands.length === 0 ? (
          <div className="py-14 text-center">
            <Award size={34} className="mx-auto mb-3 text-[#1565ff]/50" />
            <p className="font-medium text-white">No se encontraron marcas</p>
            <p className="mt-1 text-sm text-[#64748b]">
              {brands.length === 0
                ? "Crea la primera marca del catálogo."
                : "Prueba con otro término o estado."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]">
            {filteredBrands.map((brand) => (
              <article
                key={brand.id}
                className="flex flex-col gap-4 p-4 transition-colors hover:bg-[#1565ff]/5 lg:flex-row lg:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <BrandLogo name={brand.name} url={brand.logoUrl} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{brand.name}</h3>
                      <StatusBadge active={brand.isActive} />
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-[#64748b]">
                      /{brand.slug}
                    </p>
                    {brand.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-[#93c5fd]">
                        {brand.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-5 text-xs text-[#93c5fd] lg:min-w-52">
                  <span className="inline-flex items-center gap-1.5">
                    <Package size={14} className="text-[#00b4d8]" />
                    {brand.productCount} productos
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Wrench size={14} className="text-[#00b4d8]" />
                    {brand.engineCount} motores
                  </span>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 self-end lg:self-auto">
                    <button
                      type="button"
                      onClick={() => editBrand(brand)}
                      title="Editar marca"
                      aria-label={`Editar ${brand.name}`}
                      className="rounded-lg p-2 text-[#93c5fd] hover:bg-[#1565ff]/15 hover:text-white"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(brand)}
                      disabled={saving}
                      className={`min-w-23 rounded-lg px-2.5 py-2 text-xs font-medium ${
                        brand.isActive
                          ? "text-yellow-300 hover:bg-yellow-900/20"
                          : "text-green-400 hover:bg-green-900/20"
                      } disabled:opacity-50`}
                    >
                      {brand.isActive ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(brand)}
                      title="Eliminar marca"
                      aria-label={`Eliminar ${brand.name}`}
                      className="rounded-lg p-2 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {editor && (
        <BrandEditor
          value={editor}
          saving={saving}
          error={error}
          onChange={setEditor}
          onClose={closeEditor}
          onSubmit={submitEditor}
        />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={() => !saving && setDeleteTarget(null)}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-brand-title"
            className="w-full max-w-md rounded-2xl border border-red-900/70 bg-[#0a1628] p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-900/25 p-2.5 text-red-400">
                <AlertTriangle size={21} />
              </div>
              <div>
                <h2
                  id="delete-brand-title"
                  className="font-display text-xl font-bold text-white"
                >
                  {deleteTarget.productCount > 0 || deleteTarget.engineCount > 0
                    ? "La marca tiene relaciones"
                    : "Confirmar eliminación"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#93c5fd]">
                  {deleteTarget.productCount > 0 ||
                  deleteTarget.engineCount > 0 ? (
                    <>
                      <strong className="text-white">
                        {deleteTarget.name}
                      </strong>{" "}
                      tiene {deleteTarget.productCount} productos y{" "}
                      {deleteTarget.engineCount} motores vinculados. Para
                      conservar la integridad del catálogo, desactívala en lugar
                      de eliminarla.
                    </>
                  ) : (
                    <>
                      Vas a eliminar permanentemente{" "}
                      <strong className="text-white">
                        {deleteTarget.name}
                      </strong>
                      . Esta acción no se puede deshacer.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
                className="rounded-lg border border-[#1e3a5f] px-4 py-2.5 text-sm text-[#93c5fd] hover:bg-white/5 disabled:opacity-50"
              >
                {deleteTarget.productCount > 0 || deleteTarget.engineCount > 0
                  ? "Entendido"
                  : "Cancelar"}
              </button>
              {deleteTarget.productCount === 0 &&
                deleteTarget.engineCount === 0 && (
                  <button
                    type="button"
                    onClick={() => void confirmDelete()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    {saving ? "Eliminando…" : "Eliminar"}
                  </button>
                )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
