import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  History,
  LockKeyhole,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'
import { getImportHistory, type ImportHistoryEntry } from './adminService'
import {
  applyInventoryImport,
  parseInventoryWorkbook,
  type InventoryImportResult,
  type InventoryWorkbookPreview,
} from '../imports/inventoryImport'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function StatusBadge({ status }: { status: string }) {
  const className = status === 'completed'
    ? 'border-green-800 bg-green-900/30 text-green-400'
    : status === 'failed'
      ? 'border-red-800 bg-red-900/30 text-red-400'
      : 'border-yellow-800 bg-yellow-900/30 text-yellow-400'

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${className}`}>
      {status === 'completed' ? 'Completada' : status === 'failed' ? 'Fallida' : 'Procesando'}
    </span>
  )
}

export function InventoryImportPanel({
  canImport,
  onImported,
}: {
  canImport: boolean
  onImported: () => Promise<void> | void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<ImportHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [preview, setPreview] = useState<InventoryWorkbookPreview | null>(null)
  const [result, setResult] = useState<InventoryImportResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      setHistory(await getImportHistory())
    } catch {
      setError('No fue posible consultar el historial de importaciones.')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const selectFile = useCallback(async (file?: File) => {
    if (!file || !canImport) return
    setParsing(true)
    setError(null)
    setResult(null)
    setPreview(null)

    try {
      setPreview(await parseInventoryWorkbook(file))
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'No fue posible leer el archivo.')
    } finally {
      setParsing(false)
    }
  }, [canImport])

  const resetFile = () => {
    setPreview(null)
    setResult(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const runImport = async () => {
    if (!preview || importing) return
    setImporting(true)
    setError(null)

    try {
      const nextResult = await applyInventoryImport(preview)
      setResult(nextResult)
      await Promise.all([loadHistory(), Promise.resolve(onImported())])
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'No fue posible aplicar la importación.')
    } finally {
      setImporting(false)
    }
  }

  const errorIssues = preview?.issues.filter(issue => issue.severity === 'error') ?? []
  const warningIssues = preview?.issues.filter(issue => issue.severity === 'warning') ?? []

  return (
    <div className="space-y-6">
      <div className="glass overflow-hidden rounded-xl border border-[#1e3a5f]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1e3a5f] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#1565ff]/30 bg-[#1565ff]/15">
              <FileSpreadsheet size={21} className="text-[#00b4d8]" />
            </div>
            <div>
              <h3 className="font-display font-bold text-white">Actualizar catálogo desde Excel</h3>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#93c5fd]">
                Lee .xls y .xlsx, valida antes de escribir y usa el código como identificador. Los productos
                existentes se actualizan, los nuevos se crean y el stock queda registrado como movimiento.
              </p>
            </div>
          </div>
          {preview && (
            <button
              type="button"
              onClick={resetFile}
              className="flex items-center gap-2 rounded-lg border border-[#1e3a5f] px-3 py-2 text-xs text-[#93c5fd] hover:border-[#1565ff] hover:text-white"
            >
              <X size={14} /> Cambiar archivo
            </button>
          )}
        </div>

        {!canImport ? (
          <div className="flex items-center gap-3 px-6 py-8 text-[#93c5fd]">
            <LockKeyhole size={24} className="text-yellow-400" />
            <div>
              <p className="font-semibold text-white">Acceso de solo lectura</p>
              <p className="text-sm">Tu rol permite consultar el historial, pero no ejecutar importaciones.</p>
            </div>
          </div>
        ) : !preview ? (
          <div className="p-6">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={event => { event.preventDefault(); setDragActive(true) }}
              onDragOver={event => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={event => {
                event.preventDefault()
                setDragActive(false)
                void selectFile(event.dataTransfer.files[0])
              }}
              disabled={parsing}
              className={`flex min-h-44 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition-colors ${
                dragActive ? 'border-[#00b4d8] bg-[#00b4d8]/10' : 'border-[#1e3a5f] bg-[#081426] hover:border-[#1565ff]'
              } disabled:opacity-60`}
            >
              {parsing ? (
                <RefreshCw size={32} className="mb-3 animate-spin text-[#00b4d8]" />
              ) : (
                <Upload size={32} className="mb-3 text-[#00b4d8]" />
              )}
              <span className="font-semibold text-white">{parsing ? 'Validando archivo…' : 'Arrastra el Excel o selecciónalo'}</span>
              <span className="mt-1 text-xs text-[#64748b]">Formatos .xls y .xlsx · máximo 5 MB · hasta 2.000 productos</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={event => void selectFile(event.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Archivo', preview.file.name],
                ['Hoja', preview.sheetName],
                ['Filas', String(preview.sourceRowCount)],
                ['Válidas', String(preview.rows.length)],
                ['Tamaño', `${(preview.file.size / 1024).toFixed(1)} KB`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[#1e3a5f] bg-[#081426] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[#64748b]">{label}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white" title={value}>{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className={`rounded-lg border p-3 ${errorIssues.length ? 'border-red-800 bg-red-900/20' : 'border-green-800 bg-green-900/20'}`}>
                <p className={`flex items-center gap-2 text-sm font-semibold ${errorIssues.length ? 'text-red-400' : 'text-green-400'}`}>
                  {errorIssues.length ? <AlertTriangle size={15} /> : <CheckCircle size={15} />}
                  {errorIssues.length ? `${errorIssues.length} errores bloquean la importación` : 'Archivo listo para importar'}
                </p>
              </div>
              <div className="rounded-lg border border-yellow-800/60 bg-yellow-900/15 p-3">
                <p className="flex items-center gap-2 text-sm text-yellow-300">
                  <AlertTriangle size={15} /> {warningIssues.length} advertencias informativas
                </p>
              </div>
            </div>

            {preview.issues.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-lg border border-[#1e3a5f]">
                {preview.issues.slice(0, 100).map((issue, index) => (
                  <div key={`${issue.rowNumber}-${issue.field}-${index}`} className="flex gap-3 border-b border-[#1e3a5f]/60 px-3 py-2 text-xs last:border-0">
                    <span className={issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                      {issue.severity === 'error' ? 'Error' : 'Aviso'}
                    </span>
                    <span className="font-mono text-[#64748b]">Fila {issue.rowNumber ?? '—'}</span>
                    <span className="text-[#93c5fd]">{issue.field}: {issue.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-semibold text-white">Vista previa (primeras 20 filas válidas)</h4>
              <div className="overflow-x-auto rounded-lg border border-[#1e3a5f]">
                <table className="w-full min-w-[900px] text-xs">
                  <thead className="bg-[#0a1628] text-[#64748b]">
                    <tr>
                      {['Fila', 'Código', 'Referencia', 'Producto', 'Marca', 'Categoría', 'Stock', 'Compra', 'Venta'].map(header => (
                        <th key={header} className="px-3 py-2 text-left font-medium">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 20).map(row => (
                      <tr key={`${row.rowNumber}-${row.internalCode}`} className="border-t border-[#1e3a5f]/60">
                        <td className="px-3 py-2 font-mono text-[#64748b]">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-mono text-[#00b4d8]">{row.internalCode}</td>
                        <td className="px-3 py-2 text-[#93c5fd]">{row.oemCode || '—'}</td>
                        <td className="max-w-64 truncate px-3 py-2 text-white" title={row.name}>{row.name}</td>
                        <td className="px-3 py-2 text-[#93c5fd]">{row.brandName || 'Sin marca'}</td>
                        <td className="px-3 py-2 text-[#93c5fd]">{row.categoryName || 'Otros'}</td>
                        <td className="px-3 py-2 font-mono text-white">{row.stock}</td>
                        <td className="px-3 py-2 font-mono text-white">{formatCurrency(row.purchasePrice)}</td>
                        <td className="px-3 py-2 font-mono text-white">{formatCurrency(row.salePrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {result && (
              <div className="rounded-xl border border-green-800 bg-green-900/20 p-4">
                <p className="flex items-center gap-2 font-semibold text-green-400">
                  <CheckCircle size={17} />
                  {result.duplicate ? 'El archivo ya se había importado' : 'Importación terminada'}
                </p>
                <p className="mt-1 text-sm text-[#b7d4ff]">
                  {result.duplicate
                    ? result.message
                    : `${result.createdCount} creados, ${result.updatedCount} actualizados y ${result.errorCount} errores de servidor.`}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-xs leading-relaxed text-[#64748b]">
                Precio de venta: PrecioMedio. Precio de compra: Ult. Val. Compra. El campo Valor del informe no se usa porque representa el valor total del inventario.
              </p>
              <button
                type="button"
                onClick={() => void runImport()}
                disabled={importing || errorIssues.length > 0 || preview.rows.length === 0 || Boolean(result)}
                className="flex items-center gap-2 rounded-lg bg-[#1565ff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1252d3] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                {importing ? 'Actualizando catálogo…' : 'Aplicar importación'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-800 bg-red-900/20 p-4 text-sm text-red-300" role="alert">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="glass overflow-hidden rounded-xl border border-[#1e3a5f]">
        <div className="flex items-center justify-between border-b border-[#1e3a5f] px-5 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <History size={15} className="text-[#00b4d8]" /> Historial de importaciones
          </h3>
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
            className="rounded-lg p-2 text-[#93c5fd] hover:bg-white/5 hover:text-white disabled:opacity-50"
            aria-label="Actualizar historial"
          >
            <RefreshCw size={15} className={historyLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        {historyLoading ? (
          <div className="p-8 text-center text-sm text-[#64748b]">Consultando importaciones…</div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#64748b]">Todavía no se han procesado importaciones.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-[#0a1628]">
                <tr>
                  {['Archivo', 'Usuario', 'Estado', 'Fecha', 'Filas', 'Creados', 'Actualizados', 'Errores'].map(header => (
                    <th key={header} className="px-4 py-2.5 text-left text-xs font-medium text-[#64748b]">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(entry => (
                  <tr key={entry.id} className="border-t border-[#1e3a5f]/60">
                    <td className="px-4 py-3 text-xs text-white">{entry.fileName}</td>
                    <td className="px-4 py-3 text-xs text-[#93c5fd]">{entry.userEmail ?? 'Sistema'}</td>
                    <td className="px-4 py-3"><StatusBadge status={entry.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{formatDate(entry.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white">{entry.totalRows}</td>
                    <td className="px-4 py-3 font-mono text-xs text-green-400">{entry.createdCount}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-400">{entry.updatedCount}</td>
                    <td className="px-4 py-3 font-mono text-xs text-red-400">{entry.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
