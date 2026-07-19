export type NumericFormValue = number | ''

export interface ProductPricingFormValues {
  unitCost: NumericFormValue
  packaging: NumericFormValue
  gifts: NumericFormValue
  accessories: NumericFormValue
  sellerCommission: NumericFormValue
  taxes: NumericFormValue
  operational: NumericFormValue
  grossMargin: NumericFormValue
  cardFee: NumericFormValue
  finalPrice: NumericFormValue
  promotionPrice: NumericFormValue
}

export interface ProductPricingPreview {
  unitaryCost: number
  logisticsCost: number
  totalFixedCost: number
  baseCost: number
  marginValue: number
  priceWithMargin: number
  grossMarginPercentage: number
  commissionValue: number
  taxesValue: number
  operationalValue: number
  totalOperationalPercentages: number
  beforeCard: number
  cardFeeValue: number
  suggestedFinalPrice: number
  chosenFinalPrice: number
  chosenPromotionPrice: number
  realMargin: number
  realMarginPercentage: number
  promotionalRealMargin: number
  promotionalRealMarginPercentage: number
  projectedPieces: number
  projectedRevenue: number
  projectedProfit: number
  profitabilityStatus: string
  profitabilityColor: string
}

const toNumber = (value: NumericFormValue) => (typeof value === 'number' ? value : 0)

const calculateRealMargin = (
  baseCost: number,
  finalPrice: number,
  sellerCommission: number,
  taxes: number,
  operational: number,
  cardFee: number,
) => {
  const commissionValue = finalPrice * (sellerCommission / 100)
  const taxesValue = (finalPrice + commissionValue) * (taxes / 100)
  const operationalValue = (finalPrice + commissionValue + taxesValue) * (operational / 100)
  const cardFeeValue = finalPrice * (cardFee / 100)
  const realMargin = finalPrice - (baseCost + commissionValue + taxesValue + operationalValue + cardFeeValue)
  const realMarginPercentage = finalPrice > 0 ? (realMargin / finalPrice) * 100 : 0

  return {
    realMargin,
    realMarginPercentage,
  }
}

export const getProductPricingPreview = (
  values: ProductPricingFormValues,
  logisticsCost: number,
  projectedPiecesInput = 0,
): ProductPricingPreview => {
  const unitaryCost = toNumber(values.unitCost)
  const packaging = toNumber(values.packaging)
  const gifts = toNumber(values.gifts)
  const accessories = toNumber(values.accessories)
  const sellerCommission = toNumber(values.sellerCommission)
  const taxes = toNumber(values.taxes)
  const operational = toNumber(values.operational)
  const grossMargin = toNumber(values.grossMargin)
  const cardFee = toNumber(values.cardFee)
  const informedFinalPrice = toNumber(values.finalPrice)
  const informedPromotionPrice = toNumber(values.promotionPrice)

  const totalFixedCost = unitaryCost + logisticsCost
  const baseCost = unitaryCost + packaging + gifts + accessories + logisticsCost
  const marginValue = grossMargin
  const priceWithMargin = baseCost + marginValue
  const grossMarginPercentage = baseCost > 0 ? (marginValue / baseCost) * 100 : 0

  const commissionValue = priceWithMargin * (sellerCommission / 100)
  const taxesValue = (priceWithMargin + commissionValue) * (taxes / 100)
  const operationalValue = (priceWithMargin + commissionValue + taxesValue) * (operational / 100)
  const totalOperationalPercentages = commissionValue + taxesValue + operationalValue
  const beforeCard = priceWithMargin + totalOperationalPercentages
  const cardFeeValue = beforeCard * (cardFee / 100)
  const suggestedFinalPrice = beforeCard + cardFeeValue

  const chosenFinalPrice = informedFinalPrice > 0 ? informedFinalPrice : suggestedFinalPrice
  const chosenPromotionPrice = informedPromotionPrice > 0 ? informedPromotionPrice : chosenFinalPrice

  const realMarginData = calculateRealMargin(baseCost, chosenFinalPrice, sellerCommission, taxes, operational, cardFee)
  const promotionalRealMarginData = calculateRealMargin(
    baseCost,
    chosenPromotionPrice,
    sellerCommission,
    taxes,
    operational,
    cardFee,
  )

  const projectedPieces = Math.max(0, Number.isFinite(projectedPiecesInput) ? projectedPiecesInput : 0)
  const projectedRevenue = chosenFinalPrice * projectedPieces
  const projectedProfit = realMarginData.realMargin * projectedPieces

  let profitabilityStatus = ''
  let profitabilityColor = ''
  if (realMarginData.realMarginPercentage >= 40) {
    profitabilityStatus = 'Alta Rentabilidade'
    profitabilityColor = '#059669'
  } else if (realMarginData.realMarginPercentage >= 20) {
    profitabilityStatus = 'Rentabilidade Média'
    profitabilityColor = '#d97706'
  } else {
    profitabilityStatus = 'Baixa Rentabilidade'
    profitabilityColor = '#dc2626'
  }

  return {
    unitaryCost,
    logisticsCost,
    totalFixedCost,
    baseCost,
    marginValue,
    priceWithMargin,
    grossMarginPercentage,
    commissionValue,
    taxesValue,
    operationalValue,
    totalOperationalPercentages,
    beforeCard,
    cardFeeValue,
    suggestedFinalPrice,
    chosenFinalPrice,
    chosenPromotionPrice,
    realMargin: realMarginData.realMargin,
    realMarginPercentage: realMarginData.realMarginPercentage,
    promotionalRealMargin: promotionalRealMarginData.realMargin,
    promotionalRealMarginPercentage: promotionalRealMarginData.realMarginPercentage,
    projectedPieces,
    projectedRevenue,
    projectedProfit,
    profitabilityStatus,
    profitabilityColor,
  }
}
