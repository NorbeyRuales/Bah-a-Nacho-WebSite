import { supabase } from "../../lib/supabase"

export type CategoryRecord = {
  id: string
  name: string
  slug: string
  description: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type SubcategoryRecord = CategoryRecord & {
  categoryId: string
  parentId: string | null
}

export type CategoryCatalog = {
  categories: CategoryRecord[]
  subcategories: SubcategoryRecord[]
}

export type CategoryInput = {
  id: string | null
  name: string
  slug: string
  description: string
  sortOrder: number
  isActive: boolean
}

export type SubcategoryInput = CategoryInput & {
  categoryId: string
  parentId: string | null
}

type CatalogRow = {
  id: string
  name: unknown
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type SubcategoryRow = CatalogRow & {
  category_id: string
  parent_id: string | null
}

const CATEGORY_COLUMNS =
  "id, name, slug, description, sort_order, is_active, created_at, updated_at"

function mapCategory(row: CatalogRow): CategoryRecord {
  return {
    id: row.id,
    name: String(row.name),
    slug: row.slug,
    description: row.description ?? "",
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSubcategory(row: SubcategoryRow): SubcategoryRecord {
  return {
    ...mapCategory(row),
    categoryId: row.category_id,
    parentId: row.parent_id,
  }
}

export function createCategorySlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function validateCommonInput(input: CategoryInput) {
  const name = input.name.trim()
  const slug = input.slug.trim().toLowerCase()
  const description = input.description.trim()

  if (name.length < 2 || name.length > 120) {
    throw new Error("El nombre debe contener entre 2 y 120 caracteres.")
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      "El slug solo puede contener letras minúsculas, números y guiones.",
    )
  }
  if (description.length > 1_000) {
    throw new Error("La descripción no puede superar 1.000 caracteres.")
  }
  if (
    !Number.isInteger(input.sortOrder) ||
    input.sortOrder < 0 ||
    input.sortOrder > 999_999
  ) {
    throw new Error("El orden debe ser un número entero entre 0 y 999.999.")
  }

  return {
    name,
    slug,
    description: description || null,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  }
}

function categoryError(
  error: { code?: string; message?: string },
  entity: "categoría" | "subcategoría",
) {
  if (error.code === "23505") {
    return new Error(`Ya existe una ${entity} con ese nombre o slug.`)
  }
  if (error.code === "23503") {
    return new Error(
      `No se puede completar la operación porque la ${entity} tiene productos o elementos dependientes. Conserva su relación o desactívala.`,
    )
  }
  if (error.code === "42501") {
    return new Error(`Tu rol no tiene permiso para modificar esta ${entity}.`)
  }
  if (error.code === "23514" || error.code === "22023") {
    return new Error(
      `Los datos de la ${entity} no cumplen las reglas de validación.`,
    )
  }
  return new Error(error.message || `No fue posible procesar la ${entity}.`)
}

export async function getCategoryCatalog(): Promise<CategoryCatalog> {
  const [categoryResult, subcategoryResult] = await Promise.all([
    supabase
      .from("categories")
      .select(CATEGORY_COLUMNS)
      .order("sort_order")
      .order("name"),
    supabase
      .from("subcategories")
      .select(`${CATEGORY_COLUMNS}, category_id, parent_id`)
      .order("sort_order")
      .order("name"),
  ])

  if (categoryResult.error)
    throw categoryError(categoryResult.error, "categoría")
  if (subcategoryResult.error)
    throw categoryError(subcategoryResult.error, "subcategoría")

  return {
    categories: ((categoryResult.data ?? []) as CatalogRow[]).map(mapCategory),
    subcategories: ((subcategoryResult.data ?? []) as SubcategoryRow[]).map(
      mapSubcategory,
    ),
  }
}

export async function saveCategory(
  input: CategoryInput,
): Promise<CategoryRecord> {
  const values = validateCommonInput(input)
  const query = input.id
    ? supabase.from("categories").update(values).eq("id", input.id)
    : supabase.from("categories").insert(values)
  const { data, error } = await query.select(CATEGORY_COLUMNS).single()

  if (error || !data) throw categoryError(error ?? {}, "categoría")
  return mapCategory(data as CatalogRow)
}

export async function setCategoryActive(categoryId: string, isActive: boolean) {
  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", categoryId)

  if (error) throw categoryError(error, "categoría")
}

export async function deleteCategory(categoryId: string) {
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
  if (error) throw categoryError(error, "categoría")
}

export async function saveSubcategory(
  input: SubcategoryInput,
): Promise<SubcategoryRecord> {
  if (!input.categoryId) throw new Error("Selecciona la categoría principal.")
  if (input.id && input.parentId === input.id) {
    throw new Error("Una subcategoría no puede depender de sí misma.")
  }

  const values = {
    ...validateCommonInput(input),
    category_id: input.categoryId,
    parent_id: input.parentId,
  }
  const query = input.id
    ? supabase.from("subcategories").update(values).eq("id", input.id)
    : supabase.from("subcategories").insert(values)
  const { data, error } = await query
    .select(`${CATEGORY_COLUMNS}, category_id, parent_id`)
    .single()

  if (error || !data) throw categoryError(error ?? {}, "subcategoría")
  return mapSubcategory(data as SubcategoryRow)
}

export async function setSubcategoryActive(
  subcategoryId: string,
  isActive: boolean,
) {
  const { error } = await supabase
    .from("subcategories")
    .update({ is_active: isActive })
    .eq("id", subcategoryId)

  if (error) throw categoryError(error, "subcategoría")
}

export async function deleteSubcategory(subcategoryId: string) {
  const { error } = await supabase
    .from("subcategories")
    .delete()
    .eq("id", subcategoryId)
  if (error) throw categoryError(error, "subcategoría")
}
