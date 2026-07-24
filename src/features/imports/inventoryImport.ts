import { supabase } from '../../lib/supabase'
import type { InventoryWorkbookPreview } from './inventoryWorkbookParser'

export {
  parseInventoryWorkbook,
  type InventoryImportIssue,
  type InventoryImportRow,
  type InventoryWorkbookPreview,
} from './inventoryWorkbookParser'

export type InventoryImportResult = {
  importId: string
  duplicate: boolean
  totalRows: number
  createdCount: number
  updatedCount: number
  errorCount: number
  message: string | null
  errors: Array<{
    rowNumber: number
    productCode: string | null
    fieldName: string | null
    errorCode: string
    message: string
  }>
}

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function isDuplicateStorageError(
  error: { message?: string; statusCode?: string | number } | null,
) {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return String(error.statusCode) === '409'
    || message.includes('duplicate')
    || message.includes('already exists')
}

function normalizeImportResult(data: unknown): InventoryImportResult {
  const value = (data ?? {}) as Record<string, unknown>
  const errors = Array.isArray(value.errors) ? value.errors : []

  return {
    importId: String(value.importId ?? ''),
    duplicate: value.duplicate === true,
    totalRows: Number(value.totalRows ?? 0),
    createdCount: Number(value.createdCount ?? 0),
    updatedCount: Number(value.updatedCount ?? 0),
    errorCount: Number(value.errorCount ?? 0),
    message: typeof value.message === 'string' ? value.message : null,
    errors: errors.map(error => {
      const row = (error ?? {}) as Record<string, unknown>
      return {
        rowNumber: Number(row.rowNumber ?? 0),
        productCode: typeof row.productCode === 'string' ? row.productCode : null,
        fieldName: typeof row.fieldName === 'string' ? row.fieldName : null,
        errorCode: String(row.errorCode ?? ''),
        message: String(row.message ?? 'Error de procesamiento'),
      }
    }),
  }
}

export async function applyInventoryImport(preview: InventoryWorkbookPreview) {
  if (preview.issues.some(issue => issue.severity === 'error')) {
    throw new Error('Corrige los errores detectados antes de importar.')
  }
  if (preview.rows.length !== preview.sourceRowCount) {
    throw new Error('No se importará un archivo con filas inválidas.')
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    throw new Error('La sesión no es válida. Inicia sesión nuevamente.')
  }

  const extension = getExtension(preview.file.name)
  const storagePath = `${userData.user.id}/${preview.fileHash}.${extension}`
  const contentType = extension === 'xls'
    ? 'application/vnd.ms-excel'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const { error: uploadError } = await supabase.storage
    .from('inventory-imports')
    .upload(storagePath, preview.file, { contentType, upsert: false })
  const uploadedNow = !uploadError

  if (uploadError && !isDuplicateStorageError(uploadError)) {
    throw new Error('No fue posible guardar el archivo en el almacenamiento privado.')
  }

  const { data, error } = await supabase.rpc('admin_import_inventory', {
    import_file_name: preview.file.name,
    import_sheet_name: preview.sheetName,
    import_file_hash: preview.fileHash,
    import_file_size_bytes: preview.file.size,
    import_storage_path: storagePath,
    import_rows: preview.rows,
  })

  if (error) {
    if (uploadedNow) {
      await supabase.storage.from('inventory-imports').remove([storagePath])
    }
    throw new Error(error.message || 'No fue posible procesar la importación.')
  }

  return normalizeImportResult(data)
}
