// Issue #241 Slice 4a — RFC §"BrandTheme to Survey element token mapping"
// scale table (sm / md / lg → pixel strings). Pure functions, no React.

type Scale = 'sm' | 'md' | 'lg'

const HEADING: Record<Scale, string> = { sm: '20px', md: '24px', lg: '32px' }
const BODY: Record<Scale, string> = { sm: '14px', md: '16px', lg: '18px' }
const BORDER_RADIUS: Record<Scale, string> = { sm: '4px', md: '8px', lg: '16px' }
const MAX_WIDTH: Record<Scale, string> = { sm: '480px', md: '640px', lg: '800px' }

export function resolveHeadingSize(s: Scale): string {
  return HEADING[s]
}

export function resolveBodySize(s: Scale): string {
  return BODY[s]
}

export function resolveBorderRadius(s: Scale): string {
  return BORDER_RADIUS[s]
}

export function resolveMaxWidth(s: Scale): string {
  return MAX_WIDTH[s]
}
