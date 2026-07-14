export type InfinitePayCheckoutItem = {
  itemId?: string
  quantity: number
  price: number
  description: string
  productId?: string
  variationKey?: string
  note?: string
}

export type InfinitePayCustomer = {
  name: string
  email?: string
  phone_number?: string
}

export type InfinitePayAddress = {
  cep: string
  number: string
  complement?: string
}

export type CreatePaymentInput = {
  cartId?: string
  items: InfinitePayCheckoutItem[]
  customer?: InfinitePayCustomer
  address?: InfinitePayAddress
}

export type CreatePaymentResponse = {
  url: string
  orderNsu: string
}

export type PaymentStatusInput = {
  orderNsu: string
  transactionNsu: string
  slug: string
}

export type PaymentStatusResponse = {
  success: boolean
  paid: boolean
  amount: number
  paid_amount: number
  installments: number
  capture_method: 'credit_card' | 'pix' | string
  order_nsu: string
  transaction_nsu: string
  slug: string
  receipt_url?: string
  source?: 'webhook' | 'payment_check'
}

const getApiBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL?.trim()

  if (!configuredBaseUrl) {
    return ''
  }

  return configuredBaseUrl.endsWith('/') ? configuredBaseUrl.slice(0, -1) : configuredBaseUrl
}

const buildApiUrl = (path: string) => `${getApiBaseUrl()}${path}`

const buildErrorMessage = async (response: Response) => {
  const fallbackMessage = `InfinitePay respondeu com status ${response.status}.`

  try {
    const data = (await response.json()) as { message?: string }
    return data.message || fallbackMessage
  } catch {
    return fallbackMessage
  }
}

export const createPayment = async ({ cartId, items, customer, address }: CreatePaymentInput): Promise<CreatePaymentResponse> => {
  const response = await fetch(buildApiUrl('/api/createCheckout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cartId,
      items,
      customer,
      address,
    }),
  })

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response))
  }

  return (await response.json()) as CreatePaymentResponse
}

export const paymentStatus = async ({
  orderNsu,
  transactionNsu,
  slug,
}: PaymentStatusInput): Promise<PaymentStatusResponse> => {
  const response = await fetch(buildApiUrl('/api/paymentStatus'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderNsu,
      transactionNsu,
      slug,
    }),
  })

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response))
  }

  return (await response.json()) as PaymentStatusResponse
}
