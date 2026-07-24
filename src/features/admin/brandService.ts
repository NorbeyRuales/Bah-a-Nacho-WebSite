import { supabase } from "../../lib/supabase"

export type BrandRecord = {
  id: string
  name: string
  slug: string
  description: string
  logoUrl: string
  isActive: boolean
  productCount: number
  engineCount: number
  createdAt: string
  updatedAt: string
}

export type BrandInput = {
  id: string | null
  name: string
  slug: string
  description: string
  logoUrl: string
  isActive: boolean
}

type RelatedCount = { count: number | string | null }

type BrandRow = {
  id: string
  name: unknown
  slug: string
  description: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  products?: RelatedCount[] | RelatedCount | null
  engines?: RelatedCount[] | RelatedCount | null
}

const BRAND_COLUMNS =
  "id, name, slug, description, logo_url, is_active, created_at, updated_at"

function relationCount(
  value: RelatedCount[] | RelatedCount | null | undefined,
) {
  const count = Array.isArray(value) ? value[0]?.count : value?.count
  const parsed = Number(count)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

function mapBrand(row: BrandRow): BrandRecord {
  return {
    id: row.id,
    name: String(row.name),
    slug: row.slug,
    description: row.description ?? "",
    logoUrl: row.logo_url ?? "",
    isActive: row.is_active,
    productCount: relationCount(row.products),
    engineCount: relationCount(row.engines),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createBrandSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function normalizeBrandLogoUrl(value: string) {
  const candidate = value.trim()
  if (!candidate) return ""
  if (candidate.length > 2_048) {
    throw new Error("La URL del logo no puede superar 2.048 caracteres.")
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    throw new Error("Ingresa una URL válida para el logo.")
  }

  if (parsed.protocol !== "https:") {
    throw new Error("La URL del logo debe utilizar HTTPS.")
  }

  return parsed.toString()
}

function validateBrandInput(input: BrandInput) {
  const name = input.name.trim()
  const slug = input.slug.trim().toLowerCase()
  const description = input.description.trim()
  const logoUrl = normalizeBrandLogoUrl(input.logoUrl)

  if (name.length < 2 || name.length > 100) {
    throw new Error("El nombre debe contener entre 2 y 100 caracteres.")
  }
  if (slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      "El slug solo puede contener letras minúsculas, números y guiones.",
    )
  }
  if (description.length > 1_000) {
    throw new Error("La descripción no puede superar 1.000 caracteres.")
  }

  return {
    name,
    slug,
    description: description || null,
    logo_url: logoUrl || null,
    is_active: input.isActive,
  }
}

function brandError(error: { code?: string }) {
  if (error.code === "23505") {
    return new Error("Ya existe una marca con ese nombre o slug.")
  }
  if (error.code === "23503") {
    return new Error(
      "No se puede eliminar la marca porque tiene productos o motores vinculados. Desactívala para conservar esas relaciones.",
    )
  }
  if (error.code === "42501") {
    return new Error("Tu rol no tiene permiso para modificar marcas.")
  }
  if (error.code === "23514" || error.code === "22023") {
    return new Error(
      "Los datos de la marca no cumplen las reglas de validación.",
    )
  }
  return new Error("No fue posible procesar la marca. Intenta nuevamente.")
}

export async function getBrands(): Promise<BrandRecord[]> {
  const { data, error } = await supabase
    .from("brands")
    .select(`${BRAND_COLUMNS}, products(count), engines(count)`)
    .order("name")

  if (error) throw brandError(error)
  return ((data ?? []) as unknown as BrandRow[]).map(mapBrand)
}

export async function saveBrand(input: BrandInput): Promise<BrandRecord> {
  const values = validateBrandInput(input)
  const query = input.id
    ? supabase.from("brands").update(values).eq("id", input.id)
    : supabase.from("brands").insert(values)
  const { data, error } = await query.select(BRAND_COLUMNS).single()

  if (error || !data) throw brandError(error ?? {})
  return mapBrand(data as BrandRow)
}

export async function setBrandActive(brandId: string, isActive: boolean) {
  const { error } = await supabase
    .from("brands")
    .update({ is_active: isActive })
    .eq("id", brandId)

  if (error) throw brandError(error)
}

export async function deleteBrand(brandId: string) {
  const { error } = await supabase.from("brands").delete().eq("id", brandId)
  if (error) throw brandError(error)
}
