import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Edit2,
  FolderTree,
  Info,
  Layers3,
  ListFilter,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react"
import {
  createCategorySlug,
  deleteCategory,
  deleteSubcategory,
  getCategoryCatalog,
  saveCategory,
  saveSubcategory,
  setCategoryActive,
  setSubcategoryActive,
  type CategoryInput,
  type CategoryRecord,
  type SubcategoryInput,
  type SubcategoryRecord,
} from "./categoryService"
import {
  parseBoundedString,
  useAdminSessionState,
} from "./useAdminSessionState"

type StatusFilter = "all" | "active" | "inactive"
type EditorState = { kind: "category"; value: CategoryInput } | {
  kind: "subcategory"
  value: SubcategoryInput
} | null
type DeleteTarget = { kind: "category"; id: string; name: string } | {
  kind: "subcategory"
  id: string
  name: string
} | null

function parseStatusFilter(value: unknown): StatusFilter | undefined {
  return value === "all" || value === "active" || value === "inactive"
    ? value
    : undefined
}

function parseCategoryInput(value: unknown): CategoryInput | undefined {
  if (!value || typeof value !== "object") return undefined
  const input = value as Record<string, unknown>
  if (
    (input.id !== null && typeof input.id !== "string") ||
    typeof input.name !== "string" ||
    input.name.length > 120 ||
    typeof input.slug !== "string" ||
    input.slug.length > 120 ||
    typeof input.description !== "string" ||
    input.description.length > 1_000 ||
    typeof input.sortOrder !== "number" ||
    !Number.isSafeInteger(input.sortOrder) ||
    input.sortOrder < 0 ||
    input.sortOrder > 999_999 ||
    typeof input.isActive !== "boolean"
  ) {
    return undefined
  }

  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    description: input.description,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  }
}

function parseCategoryEditor(value: unknown): EditorState | undefined {
  if (value === null) return null
  if (!value || typeof value !== "object") return undefined
  const editor = value as Record<string, unknown>
  const common = parseCategoryInput(editor.value)
  if (!common) return undefined

  if (editor.kind === "category") {
    return { kind: "category", value: common }
  }

  if (editor.kind !== "subcategory" || !editor.value) return undefined
  const subcategory = editor.value as Record<string, unknown>
  if (
    typeof subcategory.categoryId !== "string" ||
    subcategory.categoryId.length > 100 ||
    (subcategory.parentId !== null &&
      typeof subcategory.parentId !== "string")
  ) {
    return undefined
  }

  return {
    kind: "subcategory",
    value: {
      ...common,
      categoryId: subcategory.categoryId,
      parentId: subcategory.parentId,
    },
  }
}

const inputClassName =
  "w-full rounded-lg border border-[#1e3a5f] bg-[#081426] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#425674] focus:border-[#1565ff] disabled:cursor-not-allowed disabled:opacity-55"

function blankCategory(nextOrder: number): CategoryInput {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    sortOrder: nextOrder,
    isActive: true,
  }
}

function categoryInput(category: CategoryRecord): CategoryInput {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  }
}

function blankSubcategory(
  categoryId: string,
  nextOrder: number,
): SubcategoryInput {
  return {
    ...blankCategory(nextOrder),
    categoryId,
    parentId: null,
  }
}

function subcategoryInput(subcategory: SubcategoryRecord): SubcategoryInput {
  return {
    ...categoryInput(subcategory),
    categoryId: subcategory.categoryId,
    parentId: subcategory.parentId,
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

function isDescendant(
  candidateId: string,
  ancestorId: string,
  subcategories: SubcategoryRecord[],
): boolean {
  let current = subcategories.find((item) => item.id === candidateId)
  const visited = new Set<string>()

  while (current?.parentId && !visited.has(current.id)) {
    if (current.parentId === ancestorId) return true
    visited.add(current.id)
    current = subcategories.find((item) => item.id === current?.parentId)
  }
  return false
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

function CategoryEditor({
  editor,
  categories,
  subcategories,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  editor: Exclude<EditorState, null>
  categories: CategoryRecord[]
  subcategories: SubcategoryRecord[]
  saving: boolean
  error: string | null
  onChange: (next: Exclude<EditorState, null>) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}) {
  const isCategory = editor.kind === "category"
  const value = editor.value
  const subcategoryValue = editor.kind === "subcategory" ? editor.value : null
  const title = `${value.id ? "Editar" : "Nueva"} ${
    isCategory ? "categoría" : "subcategoría"
  }`
  const parentOptions = subcategoryValue
    ? subcategories.filter(
        (item) =>
          item.categoryId === subcategoryValue.categoryId &&
          item.id !== subcategoryValue.id &&
          (!subcategoryValue.id ||
            !isDescendant(item.id, subcategoryValue.id, subcategories)),
      )
    : []

  const updateCommon = <Key extends keyof CategoryInput,>(
    key: Key,
    nextValue: CategoryInput[Key],
  ) => {
    if (editor.kind === "category") {
      onChange({
        kind: "category",
        value: { ...editor.value, [key]: nextValue },
      })
      return
    }
    onChange({
      kind: "subcategory",
      value: { ...editor.value, [key]: nextValue },
    })
  }

  const updateSubcategory = <Key extends keyof SubcategoryInput,>(
    key: Key,
    nextValue: SubcategoryInput[Key],
  ) => {
    if (editor.kind !== "subcategory") return
    onChange({
      kind: "subcategory",
      value: { ...editor.value, [key]: nextValue },
    })
  }

  const changeName = (name: string) => {
    const previousAutoSlug = createCategorySlug(value.name)
    const shouldUpdateSlug = !value.slug || value.slug === previousAutoSlug
    if (editor.kind === "category") {
      onChange({
        kind: "category",
        value: {
          ...editor.value,
          name,
          slug: shouldUpdateSlug ? createCategorySlug(name) : value.slug,
        },
      })
    } else {
      onChange({
        kind: "subcategory",
        value: {
          ...editor.value,
          name,
          slug: shouldUpdateSlug ? createCategorySlug(name) : value.slug,
        },
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-editor-title"
        className="w-full max-w-2xl rounded-2xl border border-[#1e3a5f] bg-[#0a1628] shadow-2xl shadow-black/50"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1e3a5f] px-5 py-4">
          <div>
            <h2
              id="category-editor-title"
              className="font-display text-xl font-bold text-white"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-[#64748b]">
              El slug se usa como identificador legible en el catálogo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar formulario"
            className="rounded-lg p-2 text-[#64748b] hover:bg-white/5 hover:text-white"
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

          {subcategoryValue && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#93c5fd]">
                Categoría principal
              </span>
              <select
                value={subcategoryValue.categoryId}
                onChange={(event) =>
                  onChange({
                    kind: "subcategory",
                    value: {
                      ...subcategoryValue,
                      categoryId: event.target.value,
                      parentId: null,
                    },
                  })
                }
                className={inputClassName}
                required
              >
                <option value="">Seleccionar categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.isActive ? "" : " (inactiva)"}
                  </option>
                ))}
              </select>
            </label>
          )}

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
                maxLength={120}
                className={inputClassName}
                placeholder={
                  isCategory ? "Ej. Sistema eléctrico" : "Ej. Bujías"
                }
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
                  updateCommon("slug", sanitizeSlugDraft(event.target.value))
                }
                maxLength={120}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                className={`${inputClassName} font-mono`}
                placeholder="sistema-electrico"
                required
              />
            </label>
            {subcategoryValue && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#93c5fd]">
                  Nivel superior
                </span>
                <select
                  value={subcategoryValue.parentId ?? ""}
                  onChange={(event) =>
                    updateSubcategory("parentId", event.target.value || null)
                  }
                  className={inputClassName}
                >
                  <option value="">Raíz de la categoría</option>
                  {parentOptions.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#93c5fd]">
                Orden de visualización
              </span>
              <input
                type="number"
                min="0"
                max="999999"
                step="1"
                value={value.sortOrder}
                onChange={(event) =>
                  updateCommon("sortOrder", Number(event.target.value))
                }
                className={inputClassName}
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#93c5fd]">
              Descripción
            </span>
            <textarea
              value={value.description}
              onChange={(event) =>
                updateCommon("description", event.target.value)
              }
              maxLength={1_000}
              rows={3}
              className={inputClassName}
              placeholder="Describe qué productos se organizan aquí…"
            />
            <span className="mt-1 block text-right text-[11px] text-[#64748b]">
              {value.description.length}/1.000
            </span>
          </label>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-[#1e3a5f] bg-[#081426] p-3.5">
            <span>
              <span className="block text-sm font-medium text-white">
                Visible y activa
              </span>
              <span className="mt-0.5 block text-xs text-[#64748b]">
                {isCategory
                  ? "Sus productos dejan de publicarse mientras la categoría esté inactiva."
                  : "Conserva la clasificación histórica y deja el registro fuera de nuevos listados."}
              </span>
            </span>
            <input
              type="checkbox"
              checked={value.isActive}
              onChange={(event) =>
                updateCommon("isActive", event.target.checked)
              }
              className="h-5 w-5 accent-[#1565ff]"
            />
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

export function CategoryManagement({
  canManage,
  onCatalogChanged,
}: {
  canManage: boolean
  onCatalogChanged: () => Promise<void> | void
}) {
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [subcategories, setSubcategories] = useState<SubcategoryRecord[]>([])
  const [query, setQuery] = useAdminSessionState(
    "categories.search",
    "",
    parseBoundedString(120),
  )
  const [status, setStatus] = useAdminSessionState<StatusFilter>(
    "categories.status",
    "all",
    parseStatusFilter,
  )
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [editor, setEditor] = useAdminSessionState<EditorState>(
    "categories.editor",
    null,
    parseCategoryEditor,
  )
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getCategoryCatalog()
      setCategories(result.categories)
      setSubcategories(result.subcategories)
      setExpanded((current) =>
        current.size > 0
          ? current
          : new Set(result.categories.map((category) => category.id)),
      )
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible consultar las categorías.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    if (!editor && !deleteTarget) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return
      setEditor(null)
      setDeleteTarget(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [deleteTarget, editor, saving])

  const subcategoriesByCategory = useMemo(() => {
    const groups = new Map<string, SubcategoryRecord[]>()
    subcategories.forEach((subcategory) => {
      const items = groups.get(subcategory.categoryId) ?? []
      items.push(subcategory)
      groups.set(subcategory.categoryId, items)
    })
    return groups
  }, [subcategories])

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return categories.filter((category) => {
      if (status === "active" && !category.isActive) return false
      if (status === "inactive" && category.isActive) return false
      if (!normalizedQuery) return true
      const children = subcategoriesByCategory.get(category.id) ?? []
      return [
        category.name,
        category.slug,
        category.description,
        ...children.flatMap((child) => [
          child.name,
          child.slug,
          child.description,
        ]),
      ].some((value) => value.toLocaleLowerCase("es").includes(normalizedQuery))
    })
  }, [categories, query, status, subcategoriesByCategory])

  const activeCategories = categories.filter(
    (category) => category.isActive,
  ).length
  const activeSubcategories = subcategories.filter(
    (subcategory) => subcategory.isActive,
  ).length

  const nextOrder = (items: Array<{ sortOrder: number }>) =>
    Math.max(0, ...items.map((item) => item.sortOrder)) + 10

  const toggleExpanded = (categoryId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  const startCategory = () => {
    setEditor({ kind: "category", value: blankCategory(nextOrder(categories)) })
    setError(null)
    setSuccess(null)
  }

  const startSubcategory = (categoryId: string) => {
    const siblings = subcategoriesByCategory.get(categoryId) ?? []
    setEditor({
      kind: "subcategory",
      value: blankSubcategory(categoryId, nextOrder(siblings)),
    })
    setError(null)
    setSuccess(null)
  }

  const editCategory = (category: CategoryRecord) => {
    setEditor({ kind: "category", value: categoryInput(category) })
    setError(null)
    setSuccess(null)
  }

  const editSubcategory = (subcategory: SubcategoryRecord) => {
    setEditor({ kind: "subcategory", value: subcategoryInput(subcategory) })
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
      const wasEditing = Boolean(editor.value.id)
      if (editor.kind === "category") await saveCategory(editor.value)
      else await saveSubcategory(editor.value)
      setEditor(null)
      setSuccess(
        `${editor.kind === "category" ? "Categoría" : "Subcategoría"} ${
          wasEditing ? "actualizada" : "creada"
        } correctamente.`,
      )
      await loadCatalog()
      await onCatalogChanged()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible guardar los cambios.",
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (
    kind: "category" | "subcategory",
    id: string,
    currentValue: boolean,
  ) => {
    if (!canManage || saving) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      if (kind === "category") await setCategoryActive(id, !currentValue)
      else await setSubcategoryActive(id, !currentValue)
      setSuccess(
        `${kind === "category" ? "Categoría" : "Subcategoría"} ${
          currentValue ? "desactivada" : "activada"
        }.`,
      )
      await loadCatalog()
      await onCatalogChanged()
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No fue posible cambiar el estado.",
      )
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !canManage || saving) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      if (deleteTarget.kind === "category")
        await deleteCategory(deleteTarget.id)
      else await deleteSubcategory(deleteTarget.id)
      setSuccess(
        `${
          deleteTarget.kind === "category" ? "Categoría" : "Subcategoría"
        } eliminada correctamente.`,
      )
      setDeleteTarget(null)
      await loadCatalog()
      await onCatalogChanged()
    } catch (deleteError) {
      setDeleteTarget(null)
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar el registro.",
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
          Tu rol permite consultar el catálogo de categorías, pero no
          modificarlo.
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-[#1565ff]/30 bg-[#1565ff]/10 p-4 text-sm text-[#b7d4ff]">
        <Info size={18} className="mt-0.5 shrink-0 text-[#00b4d8]" />
        <p>
          Desactivar conserva las relaciones históricas; una categoría inactiva
          deja de publicar sus productos. La eliminación solo funciona cuando no
          existen productos, hijos u otras dependencias.
        </p>
      </div>

      {error && (
        <Notice type="error" onClose={() => setError(null)}>
          {error}
        </Notice>
      )}
      {success && (
        <Notice type="success" onClose={() => setSuccess(null)}>
          {success}
        </Notice>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Categorías",
            value: categories.length,
            detail: `${activeCategories} activas`,
            icon: Tag,
          },
          {
            label: "Subcategorías",
            value: subcategories.length,
            detail: `${activeSubcategories} activas`,
            icon: FolderTree,
          },
          {
            label: "Registros activos",
            value: activeCategories + activeSubcategories,
            detail: "habilitados",
            icon: Layers3,
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
              <span className="sr-only">Buscar categorías</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={120}
                className={`${inputClassName} pl-9`}
                placeholder="Buscar por nombre, slug o subcategoría…"
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
              onClick={() => void loadCatalog()}
              disabled={loading}
              aria-label="Actualizar categorías"
              className="rounded-lg border border-[#1e3a5f] p-2.5 text-[#93c5fd] hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
            {canManage && (
              <button
                type="button"
                onClick={startCategory}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1565ff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1252d3]"
              >
                <Plus size={17} /> Nueva categoría
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
            Cargando categorías…
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-14 text-center">
            <Tag size={34} className="mx-auto mb-3 text-[#1565ff]/50" />
            <p className="font-medium text-white">
              No se encontraron categorías
            </p>
            <p className="mt-1 text-sm text-[#64748b]">
              {categories.length === 0
                ? "Crea la primera categoría del catálogo."
                : "Prueba con otro término o estado."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]">
            {filteredCategories.map((category) => {
              const children = subcategoriesByCategory.get(category.id) ?? []
              const isExpanded = expanded.has(category.id)
              return (
                <article key={category.id}>
                  <div className="flex flex-col gap-3 p-4 transition-colors hover:bg-[#1565ff]/5 lg:flex-row lg:items-center">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(category.id)}
                      aria-expanded={isExpanded}
                      aria-label={`${
                        isExpanded ? "Ocultar" : "Mostrar"
                      } subcategorías de ${category.name}`}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span className="mt-0.5 rounded-lg bg-[#1565ff]/15 p-2 text-[#00b4d8]">
                        {isExpanded ? (
                          <ChevronDown size={17} />
                        ) : (
                          <ChevronRight size={17} />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">
                            {category.name}
                          </span>
                          <StatusBadge active={category.isActive} />
                        </span>
                        <span className="mt-1 block truncate font-mono text-xs text-[#64748b]">
                          /{category.slug} · orden {category.sortOrder} ·{" "}
                          {children.length}{" "}
                          {children.length === 1
                            ? "subcategoría"
                            : "subcategorías"}
                        </span>
                        {category.description && (
                          <span className="mt-1 block line-clamp-1 text-xs text-[#93c5fd]">
                            {category.description}
                          </span>
                        )}
                      </span>
                    </button>

                    {canManage && (
                      <div className="flex items-center gap-1 self-end lg:self-auto">
                        <button
                          type="button"
                          onClick={() => startSubcategory(category.id)}
                          title="Agregar subcategoría"
                          aria-label={`Agregar subcategoría a ${category.name}`}
                          className="rounded-lg p-2 text-[#93c5fd] hover:bg-[#1565ff]/15 hover:text-white"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => editCategory(category)}
                          title="Editar categoría"
                          aria-label={`Editar ${category.name}`}
                          className="rounded-lg p-2 text-[#93c5fd] hover:bg-[#1565ff]/15 hover:text-white"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void toggleActive(
                              "category",
                              category.id,
                              category.isActive,
                            )
                          }
                          disabled={saving}
                          className={`min-w-23 rounded-lg px-2.5 py-2 text-xs font-medium ${
                            category.isActive
                              ? "text-yellow-300 hover:bg-yellow-900/20"
                              : "text-green-400 hover:bg-green-900/20"
                          }`}
                        >
                          {category.isActive ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "category",
                              id: category.id,
                              name: category.name,
                            })
                          }
                          title="Eliminar categoría"
                          aria-label={`Eliminar ${category.name}`}
                          className="rounded-lg p-2 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[#1e3a5f]/60 bg-[#071120] px-4 py-3 sm:pl-16">
                      {children.length === 0 ? (
                        <div className="flex items-center justify-between gap-3 py-2 text-xs text-[#64748b]">
                          <span>
                            Esta categoría todavía no tiene subcategorías.
                          </span>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => startSubcategory(category.id)}
                              className="text-[#00b4d8] hover:text-white"
                            >
                              Crear subcategoría
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {children.map((child) => {
                            const parent = child.parentId
                              ? subcategories.find(
                                  (item) => item.id === child.parentId,
                                )
                              : null
                            return (
                              <div
                                key={child.id}
                                className="flex flex-col gap-2 rounded-lg px-3 py-2.5 hover:bg-white/[0.025] sm:flex-row sm:items-center"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium text-[#dbeafe]">
                                      {child.name}
                                    </span>
                                    <StatusBadge active={child.isActive} />
                                  </div>
                                  <div className="mt-1 truncate font-mono text-[11px] text-[#64748b]">
                                    /{child.slug} · orden {child.sortOrder}
                                    {parent
                                      ? ` · depende de ${parent.name}`
                                      : " · nivel raíz"}
                                  </div>
                                </div>
                                {canManage && (
                                  <div className="flex items-center gap-1 self-end sm:self-auto">
                                    <button
                                      type="button"
                                      onClick={() => editSubcategory(child)}
                                      title="Editar subcategoría"
                                      aria-label={`Editar ${child.name}`}
                                      className="rounded-lg p-2 text-[#93c5fd] hover:bg-[#1565ff]/15 hover:text-white"
                                    >
                                      <Edit2 size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void toggleActive(
                                          "subcategory",
                                          child.id,
                                          child.isActive,
                                        )
                                      }
                                      disabled={saving}
                                      className={`min-w-23 rounded-lg px-2.5 py-2 text-xs font-medium ${
                                        child.isActive
                                          ? "text-yellow-300 hover:bg-yellow-900/20"
                                          : "text-green-400 hover:bg-green-900/20"
                                      }`}
                                    >
                                      {child.isActive
                                        ? "Desactivar"
                                        : "Activar"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteTarget({
                                          kind: "subcategory",
                                          id: child.id,
                                          name: child.name,
                                        })
                                      }
                                      title="Eliminar subcategoría"
                                      aria-label={`Eliminar ${child.name}`}
                                      className="rounded-lg p-2 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {editor && (
        <CategoryEditor
          editor={editor}
          categories={categories}
          subcategories={subcategories}
          saving={saving}
          error={error}
          onChange={setEditor}
          onClose={() => !saving && setEditor(null)}
          onSubmit={submitEditor}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-category-title"
            className="w-full max-w-md rounded-2xl border border-red-900/70 bg-[#0a1628] p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-900/25 p-2.5 text-red-400">
                <AlertTriangle size={21} />
              </div>
              <div>
                <h2
                  id="delete-category-title"
                  className="font-display text-xl font-bold text-white"
                >
                  Confirmar eliminación
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#93c5fd]">
                  Vas a eliminar{" "}
                  <strong className="text-white">{deleteTarget.name}</strong>.
                  Si tiene productos o elementos dependientes, el sistema
                  protegerá el registro y no permitirá borrarlo.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
                className="rounded-lg border border-[#1e3a5f] px-4 py-2.5 text-sm text-[#93c5fd] hover:bg-white/5"
              >
                Cancelar
              </button>
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
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
