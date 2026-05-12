// Issue #241 Slice 4a — R31 token contract.
// Maps BrandTheme fields to --ceq-* CSS custom properties for the renderer.
// Acts as the only place where the binding can be edited, so tests can lock it.

import {
  resolveBodySize,
  resolveBorderRadius,
  resolveHeadingSize,
  resolveMaxWidth,
} from './scale-resolvers'
import type { BrandThemeLite } from './types'

export function themeToCssVars(theme: BrandThemeLite): Record<string, string> {
  return {
    '--ceq-primary-color': theme.primaryColor,
    '--ceq-secondary-color': theme.secondaryColor,
    '--ceq-background-color': theme.backgroundColor,
    '--ceq-text-color': theme.textColor,
    '--ceq-button-color': theme.buttonColor,
    '--ceq-button-text-color': theme.buttonTextColor,
    '--ceq-accent-color': theme.accentColor,
    '--ceq-font-family': theme.fontFamily,
    '--ceq-heading-size': resolveHeadingSize(theme.headingSize),
    '--ceq-body-size': resolveBodySize(theme.bodySize),
    '--ceq-border-radius': resolveBorderRadius(theme.borderRadius),
    '--ceq-max-width': resolveMaxWidth(theme.maxWidth),
    '--ceq-background-image': theme.backgroundImageUrl
      ? `url("${theme.backgroundImageUrl}")`
      : 'none',
    '--ceq-card-style': theme.cardStyle,
  }
}
