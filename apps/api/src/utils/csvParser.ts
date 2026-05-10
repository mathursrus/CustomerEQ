/**
 * Minimal RFC 4180-compliant CSV parser.
 * Handles: quoted fields, embedded commas/newlines, double-quote escaping.
 * Returns rows as string arrays; the first row is assumed to be headers.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let i = 0
  const n = text.length

  while (i < n) {
    const row: string[] = []

    // Parse one row
    while (i < n) {
      let field = ''

      if (text[i] === '"') {
        // Quoted field
        i++ // skip opening quote
        while (i < n) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') {
              // Escaped double-quote
              field += '"'
              i += 2
            } else {
              i++ // skip closing quote
              break
            }
          } else {
            field += text[i]
            i++
          }
        }
      } else {
        // Unquoted field — read until comma or newline
        while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          field += text[i]
          i++
        }
      }

      row.push(field.trim())

      if (i >= n || text[i] === '\n' || text[i] === '\r') {
        // End of row
        if (text[i] === '\r' && text[i + 1] === '\n') i++ // CRLF
        i++
        break
      }
      // Must be a comma
      i++
    }

    // Skip blank rows
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      rows.push(row)
    }
  }

  return rows
}

export interface ParsedCsvResult {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsvWithHeaders(text: string): ParsedCsvResult {
  const all = parseCsv(text)
  if (all.length === 0) return { headers: [], rows: [] }

  const headers = all[0].map((h) => h.toLowerCase().trim())
  const rows = all.slice(1).map((cells) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? ''
    })
    return obj
  })

  return { headers, rows }
}

export interface ParsedCsvRaw {
  headers: string[]
  rows: string[][]
}

/** Returns headers (original casing preserved) and data rows as positional string arrays. */
export function parseCsvRaw(text: string): ParsedCsvRaw {
  const all = parseCsv(text)
  if (all.length === 0) return { headers: [], rows: [] }
  return { headers: all[0], rows: all.slice(1) }
}
