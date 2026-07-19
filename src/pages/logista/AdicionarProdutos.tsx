import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rtdb, storage } from '../../service/firebase'
import { get, push, ref, update } from 'firebase/database'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { FiEdit, FiPackage, FiTrash2, FiTrendingUp } from 'react-icons/fi'
import { buildVariationKey } from '../../utils/catalog'
import type { CatalogCategoryRecord, InternalProductRecord, ShowcaseRecord } from '../../types/catalog'
import { buildInventoryProductRow, CATALOG_SYNC_PATH, upsertCachedStockProduct } from './stockCache'
import SharedProductEditorForm, { type ProductCategoryOption, type ProductVariationInput } from './components/SharedProductEditorForm'
import { getProductPricingPreview } from './productPricing'
import { useMediaQuery } from '../../hooks/useMediaQuery'

interface Product {
  id: string
  name: string
  description: string
  supplierName: string
  categoryId: string
  images: string[]
  mainImageZoom: number
  mainImageOffsetX: number
  mainImageOffsetY: number
  unitCost: number
  packaging: number
  gifts: number
  accessories: number
  sellerCommission: number
  taxes: number
  operational: number
  grossMargin: number
  cardFee: number
  finalPrice: number
  promotionPrice: number
  realMargin: number
  salePrice: number
  priceWithMargin: number
  grossMarginPercentage: number
  totalPieces: number
  variations: ProductVariationInput[]
}

interface ProductFormDraft {
  editingProductId: string | null
  productName: string
  productDescription: string
  supplierName: string
  categoryId: string
  productImages: string[]
  mainImageZoom: number
  mainImageOffsetX: number
  mainImageOffsetY: number
  unitCost: number | ''
  packaging: number | ''
  gifts: number | ''
  accessories: number | ''
  sellerCommission: number | ''
  taxes: number | ''
  operational: number | ''
  grossMargin: number | ''
  cardFee: number | ''
  finalPrice: number | ''
  promotionPrice: number | ''
  variations: ProductVariationInput[]
  newVariationSize: string
  newVariationColor: string
  newVariationQuantity: number | ''
}

interface PurchaseRecord {
  name?: string
  totalPieces: number
  costs?: {
    freight?: number
    travel?: number
    consultancy?: number
    other?: number
  }
}

interface CategoryRecord extends ProductCategoryOption {
  image?: string
  order?: number
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export default function AdicionarProdutos() {
  const { purchaseId } = useParams<{ purchaseId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  const [purchase, setPurchase] = useState<PurchaseRecord | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  
  // Current form state
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [productImages, setProductImages] = useState<string[]>([])
  const [mainImageZoom, setMainImageZoom] = useState(1)
  const [mainImageOffsetX, setMainImageOffsetX] = useState(0)
  const [mainImageOffsetY, setMainImageOffsetY] = useState(0)
  const [unitCost, setUnitCost] = useState<number | ''>('')
  const [packaging, setPackaging] = useState<number | ''>('')
  const [gifts, setGifts] = useState<number | ''>('')
  const [accessories, setAccessories] = useState<number | ''>('')
  const [sellerCommission, setSellerCommission] = useState<number | ''>('')
  const [taxes, setTaxes] = useState<number | ''>('')
  const [operational, setOperational] = useState<number | ''>('')
  const [grossMargin, setGrossMargin] = useState<number | ''>('')
  const [cardFee, setCardFee] = useState<number | ''>('')
  const [finalPrice, setFinalPrice] = useState<number | ''>('')
  const [promotionPrice, setPromotionPrice] = useState<number | ''>('')
  const [variations, setVariations] = useState<ProductVariationInput[]>([])
  const [newVariationSize, setNewVariationSize] = useState('')
  const [newVariationColor, setNewVariationColor] = useState('')
  const [newVariationQuantity, setNewVariationQuantity] = useState<number | ''>('')
  const [uploadingImages, setUploadingImages] = useState(false)
  
  // Categories
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [sizes] = useState(['34', '36', '38', '40', '42', '44', '46', 'PP', 'P', 'M', 'G', 'GG', 'XG', 'Único'])

  const getDraftStorageKey = (id: string) => `adicionar-produtos-rascunho:${id}`
  const getFormDraftStorageKey = (id: string) => `adicionar-produtos-formulario:${id}`

  const readDraftProducts = useCallback((id: string) => {
    if (typeof window === 'undefined') return null

    try {
      const rawDraft = window.localStorage.getItem(getDraftStorageKey(id))
      if (!rawDraft) return null

      const parsedDraft = JSON.parse(rawDraft)

      if (Array.isArray(parsedDraft)) {
        return parsedDraft as Product[]
      }

      if (Array.isArray(parsedDraft?.products)) {
        return parsedDraft.products as Product[]
      }

      return null
    } catch (error) {
      console.error('Error reading local draft:', error)
      window.localStorage.removeItem(getDraftStorageKey(id))
      return null
    }
  }, [])

  const readFormDraft = useCallback((id: string) => {
    if (typeof window === 'undefined') return null

    try {
      const rawDraft = window.localStorage.getItem(getFormDraftStorageKey(id))
      if (!rawDraft) return null

      const parsedDraft = JSON.parse(rawDraft)

      if (parsedDraft && typeof parsedDraft === 'object') {
        return parsedDraft as ProductFormDraft
      }

      return null
    } catch (error) {
      console.error('Error reading local form draft:', error)
      window.localStorage.removeItem(getFormDraftStorageKey(id))
      return null
    }
  }, [])

  const applyFormDraft = useCallback((draft: ProductFormDraft) => {
    setEditingProductId(draft.editingProductId)
    setProductName(draft.productName)
    setProductDescription(draft.productDescription)
    setSupplierName(draft.supplierName)
    setCategoryId(draft.categoryId)
    setProductImages(draft.productImages || [])
    setMainImageZoom(Number(draft.mainImageZoom || 1))
    setMainImageOffsetX(Number(draft.mainImageOffsetX || 0))
    setMainImageOffsetY(Number(draft.mainImageOffsetY || 0))
    setUnitCost(draft.unitCost)
    setPackaging(draft.packaging)
    setGifts(draft.gifts)
    setAccessories(draft.accessories)
    setSellerCommission(draft.sellerCommission)
    setTaxes(draft.taxes)
    setOperational(draft.operational)
    setGrossMargin(draft.grossMargin)
    setCardFee(draft.cardFee)
    setFinalPrice(draft.finalPrice)
    setPromotionPrice(draft.promotionPrice)
    setVariations(draft.variations)
    setNewVariationSize(draft.newVariationSize)
    setNewVariationColor(draft.newVariationColor)
    setNewVariationQuantity(draft.newVariationQuantity)
  }, [])
  
  // Load purchase and categories
  useEffect(() => {
    const loadData = async () => {
      if (!purchaseId) return
      
      try {
        // Load purchase
        const purchaseSnap = await get(ref(rtdb, `purchases/${purchaseId}`))
        const purchaseData = purchaseSnap.exists() ? (purchaseSnap.val() as PurchaseRecord) : null
        if (purchaseData) {
          setPurchase(purchaseData)
        }
        
        // Load categories
        const categoriesSnap = await get(ref(rtdb, 'categories'))
        if (categoriesSnap.exists()) {
          const cats: CategoryRecord[] = []
          categoriesSnap.forEach((child) => {
            const categoryData = (child.val() || {}) as CatalogCategoryRecord
            cats.push({
              id: child.key || '',
              name: categoryData.name,
              image: categoryData.image,
              order: categoryData.order,
            })
          })
          setCategories(cats.sort((a, b) => Number(a.order || 0) - Number(b.order || 0)))
        }
        
        // Load existing products in the purchase
        const loadedProducts: Product[] = []
        const purchaseItemsSnap = await get(ref(rtdb, `purchaseItems/${purchaseId}`))
        if (purchaseItemsSnap.exists()) {
          const purchaseItems = purchaseItemsSnap.val()
          
          for (const productId in purchaseItems) {
            const productSnap = await get(ref(rtdb, `products/${productId}`))
            if (productSnap.exists()) {
              const productData = productSnap.val()
              const pricing = productData.pricing || {}
              
              // Convert variations from object to array
              const variationsArray: ProductVariationInput[] = []
              if (productData.variations) {
                for (const key in productData.variations) {
                  const v = productData.variations[key]
                  variationsArray.push({
                    size: v.size,
                    color: v.color,
                    quantity: v.stock || v.quantity || 0
                  })
                }
              }
              
              // Calculate the additional fields we need (priceWithMargin, grossMarginPercentage, totalPieces)
              const tempUnitCost = pricing.unitCost || 0
              const tempPackaging = pricing.packaging || 0
              const tempGifts = pricing.gifts || 0
              const tempAccessories = pricing.accessories || 0
              const tempLogisticsCost = purchaseData && purchaseData.totalPieces > 0 
                ? Number(((purchaseData.costs?.freight || 0) + (purchaseData.costs?.travel || 0) + (purchaseData.costs?.consultancy || 0) + (purchaseData.costs?.other || 0)) / purchaseData.totalPieces)
                : 0
              const tempGrossMargin = pricing.grossMargin || 0
              
              const tempBaseCost = tempUnitCost + tempPackaging + tempGifts + tempAccessories + tempLogisticsCost
              const tempPriceWithMargin = tempBaseCost + tempGrossMargin
              const tempGrossMarginPercentage = tempBaseCost > 0 ? (tempGrossMargin / tempBaseCost) * 100 : 0
              const tempTotalPieces = variationsArray.reduce((sum, v) => sum + v.quantity, 0)
              
              loadedProducts.push({
                id: productId,
                name: productData.name || '',
                description: productData.description || '',
                supplierName: productData.supplierName || '',
                categoryId: productData.categoryId || '',
                images: productData.images || (productData.image ? [productData.image] : []),
                mainImageZoom: Number(productData.mainImageZoom || 1),
                mainImageOffsetX: Number(productData.mainImageOffsetX || 0),
                mainImageOffsetY: Number(productData.mainImageOffsetY || 0),
                unitCost: tempUnitCost,
                packaging: tempPackaging,
                gifts: tempGifts,
                accessories: tempAccessories,
                sellerCommission: pricing.sellerCommission || 0,
                taxes: pricing.taxes || 0,
                operational: pricing.operational || 0,
                grossMargin: tempGrossMargin,
                cardFee: pricing.cardFee || 0,
                finalPrice: pricing.finalPrice || pricing.salePrice || 0,
                promotionPrice: pricing.promotionPrice || 0,
                realMargin: pricing.realMargin || 0,
                salePrice: pricing.salePrice || 0,
                priceWithMargin: tempPriceWithMargin,
                grossMarginPercentage: tempGrossMarginPercentage,
                totalPieces: tempTotalPieces,
                variations: variationsArray
              })
            }
          }
        }

        const draftProducts = readDraftProducts(purchaseId)
        if (draftProducts && draftProducts.length > 0) {
          setProducts(draftProducts)
        } else {
          setProducts(loadedProducts)
        }

        const formDraft = readFormDraft(purchaseId)
        if (formDraft) {
          applyFormDraft(formDraft)
        }
      } catch (e) {
        console.error('Error loading data:', e)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [applyFormDraft, purchaseId, readDraftProducts, readFormDraft])

  useEffect(() => {
    if (!purchaseId || loading || typeof window === 'undefined') return

    const draftKey = getDraftStorageKey(purchaseId)

    if (products.length === 0) {
      window.localStorage.removeItem(draftKey)
      return
    }

    window.localStorage.setItem(
      draftKey,
      JSON.stringify({
        products,
        savedAt: Date.now(),
      })
    )
  }, [loading, products, purchaseId])

  useEffect(() => {
    if (!purchaseId || loading || typeof window === 'undefined') return

    const formDraftKey = getFormDraftStorageKey(purchaseId)
    const formDraft: ProductFormDraft = {
      editingProductId,
      productName,
      productDescription,
      supplierName,
      categoryId,
      productImages,
      mainImageZoom,
      mainImageOffsetX,
      mainImageOffsetY,
      unitCost,
      packaging,
      gifts,
      accessories,
      sellerCommission,
      taxes,
      operational,
      grossMargin,
      cardFee,
      finalPrice,
      promotionPrice,
      variations,
      newVariationSize,
      newVariationColor,
      newVariationQuantity,
    }

    const isFormEmpty =
      !editingProductId &&
      !productName.trim() &&
      !productDescription.trim() &&
      !supplierName.trim() &&
      !categoryId &&
      productImages.length === 0 &&
      mainImageZoom === 1 &&
      mainImageOffsetX === 0 &&
      mainImageOffsetY === 0 &&
      unitCost === '' &&
      packaging === '' &&
      gifts === '' &&
      accessories === '' &&
      sellerCommission === '' &&
      taxes === '' &&
      operational === '' &&
      grossMargin === '' &&
      cardFee === '' &&
      finalPrice === '' &&
      promotionPrice === '' &&
      variations.length === 0 &&
      !newVariationSize &&
      !newVariationColor &&
      newVariationQuantity === ''

    if (isFormEmpty) {
      window.localStorage.removeItem(formDraftKey)
      return
    }

    window.localStorage.setItem(formDraftKey, JSON.stringify(formDraft))
  }, [
    loading,
    purchaseId,
    editingProductId,
    productName,
    productDescription,
    supplierName,
    categoryId,
    productImages,
    mainImageZoom,
    mainImageOffsetX,
    mainImageOffsetY,
    unitCost,
    packaging,
    gifts,
    accessories,
    sellerCommission,
    taxes,
    operational,
    grossMargin,
    cardFee,
    finalPrice,
    promotionPrice,
    variations,
    newVariationSize,
    newVariationColor,
    newVariationQuantity,
  ])
  
  // Calculate total cost per piece from purchase
  const custoPorPeca = purchase && purchase.totalPieces > 0 
    ? Number(((purchase.costs?.freight || 0) + (purchase.costs?.travel || 0) + (purchase.costs?.consultancy || 0) + (purchase.costs?.other || 0)) / purchase.totalPieces).toFixed(2)
    : 0
  
  const pricingPreview = useMemo(
    () => {
      const projectedPieces = variations.reduce((sum, variation) => sum + variation.quantity, 0)

      return getProductPricingPreview(
        {
          unitCost,
          packaging,
          gifts,
          accessories,
          sellerCommission,
          taxes,
          operational,
          grossMargin,
          cardFee,
          finalPrice,
          promotionPrice,
        },
        Number(custoPorPeca),
        projectedPieces,
      )
    },
    [
      accessories,
      cardFee,
      custoPorPeca,
      finalPrice,
      gifts,
      grossMargin,
      operational,
      packaging,
      promotionPrice,
      sellerCommission,
      taxes,
      unitCost,
    ],
  )

  const handleImageUpload = async (files: File[]) => {
    if (!purchaseId || files.length === 0) return

    setUploadingImages(true)

    try {
      const uploadedUrls = await Promise.all(
        files.map(async (file) => {
          const safeName = file.name.replace(/\s+/g, '-').toLowerCase()
          const filePath = `products/drafts/${purchaseId}/${Date.now()}-${safeName}`
          const imageRef = storageRef(storage, filePath)
          const snapshot = await uploadBytes(imageRef, file)
          return getDownloadURL(snapshot.ref)
        }),
      )

      setProductImages((current) => [...current, ...uploadedUrls])
    } catch (error) {
      console.error('Erro ao enviar imagens do produto:', error)
      alert('Nao foi possivel enviar uma ou mais imagens.')
    } finally {
      setUploadingImages(false)
    }
  }

  const removeImage = (index: number) => {
    setProductImages((current) => current.filter((_, imageIndex) => imageIndex !== index))
    if (index === 0) {
      setMainImageZoom(1)
      setMainImageOffsetX(0)
      setMainImageOffsetY(0)
    }
  }
  
  const addVariation = () => {
    if (!newVariationSize || typeof newVariationQuantity !== 'number' || newVariationQuantity <= 0) return
    
    const newVar: ProductVariationInput = {
      size: newVariationSize,
      color: newVariationColor,
      quantity: newVariationQuantity,
    }
    
    setVariations([...variations, newVar])
    setNewVariationSize('')
    setNewVariationColor('')
    setNewVariationQuantity('')
  }
  
  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index))
  }
  
  const addProduct = () => {
    if (!productName.trim() || typeof unitCost !== 'number' || unitCost <= 0 || variations.length === 0) return
    
    const tempPackaging = typeof packaging === 'number' ? packaging : 0
    const tempGifts = typeof gifts === 'number' ? gifts : 0
    const tempAccessories = typeof accessories === 'number' ? accessories : 0
    const tempGrossMargin = typeof grossMargin === 'number' ? grossMargin : 0
    const tempTotalPieces = variations.reduce((sum, v) => sum + v.quantity, 0)
    
    if (editingProductId) {
      // Update existing product
      const updatedProducts = products.map(product => {
        if (product.id === editingProductId) {
          return {
            ...product,
            name: productName,
            description: productDescription,
            supplierName,
            categoryId,
            images: productImages,
            mainImageZoom,
            mainImageOffsetX,
            mainImageOffsetY,
            unitCost,
            packaging: tempPackaging,
            gifts: tempGifts,
            accessories: tempAccessories,
            sellerCommission: typeof sellerCommission === 'number' ? sellerCommission : 0,
            taxes: typeof taxes === 'number' ? taxes : 0,
            operational: typeof operational === 'number' ? operational : 0,
            grossMargin: tempGrossMargin,
            cardFee: typeof cardFee === 'number' ? cardFee : 0,
            finalPrice: pricingPreview.chosenFinalPrice,
            promotionPrice: pricingPreview.chosenPromotionPrice,
            realMargin: pricingPreview.realMargin,
            salePrice: pricingPreview.chosenFinalPrice,
            priceWithMargin: pricingPreview.priceWithMargin,
            grossMarginPercentage: pricingPreview.grossMarginPercentage,
            totalPieces: tempTotalPieces,
            variations,
          }
        }
        return product
      })
      setProducts(updatedProducts)
    } else {
      // Add new product
      const newProduct: Product = {
        id: Date.now().toString(),
        name: productName,
        description: productDescription,
        supplierName,
        categoryId,
        images: productImages,
        mainImageZoom,
        mainImageOffsetX,
        mainImageOffsetY,
        unitCost,
        packaging: tempPackaging,
        gifts: tempGifts,
        accessories: tempAccessories,
        sellerCommission: typeof sellerCommission === 'number' ? sellerCommission : 0,
        taxes: typeof taxes === 'number' ? taxes : 0,
        operational: typeof operational === 'number' ? operational : 0,
        grossMargin: tempGrossMargin,
        cardFee: typeof cardFee === 'number' ? cardFee : 0,
        finalPrice: pricingPreview.chosenFinalPrice,
        promotionPrice: pricingPreview.chosenPromotionPrice,
        realMargin: pricingPreview.realMargin,
        salePrice: pricingPreview.chosenFinalPrice,
        priceWithMargin: pricingPreview.priceWithMargin,
        grossMarginPercentage: pricingPreview.grossMarginPercentage,
        totalPieces: tempTotalPieces,
        variations,
      }
      setProducts([...products, newProduct])
    }
    
    // Reset form
    cancelEdit()
  }
  
  const removeProduct = (productId: string) => {
    setProducts(products.filter(p => p.id !== productId))
  }
  
  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id)
    setProductName(product.name)
    setProductDescription(product.description)
    setSupplierName(product.supplierName)
    setCategoryId(product.categoryId)
    setProductImages(product.images || [])
    setMainImageZoom(Number(product.mainImageZoom || 1))
    setMainImageOffsetX(Number(product.mainImageOffsetX || 0))
    setMainImageOffsetY(Number(product.mainImageOffsetY || 0))
    setUnitCost(product.unitCost)
    setPackaging(product.packaging)
    setGifts(product.gifts)
    setAccessories(product.accessories)
    setSellerCommission(product.sellerCommission)
    setTaxes(product.taxes)
    setOperational(product.operational)
    setGrossMargin(product.grossMargin)
    setCardFee(product.cardFee)
    setFinalPrice(product.finalPrice)
    setPromotionPrice(product.promotionPrice)
    setVariations(product.variations)
  }
  
  const cancelEdit = () => {
    setEditingProductId(null)
    setProductName('')
    setProductDescription('')
    setSupplierName('')
    setCategoryId('')
    setProductImages([])
    setMainImageZoom(1)
    setMainImageOffsetX(0)
    setMainImageOffsetY(0)
    setUnitCost('')
    setPackaging('')
    setGifts('')
    setAccessories('')
    setSellerCommission('')
    setTaxes('')
    setOperational('')
    setGrossMargin('')
    setCardFee('')
    setFinalPrice('')
    setPromotionPrice('')
    setVariations([])
    setNewVariationSize('')
    setNewVariationColor('')
    setNewVariationQuantity('')
  }
  
  const finalizePurchase = async () => {
    if (!purchaseId || !user) return
    setSaving(true)
    
    try {
      const updates: Record<string, unknown> = {}
      const now = Date.now()
      const cachedRows: Array<{ row: ReturnType<typeof buildInventoryProductRow>; updatedAt: number }> = []
      const categoryMap = categories.reduce(
        (acc, category) => {
          acc[category.id] = category.name || 'Sem categoria'
          return acc
        },
        {} as Record<string, string>,
      )

      for (const product of products) {
        const totalQuantity = product.variations.reduce((sum, v) => sum + v.quantity, 0)
        const allocatedCosts = Number(custoPorPeca)
        const finalUnitCost = product.unitCost + allocatedCosts
        const variationMap = product.variations.reduce((acc, v) => {
          const key = buildVariationKey(v.size, v.color)
          acc[key] = {
            size: v.size,
            color: v.color,
            stock: v.quantity,
          }
          return acc
        }, {} as Record<string, { size: string; color: string; stock: number }>)
        const totalStock = totalQuantity

        updates[`purchaseItems/${purchaseId}/${product.id}`] = {
          quantity: totalQuantity,
          cost: product.unitCost,
        }

        const nextProductRecord: InternalProductRecord = {
          name: product.name,
          description: product.description,
          supplierName: product.supplierName,
          categoryId: product.categoryId,
          active: true,
          createdAt: now,
          updatedAt: now,
          image: product.images[0] || '',
          images: product.images,
          mainImageZoom: product.mainImageZoom,
          mainImageOffsetX: product.mainImageOffsetX,
          mainImageOffsetY: product.mainImageOffsetY,
          pricing: {
            unitCost: product.unitCost,
            allocatedCosts,
            finalUnitCost,
            packaging: product.packaging,
            gifts: product.gifts,
            accessories: product.accessories,
            sellerCommission: product.sellerCommission,
            taxes: product.taxes,
            operational: product.operational,
            grossMargin: product.grossMargin,
            cardFee: product.cardFee,
            salePrice: product.salePrice,
            finalPrice: product.finalPrice,
            promotionPrice: product.promotionPrice,
            realMargin: product.realMargin,
            realMarginPercentage: product.finalPrice > 0 ? (product.realMargin / product.finalPrice) * 100 : 0,
          },
          variations: variationMap,
        }
        updates[`products/${product.id}`] = nextProductRecord

        const nextInventoryRecord = {
          total: totalStock,
          reserved: 0,
          available: totalStock,
          cartReserved: 0,
        }
        updates[`inventory/${product.id}`] = nextInventoryRecord

        const nextShowcaseRecord: ShowcaseRecord = {
          purchaseId,
          name: product.name,
          image: product.images[0] || '',
          images: product.images,
          mainImageZoom: product.mainImageZoom,
          mainImageOffsetX: product.mainImageOffsetX,
          mainImageOffsetY: product.mainImageOffsetY,
          price: product.finalPrice,
          promotionPrice: product.promotionPrice || undefined,
          categoryId: product.categoryId,
          shortDescription: product.description.substring(0, 100),
          available: true,
          stock: totalStock > 0,
          variations: variationMap,
          featured: false,
          promotion: false,
          updatedAt: now,
        }
        updates[`showcase/${product.id}`] = nextShowcaseRecord
        cachedRows.push({
          row: buildInventoryProductRow(product.id, nextProductRecord, nextShowcaseRecord, nextInventoryRecord, categoryMap),
          updatedAt: now,
        })

        for (const variation of product.variations) {
          const movementKey = push(ref(rtdb, 'stockMovements')).key
          if (!movementKey) continue

          updates[`stockMovements/${movementKey}`] = {
            productId: product.id,
            variation: buildVariationKey(variation.size, variation.color),
            quantity: variation.quantity,
            type: 'entry',
            purchaseId,
            createdAt: now,
          }
        }
      }
      
      updates[`purchases/${purchaseId}/status`] = 'completed'
      updates[`purchases/${purchaseId}/updatedAt`] = now
      updates[`${CATALOG_SYNC_PATH}/updatedAt`] = now
      updates[`${CATALOG_SYNC_PATH}/source`] = 'adicionar_produtos'
      await update(ref(rtdb), updates)

      cachedRows.forEach(({ row, updatedAt }) => {
        upsertCachedStockProduct(row, updatedAt)
      })

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(getDraftStorageKey(purchaseId))
        window.localStorage.removeItem(getFormDraftStorageKey(purchaseId))
      }
      
      navigate(`/logista/pedido/${purchaseId}/vitrine`)
    } catch (error) {
      console.error('Error finalizing purchase:', error)
      alert(getErrorMessage(error, 'Nao foi possivel finalizar o pedido.'))
    } finally {
      setSaving(false)
    }
  }
  
  const totalProducts = products.length
  const totalPieces = products.reduce((sum, p) => sum + p.variations.reduce((s, v) => s + v.quantity, 0), 0)
  const totalRevenue = products.reduce((sum, p) => sum + p.salePrice * p.variations.reduce((s, v) => s + v.quantity, 0), 0)
  const totalCost = products.reduce((sum, p) => sum + p.unitCost * p.variations.reduce((s, v) => s + v.quantity, 0), 0)
  const totalProfit = totalRevenue - totalCost
  
  if (loading) {
    return <div>Carregando...</div>
  }
  
  if (!purchase) {
    return <div>Pedido não encontrado</div>
  }
  
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, marginBottom: 24 }}>
        <div style={{width:'-webkit-fill-available'}}>
          <h1 style={{ margin: 0, fontSize: 28, textAlign: 'left' }}>Adicionar Produto</h1>
          <div style={{ color: '#6b7280', marginTop: 4, textAlign: 'left' }}>
            Pedido: {purchase.name} • Logística: R$ {custoPorPeca}/peça
          </div>
        </div>
        <button
          onClick={finalizePurchase}
          disabled={saving}
          style={{
            padding: '12px 20px',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            alignSelf: 'flex-start',
            fontSize: '12px',
            width: isMobile ? '100%' : '200px',
          }}
        >
          {saving ? 'Finalizando...' : 'Finalizar Pedido'}
        </button>
      </div>
      
      <SharedProductEditorForm
        categories={categories}
        sizes={sizes}
        productName={productName}
        onProductNameChange={setProductName}
        supplierName={supplierName}
        onSupplierNameChange={setSupplierName}
        productDescription={productDescription}
        onProductDescriptionChange={setProductDescription}
        categoryId={categoryId}
        onCategoryIdChange={setCategoryId}
        images={productImages}
        mainImageZoom={mainImageZoom}
        onMainImageZoomChange={setMainImageZoom}
        mainImageOffsetX={mainImageOffsetX}
        onMainImageOffsetXChange={setMainImageOffsetX}
        mainImageOffsetY={mainImageOffsetY}
        onMainImageOffsetYChange={setMainImageOffsetY}
        uploadingImages={uploadingImages}
        onUploadImages={(files) => void handleImageUpload(files)}
        onRemoveImage={removeImage}
        newVariationSize={newVariationSize}
        onNewVariationSizeChange={setNewVariationSize}
        newVariationColor={newVariationColor}
        onNewVariationColorChange={setNewVariationColor}
        newVariationQuantity={newVariationQuantity}
        onNewVariationQuantityChange={setNewVariationQuantity}
        variations={variations}
        onAddVariation={addVariation}
        onRemoveVariation={removeVariation}
        unitCost={unitCost}
        onUnitCostChange={setUnitCost}
        packaging={packaging}
        onPackagingChange={setPackaging}
        gifts={gifts}
        onGiftsChange={setGifts}
        accessories={accessories}
        onAccessoriesChange={setAccessories}
        sellerCommission={sellerCommission}
        onSellerCommissionChange={setSellerCommission}
        taxes={taxes}
        onTaxesChange={setTaxes}
        operational={operational}
        onOperationalChange={setOperational}
        grossMargin={grossMargin}
        onGrossMarginChange={setGrossMargin}
        cardFee={cardFee}
        onCardFeeChange={setCardFee}
        finalPrice={finalPrice}
        onFinalPriceChange={setFinalPrice}
        promotionPrice={promotionPrice}
        onPromotionPriceChange={setPromotionPrice}
        pricingPreview={pricingPreview}
        onManageCategories={() => navigate('/logista/categorias')}
      />

      {/* Add Product Button */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, marginBottom: 24 }}>
        <button
          onClick={finalizePurchase}
          disabled={saving}
          style={{
            padding: '12px 20px',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            alignSelf: 'flex-start',
            fontSize: '12px',
            width: isMobile ? '100%' : '200px',
          }}
        >
          {saving ? 'Finalizando...' : 'Finalizar Pedido'}
        </button>
        
        {editingProductId && (
          <button
            onClick={cancelEdit}
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              background: '#fff',
              cursor: 'pointer',
              alignSelf: 'flex-start',
              fontSize: '14px',
            }}
          >
            Cancelar
          </button>
        )}

        <button
          onClick={addProduct}
          disabled={!productName.trim() || typeof unitCost !== 'number' || unitCost <= 0 || variations.length === 0}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: (!productName.trim() || typeof unitCost !== 'number' || unitCost <= 0 || variations.length === 0) ? 'not-allowed' : 'pointer',
            opacity: (!productName.trim() || typeof unitCost !== 'number' || unitCost <= 0 || variations.length === 0) ? 0.7 : 1,
          }}
        >
          {editingProductId ? 'Atualizar Produto' : '+ Adicionar Produto'}
        </button>
      </div>
      
      {/* Added Products List */}
      {products.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ 
            margin: '0 0 16px 0', 
            fontSize: 24, 
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FiPackage /> Produtos Adicionados ao Pedido ({products.length})
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {products.map((product) => (
              <div key={product.id} style={{
                background: '#faf5ff',
                border: '1px solid #e9d5ff',
                borderRadius: 16,
                padding: isMobile ? 16 : 24,
              }}>
                {/* Product Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 16
                }}>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: 20, 
                    fontWeight: 600 
                  }}>
                    {product.name}
                  </h3>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                    <button
                      onClick={() => handleEditProduct(product)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: 14
                      }}
                    >
                      <FiEdit /> Editar
                    </button>
                    <button
                      onClick={() => removeProduct(product.id)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid #fee2e2',
                        background: '#fff',
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: 14
                      }}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
                
                {/* Supplier */}
                {product.supplierName && (
                  <div style={{ 
                    fontSize: 14, 
                    color: '#6b7280', 
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    Fornecedor: {product.supplierName}
                  </div>
                )}
                
                {/* Pricing Info */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 120px))', 
                  gap: 8, 
                  marginBottom: 16
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Preço à vista</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>
                      R$ {product.priceWithMargin.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Preço no cartão</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                      R$ {product.salePrice.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Total de peças</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {product.totalPieces}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Margem</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      R$ {product.grossMargin.toFixed(2)}
                    </div>
                  </div>
                </div>
                
                {/* Variations */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Variações:</div>
                  <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}>
                    {product.variations.map((v, i) => (
                      <div key={i} style={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 14
                      }}>
                        {v.size}{v.color ? ` • ${v.color}` : ''} • {v.quantity}x
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Total Revenue */}
                <div style={{
                  background: '#ecfdf5',
                  border: '1px solid #10b981',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 14, color: '#059669', marginBottom: 4 }}>Receita Total</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>
                    R$ {(product.priceWithMargin * product.totalPieces).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Summary */}
      {products.length > 0 && (
        <div style={{
          background: '#faf5ff',
          border: '1px solid #e9d5ff',
          borderRadius: 16,
          padding: 20,
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiTrendingUp /> Resumo Total do Pedido
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div style={{
              background: '#f3e8ff',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{totalProducts}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Produtos</div>
            </div>
            
            <div style={{
              background: '#f3e8ff',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{totalPieces}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Peças Totais</div>
            </div>
            
            <div style={{
              background: '#ecfdf5',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>R$ {totalRevenue.toFixed(2)}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Receita Total</div>
            </div>
            
            <div style={{
              background: '#fef3c7',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
              border: '1px solid #fbbf24',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>R$ {totalProfit.toFixed(2)}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Lucro Total</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
