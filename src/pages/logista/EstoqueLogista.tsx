import { useEffect, useMemo, useState } from 'react'
import { get, ref } from 'firebase/database'
import { useNavigate } from 'react-router-dom'
import { FiBox, FiChevronRight, FiEye, FiPackage, FiSearch, FiStar } from 'react-icons/fi'
import { rtdb } from '../../service/firebase'
import type { CatalogVariation, InternalProductRecord, ShowcaseRecord } from '../../types/catalog'

interface InventoryRecord {
  total?: number
  reserved?: number
  available?: number
}

interface CategoryRecord {
  name?: string
}

interface InventoryProductRow {
  id: string
  name: string
  description: string
  supplierName: string
  categoryName: string
  image: string
  salePrice: number
  finalUnitCost: number
  totalStock: number
  availableStock: number
  reservedStock: number
  totalVariations: number
  active: boolean
  available: boolean
  featured: boolean
  searchText: string
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 20,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export default function EstoqueLogista() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<InventoryProductRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true)
        setError(null)

        const [productsSnapshot, showcaseSnapshot, inventorySnapshot, categoriesSnapshot] = await Promise.all([
          get(ref(rtdb, 'products')),
          get(ref(rtdb, 'showcase')),
          get(ref(rtdb, 'inventory')),
          get(ref(rtdb, 'categories')),
        ])

        const productsData = (productsSnapshot.exists() ? productsSnapshot.val() : {}) as Record<
          string,
          InternalProductRecord
        >
        const showcaseData = (showcaseSnapshot.exists() ? showcaseSnapshot.val() : {}) as Record<
          string,
          ShowcaseRecord
        >
        const inventoryData = (inventorySnapshot.exists() ? inventorySnapshot.val() : {}) as Record<
          string,
          InventoryRecord
        >
        const categoriesData = (categoriesSnapshot.exists() ? categoriesSnapshot.val() : {}) as Record<
          string,
          CategoryRecord
        >

        const nextRows = Object.entries(productsData)
          .map(([productId, product]) => {
            const showcase = showcaseData[productId]
            const inventory = inventoryData[productId]
            const variations = (showcase?.variations || product.variations || {}) as Record<string, CatalogVariation>

            const categoryId = showcase?.categoryId || product.categoryId || ''
            const categoryName = categoriesData[categoryId]?.name || 'Sem categoria'
            const name = showcase?.name || product.name || 'Produto sem nome'
            const description = product.description || showcase?.shortDescription || ''
            const supplierName = product.supplierName || 'Fornecedor nao informado'
            const salePrice = Number(showcase?.price ?? product.pricing?.salePrice ?? 0)
            const finalUnitCost = Number(product.pricing?.finalUnitCost ?? 0)
            const availableStock = Number(inventory?.available ?? 0)
            const totalStock = Number(inventory?.total ?? availableStock)
            const reservedStock = Number(inventory?.reserved ?? 0)

            return {
              id: productId,
              name,
              description,
              supplierName,
              categoryName,
              image: showcase?.image || product.image || '',
              salePrice,
              finalUnitCost,
              totalStock,
              availableStock,
              reservedStock,
              totalVariations: Object.keys(variations).length,
              active: Boolean(product.active ?? true),
              available: Boolean(showcase?.available ?? true),
              featured: Boolean(showcase?.featured),
              searchText: normalizeText(
                [
                  productId,
                  name,
                  description,
                  supplierName,
                  categoryName,
                  ...Object.values(variations).flatMap((variation) => [variation.size, variation.color]),
                ]
                  .filter(Boolean)
                  .join(' '),
              ),
            } satisfies InventoryProductRow
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

        setProducts(nextRows)
      } catch (loadError) {
        console.error('Erro ao carregar estoque do logista:', loadError)
        setError('Nao foi possivel carregar o estoque da loja.')
      } finally {
        setLoading(false)
      }
    }

    void loadProducts()
  }, [])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search.trim())

    if (!normalizedSearch) {
      return products
    }

    return products.filter((product) => product.searchText.includes(normalizedSearch))
  }, [products, search])

  const stats = useMemo(
    () => ({
      totalProducts: products.length,
      activeInShowcase: products.filter((product) => product.available && product.active).length,
      featuredProducts: products.filter((product) => product.featured).length,
      totalAvailableStock: products.reduce((sum, product) => sum + product.availableStock, 0),
    }),
    [products],
  )

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>Estoque da loja</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280', maxWidth: 720 }}>
            Visualize todos os produtos cadastrados, pesquise rapidamente e entre na tela de produto para editar
            foto, precificacao e publicacao na vitrine.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ ...cardStyle, background: '#faf5ff', borderColor: '#e9d5ff' }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Produtos cadastrados</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>{stats.totalProducts}</div>
        </div>
        <div style={{ ...cardStyle, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <div style={{ color: '#166534', fontSize: 13 }}>Na vitrine</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>{stats.activeInShowcase}</div>
        </div>
        <div style={{ ...cardStyle, background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <div style={{ color: '#1d4ed8', fontSize: 13 }}>Em destaque na home</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>{stats.featuredProducts}</div>
        </div>
        <div style={{ ...cardStyle, background: '#fff7ed', borderColor: '#fed7aa' }}>
          <div style={{ color: '#9a3412', fontSize: 13 }}>Pecas disponiveis</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>{stats.totalAvailableStock}</div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Pesquisar produto
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            border: '1px solid #d1d5db',
            borderRadius: 14,
            padding: '0 14px',
            background: '#fff',
          }}
        >
          <FiSearch size={18} color="#6b7280" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Busque por nome, categoria, fornecedor, tamanho ou cor"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              padding: '14px 0',
              fontSize: 15,
              background: 'transparent',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ ...cardStyle, color: '#6b7280' }}>Carregando produtos do estoque...</div>
      ) : error ? (
        <div style={{ ...cardStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ ...cardStyle, color: '#6b7280' }}>Nenhum produto encontrado para a pesquisa informada.</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => navigate(`/logista/estoque/${product.id}`)}
              style={{
                ...cardStyle,
                cursor: 'pointer',
                textAlign: 'left',
                padding: 0,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: 220,
                  background: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ color: '#9ca3af', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <FiPackage size={32} />
                    <span>Sem foto</span>
                  </div>
                )}
              </div>

              <div style={{ padding: 18 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      background: product.available ? '#ecfdf5' : '#f3f4f6',
                      color: product.available ? '#166534' : '#6b7280',
                    }}
                  >
                    {product.available ? 'Na vitrine' : 'Oculto'}
                  </span>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      background: product.featured ? '#faf5ff' : '#f9fafb',
                      color: product.featured ? '#7c3aed' : '#6b7280',
                    }}
                  >
                    {product.featured ? 'Destaque home' : 'Sem destaque'}
                  </span>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      background: product.active ? '#eff6ff' : '#fef2f2',
                      color: product.active ? '#1d4ed8' : '#b91c1c',
                    }}
                  >
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{product.name}</div>
                <div style={{ color: '#6b7280', marginTop: 6, minHeight: 42 }}>
                  {product.description || 'Sem descricao cadastrada.'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Preco de venda</div>
                    <div style={{ fontWeight: 700 }}>{currencyFormatter.format(product.salePrice)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Custo final</div>
                    <div style={{ fontWeight: 700 }}>{currencyFormatter.format(product.finalUnitCost)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Estoque disponivel</div>
                    <div style={{ fontWeight: 700 }}>{product.availableStock}</div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Variacoes</div>
                    <div style={{ fontWeight: 700 }}>{product.totalVariations}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 6, marginTop: 16, color: '#4b5563', fontSize: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiBox size={16} />
                    <span>Categoria: {product.categoryName}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiEye size={16} />
                    <span>Fornecedor: {product.supplierName}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiStar size={16} />
                    <span>
                      Total: {product.totalStock} • Reservado: {product.reservedStock}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#7c3aed',
                    fontWeight: 700,
                  }}
                >
                  <span>Editar produto</span>
                  <FiChevronRight size={18} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
