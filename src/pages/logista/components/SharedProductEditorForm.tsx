import { useMemo } from 'react'
import {
  FiFolderPlus,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiImage,
  FiPackage,
  FiPercent,
  FiSave,
  FiTarget,
  FiTrash2,
  FiTrendingUp,
  FiUploadCloud,
} from 'react-icons/fi'
import type { ProductPricingPreview, NumericFormValue } from '../productPricing'

export interface ProductCategoryOption {
  id: string
  name?: string
}

export interface ProductVariationInput {
  size: string
  color: string
  quantity: number
}

interface SharedProductEditorFormProps {
  categories: ProductCategoryOption[]
  sizes: string[]
  colors: string[]
  productName: string
  onProductNameChange: (value: string) => void
  supplierName: string
  onSupplierNameChange: (value: string) => void
  productDescription: string
  onProductDescriptionChange: (value: string) => void
  categoryId: string
  onCategoryIdChange: (value: string) => void
  images: string[]
  mainImageZoom: number
  onMainImageZoomChange: (value: number) => void
  mainImageOffsetX: number
  onMainImageOffsetXChange: (value: number) => void
  mainImageOffsetY: number
  onMainImageOffsetYChange: (value: number) => void
  uploadingImages: boolean
  onUploadImages: (files: File[]) => void
  onRemoveImage: (index: number) => void
  newVariationSize: string
  onNewVariationSizeChange: (value: string) => void
  newVariationColor: string
  onNewVariationColorChange: (value: string) => void
  newVariationQuantity: number | ''
  onNewVariationQuantityChange: (value: number | '') => void
  variations: ProductVariationInput[]
  onAddVariation: () => void
  onRemoveVariation: (index: number) => void
  unitCost: NumericFormValue
  onUnitCostChange: (value: NumericFormValue) => void
  packaging: NumericFormValue
  onPackagingChange: (value: NumericFormValue) => void
  gifts: NumericFormValue
  onGiftsChange: (value: NumericFormValue) => void
  accessories: NumericFormValue
  onAccessoriesChange: (value: NumericFormValue) => void
  sellerCommission: NumericFormValue
  onSellerCommissionChange: (value: NumericFormValue) => void
  taxes: NumericFormValue
  onTaxesChange: (value: NumericFormValue) => void
  operational: NumericFormValue
  onOperationalChange: (value: NumericFormValue) => void
  grossMargin: NumericFormValue
  onGrossMarginChange: (value: NumericFormValue) => void
  cardFee: NumericFormValue
  onCardFeeChange: (value: NumericFormValue) => void
  finalPrice: NumericFormValue
  onFinalPriceChange: (value: NumericFormValue) => void
  promotionPrice: NumericFormValue
  onPromotionPriceChange: (value: NumericFormValue) => void
  pricingPreview: ProductPricingPreview
  onSave?: () => void
  saveButtonLabel?: string
  saveButtonDisabled?: boolean
  onManageCategories?: () => void
}

const sectionCardStyle: React.CSSProperties = {
  background: '#faf5ff',
  border: '1px solid #e9d5ff',
  borderRadius: 16,
  padding: 20,
  marginBottom: 20,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
}

const innerCardStyle: React.CSSProperties = {
  border: '1px solid #e9d5ff',
  borderRadius: 16,
  padding: 20,
  background: '#fff',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: '#fff',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  marginBottom: 6,
  fontWeight: 600,
  textAlign: 'left',
}

const editorFrameSize = 280
const editorMaskInset = 0
const editorMaskAspectRatio = '4 / 5'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const getCurrencyDisplayValue = (value: NumericFormValue) => {
  if (value === '') return ''

  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''

  return currencyFormatter.format(numericValue)
}

const formatCurrencyNumber = (value: number) => currencyFormatter.format(value)
const formatPercentNumber = (value: number) => percentFormatter.format(value)

const parseCurrencyInputValue = (rawValue: string): NumericFormValue => {
  const digitsOnly = rawValue.replace(/\D/g, '')
  if (!digitsOnly) return ''

  return Number(digitsOnly) / 100
}

const currencyInput = (
  value: NumericFormValue,
  onChange: (value: NumericFormValue) => void,
  extraStyle?: React.CSSProperties,
) => (
  <div style={{ position: 'relative' }}>
    <span style={{ position: 'absolute', left: 12, top: 12, color: '#6b7280' }}>R$</span>
    <input
      type="text"
      value={getCurrencyDisplayValue(value)}
      inputMode="numeric"
      onChange={(event) => onChange(parseCurrencyInputValue(event.target.value))}
      style={{
        ...inputStyle,
        ...extraStyle,
        padding: '12px 14px 12px 36px',
      }}
    />
  </div>
)

const percentInput = (
  value: NumericFormValue,
  onChange: (value: NumericFormValue) => void,
  extraStyle?: React.CSSProperties,
) => (
  <div style={{ position: 'relative' }}>
    <input
      type="number"
      min={0}
      step="0.1"
      value={value}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : '')}
      style={{
        ...inputStyle,
        ...extraStyle,
        padding: '12px 40px 12px 14px',
      }}
    />
    <span style={{ position: 'absolute', right: 12, top: 12, color: '#6b7280' }}>%</span>
  </div>
)

export default function SharedProductEditorForm({
  categories,
  sizes,
  colors,
  productName,
  onProductNameChange,
  supplierName,
  onSupplierNameChange,
  productDescription,
  onProductDescriptionChange,
  categoryId,
  onCategoryIdChange,
  images,
  mainImageZoom,
  onMainImageZoomChange,
  mainImageOffsetX,
  onMainImageOffsetXChange,
  mainImageOffsetY,
  onMainImageOffsetYChange,
  uploadingImages,
  onUploadImages,
  onRemoveImage,
  newVariationSize,
  onNewVariationSizeChange,
  newVariationColor,
  onNewVariationColorChange,
  newVariationQuantity,
  onNewVariationQuantityChange,
  variations,
  onAddVariation,
  onRemoveVariation,
  unitCost,
  onUnitCostChange,
  packaging,
  onPackagingChange,
  gifts,
  onGiftsChange,
  accessories,
  onAccessoriesChange,
  sellerCommission,
  onSellerCommissionChange,
  taxes,
  onTaxesChange,
  operational,
  onOperationalChange,
  grossMargin,
  onGrossMarginChange,
  cardFee,
  onCardFeeChange,
  finalPrice,
  onFinalPriceChange,
  promotionPrice,
  onPromotionPriceChange,
  pricingPreview,
  onSave,
  saveButtonLabel = 'Salvar produto',
  saveButtonDisabled = false,
  onManageCategories,
}: SharedProductEditorFormProps) {
  const mainImageUrl = images[0] || ''
  const mainImagePreviewStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: `translate(${mainImageOffsetX}%, ${mainImageOffsetY}%) scale(${mainImageZoom})`,
      transformOrigin: 'center center',
      userSelect: 'none',
      pointerEvents: 'none',
    }),
    [mainImageOffsetX, mainImageOffsetY, mainImageZoom],
  )

  return (
    <>
      <div style={sectionCardStyle}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <FiImage /> Imagens do Produto
        </h2>
        <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: 14, textAlign: 'center' }}>
          Um produto pode ter varias imagens. A primeira imagem sera usada como principal.
        </p>

        <div style={innerCardStyle}>
          <label
            style={{
              marginBottom: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid #d1d5db',
              cursor: uploadingImages ? 'not-allowed' : 'pointer',
              opacity: uploadingImages ? 0.7 : 1,
            }}
          >
            <FiUploadCloud size={18} />
            {uploadingImages ? 'Enviando imagens...' : 'Enviar imagens'}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploadingImages}
              onChange={(event) => {
                const files = Array.from(event.target.files || [])
                if (files.length > 0) {
                  onUploadImages(files)
                }
                event.target.value = ''
              }}
              style={{ display: 'none' }}
            />
          </label>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, background: '#fafafa', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, textAlign: 'left' }}>Imagem principal da vitrine</div>
            <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'left', marginBottom: 16 }}>
              Ajuste o enquadramento da primeira imagem para controlar como ela aparece na vitrine.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: 16, alignItems: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  width: editorFrameSize,
                  maxWidth: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  overflow: 'hidden',
                  background: '#f8fafc',
                  justifySelf: 'center',
                }}
              >
                {mainImageUrl ? (
                  <>
                    <img src={mainImageUrl} alt="Recorte da imagem principal" style={mainImagePreviewStyle} />
                    <div
                      style={{
                        position: 'absolute',
                        top: editorMaskInset,
                        right: editorMaskInset,
                        bottom: editorMaskInset,
                        left: editorMaskInset,
                        aspectRatio: editorMaskAspectRatio,
                        margin: 'auto',
                        width: `calc(100% - ${editorMaskInset * 2}px)`,
                        maxHeight: `calc(100% - ${editorMaskInset * 2}px)`,
                        borderRadius: 16,
                        border: '2px solid rgba(255,255,255,0.95)',
                        boxShadow: '0 0 0 999px rgba(15, 23, 42, 0.35)',
                      }}
                    />
                  </>
                ) : (
                  <div style={{ color: '#9ca3af', display: 'grid', gap: 8, justifyItems: 'center', alignContent: 'center', height: '100%' }}>
                    <FiImage size={36} />
                    <span>Envie uma imagem para ajustar</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 84,
                    height: 112,
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: '1px solid #d1d5db',
                    position: 'relative',
                    background: '#f8fafc',
                  }}
                >
                  {mainImageUrl ? (
                    <img src={mainImageUrl} alt="Miniatura da imagem principal" style={mainImagePreviewStyle} />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9ca3af',
                        fontSize: 11,
                      }}
                    >
                      Prévia
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Miniatura final</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, textAlign: 'left' }}>Zoom</label>
                <input
                  type="range"
                  min="1"
                  max="2.4"
                  step="0.05"
                  value={mainImageZoom}
                  onChange={(event) => onMainImageZoomChange(Number(event.target.value))}
                  style={{ width: '100%' }}
                  disabled={!mainImageUrl}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, textAlign: 'left' }}>Mover horizontalmente</label>
                <input
                  type="range"
                  min="-35"
                  max="35"
                  step="1"
                  value={mainImageOffsetX}
                  onChange={(event) => onMainImageOffsetXChange(Number(event.target.value))}
                  style={{ width: '100%' }}
                  disabled={!mainImageUrl}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, textAlign: 'left' }}>Mover verticalmente</label>
                <input
                  type="range"
                  min="-35"
                  max="35"
                  step="1"
                  value={mainImageOffsetY}
                  onChange={(event) => onMainImageOffsetYChange(Number(event.target.value))}
                  style={{ width: '100%' }}
                  disabled={!mainImageUrl}
                />
              </div>
            </div>
          </div>

          {images.length === 0 ? (
            <div
              style={{
                minHeight: 180,
                borderRadius: 16,
                border: '1px dashed #d1d5db',
                background: '#f9fafb',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                color: '#9ca3af',
              }}
            >
              <FiImage size={36} />
              <span>Sem imagens cadastradas</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {images.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  style={{
                    borderRadius: 14,
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                  }}
                >
                  <div style={{ height: 180, background: '#f9fafb' }}>
                    <img
                      src={image}
                      alt={`Imagem ${index + 1}`}
                      style={
                        index === 0
                          ? {
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              transform: `translate(${mainImageOffsetX}%, ${mainImageOffsetY}%) scale(${mainImageZoom})`,
                              transformOrigin: 'center center',
                            }
                          : { width: '100%', height: '100%', objectFit: 'cover' }
                      }
                    />
                  </div>
                  <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: index === 0 ? '#7c3aed' : '#4b5563' }}>
                      {index === 0 ? 'Imagem principal' : `Imagem ${index + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveImage(index)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <FiTrash2 size={16} />
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={sectionCardStyle}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <FiPackage /> Informações do Produto
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Nome do Produto *</label>
            <input
              type="text"
              value={productName}
              onChange={(event) => onProductNameChange(event.target.value)}
              placeholder="Digite o nome do produto"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Fornecedor (opcional)</label>
            <input
              type="text"
              value={supplierName}
              onChange={(event) => onSupplierNameChange(event.target.value)}
              placeholder="Nome do fornecedor"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Descrição (opcional)</label>
          <textarea
            value={productDescription}
            onChange={(event) => onProductDescriptionChange(event.target.value)}
            placeholder="Descreva os detalhes do produto"
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Categoria (opcional)</label>
          <select value={categoryId} onChange={(event) => onCategoryIdChange(event.target.value)} style={inputStyle}>
            <option value="">Selecione uma categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {onManageCategories && (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={onManageCategories}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid #d8b4fe',
                  background: '#fff',
                  color: '#7c3aed',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <FiFolderPlus size={16} />
                Gerenciar categorias
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={sectionCardStyle}>
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18 }}>Variações do Produto</h3>
          <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: 14 }}>
            Adicione variações de tamanho e cor (opcional)
          </p>

          <div style={innerCardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Tamanho</label>
                <select value={newVariationSize} onChange={(event) => onNewVariationSizeChange(event.target.value)} style={inputStyle}>
                  <option value="">Selecione um tamanho</option>
                  {sizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Cor (opcional)</label>
                <select value={newVariationColor} onChange={(event) => onNewVariationColorChange(event.target.value)} style={inputStyle}>
                  <option value="">Selecione uma cor</option>
                  {colors.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Quantidade</label>
                <input
                  type="number"
                  min={1}
                  value={newVariationQuantity}
                  onChange={(event) => onNewVariationQuantityChange(event.target.value ? Number(event.target.value) : '')}
                  style={inputStyle}
                />
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onAddVariation}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    width: '100%',
                  }}
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {variations.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {variations.map((variation, index) => (
                  <div
                    key={`${variation.size}-${variation.color}-${index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      background: '#f3e8ff',
                      borderRadius: 8,
                      color: '#7c3aed',
                    }}
                  >
                    <span>
                      {variation.size} {variation.color && `(${variation.color})`} - {variation.quantity} un
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveVariation(index)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#7c3aed',
                        cursor: 'pointer',
                        fontSize: 16,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={sectionCardStyle}>
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            R$ Precificação
          </h3>
          <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: 14 }}>
            Siga a sequência: custos base → percentuais → margem → preço final → preço promoção.
          </p>

          <div style={innerCardStyle}>
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#6b7280', textAlign: 'left' }}>1. Custos Base</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Custo Unitário *</label>
                  {currencyInput(unitCost, onUnitCostChange)}
                </div>
                <div>
                  <label style={labelStyle}>Embalagem</label>
                  {currencyInput(packaging, onPackagingChange)}
                </div>
                <div>
                  <label style={labelStyle}>Brindes</label>
                  {currencyInput(gifts, onGiftsChange)}
                </div>
                <div>
                  <label style={labelStyle}>Aviamentos (etiquetas, cartões...)</label>
                  {currencyInput(accessories, onAccessoriesChange)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#6b7280', textAlign: 'left' }}>2. Percentuais Operacionais</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Comissão do Vendedor (opcional)</label>
                  {percentInput(sellerCommission, onSellerCommissionChange)}
                </div>
                <div>
                  <label style={labelStyle}>Impostos ME (opcional)</label>
                  {percentInput(taxes, onTaxesChange)}
                </div>
                <div>
                  <label style={labelStyle}>Custos Operacionais (opcional)</label>
                  {percentInput(operational, onOperationalChange)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#6b7280', textAlign: 'left' }}>3. Taxa Final</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FiCreditCard /> Taxa Cartão
                    </span>
                  </label>
                  {percentInput(cardFee, onCardFeeChange, { background: '#faf5ff' })}
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#6b7280', textAlign: 'left' }}>4. Margem e Venda</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Margem Bruta (R$)</label>
                  {currencyInput(grossMargin, onGrossMarginChange)}
                </div>
                <div>
                  <label style={labelStyle}>Preço Sugerido</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: '#6b7280' }}>R$</span>
                    <input
                      type="text"
                      value={formatCurrencyNumber(pricingPreview.suggestedFinalPrice)}
                      readOnly
                      style={{
                        ...inputStyle,
                        padding: '12px 14px 12px 36px',
                        background: '#f9fafb',
                        color: '#2563eb',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Preço Final</label>
                  {currencyInput(finalPrice, onFinalPriceChange)}
                </div>
                <div>
                  <label style={labelStyle}>Preço Promoção</label>
                  {currencyInput(promotionPrice, onPromotionPriceChange)}
                </div>
                <div>
                  <label style={labelStyle}>Margem Real</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: '#6b7280' }}>R$</span>
                    <input
                      type="text"
                      value={formatCurrencyNumber(pricingPreview.realMargin)}
                      readOnly
                      style={{
                        ...inputStyle,
                        padding: '12px 14px 12px 36px',
                        background: '#f9fafb',
                        color: pricingPreview.realMargin >= 0 ? '#059669' : '#dc2626',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Margem Real (%)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={formatPercentNumber(pricingPreview.realMarginPercentage)}
                      readOnly
                      style={{
                        ...inputStyle,
                        padding: '12px 40px 12px 14px',
                        background: '#f9fafb',
                        color: pricingPreview.realMarginPercentage >= 0 ? '#059669' : '#dc2626',
                        fontWeight: 700,
                      }}
                    />
                    <span style={{ position: 'absolute', right: 12, top: 12, color: '#6b7280' }}>%</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, color: '#6b7280', fontSize: 13, textAlign: 'left' }}>
                Quando o preço promoção estiver zerado, ele assume automaticamente o mesmo valor do preço final.
              </div>
            </div>
          </div>
        </div>

        {onSave && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <button
              type="button"
              onClick={onSave}
              disabled={saveButtonDisabled}
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
                color: '#fff',
                cursor: saveButtonDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                opacity: saveButtonDisabled ? 0.7 : 1,
              }}
            >
              <FiSave size={16} />
              {saveButtonLabel}
            </button>
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiTrendingUp /> Preview da Precificação
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, color: '#6b7280', textAlign: 'left' }}>Estrutura de Custos e Precificação:</div>

            <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600 }}>
                <FiPackage /> Custos Fixos Totais
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Custo unitário:</span>
                  <span style={{ fontWeight: 600 }}>R$ {formatCurrencyNumber(pricingPreview.unitaryCost)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>+ Logística:</span>
                  <span style={{ fontWeight: 600 }}>R$ {formatCurrencyNumber(pricingPreview.logisticsCost)}</span>
                </div>
                <div style={{ borderTop: '1px dashed #fbbf24', margin: '8px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#d97706' }}>
                  <span>= Custo Total Unitário:</span>
                  <span>R$ {formatCurrencyNumber(pricingPreview.baseCost)}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#dbeafe', border: '1px solid #3b82f6', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600 }}>
                <FiDollarSign /> Aplicação da Margem
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Custo Base Total:</span>
                  <span style={{ fontWeight: 600 }}>R$ {formatCurrencyNumber(pricingPreview.baseCost)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>+ Margem Bruta ({formatPercentNumber(pricingPreview.grossMarginPercentage)}%):</span>
                  <span style={{ fontWeight: 600 }}>R$ {formatCurrencyNumber(pricingPreview.marginValue)}</span>
                </div>
                <div style={{ borderTop: '1px dashed #3b82f6', margin: '8px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#2563eb' }}>
                  <span>= Preço com Margem:</span>
                  <span>R$ {formatCurrencyNumber(pricingPreview.priceWithMargin)}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600 }}>
                <FiPercent /> Percentuais Operacionais
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, textAlign: 'left' }}>
                Aplicados sobre o preço com margem calculado.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Comissão:</span>
                  <span style={{ fontWeight: 600 }}>R$ {formatCurrencyNumber(pricingPreview.commissionValue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Impostos:</span>
                  <span style={{ fontWeight: 600 }}>R$ {formatCurrencyNumber(pricingPreview.taxesValue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Operacional:</span>
                  <span style={{ fontWeight: 600 }}>R$ {formatCurrencyNumber(pricingPreview.operationalValue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#d97706' }}>
                  <span>Total de Percentuais Embutidos:</span>
                  <span>R$ {formatCurrencyNumber(pricingPreview.totalOperationalPercentages)}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600 }}>
                <FiCreditCard /> Taxa de Cartão
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Preço sugerido:</span>
                  <span style={{ fontWeight: 600 }}>R$ {formatCurrencyNumber(pricingPreview.suggestedFinalPrice)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Preço final informado:</span>
                  <span style={{ fontWeight: 700 }}>R$ {formatCurrencyNumber(pricingPreview.chosenFinalPrice)}</span>
                </div>
                {pricingPreview.chosenPromotionPrice > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Preço promoção:</span>
                    <span style={{ fontWeight: 700 }}>R$ {formatCurrencyNumber(pricingPreview.chosenPromotionPrice)}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600 }}>
                <FiCheckCircle /> Lucro Real
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FiTrendingUp /> Margem Real por Peça:
                  </span>
                  <span style={{ fontWeight: 600 }}>R$ {formatCurrencyNumber(pricingPreview.realMargin)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FiTarget /> Margem Real:
                  </span>
                  <span>{formatPercentNumber(pricingPreview.realMarginPercentage)}%</span>
                </div>
                {pricingPreview.chosenPromotionPrice > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Margem com promoção:</span>
                    <span style={{ fontWeight: 600 }}>
                      R$ {formatCurrencyNumber(pricingPreview.promotionalRealMargin)} ({formatPercentNumber(pricingPreview.promotionalRealMarginPercentage)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: '#faf5ff', border: '1px solid #a78bfa', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600, color: '#7c3aed', justifyContent: 'center' }}>
                <FiTarget /> Valor de Revenda Ideal
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Preço sugerido:</span>
                  <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: 18 }}>
                    R$ {formatCurrencyNumber(pricingPreview.suggestedFinalPrice)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Preço final escolhido:</span>
                  <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: 18 }}>
                    R$ {formatCurrencyNumber(pricingPreview.chosenFinalPrice)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
                  Projeção de Receita ({pricingPreview.projectedPieces} peças)
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>R$ {formatCurrencyNumber(pricingPreview.projectedRevenue)}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Receita líquida total</div>
              </div>
              <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
                  Projeção de Lucro ({pricingPreview.projectedPieces} peças)
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>R$ {formatCurrencyNumber(pricingPreview.projectedProfit)}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Lucro líquido total</div>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  padding: '8px 24px',
                  borderRadius: 20,
                  background: `${pricingPreview.profitabilityColor}10`,
                  color: pricingPreview.profitabilityColor,
                  fontWeight: 700,
                  fontSize: 14,
                  border: `1px solid ${pricingPreview.profitabilityColor}`,
                }}
              >
                {pricingPreview.profitabilityStatus}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
