import type { CSSProperties } from 'react'
import type { CatalogVariation } from '../../../types/catalog'
import type { ReservedSaleViewRecord, SaleRecord } from './types'
import { logistaCardStyle, logistaTheme } from '../logistaTheme'

export const cardStyle: CSSProperties = logistaCardStyle

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

export const getStatusMeta = (sale: SaleRecord | ReservedSaleViewRecord) => {
  if (sale.paymentStatus === 'cancelled' || sale.fulfillmentStatus === 'cancelled' || sale.stockStatus === 'released') {
    return {
      label: 'Cancelada',
      color: logistaTheme.colors.errorText,
      background: logistaTheme.colors.errorBackground,
    }
  }

  if (sale.fulfillmentStatus === 'delivered') {
    return {
      label: 'Entregue',
      color: logistaTheme.colors.successText,
      background: logistaTheme.colors.successBackground,
    }
  }

  if (sale.fulfillmentStatus === 'reserved' || sale.stockStatus === 'reserved') {
    return {
      label: 'Reservada',
      color: logistaTheme.colors.warningText,
      background: logistaTheme.colors.warningBackground,
    }
  }

  if (sale.fulfillmentStatus === 'pending_review' || sale.stockStatus === 'attention') {
    return {
      label: 'Requer atenção',
      color: logistaTheme.colors.warningText,
      background: logistaTheme.colors.warningBackground,
    }
  }

  if (sale.channel === 'online') {
    return {
      label: 'Aguardando entrega',
      color: logistaTheme.colors.accentDark,
      background: logistaTheme.colors.accentSoft,
    }
  }

  return {
    label: 'Concluída',
    color: logistaTheme.colors.successText,
    background: logistaTheme.colors.successBackground,
  }
}
