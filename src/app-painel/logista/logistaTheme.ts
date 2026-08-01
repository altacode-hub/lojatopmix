import type { CSSProperties } from 'react'
import { siteTheme } from '../../app-cliente/siteTheme'

export const logistaTheme = {
  colors: {
    pageBackground: siteTheme.colors.pageBackground,
    surface: siteTheme.colors.surface,
    surfaceAlt: siteTheme.colors.surfaceAlt,
    text: siteTheme.colors.text,
    textMuted: siteTheme.colors.textMuted,
    textSoft: siteTheme.colors.textSoft,
    border: siteTheme.colors.border,
    borderStrong: siteTheme.colors.borderStrong,
    accent: siteTheme.colors.primary,
    accentDark: siteTheme.colors.primaryDark,
    accentSoft: siteTheme.colors.primarySoft,
    accentBorder: siteTheme.colors.primarySoftBorder,
    successBackground: siteTheme.colors.successBackground,
    successText: siteTheme.colors.successText,
    successBorder: siteTheme.colors.successBorder,
    warningBackground: siteTheme.colors.warningBackground,
    warningText: siteTheme.colors.warningText,
    warningBorder: siteTheme.colors.warningBorder,
    errorBackground: siteTheme.colors.errorBackground,
    errorText: siteTheme.colors.errorText,
    errorBorder: siteTheme.colors.errorBorder,
    overlay: siteTheme.colors.overlay,
  },
  radius: siteTheme.radius,
  shadow: siteTheme.shadow,
} as const

export const logistaCardStyle: CSSProperties = {
  background: logistaTheme.colors.surface,
  border: `1px solid ${logistaTheme.colors.border}`,
  borderRadius: logistaTheme.radius.lg,
  padding: 20,
  boxShadow: logistaTheme.shadow.card,
}

export const logistaInputStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: logistaTheme.radius.md,
  border: `1px solid ${logistaTheme.colors.borderStrong}`,
  background: logistaTheme.colors.surface,
  color: logistaTheme.colors.text,
}
