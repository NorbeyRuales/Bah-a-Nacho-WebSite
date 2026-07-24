const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 2_000
const MAX_HEADER_SCAN_ROWS = 250
const SUPPORTED_EXTENSIONS = new Set(['xls', 'xlsx'])

type IssueSeverity = 'error' | 'warning'

export type InventoryImportIssue = {
  rowNumber: number | null
  field: string
  message: string
  severity: IssueSeverity
}

export type InventoryImportRow = {
  rowNumber: number
  internalCode: string
  oemCode: string
  name: string
  stock: number
  purchasePrice: number
  salePrice: number
  categoryName: string
  brandName: string
  shortDescription: string
  longDescription: string
}

export type InventoryWorkbookPreview = {
  file: File
  fileHash: string
  sheetName: string
  rows: InventoryImportRow[]
  issues: InventoryImportIssue[]
  sourceRowCount: number
}

type ColumnKey =
  | 'internalCode'
  | 'oemCode'
  | 'name'
  | 'stock'
  | 'purchasePrice'
  | 'salePrice'
  | 'categoryName'
  | 'brandName'
  | 'shortDescription'
  | 'longDescription'

type ColumnDefinition = {
  key: ColumnKey
  aliases: string[]
  label: string
}

const REQUIRED_COLUMNS: ColumnDefinition[] = [
  {
    key: 'internalCode',
    aliases: ['codigo', 'codigoproducto', 'codproducto', 'codigointerno', 'sku'],
    label: 'Código',
  },
  {
    key: 'name',
    aliases: ['nombreproducto', 'nombre', 'producto', 'descripcionproducto'],
    label: 'Nombre Producto',
  },
  {
    key: 'stock',
    aliases: ['cantidad', 'stock', 'saldo', 'existencia', 'existencias', 'cantidadactual'],
    label: 'Cantidad',
  },
  {
    key: 'purchasePrice',
    aliases: ['ultvalcompra', 'ultimovalorcompra', 'preciocompra', 'costocompra', 'costounitario', 'costo'],
    label: 'Ult. Val. Compra',
  },
  {
    key: 'salePrice',
    aliases: ['preciomedio', 'precioventa', 'valorventa', 'pvp', 'precio'],
    label: 'PrecioMedio',
  },
]

const OPTIONAL_COLUMNS: ColumnDefinition[] = [
  {
    key: 'oemCode',
    aliases: ['referencia', 'codigooem', 'referenciafabricante', 'ref'],
    label: 'Referencia',
  },
  {
    key: 'categoryName',
    aliases: ['nombrecategoria', 'categoria', 'familia', 'linea'],
    label: 'Categoría',
  },
  {
    key: 'brandName',
    aliases: ['marca', 'fabricante'],
    label: 'Marca',
  },
  {
    key: 'shortDescription',
    aliases: ['descripcioncorta', 'descripcionbreve'],
    label: 'Descripción corta',
  },
  {
    key: 'longDescription',
    aliases: ['descripcionlarga', 'descripcionextendida', 'detalle'],
    label: 'Descripción larga',
  },
]

type HeaderCandidate = {
  sheetName: string
  rows: unknown[][]
  rowIndex: number
  score: number
  complete: boolean
  columns: Map<ColumnKey, number>
}

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function parseLocalizedNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN

  let normalized = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!normalized) return Number.NaN

  const commaIndex = normalized.lastIndexOf(',')
  const dotIndex = normalized.lastIndexOf('.')

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ','
    normalized = normalized.split(thousandsSeparator).join('')
    if (decimalSeparator === ',') normalized = normalized.replace(',', '.')
  } else if (commaIndex >= 0 || dotIndex >= 0) {
    const separator = commaIndex >= 0 ? ',' : '.'
    const sections = normalized.split(separator)
    const looksLikeThousands = sections.length > 2
      || (sections.length === 2 && sections[1].length === 3 && sections[0].length > 0)

    normalized = looksLikeThousands
      ? sections.join('')
      : normalized.replace(separator, '.')
  }

  const number = Number(normalized)
  return Number.isFinite(number) ? number : Number.NaN
}

function validateWorkbookSignature(bytes: Uint8Array, extension: string) {
  const isXls = bytes.length >= 8
    && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
      (byte, index) => bytes[index] === byte,
    )
  const isXlsx = bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && (
      (bytes[2] === 0x03 && bytes[3] === 0x04)
      || (bytes[2] === 0x05 && bytes[3] === 0x06)
      || (bytes[2] === 0x07 && bytes[3] === 0x08)
    )

  return extension === 'xls' ? isXls : isXlsx
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(
    new Uint8Array(digest),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('')
}

function buildColumnMap(header: unknown[]) {
  const normalized = header.map(normalizeHeader)
  const map = new Map<ColumnKey, number>()

  for (const column of [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]) {
    const index = normalized.findIndex(value => column.aliases.includes(value))
    if (index >= 0) map.set(column.key, index)
  }

  return map
}

function scoreHeader(header: unknown[]) {
  const columns = buildColumnMap(header)
  const requiredMatches = REQUIRED_COLUMNS.filter(column => columns.has(column.key)).length
  const optionalMatches = OPTIONAL_COLUMNS.filter(column => columns.has(column.key)).length

  return {
    columns,
    score: requiredMatches * 100 + optionalMatches * 10,
    complete: requiredMatches === REQUIRED_COLUMNS.length,
  }
}

function isBetterCandidate(candidate: HeaderCandidate, current: HeaderCandidate | null) {
  if (!current) return true
  if (candidate.complete !== current.complete) return candidate.complete
  return candidate.score > current.score
}

function findHeaderCandidate(
  sheetNames: string[],
  readRows: (sheetName: string) => unknown[][],
) {
  let best: HeaderCandidate | null = null

  for (const sheetName of sheetNames) {
    const rows = readRows(sheetName)
    const scanLength = Math.min(rows.length, MAX_HEADER_SCAN_ROWS)

    for (let rowIndex = 0; rowIndex < scanLength; rowIndex += 1) {
      const result = scoreHeader(rows[rowIndex])
      const candidate: HeaderCandidate = {
        sheetName,
        rows,
        rowIndex,
        score: result.score,
        complete: result.complete,
        columns: result.columns,
      }

      if (isBetterCandidate(candidate, best)) best = candidate
    }
  }

  return best
}

function valueAt(row: unknown[], columns: Map<ColumnKey, number>, key: ColumnKey) {
  const index = columns.get(key)
  return index === undefined ? '' : row[index]
}

function describeWorkbookFailure(
  fileName: string,
  sheetNames: string[],
  candidate: HeaderCandidate,
) {
  const missingColumns = REQUIRED_COLUMNS.filter(column => !candidate.columns.has(column.key))
  const detectedHeaders = candidate.rows[candidate.rowIndex]
    .map(value => cleanText(value, 60))
    .filter(Boolean)
    .slice(0, 12)
    .join(', ')
  const sheets = sheetNames.map(name => `“${cleanText(name, 80)}”`).join(', ')
  const closestHeaders = detectedHeaders
    ? ` La coincidencia más cercana está en “${candidate.sheetName}”, fila ${candidate.rowIndex + 1}: ${detectedHeaders}.`
    : ''

  return [
    `El archivo “${cleanText(fileName, 255)}” no parece ser el reporte Saldos de Productos.`,
    `Faltan las columnas: ${missingColumns.map(column => column.label).join(', ')}.`,
    `Hojas revisadas: ${sheets}.${closestHeaders}`,
  ].join(' ')
}

export async function parseInventoryWorkbook(file: File): Promise<InventoryWorkbookPreview> {
  const extension = getExtension(file.name)
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error('Selecciona un archivo Excel con extensión .xls o .xlsx.')
  }
  if (file.size < 1 || file.size > MAX_FILE_BYTES) {
    throw new Error('El archivo debe pesar entre 1 byte y 5 MB.')
  }

  const buffer = await file.arrayBuffer()
  if (!validateWorkbookSignature(new Uint8Array(buffer.slice(0, 12)), extension)) {
    throw new Error('El contenido del archivo no corresponde a un Excel válido.')
  }

  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
  })
  if (workbook.SheetNames.length === 0) {
    throw new Error('El archivo no contiene hojas de cálculo.')
  }

  const candidate = findHeaderCandidate(workbook.SheetNames, sheetName => {
    const sheet = workbook.Sheets[sheetName]
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    })
  })

  if (!candidate) {
    throw new Error(`El archivo “${cleanText(file.name, 255)}” no contiene filas utilizables.`)
  }
  if (!candidate.complete) {
    throw new Error(describeWorkbookFailure(file.name, workbook.SheetNames, candidate))
  }

  const {
    sheetName,
    rows: sourceRows,
    rowIndex: headerIndex,
    columns,
  } = candidate
  const dataRows = sourceRows
    .slice(headerIndex + 1)
    .filter(row => row.some(value => cleanText(value, 20) !== ''))

  if (dataRows.length < 1) {
    throw new Error('El archivo no contiene productos para importar.')
  }
  if (dataRows.length > MAX_ROWS) {
    throw new Error(`El archivo supera el límite de ${MAX_ROWS} productos.`)
  }

  const issues: InventoryImportIssue[] = []
  const rows: InventoryImportRow[] = []
  const seenCodes = new Map<string, number>()

  dataRows.forEach((sourceRow, index) => {
    const rowNumber = headerIndex + index + 2
    const internalCode = cleanText(valueAt(sourceRow, columns, 'internalCode'), 80)
    const name = cleanText(valueAt(sourceRow, columns, 'name'), 240)
    const oemCode = cleanText(valueAt(sourceRow, columns, 'oemCode'), 120)
    const brandName = cleanText(valueAt(sourceRow, columns, 'brandName'), 100)
    const categoryName = cleanText(valueAt(sourceRow, columns, 'categoryName'), 120)
    const shortDescription = cleanText(valueAt(sourceRow, columns, 'shortDescription'), 1_000)
    const longDescription = cleanText(valueAt(sourceRow, columns, 'longDescription'), 5_000)
    const stock = parseLocalizedNumber(valueAt(sourceRow, columns, 'stock'))
    const purchasePrice = parseLocalizedNumber(valueAt(sourceRow, columns, 'purchasePrice'))
    const salePrice = parseLocalizedNumber(valueAt(sourceRow, columns, 'salePrice'))
    const normalizedCode = internalCode.toLowerCase()
    let rowHasError = false

    const addError = (field: string, message: string) => {
      rowHasError = true
      issues.push({ rowNumber, field, message, severity: 'error' })
    }

    if (!/^[A-Za-z0-9._/-]{2,80}$/.test(internalCode)) {
      addError('Código', 'El código debe tener entre 2 y 80 caracteres válidos.')
    } else if (seenCodes.has(normalizedCode)) {
      addError(
        'Código',
        `Código duplicado; también aparece en la fila ${seenCodes.get(normalizedCode)}.`,
      )
    } else {
      seenCodes.set(normalizedCode, rowNumber)
    }

    if (name.length < 2) {
      addError('Nombre Producto', 'El nombre del producto es obligatorio.')
    }
    if (!Number.isFinite(stock) || stock < 0) {
      addError('Cantidad', 'La cantidad debe ser un número mayor o igual a cero.')
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      addError(
        'Ult. Val. Compra',
        'El precio de compra debe ser un número mayor o igual a cero.',
      )
    }
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      addError(
        'PrecioMedio',
        'El precio de venta debe ser un número mayor o igual a cero.',
      )
    }

    if (!brandName) {
      issues.push({
        rowNumber,
        field: 'Marca',
        message: 'Sin marca: se conservará la actual o se asignará “Sin marca” si el producto es nuevo.',
        severity: 'warning',
      })
    }
    if (!categoryName) {
      issues.push({
        rowNumber,
        field: 'Nombre Categoría',
        message: 'Sin categoría: se conservará la actual o se asignará “Otros” si el producto es nuevo.',
        severity: 'warning',
      })
    }

    if (!rowHasError) {
      rows.push({
        rowNumber,
        internalCode,
        oemCode,
        name,
        stock,
        purchasePrice,
        salePrice,
        categoryName,
        brandName,
        shortDescription,
        longDescription,
      })
    }
  })

  return {
    file,
    fileHash: await sha256Hex(buffer),
    sheetName: cleanText(sheetName, 120),
    rows,
    issues,
    sourceRowCount: dataRows.length,
  }
}
