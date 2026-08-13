import { useEffect, useMemo, useRef, useState } from 'react'
import { get, push, ref, update } from 'firebase/database'
import { FiArrowLeft, FiCreditCard, FiUsers, FiUserPlus } from 'react-icons/fi'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import FramedImage from '../../components/FramedImage'
import type { InternalProductRecord, ShowcaseRecord } from '../../types/catalog'
import { variationLabel } from '../../utils/catalog'
import { CATALOG_SYNC_PATH, clearCounterSaleDraft, patchCachedStockProduct } from './stockCache'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { logistaInputStyle, logistaTheme } from './logistaTheme'
import { cardStyle, formatCurrency, hasVariationStock } from './vendas/helpers'
import { isAdHocCounterSaleItem, isRegisteredCounterSaleItem } from './vendas/types'
import type { CounterSaleItem, SaleItemRecord, SaleRecord, CustomerRecord } from './vendas/types'

type PaymentLocationState = {
  selectedItems?: CounterSaleItem[]
  reservedSale?: SaleRecord
}

const paymentOptions = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_credito', label: 'Cartao de credito' },
  { value: 'cartao_debito', label: 'Cartao de debito' },
  { value: 'amortizacao', label: 'Amortização (pagamento parcial)' },
] as const

const getItemLineTotal = (item: CounterSaleItem | SaleItemRecord) => {
  if ('qty' in item) {
    return Number(item.qty || 0) * Number((item as CounterSaleItem).price || 0)
  }

  return Number(item.lineTotal || 0)
}

const formatPriceInputValue = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'R$ 0,00'
  return formatCurrency(value)
}

export default function CounterSalePayment() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [customerBirthDate, setCustomerBirthDate] = useState<string>('')
  const [creatingNewCustomer, setCreatingNewCustomer] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [customerSearchText, setCustomerSearchText] = useState<string>('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false)
  const customerDropdownRef = useRef<HTMLDivElement | null>(null)

  const locationState = (location.state as PaymentLocationState | null) ?? null
  const selectedItems = Array.isArray(locationState?.selectedItems) ? locationState.selectedItems : []
  const reservedSale = locationState?.reservedSale?.saleId ? locationState.reservedSale : null
  const localSelectedItems = selectedItems
  const hasAdHocItems = localSelectedItems.some((item) => isAdHocCounterSaleItem(item))
  const hasInvalidAdHocItem = localSelectedItems.some((item) => {
    if (!isAdHocCounterSaleItem(item)) return false
    return !item.productName.trim() || item.price <= 0 || item.qty <= 0
  })

  const [paymentMethod, setPaymentMethod] = useState<string>(reservedSale?.paymentMethod || 'pix')
  const [customerName, setCustomerName] = useState(reservedSale?.customer?.name || '')
  const [customerPhone, setCustomerPhone] = useState(reservedSale?.customer?.phone_number || '')
  const [notes, setNotes] = useState(reservedSale?.notes || '')
  const [discountValueText, setDiscountValueText] = useState<string>('')
  const [discountPercentText, setDiscountPercentText] = useState<string>('')

  const isAmortizacao = paymentMethod === 'amortizacao'

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const snapshot = await get(ref(rtdb, 'customers'))
        if (snapshot.exists()) {
          const data = snapshot.val() as Record<string, CustomerRecord>
          const list = Object.entries(data)
            .map(([id, c]) => ({ ...c, customerId: c.customerId || id }))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
          setCustomers(list)

          if (reservedSale?.customer?.customerId) {
            setSelectedCustomerId(reservedSale.customer.customerId)
            const existing = list.find((c) => c.customerId === reservedSale.customer?.customerId)
            if (existing) {
              setCustomerName(existing.name || '')
              setCustomerPhone(existing.phone_number || '')
              setCustomerBirthDate(existing.birthDate || '')
              setCustomerSearchText(existing.name || '')
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar clientes:', err)
      } finally {
        setLoadingCustomers(false)
      }
    }
    void loadCustomers()
  }, [reservedSale])

  const hasPaymentContext = localSelectedItems.length > 0 || Boolean(reservedSale)

  const totalAmount = useMemo(() => {
    if (reservedSale) {
      return Number(reservedSale.totalAmount || 0)
    }

    return localSelectedItems.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0)
  }, [reservedSale, localSelectedItems])

  const totalItems = useMemo(() => {
    if (reservedSale) {
      return Number(reservedSale.totalItems || 0)
    }

    return localSelectedItems.reduce((sum, item) => sum + Number(item.qty || 0), 0)
  }, [reservedSale, localSelectedItems])

  const discountCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const parseCurrencyCents = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '')
    if (!digitsOnly) return 0
    return Number(digitsOnly) / 100
  }

  const getDiscountCurrencyDisplayValue = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return ''
    return discountCurrencyFormatter.format(value)
  }

  const parseNumericText = (value: string) => {
    const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '')
    if (!normalized) return 0
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const discountValue = parseCurrencyCents(discountValueText)
  const discountPercent = parseNumericText(discountPercentText)

  const clampedDiscountValue = totalAmount > 0 ? Math.max(0, Math.min(discountValue, totalAmount)) : 0
  const clampedDiscountPercent = totalAmount > 0 ? Math.max(0, Math.min(discountPercent, 100)) : 0

  const finalDiscountValue = useMemo(() => {
    if (discountValueText && !discountPercentText) {
      return clampedDiscountValue
    }

    if (discountPercentText && !discountValueText) {
      return (clampedDiscountPercent / 100) * totalAmount
    }

    if (discountValueText && discountPercentText) {
      return clampedDiscountValue
    }

    return 0
  }, [discountValueText, discountPercentText, clampedDiscountValue, clampedDiscountPercent, totalAmount])

  const finalDiscountPercent = useMemo(() => {
    if (totalAmount <= 0) return 0
    if (discountPercentText && !discountValueText) {
      return clampedDiscountPercent
    }
    return (finalDiscountValue / totalAmount) * 100
  }, [discountPercentText, discountValueText, totalAmount, clampedDiscountPercent, finalDiscountValue])

  const finalTotalAmount = Math.max(0, totalAmount - finalDiscountValue)

  const handleDiscountValueChange = (rawValue: string) => {
    if (!rawValue) {
      setDiscountValueText('')
      setDiscountPercentText('')
      return
    }

    const numericValue = parseCurrencyCents(rawValue)
    const safeTotal = Math.max(0, totalAmount)
    const clampedValue = Math.max(0, Math.min(numericValue, safeTotal))

    setDiscountValueText(getDiscountCurrencyDisplayValue(clampedValue))

    if (safeTotal <= 0) {
      setDiscountPercentText('')
      return
    }

    const percent = safeTotal > 0 ? (clampedValue / safeTotal) * 100 : 0
    setDiscountPercentText(percent.toFixed(2).replace('.', ','))
  }

  const handleDiscountPercentChange = (rawValue: string) => {
    setDiscountPercentText(rawValue)
    if (!rawValue) {
      setDiscountValueText('')
      return
    }

    const nextPercent = parseNumericText(rawValue)
    const clampedPercent = Math.max(0, Math.min(nextPercent, 100))
    const safeTotal = Math.max(0, totalAmount)

    if (safeTotal <= 0) {
      setDiscountValueText('')
      return
    }

    const rawDiscountValue = (clampedPercent / 100) * safeTotal
    const exactFinalTotal = safeTotal - rawDiscountValue
    const roundedFinalTotal = Math.round(exactFinalTotal)
    let finalDiscountValue = rawDiscountValue

    if (roundedFinalTotal >= 0 && roundedFinalTotal <= safeTotal) {
      const candidateDiscountValue = safeTotal - roundedFinalTotal
      if (candidateDiscountValue >= 0 && candidateDiscountValue <= safeTotal) {
        finalDiscountValue = candidateDiscountValue
      }
    }

    setDiscountValueText(getDiscountCurrencyDisplayValue(finalDiscountValue))
  }

  const discountApplied = finalDiscountValue > 0
  const discountDetails = discountApplied
    ? {
        discountValue: finalDiscountValue,
        discountPercent: finalDiscountPercent,
      }
    : null

  const handleSelectExistingCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId)
    const existing = customers.find((c) => c.customerId === customerId)
    if (existing) {
      setCustomerName(existing.name || '')
      setCustomerPhone(existing.phone_number || '')
      setCustomerBirthDate(existing.birthDate || '')
      setCustomerSearchText(existing.name || '')
      setCreatingNewCustomer(false)
    } else {
      setCustomerName('')
      setCustomerPhone('')
      setCustomerBirthDate('')
      setCustomerSearchText('')
    }
    setShowCustomerDropdown(false)
  }

  const filteredCustomers = useMemo(() => {
    const search = customerSearchText.trim().toLowerCase()
    if (!search) return customers
    return customers.filter((c) => {
      const nameMatch = (c.name || '').toLowerCase().includes(search)
      const phoneMatch = (c.phone_number || '').replace(/\D/g, '').includes(search)
      return nameMatch || phoneMatch
    })
  }, [customers, customerSearchText])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const buildCustomer = () => {
    const trimmedName = customerName.trim()
    const trimmedPhone = customerPhone.trim()
    const trimmedBirthDate = customerBirthDate.trim() || null

    if (!trimmedName && !trimmedPhone && !reservedSale?.customer && !selectedCustomerId) {
      return null
    }

    return {
      ...(reservedSale?.customer || {}),
      ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
      ...(trimmedName ? { name: trimmedName } : {}),
      ...(trimmedPhone ? { phone_number: trimmedPhone } : {}),
      ...(trimmedBirthDate ? { birthDate: trimmedBirthDate } : {}),
    }
  }

  const ensureCustomerRecord = async (customerData: ReturnType<typeof buildCustomer>) => {
    if (!customerData) return null
    if (customerData.customerId) return customerData.customerId
    if (!customerData.name?.trim()) return null

    const now = Date.now()
    const customerRef = push(ref(rtdb, 'customers'))
    const customerId = customerRef.key
    if (!customerId) return null

    const updates: Record<string, unknown> = {}
    updates[`customers/${customerId}`] = {
      customerId,
      name: customerData.name.trim(),
      phone_number: customerData.phone_number || null,
      birthDate: customerData.birthDate || null,
      email: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
      totalDebt: 0,
      totalPurchased: 0,
      totalPaid: 0,
    }
    await update(ref(rtdb), updates)
    return customerId
  }

  const handleSubmitPayment = async () => {
    if (!user) {
      setError('Usuario nao autenticado para concluir a venda.')
      return
    }

    if (!hasPaymentContext) {
      setError('Nao ha itens selecionados para pagamento.')
      return
    }

    if (!reservedSale && hasInvalidAdHocItem) {
      setError('Preencha o nome do produto, a quantidade e o valor unitario dos itens avulsos antes de confirmar.')
      return
    }

    if (finalTotalAmount <= 0) {
      setError('O valor total final da venda deve ser maior que zero para concluir o pagamento.')
      return
    }

    const trimmedCustomerName = customerName.trim()
    if (isAmortizacao && !trimmedCustomerName) {
      setError('Para pagamento por amortização, é obrigatório informar o nome do cliente.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const now = Date.now()
      const updates: Record<string, unknown> = {}
      const inventoryPatches: Array<{ productId: string; total: number; reserved: number; available: number }> = []
      let customer = buildCustomer()
      const normalizedNotes = hasAdHocItems && notes.trim()
        ? `${notes.trim()}${reservedSale ? '' : ' (inclui item avulso de venda no balcao)'}`
        : notes.trim() || null

      let customerId: string | null = null
      const hasAnyCustomerInfo = trimmedCustomerName || selectedCustomerId
      if (hasAnyCustomerInfo) {
        customerId = await ensureCustomerRecord(customer)
        if (customerId && customer) {
          customer = { ...customer, customerId }
        }
      }

      if (reservedSale) {
        for (const item of reservedSale.items || []) {
          if (!item.productId || !item.variationKey) {
            continue
          }

          const inventorySnapshot = await get(ref(rtdb, `inventory/${item.productId}`))

          if (!inventorySnapshot.exists()) {
            throw new Error(`Estoque nao encontrado para o produto ${item.productId}.`)
          }

          const inventory = inventorySnapshot.val() as { total?: number; available?: number; reserved?: number }
          const currentReserved = Number(inventory.reserved || 0)
          const currentTotal = Number(inventory.total || 0)

          if (currentReserved < item.quantity || currentTotal < item.quantity) {
            throw new Error(`A reserva do produto ${item.productName} nao cobre a baixa final do estoque.`)
          }

          const nextInventory = {
            total: currentTotal - item.quantity,
            reserved: currentReserved - item.quantity,
            available: Number(inventory.available || 0),
          }

          updates[`inventory/${item.productId}`] = nextInventory
          inventoryPatches.push({ productId: item.productId, ...nextInventory })

          const movementKey = push(ref(rtdb, 'stockMovements')).key
          if (movementKey) {
            updates[`stockMovements/${movementKey}`] = {
              productId: item.productId,
              variation: item.variationKey,
              quantity: item.quantity,
              type: 'finalize_reserved_sale',
              saleId: reservedSale.saleId,
              createdAt: now,
            }
          }
        }

        updates[`sales/${reservedSale.saleId}/paymentStatus`] = isAmortizacao ? 'pending' : 'paid'
        updates[`sales/${reservedSale.saleId}/paymentMethod`] = paymentMethod
        updates[`sales/${reservedSale.saleId}/fulfillmentStatus`] = 'delivered'
        updates[`sales/${reservedSale.saleId}/stockStatus`] = hasAdHocItems ? 'mixed' : 'deducted'
        updates[`sales/${reservedSale.saleId}/customer`] = customer
        updates[`sales/${reservedSale.saleId}/notes`] = normalizedNotes
        if (!isAmortizacao) updates[`sales/${reservedSale.saleId}/paidAt`] = now
        updates[`sales/${reservedSale.saleId}/deliveredAt`] = now
        updates[`sales/${reservedSale.saleId}/updatedAt`] = now
        updates[`sales/${reservedSale.saleId}/sellerUid`] = user.uid
        updates[`sales/${reservedSale.saleId}/originalTotalAmount`] = Number(reservedSale.totalAmount || 0)
        updates[`sales/${reservedSale.saleId}/discountValue`] = discountDetails?.discountValue ?? 0
        updates[`sales/${reservedSale.saleId}/discountPercent`] = discountDetails?.discountPercent ?? 0
        updates[`sales/${reservedSale.saleId}/discountApplied`] = Boolean(discountDetails)
        updates[`sales/${reservedSale.saleId}/totalAmount`] = finalTotalAmount
        if (isAmortizacao) {
          updates[`sales/${reservedSale.saleId}/debtAmount`] = finalTotalAmount
          updates[`sales/${reservedSale.saleId}/paidAmount`] = 0
          updates[`sales/${reservedSale.saleId}/amortizationCount`] = 0
        }
      } else {
        const saleRef = push(ref(rtdb, 'sales'))
        const saleId = saleRef.key

        if (!saleId) {
          throw new Error('Nao foi possivel gerar o identificador da venda.')
        }

        const saleItems: SaleItemRecord[] = []
        const deductedRegisteredItemCount = localSelectedItems.filter((item) => isRegisteredCounterSaleItem(item)).length

        for (const item of localSelectedItems) {
          if (isAdHocCounterSaleItem(item)) {
            saleItems.push({
              productId: null,
              variationKey: null,
              productName: item.productName.trim(),
              description: 'Item avulso da venda no balcao.',
              quantity: Number(item.qty || 0),
              unitPrice: Number(item.price || 0),
              lineTotal: Number(item.qty || 0) * Number(item.price || 0),
              size: null,
              color: null,
            })
            continue
          }

          const [productSnapshot, showcaseSnapshot, inventorySnapshot] = await Promise.all([
            get(ref(rtdb, `products/${item.productId}`)),
            get(ref(rtdb, `showcase/${item.productId}`)),
            get(ref(rtdb, `inventory/${item.productId}`)),
          ])

          if (!productSnapshot.exists() || !showcaseSnapshot.exists() || !inventorySnapshot.exists()) {
            throw new Error(`Produto ${item.productId} nao esta consistente no sistema.`)
          }

          const product = productSnapshot.val() as InternalProductRecord
          const showcase = showcaseSnapshot.val() as ShowcaseRecord
          const inventory = inventorySnapshot.val() as { total?: number; available?: number; reserved?: number }

          const showcaseVariations = { ...(showcase.variations || {}) }
          const productVariations = { ...(product.variations || {}) }
          const showcaseVariation = showcaseVariations[item.variationKey]
          const productVariation = productVariations[item.variationKey] || showcaseVariation
          const currentVariationStock = Number(showcaseVariation?.stock ?? productVariation?.stock ?? 0)
          const currentAvailable = Number(inventory.available || 0)
          const currentTotal = Number(inventory.total || 0)

          if (!showcaseVariation) {
            throw new Error(`Variacao ${item.variationKey} nao encontrada para ${item.productName}.`)
          }

          if (item.qty > currentVariationStock || item.qty > currentAvailable || item.qty > currentTotal) {
            throw new Error(`Estoque insuficiente para ${item.productName} (${variationLabel(item.variation)}).`)
          }

          const nextVariationStock = currentVariationStock - item.qty
          const nextInventory = {
            total: currentTotal - item.qty,
            reserved: Number(inventory.reserved || 0),
            available: currentAvailable - item.qty,
          }

          showcaseVariations[item.variationKey] = {
            ...showcaseVariation,
            stock: nextVariationStock,
          }
          productVariations[item.variationKey] = {
            ...productVariation,
            stock: nextVariationStock,
          }

          updates[`inventory/${item.productId}`] = nextInventory
          updates[`showcase/${item.productId}/variations`] = showcaseVariations
          updates[`showcase/${item.productId}/stock`] = hasVariationStock(showcaseVariations)
          updates[`showcase/${item.productId}/updatedAt`] = now
          updates[`products/${item.productId}/variations`] = productVariations
          updates[`products/${item.productId}/updatedAt`] = now
          inventoryPatches.push({ productId: item.productId, ...nextInventory })

          const movementKey = push(ref(rtdb, 'stockMovements')).key
          if (movementKey) {
            updates[`stockMovements/${movementKey}`] = {
              productId: item.productId,
              variation: item.variationKey,
              quantity: item.qty,
              type: 'sale_counter',
              saleId,
              createdAt: now,
            }
          }

          saleItems.push({
            productId: item.productId,
            variationKey: item.variationKey,
            productName: item.productName,
            description: item.description,
            quantity: item.qty,
            unitPrice: item.price,
            lineTotal: item.qty * item.price,
            size: item.variation.size,
            color: item.variation.color,
          })
        }

        const originalTotalAmount = saleItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0)
        const finalTotalItems = saleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        const stockStatus =
          hasAdHocItems && deductedRegisteredItemCount === 0
            ? 'no_stock'
            : hasAdHocItems && deductedRegisteredItemCount > 0
              ? 'mixed'
              : 'deducted'

        updates[`sales/${saleId}`] = {
          saleId,
          channel: 'balcao',
          source: 'logista',
          paymentStatus: isAmortizacao ? 'pending' : 'paid',
          paymentMethod,
          fulfillmentStatus: 'delivered',
          stockStatus,
          customer,
          items: saleItems,
          originalTotalAmount,
          discountValue: discountDetails?.discountValue ?? 0,
          discountPercent: discountDetails?.discountPercent ?? 0,
          discountApplied: Boolean(discountDetails),
          totalAmount: finalTotalAmount,
          totalItems: finalTotalItems,
          notes: normalizedNotes,
          createdAt: now,
          paidAt: isAmortizacao ? undefined : now,
          deliveredAt: now,
          updatedAt: now,
          sellerUid: user.uid,
          ...(hasAdHocItems ? { hasAdHocItems: true } : {}),
          ...(isAmortizacao
            ? {
                debtAmount: finalTotalAmount,
                paidAmount: 0,
                amortizationCount: 0,
              }
            : {}),
        }
      }

      if (customerId) {
        const customerRef = ref(rtdb, `customers/${customerId}`)
        const customerSnap = await get(customerRef)
        const existingCustomer = customerSnap.exists() ? (customerSnap.val() as CustomerRecord) : null
        const currentDebt = Number(existingCustomer?.totalDebt || 0)
        const currentPurchased = Number(existingCustomer?.totalPurchased || 0)
        const currentPaid = Number(existingCustomer?.totalPaid || 0)

        updates[`customers/${customerId}/totalPurchased`] = currentPurchased + finalTotalAmount
        updates[`customers/${customerId}/updatedAt`] = now

        if (isAmortizacao) {
          updates[`customers/${customerId}/totalDebt`] = currentDebt + finalTotalAmount
        } else {
          updates[`customers/${customerId}/totalPaid`] = currentPaid + finalTotalAmount
        }

        if (customer?.phone_number) {
          updates[`customers/${customerId}/phone_number`] = customer.phone_number
        }
        if (customer?.birthDate) {
          updates[`customers/${customerId}/birthDate`] = customer.birthDate
        }
      }

      updates[`${CATALOG_SYNC_PATH}/updatedAt`] = now
      updates[`${CATALOG_SYNC_PATH}/source`] = reservedSale
        ? isAmortizacao
          ? 'pagamento_reserva_balcao_amortizacao'
          : 'pagamento_reserva_balcao'
        : isAmortizacao
          ? 'pagamento_venda_balcao_amortizacao'
          : 'pagamento_venda_balcao'

      clearCounterSaleDraft()
      await update(ref(rtdb), updates)

      inventoryPatches.forEach((patch) => {
        patchCachedStockProduct(
          patch.productId,
          {
            totalStock: Number(patch.total || 0),
            reservedStock: Number(patch.reserved || 0),
            availableStock: Number(patch.available || 0),
            updatedAt: now,
          },
          now,
        )
      })

      navigate('/vendas', {
        replace: true,
        state: {
          clearCounterSaleDraft: true,
          successMessage: isAmortizacao
            ? reservedSale
              ? 'Venda reservada concluída. Débito registrado no cliente para amortização.'
              : 'Venda no balcão concluída. Débito registrado no cliente para amortização.'
            : reservedSale
              ? 'Pagamento registrado e venda reservada concluida com sucesso.'
              : 'Venda no balcao finalizada com sucesso.',
        },
      })
    } catch (paymentError) {
      console.error('Erro ao concluir pagamento da venda:', paymentError)
      setError(paymentError instanceof Error ? paymentError.message : 'Nao foi possivel concluir o pagamento da venda.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 24, padding: 24 }}>
      <section
        style={{
          ...cardStyle,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <FiCreditCard size={18} />
            <h1 style={{ margin: 0, fontSize: 28 }}>Forma de pagamento</h1>
          </div>
          <div style={{ color: logistaTheme.colors.textMuted }}>
            {reservedSale
              ? 'Conclua o pagamento para transformar a reserva em venda finalizada.'
              : 'Defina a forma de pagamento antes de concluir a venda no balcao.'}
          </div>
        </div>

        <button
          onClick={() => navigate('/vendas')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderRadius: 12,
            border: `1px solid ${logistaTheme.colors.borderStrong}`,
            background: logistaTheme.colors.surface,
            color: logistaTheme.colors.text,
            cursor: 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <FiArrowLeft size={16} />
          Voltar para vendas
        </button>
      </section>

      {!hasPaymentContext ? (
        <section style={cardStyle}>
          <div style={{ color: logistaTheme.colors.textMuted }}>
            Nenhuma venda foi enviada para esta etapa. Volte para a tela de vendas e selecione os produtos novamente.
          </div>
        </section>
      ) : (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <section style={{ display: 'grid', gap: 16, flex: '1 1 520px', minWidth: 0, maxWidth: '380px' }}>
            <div style={{...cardStyle, display: 'grid', gap: 8 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 24 }}>Forma de pagamento</h2>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  style={{
                    ...logistaInputStyle,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {paymentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {isAmortizacao ? (
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${logistaTheme.colors.infoBorder ?? logistaTheme.colors.accentBorder}`,
                    background: logistaTheme.colors.infoBackground ?? logistaTheme.colors.accentSoft,
                    color: logistaTheme.colors.infoText ?? logistaTheme.colors.accentDark,
                    padding: '12px 14px',
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                    <FiUsers size={16} />
                    Pagamento por Amortização
                  </div>
                  <div style={{ fontSize: 12 }}>
                    O valor total desta venda será registrado como débito do cliente e baixado conforme os pagamentos parciais (amortizações) forem sendo realizados.
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{...cardStyle, display: 'grid', gap: 8 }}>
              {!loadingCustomers ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div ref={customerDropdownRef} style={{ display: 'grid', gap: 6, position: 'relative' }}>
                    <h2 style={{ margin: 0, fontSize: 24 }}>Cliente</h2>
                    <input
                      value={customerSearchText}
                      onChange={(event) => {
                        setCustomerSearchText(event.target.value)
                        if (event.target.value && selectedCustomerId) {
                          setSelectedCustomerId('')
                          setCustomerName('')
                          setCustomerPhone('')
                          setCustomerBirthDate('')
                        }
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onClick={() => setShowCustomerDropdown(true)}
                      placeholder="Digite o nome ou telefone para buscar..."
                      style={{
                        ...logistaInputStyle,
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                    {showCustomerDropdown ? (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: 4,
                          maxHeight: 240,
                          overflowY: 'auto',
                          background: logistaTheme.colors.surface,
                          border: `1px solid ${logistaTheme.colors.border}`,
                          borderRadius: 12,
                          zIndex: 50,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId('')
                            setCustomerSearchText('')
                            setCustomerName('')
                            setCustomerPhone('')
                            setCustomerBirthDate('')
                            setCreatingNewCustomer(true)
                            setShowCustomerDropdown(false)
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 14px',
                            background: selectedCustomerId === '' && !creatingNewCustomer ? logistaTheme.colors.accentSoft : 'transparent',
                            border: 'none',
                            borderBottom: `1px solid ${logistaTheme.colors.border}`,
                            color: logistaTheme.colors.text,
                            cursor: 'pointer',
                            fontSize: 14,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>+ Novo cliente</span>
                          <span style={{ color: logistaTheme.colors.textMuted, fontSize: 12, display: 'block' }}>
                            Cadastrar cliente com os dados abaixo
                          </span>
                        </button>
                        {filteredCustomers.length === 0 ? (
                          <div
                            style={{
                              padding: '14px',
                              color: logistaTheme.colors.textMuted,
                              fontSize: 13,
                              textAlign: 'center',
                            }}
                          >
                            {customerSearchText.trim() ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado.'}
                          </div>
                        ) : (
                          filteredCustomers.map((c) => (
                            <button
                              key={c.customerId}
                              type="button"
                              onClick={() => handleSelectExistingCustomer(c.customerId || '')}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 14px',
                                background: selectedCustomerId === c.customerId ? logistaTheme.colors.accentSoft : 'transparent',
                                border: 'none',
                                borderBottom: `1px solid ${logistaTheme.colors.border}`,
                                color: logistaTheme.colors.text,
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                              <div style={{ color: logistaTheme.colors.textMuted, fontSize: 12 }}>
                                {c.phone_number || 'Telefone não informado'}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                    {selectedCustomerId && !creatingNewCustomer ? (
                      <div
                        style={{
                          marginTop: 4,
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: logistaTheme.colors.surfaceAlt,
                          border: `1px solid ${logistaTheme.colors.border}`,
                          display: 'grid',
                          gap: 2,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>
                            {customerName || 'Cliente selecionado'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId('')
                              setCustomerSearchText('')
                              setCustomerName('')
                              setCustomerPhone('')
                              setCustomerBirthDate('')
                            }}
                            style={{
                              padding: '4px 8px',
                              fontSize: 12,
                              border: `1px solid ${logistaTheme.colors.borderStrong}`,
                              background: logistaTheme.colors.surface,
                              borderRadius: 8,
                              cursor: 'pointer',
                              color: logistaTheme.colors.text,
                            }}
                          >
                            Limpar
                          </button>
                        </div>
                        <div style={{ color: logistaTheme.colors.textMuted, fontSize: 12 }}>
                          {customerPhone || 'Telefone não informado'}
                          {customerBirthDate ? ` · Nascimento: ${customerBirthDate}` : ''}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {!selectedCustomerId || creatingNewCustomer ? (
                    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, border: `1px dashed ${logistaTheme.colors.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: logistaTheme.colors.accentDark }}>
                        <FiUserPlus size={14} />
                        Dados do novo cliente
                      </div>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>
                          Nome completo
                          {isAmortizacao ? <span style={{ color: logistaTheme.colors.errorText }}>*</span> : null}
                        </span>
                        <input
                          value={customerName}
                          onChange={(event) => setCustomerName(event.target.value)}
                          placeholder={isAmortizacao ? 'Nome obrigatório para amortização' : 'Opcional (preencha para vincular à venda)'}
                          style={{
                            ...logistaInputStyle,
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                          }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>Telefone / WhatsApp</span>
                        <input
                          value={customerPhone}
                          onChange={(event) => setCustomerPhone(event.target.value)}
                          placeholder="(00) 00000-0000"
                          style={{
                            ...logistaInputStyle,
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                          }}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>Data de nascimento</span>
                        <input
                          type="date"
                          value={customerBirthDate}
                          onChange={(event) => setCustomerBirthDate(event.target.value)}
                          style={{
                            ...logistaInputStyle,
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                          }}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Nome do cliente</span>
                    <input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Opcional"
                      style={{
                        ...logistaInputStyle,
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Telefone do cliente</span>
                    <input
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Opcional"
                      style={{
                        ...logistaInputStyle,
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  </label>
                </div>
              )}

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Observacoes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Informacoes adicionais sobre a venda"
                  rows={4}
                  style={{
                    ...logistaInputStyle,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </label>
            </div>

            {error ? (
              <div
                style={{
                  borderRadius: 14,
                  border: `1px solid ${logistaTheme.colors.warningBorder}`,
                  background: logistaTheme.colors.warningBackground,
                  color: logistaTheme.colors.warningText,
                  padding: '14px 16px',
                }}
              >
                {error}
              </div>
            ) : null}
          </section>

          <aside style={{ ...cardStyle, flex: '1 1 320px', width: '100%', maxWidth: 380, minWidth: 0 }}>
            <div style={{ alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 24 }}>Resumo da venda</h2>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {reservedSale
                ? reservedSale.items.map((item, index) => (
                    <div
                      key={`${reservedSale.saleId}-${index}`}
                      style={{
                        border: `1px solid ${logistaTheme.colors.border}`,
                        borderRadius: 14,
                        padding: 14,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        background: logistaTheme.colors.surface,
                      }}
                    >
                      <div
                        style={{
                          width: 72,
                          flex: '0 0 72px',
                          aspectRatio: '1 / 1',
                          borderRadius: 12,
                          overflow: 'hidden',
                          border: `1px solid ${logistaTheme.colors.border}`,
                          background: logistaTheme.colors.surfaceAlt,
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: logistaTheme.colors.textMuted,
                            fontSize: 12,
                          }}
                        >
                          Reserva
                        </div>
                      </div>
                      <div style={{ flex: '1 1 200px', minWidth: 0, display: 'grid', gap: 6 }}>
                        <div style={{ fontWeight: 700 }}>{item.productName}</div>
                        <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                          {item.size || '-'} {item.color ? `• ${item.color}` : ''}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <span>{item.quantity} item(ns)</span>
                          <strong>{formatCurrency(item.lineTotal)}</strong>
                        </div>
                      </div>
                    </div>
                  ))
                : localSelectedItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: `1px solid ${logistaTheme.colors.border}`,
                        borderRadius: 14,
                        padding: 14,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        background: logistaTheme.colors.surface,
                      }}
                    >
                      <div
                        style={{
                          width: 72,
                          flex: '0 0 72px',
                          aspectRatio: '1 / 1',
                          borderRadius: 12,
                          overflow: 'hidden',
                          border: `1px solid ${logistaTheme.colors.border}`,
                          background: logistaTheme.colors.surfaceAlt,
                        }}
                      >
                        {isRegisteredCounterSaleItem(item) ? (
                          <FramedImage
                            src={item.image || ''}
                            alt={item.productName}
                            zoom={Number(item.mainImageZoom ?? 1)}
                            offsetX={Number(item.mainImageOffsetX ?? 0)}
                            offsetY={Number(item.mainImageOffsetY ?? 0)}
                            style={{ width: '100%', height: '100%', display: 'block' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: logistaTheme.colors.textMuted,
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            Avulso
                          </div>
                        )}
                      </div>
                      <div style={{ flex: '1 1 200px', minWidth: 0, display: 'grid', gap: 6 }}>
                        <div style={{ fontWeight: 700 }}>
                          {isRegisteredCounterSaleItem(item) || item.productName.trim()
                            ? item.productName
                            : '(Item avulso sem nome)'}
                        </div>
                        <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                          {isRegisteredCounterSaleItem(item) ? (
                            variationLabel(item.variation)
                          ) : (
                            <>Item não cadastrado · Unitário: {formatPriceInputValue(item.price)}</>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <span>
                            {Number(item.qty || 0)} item(ns)
                          </span>
                          <strong>{formatCurrency(getItemLineTotal(item))}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
            </div>

            <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${logistaTheme.colors.border}` }}>
              <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 14, color: logistaTheme.colors.text, fontWeight: 600 }}>
                  Desconto
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>
                      Valor do desconto (R$)
                    </span>
                    <input
                      inputMode="decimal"
                      value={discountValueText}
                      onChange={(event) => handleDiscountValueChange(event.target.value)}
                      placeholder="R$ 0,00"
                      disabled={totalAmount <= 0}
                      style={{
                        ...logistaInputStyle,
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 12px',
                      }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>
                      Porcentagem do desconto (%)
                    </span>
                    <input
                      inputMode="decimal"
                      value={discountPercentText}
                      onChange={(event) => handleDiscountPercentChange(event.target.value)}
                      placeholder="0,00%"
                      disabled={totalAmount <= 0}
                      style={{
                        ...logistaInputStyle,
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 12px',
                      }}
                    />
                  </label>
                </div>
                {totalAmount <= 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: logistaTheme.colors.textMuted,
                    }}
                  >
                    O desconto só pode ser aplicado após o total da venda ser maior que zero.
                  </div>
                ) : null}
              </div>
            </div>
            
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${logistaTheme.colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: logistaTheme.colors.textMuted }}>
                <span>Itens</span>
                <strong>{totalItems}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: logistaTheme.colors.textMuted }}>
                <span>Subtotal</span>
                <strong>{formatCurrency(totalAmount)}</strong>
              </div>
              {discountApplied ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: logistaTheme.colors.errorText }}>
                  <span>
                    Desconto ({finalDiscountPercent.toFixed(2).replace('.', ',')}%)
                  </span>
                  <strong>- {formatCurrency(finalDiscountValue)}</strong>
                </div>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, color: logistaTheme.colors.text, fontSize: 18 }}>
                <span>Total final</span>
                <strong>{formatCurrency(finalTotalAmount)}</strong>
              </div>

              {hasInvalidAdHocItem && !reservedSale ? (
                <div
                  style={{
                    marginBottom: 12,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: `1px solid ${logistaTheme.colors.warningBorder}`,
                    background: logistaTheme.colors.warningBackground,
                    color: logistaTheme.colors.warningText,
                    fontSize: 13,
                  }}
                >
                  Volte para a tela de vendas e preencha nome do produto, quantidade e valor unitário dos itens avulsos antes de confirmar.
                </div>
              ) : null}

              <button
                onClick={() => {
                  void handleSubmitPayment()
                }}
                disabled={saving || (!reservedSale && hasInvalidAdHocItem) || finalTotalAmount <= 0}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: 'none',
                  background: logistaTheme.colors.accent,
                  color: logistaTheme.colors.surface,
                  fontWeight: 800,
                  cursor: saving || (!reservedSale && hasInvalidAdHocItem) || finalTotalAmount <= 0 ? 'not-allowed' : 'pointer',
                  opacity: saving || (!reservedSale && hasInvalidAdHocItem) || finalTotalAmount <= 0 ? 0.7 : 1,
                }}
              >
                {saving
                  ? 'Concluindo pagamento...'
                  : reservedSale
                    ? 'Concluir reserva e pagar'
                    : 'Confirmar pagamento'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
