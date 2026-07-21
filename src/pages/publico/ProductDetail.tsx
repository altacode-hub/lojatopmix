import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { onValue, ref } from 'firebase/database'
import { useCart } from '../../context/CartContext'
import { rtdb } from '../../service/firebase'
import type { ShowcaseRecord } from '../../types/catalog'
import { getVariationOptions, variationLabel } from '../../utils/catalog'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

const thumbnailStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

type QuantityMessageState = {
  text: string
  autoDismiss?: boolean
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { add } = useCart()
  const [product, setProduct] = useState<(({ id: string } & ShowcaseRecord) | null)>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [addingToCart, setAddingToCart] = useState(false)
  const [viewportWidth, setViewportWidth] = useState<number>(() => (typeof window === 'undefined' ? 1440 : window.innerWidth))

  const [qty, setQty] = useState<number>(1)
  const [variationKey, setVariationKey] = useState<string>('')
  const [note, setNote] = useState('')
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [quantityMessage, setQuantityMessage] = useState<QuantityMessageState | null>(null)
  const [isQuantityMessageFading, setIsQuantityMessageFading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!id) return

    const showcaseRef = ref(rtdb, 'showcase')
    const unsubscribe = onValue(
      showcaseRef,
      (snapshot) => {
        const showcaseData = snapshot.exists() ? (snapshot.val() as Record<string, ShowcaseRecord>) : {}
        const productData = showcaseData[id] ? ({ id, ...showcaseData[id] } as { id: string } & ShowcaseRecord) : null
        setProduct(productData)
        setLoading(false)
      },
      (error) => {
        console.error('Erro ao carregar produto da vitrine:', error)
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [id])

  useEffect(() => {
    setQty(1)
    setVariationKey('')
    setNote('')
    setSelectedImageIndex(0)
    setQuantityMessage(null)
    setErrorMessage(null)
  }, [product?.id])

  const variations = useMemo(() => getVariationOptions(product?.variations), [product?.variations])
  const selectedVariation = useMemo(
    () => variations.find((variation) => variation.key === variationKey) || null,
    [variationKey, variations],
  )

  const galleryImages = useMemo(() => {
    if (!product) return []

    const mergedImages = [product.image, ...(product.images || [])].filter(
      (image): image is string => Boolean(image && image.trim()),
    )

    return Array.from(new Set(mergedImages))
  }, [product])

  useEffect(() => {
    if (galleryImages.length === 0) {
      setSelectedImageIndex(0)
      return
    }

    setSelectedImageIndex((currentIndex) => Math.min(currentIndex, galleryImages.length - 1))
  }, [galleryImages])

  useEffect(() => {
    if (!quantityMessage?.autoDismiss) {
      setIsQuantityMessageFading(false)
      return undefined
    }

    setIsQuantityMessageFading(false)

    const fadeTimeout = window.setTimeout(() => {
      setIsQuantityMessageFading(true)
    }, 3000)

    const clearTimeoutId = window.setTimeout(() => {
      setQuantityMessage(null)
      setIsQuantityMessageFading(false)
    }, 3600)

    return () => {
      window.clearTimeout(fadeTimeout)
      window.clearTimeout(clearTimeoutId)
    }
  }, [quantityMessage])

  if (loading) {
    return <div>Carregando produto...</div>
  }

  if (!product) {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>Produto não encontrado.</div>
        <button onClick={() => navigate(-1)}>Voltar</button>
      </div>
    )
  }

  const isTablet = viewportWidth < 1180
  const isMobile = viewportWidth < 820
  const selectedImage = galleryImages[selectedImageIndex] || product.image || ''
  const selectedVariationStock = selectedVariation?.stock ?? 0
  const isVariationUnavailable = !selectedVariation || selectedVariation.stock <= 0
  const canAdd = selectedVariationStock > 0 && qty > 0
  const totalPrice = product.price * qty

  const showQuantityMessage = (text: string, autoDismiss = false) => {
    setIsQuantityMessageFading(false)
    setQuantityMessage({ text, autoDismiss })
  }

  const handleQuantityInputAccess = () => {
    if (quantityMessage?.autoDismiss) {
      return
    }

    if (!selectedVariation) {
      showQuantityMessage('Selecione uma variacao para informar a quantidade.')
      return
    }

    if (selectedVariation.stock <= 0) {
      showQuantityMessage('Essa variacao esta esgotada no momento.')
      return
    }

    setQuantityMessage(null)
  }

  const handleQuantityChange = (nextRawValue: string | number) => {
    if (!selectedVariation) {
      showQuantityMessage('Selecione uma variacao para informar a quantidade.')
      return
    }

    if (selectedVariation.stock <= 0) {
      showQuantityMessage('Essa variacao esta esgotada no momento.')
      return
    }

    const nextQty = Math.max(1, Number(nextRawValue) || 1)
    if (nextQty > selectedVariation.stock) {
      setQty(selectedVariation.stock)
      showQuantityMessage(`Quantidade maxima disponivel para esta variacao: ${selectedVariation.stock} un.`, true)
      return
    }

    setQty(nextQty)
    if (!(quantityMessage?.autoDismiss && nextQty === selectedVariation.stock)) {
      setQuantityMessage(null)
    }
  }

  const handleDecreaseQty = () => {
    handleQuantityInputAccess()
    if (isVariationUnavailable) return
    setQty((currentQty) => Math.max(1, currentQty - 1))
    setQuantityMessage(null)
  }

  const handleIncreaseQty = () => {
    handleQuantityInputAccess()
    if (isVariationUnavailable) return
    handleQuantityChange(qty + 1)
  }

  const handleAdd = async () => {
    if (!selectedVariation || selectedVariation.stock <= 0) return

    const idVariant = `${product.id}:${variationKey}`
    const nameVariant = `${product.name} - ${variationLabel(selectedVariation)}${note ? ' (Obs: ' + note + ')' : ''}`

    try {
      setAddingToCart(true)
      setErrorMessage(null)
      await add({
        id: idVariant,
        productId: product.id,
        variationKey,
        name: nameVariant,
        price: product.price,
        qty,
        note: note.trim() || undefined,
      })
      navigate('/cliente/carrinho')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel reservar o item no carrinho.')
    } finally {
      setAddingToCart(false)
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : isTablet ? '90px minmax(0, 340px) minmax(340px, 1fr)' : '150px minmax(0, 540px) minmax(340px, 1fr)',
        gap: 18,
        alignItems: 'start',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          gap: 10,
          order: 1,
          overflowX: isMobile ? 'auto' : 'visible',
          maxHeight: isMobile ? 'none' : 560,
        }}
      >
        {galleryImages.map((image, index) => {
          const isPrimaryImage = index === 0
          const imageStyle = isPrimaryImage
            ? {
                ...thumbnailStyle,
                transform: `translate(${Number(product.mainImageOffsetX || 0)}%, ${Number(product.mainImageOffsetY || 0)}%) scale(${Number(product.mainImageZoom || 1)})`,
                transformOrigin: 'center center',
              }
            : thumbnailStyle

          return (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setSelectedImageIndex(index)}
              style={{
                minWidth: 78,
                maxWidth: 100,
                padding: 0,
                borderRadius: 14,
                overflow: 'hidden',
                border: selectedImageIndex === index ? '2px solid #b58516' : '1px solid #d6d3d1',
                background: '#fff',
                cursor: 'pointer',
                boxShadow: selectedImageIndex === index ? '0 0 0 3px rgba(181, 133, 22, 0.15)' : 'none',
              }}
            >
              <img src={image} alt={`${product.name} ${index + 1}`} style={imageStyle} />
            </button>
          )
        })}
      </div>

      <div
        style={{
          order: 2,
          borderRadius: 24,
          overflow: 'hidden',
          background: '#fff',
          border: '1px solid #ede7df',
          minHeight: isMobile ? 320 : 560,
        }}
      >
        {selectedImage ? (
          <img
            src={selectedImage}
            alt={product.name}
            style={
              selectedImageIndex === 0
                ? {
                    width: '100%',
                    height: '100%',
                    minHeight: isMobile ? 320 : 560,
                    objectFit: 'cover',
                    transform: `translate(${Number(product.mainImageOffsetX || 0)}%, ${Number(product.mainImageOffsetY || 0)}%) scale(${Number(product.mainImageZoom || 1)})`,
                    transformOrigin: 'center center',
                    display: 'block',
                  }
                : {
                    width: '100%',
                    height: '100%',
                    minHeight: isMobile ? 320 : 560,
                    objectFit: 'cover',
                    display: 'block',
                  }
            }
          />
        ) : (
          <div
            style={{
              minHeight: isMobile ? 320 : 560,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              background: '#f8fafc',
              padding: 16,
            }}
          >
            Foto em breve
          </div>
        )}
      </div>

      <div
        style={{
          order: 3,
          gridColumn: isMobile ? '1' : '3',
          background: '#f4f1ed',
          borderRadius: 24,
          padding: isMobile ? 20 : 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ fontSize: isMobile ? '17px' : '27px', lineHeight: 1.35, fontWeight: 700, color: '#3f3d56', textAlign: 'left' }}>
            {product.name}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#7c746d' }}>Quantidade</label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 150px',
              gap: 12,
              width: '100%',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 150,
                display: 'grid',
                gridTemplateColumns: '48px 1fr 48px',
                borderRadius: 999,
                border: '1px solid #e5ded7',
                background: isVariationUnavailable ? '#e8e3dd' : '#ece7e1',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={handleDecreaseQty}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#9b948c',
                  fontSize: 20,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.6em 1em'
                }}
              >
                -
              </button>
              <input
                type="tel"
                inputMode="numeric"
                value={qty}
                readOnly={isVariationUnavailable}
                onClick={handleQuantityInputAccess}
                onFocus={handleQuantityInputAccess}
                onChange={(event) => {
                  const numericValue = event.target.value.replace(/\D/g, '')
                  handleQuantityChange(numericValue)
                }}
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: '#5b554f',
                  textAlign: 'center',
                  fontSize: 16,
                  fontWeight: 600,
                  outline: 'none',
                  padding: 0,
                }}
              />
              <button
                type="button"
                onClick={handleIncreaseQty}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#9b948c',
                  fontSize: 20,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.6em 1em'
                }}
              >
                +
              </button>
            </div>
            <div
              style={{
                fontSize: isMobile ? '18px' : '24px',
                fontWeight: 800,
                color: '#3f3d56',
                whiteSpace: 'nowrap',
                width: '100%',
                textAlign: 'right',
              }}
            >
              {currencyFormatter.format(totalPrice)}
            </div>
          </div>
          {quantityMessage ? (
            <div
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 12,
                background: '#ec4899',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.4,
                opacity: isQuantityMessageFading ? 0 : 1,
                transform: isQuantityMessageFading ? 'translateY(-4px)' : 'translateY(0)',
                transition: 'opacity 0.6s ease, transform 0.6s ease',
              }}
            >
              {quantityMessage.text}
            </div>
          ) : null}
        </div>

        <div>
          <div style={{ marginBottom: 10, color: '#7c746d', fontSize: 14, fontWeight: 600, textAlign: 'left' }}>
            Cor / Tamanho
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {variations.map((variation) => {
              const isSelected = variationKey === variation.key
              const soldOut = variation.stock <= 0

              return (
                <label
                  key={variation.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 10px',
                    borderRadius: 14,
                    border: isSelected ? '1px solid #b58516' : '1px solid transparent',
                    background: isSelected ? '#fffaf0' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#4b495f', minWidth: 0 }}>
                    <input
                      type="radio"
                      name="variation"
                      value={variation.key}
                      checked={isSelected}
                      onChange={() => {
                        setVariationKey(variation.key)
                        setQuantityMessage(null)
                        setIsQuantityMessageFading(false)
                        setQty((currentQty) => {
                          if (variation.stock <= 0) return 1
                          return Math.min(Math.max(currentQty, 1), variation.stock)
                        })
                      }}
                      style={{ accentColor: '#b58516', margin: 0 }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {variationLabel(variation)}
                    </span>
                  </span>
                  <span
                    style={{
                      color: soldOut ? '#9b948c' : '#7c746d',
                      fontSize: 13,
                      fontWeight: soldOut ? 500 : 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {soldOut ? 'Esgotado' : `${variation.stock} un`}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <textarea
          placeholder="Inclua algum detalhe para este produto (opcional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '16px 14px',
            borderRadius: 14,
            border: '1px solid #ddd6cf',
            background: '#ebe6e0',
            minHeight: 96,
            resize: 'vertical',
            color: '#5b554f',
            outline: 'none',
          }}
        />

        {errorMessage ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: '#fff7ed',
              color: '#9a3412',
              border: '1px solid #fdba74',
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={!canAdd || addingToCart}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid transparent',
            background: canAdd && !addingToCart ? '#b58516' : '#b9b5b1',
            color: '#fff',
            fontWeight: 700,
            cursor: canAdd && !addingToCart ? 'pointer' : 'not-allowed',
          }}
        >
          {addingToCart ? 'Reservando...' : canAdd ? 'Adicionar ao carrinho' : 'Selecione'}
        </button>

        <Link
          to="/"
          style={{
            display: 'inline-block',
            textAlign: 'center',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid #b58516',
            color: '#b58516',
            textDecoration: 'none',
            fontWeight: 600,
            background: '#fffaf2',
          }}
        >
          Voltar para a loja
        </Link>
      </div>
    </div>
  )
}
