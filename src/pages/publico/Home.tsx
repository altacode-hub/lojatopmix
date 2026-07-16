import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { equalTo, onValue, orderByChild, query, ref } from 'firebase/database'
import { rtdb } from '../../service/firebase'
import type { CatalogCategoryRecord, ShowcaseRecord } from '../../types/catalog'
import { showcaseToArray } from '../../utils/catalog'
import CategoryFilterSection from './components/CategoryFilterSection'
import ProductSearchBar from './components/ProductSearchBar'

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export default function Home() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState<Array<{ id: string } & ShowcaseRecord>>([])
  const [categories, setCategories] = useState<Record<string, CatalogCategoryRecord>>({})
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get('categoria') || '')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const showcaseRef = selectedCategoryId
      ? query(ref(rtdb, 'showcase'), orderByChild('categoryId'), equalTo(selectedCategoryId))
      : ref(rtdb, 'showcase')

    setLoading(true)

    const unsubscribe = onValue(
      showcaseRef,
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.val() as Record<string, ShowcaseRecord>) : null
        setProducts(showcaseToArray(data))
        setLoading(false)
      },
      (error) => {
        console.error('Erro ao carregar vitrine:', error)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [selectedCategoryId])

  useEffect(() => {
    const nextCategoryId = searchParams.get('categoria') || ''
    if (nextCategoryId !== selectedCategoryId) {
      setSelectedCategoryId(nextCategoryId)
    }
  }, [searchParams, selectedCategoryId])

  useEffect(() => {
    const categoriesRef = ref(rtdb, 'categories')
    const unsubscribe = onValue(categoriesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setCategories({})
        return
      }

      const rawData = snapshot.val() as Record<string, CatalogCategoryRecord>
      const nextCategories = Object.entries(rawData).reduce<Record<string, CatalogCategoryRecord>>((acc, [id, category]) => {
        acc[id] = {
          name: category?.name || 'Sem categoria',
          image: category?.image || '',
          thumbnailImage: category?.thumbnailImage || '',
          thumbnailZoom: Number(category?.thumbnailZoom || 1),
          thumbnailOffsetX: Number(category?.thumbnailOffsetX || 0),
          thumbnailOffsetY: Number(category?.thumbnailOffsetY || 0),
          hidden: Boolean(category?.hidden),
          order: Number(category?.order || 0),
        }
        return acc
      }, {})

      setCategories(nextCategories)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!selectedCategoryId) return

    const selectedCategory = categories[selectedCategoryId]
    if (selectedCategory && !selectedCategory.hidden) return

    setSelectedCategoryId('')
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.delete('categoria')
      return nextParams
    })
  }, [categories, selectedCategoryId, setSearchParams])

  const categoryOptions = useMemo(() => {
    return Object.entries(categories)
      .filter(([, category]) => !category.hidden)
      .map(([id, category]) => ({
        id,
        label: category.name || 'Sem categoria',
        imageUrl: category.thumbnailImage || category.image || '',
        thumbnailZoom: Number(category.thumbnailZoom || 1),
        thumbnailOffsetX: Number(category.thumbnailOffsetX || 0),
        thumbnailOffsetY: Number(category.thumbnailOffsetY || 0),
        order: Number(category.order || 0),
      }))
      .sort((a, b) => {
        const orderDiff = a.order - b.order
        if (orderDiff !== 0) return orderDiff
        return a.label.localeCompare(b.label, 'pt-BR')
      })
      .map(({ order: _order, ...categoryOption }) => categoryOption)
  }, [categories])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm.trim())

    return products.filter((product) => {
      const matchesCategory = !selectedCategoryId || product.categoryId === selectedCategoryId

      if (!matchesCategory) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const searchableText = normalizeText(
        [product.name, product.shortDescription, categories[product.categoryId]?.name || '']
          .filter(Boolean)
          .join(' '),
      )

      return searchableText.includes(normalizedSearch)
    })
  }, [categories, products, searchTerm, selectedCategoryId])

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      if (categoryId) {
        nextParams.set('categoria', categoryId)
      } else {
        nextParams.delete('categoria')
      }
      return nextParams
    })
  }

  return (
    <div>
      <CategoryFilterSection
        categories={categoryOptions}
        selectedCategoryId={selectedCategoryId}
        onSelect={handleSelectCategory}
      />
      <ProductSearchBar value={searchTerm} onChange={setSearchTerm} />
      <div
        style={{
          fontWeight: 700,
          fontSize: 'var(--font-size-grande)',
          color: '#797979',
          wordBreak: 'break-word',
          textAlign: 'left',
          margin: '16px 0 8px',
        }}
      >
        {selectedCategoryId ? `Produtos em ${categories[selectedCategoryId]?.name || 'Categoria'}` : 'Produtos'}
      </div>
      {!loading && (
        <div style={{ color: '#6b7280', textAlign: 'left', marginBottom: 16 }}>
          {filteredProducts.length} produto{filteredProducts.length === 1 ? '' : 's'} encontrado
          {filteredProducts.length === 1 ? '' : 's'}
        </div>
      )}
      {loading && <div style={{ color: '#6b7280', textAlign: 'left' }}>Carregando vitrine...</div>}
      {!loading && filteredProducts.length === 0 && (
        <div style={{ color: '#6b7280', textAlign: 'left' }}>
          Nenhum produto encontrado para os filtros selecionados.
        </div>
      )}
      <div className="products-grid">
        {filteredProducts.map((p) => (
          <div key={p.id} className="product-card" onClick={() => navigate(`/produto/${p.id}`)}>
            <span
              aria-hidden="true"
              style={{
                borderRadius: 8,
                aspectRatio: '1 / 1',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {p.image ? (
                <img
                  src={p.image}
                  alt={p.name}
                  //className="product-img"
                  style={{
                    transform: `translate(${Number(p.mainImageOffsetX || 0)}%, ${Number(p.mainImageOffsetY || 0)}%) scale(${Number(p.mainImageZoom || 1)})`,
                    transformOrigin: 'center center',
                    objectFit: 'cover',
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                  }}
                  onError={(e) => {
                    const t = e.currentTarget
                    t.style.display = 'none'
                  }}
                />
              ) : (
                <div
                  className="product-img"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280',
                    background: '#f8fafc',
                  }}
                >
                  Sem foto
                </div>
              )}
            </span>
            <div className="product-body">
              <div style={{ color: '#797979', fontWeight: 600, fontSize: '16px' }}>{p.name}</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#474747ff' }}>R$ {p.price.toFixed(2)}</div>
              <button
                onClick={() => navigate(`/produto/${p.id}`)}
                style={{
                  alignSelf: 'start',
                  background: '#b58516',
                  color: '#fff',
                }}
              >
                Comprar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
