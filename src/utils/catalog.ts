import type { CatalogVariation, ShowcaseRecord } from '../types/catalog'

const sanitizeFragment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

export const buildVariationKey = (size: string, color: string) => {
  const safeSize = sanitizeFragment(size || 'unico')
  const safeColor = sanitizeFragment(color || 'sem-cor')
  return `${safeSize}_${safeColor}`
}

export const variationLabel = (variation: Pick<CatalogVariation, 'size' | 'color'>) => {
  return variation.color ? `${variation.size} • ${variation.color}` : variation.size
}

export const showcaseToArray = (showcase: Record<string, ShowcaseRecord> | null | undefined) => {
  if (!showcase) return []

  return Object.entries(showcase)
    .map(([id, item]) => ({ id, ...item }))
    .filter((item) => item.available && item.stock)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
}

export const getVariationOptions = (variations: Record<string, CatalogVariation> | undefined) => {
  if (!variations) return []

  return Object.entries(variations)
    .map(([key, variation]) => ({
      key,
      ...variation,
      stock: Number(variation.stock || 0),
    }))
    .filter((variation) => variation.stock > 0)
}
