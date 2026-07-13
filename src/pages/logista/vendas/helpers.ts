import type { CSSProperties } from 'react'
import type { CatalogVariation } from '../../../types/catalog'
import type { SaleRecord } from './types'

export const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 20,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0)

export const formatDateTime = (value?: number) => {
  if (!value) return '-'

  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export const getDateInputValue = (daysFromToday = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)

  const timezoneOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

export const getDateRange = (date: string, endOfDay = false) => {
  if (!date) return null

  const parsed = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999)
  }

  return parsed.getTime()
}

export const hasVariationStock = (variations: Record<string, CatalogVariation> | undefined) =>
  Object.values(variations || {}).some((variation) => Number(variation?.stock || 0) > 0)

export const getStatusMeta = (sale: SaleRecord) => {
  if (sale.fulfillmentStatus === 'delivered') {
    return { label: 'Entregue', color: '#059669', background: '#ecfdf5' }
  }

  if (sale.fulfillmentStatus === 'pending_review' || sale.stockStatus === 'attention') {
    return { label: 'Requer atenção', color: '#c2410c', background: '#fff7ed' }
  }

  if (sale.channel === 'online') {
    return { label: 'Aguardando entrega', color: '#7c3aed', background: '#f5f3ff' }
  }

  return { label: 'Concluída', color: '#0f766e', background: '#ecfeff' }
}
