import { type AdapterParseResult, type SourceType } from './types.js'
import { parseExcelRows } from './excelAdapter.js'
import { parseGoogleReviewsRows } from './googleReviewsAdapter.js'

export { SOURCE_TYPES } from './types.js'
export type { CanonicalImportRow, SourceType, SourceType as ImportSourceType, AdapterParseResult } from './types.js'

export function runAdapter(
  sourceType: SourceType,
  headers: string[],
  rows: string[][],
  importDate: Date,
): AdapterParseResult {
  switch (sourceType) {
    case 'excel':
      return parseExcelRows(headers, rows, importDate)
    case 'google_reviews':
      return parseGoogleReviewsRows(headers, rows, importDate)
  }
}
