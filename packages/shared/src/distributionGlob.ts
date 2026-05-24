// Issue #420 — glob → SQL LIKE translator for the audience-builder wildcard search.
// Spec R17: `*` matches any run; `?` matches a single char; literal `%` and `_`
// must be escaped so operator-typed search strings don't gain SQL wildcard
// semantics by accident.
//
// Output is intended for use with Postgres `ILIKE` (case-insensitive). The
// caller must pass the result to a parameterized query — this function does
// NOT escape against SQL injection; it only translates glob → LIKE patterns
// AND escapes the LIKE special chars so a literal `%` stays literal.
//
// Examples:
//   '*@artistos.com'  →  '%@artistos.com'
//   'q2-*'            →  'q2-%'
//   '100%off'         →  '100\\%off'    (literal %)
//   '\\foo'           →  '\\\\foo'      (literal backslash)
//   'q?'              →  'q_'

const LIKE_ESCAPE = '\\'

export function globToSqlLike(pattern: string): string {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    switch (ch) {
      case '*':
        out += '%'
        break
      case '?':
        out += '_'
        break
      case '%':
      case '_':
      case '\\':
        out += LIKE_ESCAPE + ch
        break
      default:
        out += ch
    }
  }
  return out
}
