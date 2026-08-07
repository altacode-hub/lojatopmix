export interface UiSemanticColorTokens {
  successBackground: string
  successText: string
  successBorder: string
  warningBackground: string
  warningText: string
  warningBorder: string
  errorBackground: string
  errorText: string
  errorBorder: string
  infoBackground: string
  infoText: string
  infoBorder: string
}

export interface UiCoreColorTokens extends UiSemanticColorTokens {
  primary: string
  primaryDark: string
  primarySoft: string
  primarySoftBorder: string
  primaryMuted: string
  pageBackground: string
  surface: string
  surfaceAlt: string
  text: string
  textMuted: string
  textSoft: string
  border: string
  borderStrong: string
  divider: string
  overlay: string
}

export interface UiRadiusTokens {
  sm: number
  md: number
  lg: number
  pill: number
}

export interface UiShadowTokens {
  card: string
}

export interface UiLayoutTokens {
  maxWidth: number
  sidebarWidth: number
  mobileBreakpoint: number
}

export interface UiTheme {
  colors: UiCoreColorTokens
  layout: UiLayoutTokens
  radius: UiRadiusTokens
  shadow: UiShadowTokens
}

export const siteTheme: UiTheme = {
  colors: {
    primary: '#b58516',
    primaryDark: '#8f6610',
    primarySoft: '#f7edd2',
    primarySoftBorder: '#e8d29a',
    primaryMuted: '#b9b5b1',
    pageBackground: '#f5f6f8',
    surface: '#ffffff',
    surfaceAlt: '#fbfaf7',
    text: '#1f2937',
    textMuted: '#6b7280',
    textSoft: '#9ca3af',
    border: '#e5e7eb',
    borderStrong: '#d1d5db',
    divider: '#ddd',
    successBackground: '#f0fdf4',
    successText: '#166534',
    successBorder: '#bbf7d0',
    warningBackground: '#fffbeb',
    warningText: '#92400e',
    warningBorder: '#fcd34d',
    errorBackground: '#fff5f5',
    errorText: '#b42318',
    errorBorder: '#f3b3b3',
    infoBackground: '#eff6ff',
    infoText: '#1e40af',
    infoBorder: '#bfdbfe',
    overlay: 'rgba(17, 24, 39, 0.52)',
  },
  layout: {
    maxWidth: 1440,
    sidebarWidth: 240,
    mobileBreakpoint: 768,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    pill: 999,
  },
  shadow: {
    card: '0 16px 36px rgba(17, 24, 39, 0.08)',
  },
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
