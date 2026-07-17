import { useEffect, useMemo, useState } from 'react'
import { onValue, push, ref, update } from 'firebase/database'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiEdit2, FiEyeOff, FiFolderPlus, FiImage, FiSave } from 'react-icons/fi'
import CategoryRoundImage from '../../components/CategoryRoundImage'
import { rtdb, storage } from '../../service/firebase'
import type { CatalogCategoryRecord } from '../../types/catalog'
import { CATALOG_SYNC_PATH } from './stockCache'
import { useMediaQuery } from '../../hooks/useMediaQuery'

interface CategoryListItem extends CatalogCategoryRecord {
  id: string
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 20,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
}

const editorFrameSize = 280
const editorMaskInset = 0

export default function CategoriasLogista() {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [categories, setCategories] = useState<CategoryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [order, setOrder] = useState<number | ''>('')
  const [hidden, setHidden] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [existingImageUrl, setExistingImageUrl] = useState('')
  const [cropZoom, setCropZoom] = useState(1)
  const [cropX, setCropX] = useState(0)
  const [cropY, setCropY] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const categoriesRef = ref(rtdb, 'categories')
    const unsubscribe = onValue(
      categoriesRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setCategories([])
          setLoading(false)
          return
        }

        const nextCategories: CategoryListItem[] = []
        snapshot.forEach((child) => {
          const categoryData = (child.val() || {}) as CatalogCategoryRecord
          nextCategories.push({
            id: child.key || '',
            name: categoryData.name || 'Sem nome',
            image: categoryData.image || '',
            thumbnailImage: categoryData.thumbnailImage || '',
            thumbnailZoom: Number(categoryData.thumbnailZoom || 1),
            thumbnailOffsetX: Number(categoryData.thumbnailOffsetX || 0),
            thumbnailOffsetY: Number(categoryData.thumbnailOffsetY || 0),
            hidden: Boolean(categoryData.hidden),
            order: Number(categoryData.order || 0),
            createdAt: categoryData.createdAt,
            updatedAt: categoryData.updatedAt,
          })
        })

        nextCategories.sort((a, b) => {
          const orderDiff = Number(a.order || 0) - Number(b.order || 0)
          if (orderDiff !== 0) return orderDiff
          return a.name.localeCompare(b.name, 'pt-BR')
        })

        setCategories(nextCategories)
        setLoading(false)
      },
      (loadError) => {
        console.error('Erro ao carregar categorias:', loadError)
        setError('Nao foi possivel carregar as categorias.')
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    return () => {
      if (imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
  }, [imagePreviewUrl])

  const currentSourceImageUrl = imagePreviewUrl || existingImageUrl

  const nextSuggestedOrder = useMemo(() => {
    if (categories.length === 0) return 1
    return Math.max(...categories.map((category) => Number(category.order || 0)), 0) + 1
  }, [categories])

  const resetForm = () => {
    setEditingCategoryId(null)
    setName('')
    setOrder('')
    setHidden(false)
    setImageFile(null)
    if (imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    setImagePreviewUrl('')
    setExistingImageUrl('')
    setCropZoom(1)
    setCropX(0)
    setCropY(0)
    setError(null)
    setSuccessMessage(null)
  }

  const handleSelectImage = (file: File | null) => {
    if (imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl)
    }

    setImageFile(file)
    setImagePreviewUrl(file ? URL.createObjectURL(file) : '')
    if (file) {
      setCropZoom(1)
      setCropX(0)
      setCropY(0)
    }
  }

  const getPreviewFrameStyle = (): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `translate(${cropX}%, ${cropY}%) scale(${cropZoom})`,
    transformOrigin: 'center center',
    userSelect: 'none',
    pointerEvents: 'none',
  })

  const startEditing = (category: CategoryListItem) => {
    if (imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl)
    }

    setEditingCategoryId(category.id)
    setName(category.name)
    setOrder(typeof category.order === 'number' ? category.order : '')
    setHidden(Boolean(category.hidden))
    setImageFile(null)
    setImagePreviewUrl('')
    setExistingImageUrl(category.image || '')
    setCropZoom(Number(category.thumbnailZoom || 1))
    setCropX(Number(category.thumbnailOffsetX || 0))
    setCropY(Number(category.thumbnailOffsetY || 0))
    setError(null)
    setSuccessMessage(null)
  }

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Informe o nome da categoria.')
      return
    }

    const duplicateCategory = categories.find(
      (category) =>
        category.id !== editingCategoryId &&
        category.name.trim().toLocaleLowerCase('pt-BR') === trimmedName.toLocaleLowerCase('pt-BR'),
    )

    if (duplicateCategory) {
      setError('Ja existe uma categoria com esse nome.')
      return
    }

    const targetCategoryId = editingCategoryId || push(ref(rtdb, 'categories')).key
    if (!targetCategoryId) {
      setError('Nao foi possivel gerar o identificador da categoria.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      let imageUrl = existingImageUrl
      if (imageFile) {
        const safeName = imageFile.name.replace(/\s+/g, '-').toLowerCase()
        const fileRef = storageRef(storage, `categories/${targetCategoryId}/${Date.now()}-${safeName}`)
        const snapshot = await uploadBytes(fileRef, imageFile)
        imageUrl = await getDownloadURL(snapshot.ref)
      }

      const now = Date.now()
      const resolvedOrder = typeof order === 'number' && Number.isFinite(order) ? order : nextSuggestedOrder

      await update(ref(rtdb), {
        [`categories/${targetCategoryId}`]: {
          name: trimmedName,
          image: imageUrl,
          thumbnailImage: imageUrl,
          thumbnailZoom: cropZoom,
          thumbnailOffsetX: cropX,
          thumbnailOffsetY: cropY,
          hidden,
          order: resolvedOrder,
          createdAt:
            categories.find((category) => category.id === targetCategoryId)?.createdAt ||
            now,
          updatedAt: now,
        },
        [`${CATALOG_SYNC_PATH}/updatedAt`]: now,
        [`${CATALOG_SYNC_PATH}/source`]: 'categorias_logista',
      })

      resetForm()
      setSuccessMessage(editingCategoryId ? 'Categoria atualizada com sucesso.' : 'Categoria salva com sucesso.')
    } catch (saveError) {
      console.error('Erro ao salvar categoria:', saveError)
      setError('Nao foi possivel salvar a categoria.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              width: 'fit-content',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: 'none',
              background: 'transparent',
              color: '#7c3aed',
              cursor: 'pointer',
              fontWeight: 700,
              padding: 0,
              marginBottom: 12,
            }}
          >
            <FiArrowLeft size={16} />
            Voltar
          </button>
          <h1 style={{ margin: 0, fontSize: 30 }}>Categorias</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280', maxWidth: 760 }}>
            Cadastre as categorias em uma tela exclusiva, com imagem, para organizar a vitrine e facilitar a consulta dos produtos pelos clientes.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ ...cardStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{ ...cardStyle, borderColor: '#bbf7d0', background: '#f0fdf4', color: '#166534' }}>
          {successMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(320px, 420px) minmax(0, 1fr)', gap: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiFolderPlus />
            {editingCategoryId ? 'Editar categoria' : 'Nova categoria'}
          </div>
          <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 20, textAlign: 'left' }}>
            Defina a imagem principal, ajuste o recorte da miniatura e escolha se a categoria fica visivel para o cliente.
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, textAlign: 'left' }}>Nome da categoria</label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Vestidos"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, textAlign: 'left' }}>Ordem de exibicao</label>
              <input
                type="number"
                min={1}
                value={order}
                onChange={(event) => setOrder(event.target.value ? Number(event.target.value) : '')}
                placeholder={String(nextSuggestedOrder)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, textAlign: 'left' }}>Imagem da categoria</label>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid #d1d5db',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  marginBottom: 12,
                }}
              >
                <FiImage size={18} />
                {imageFile ? 'Trocar imagem' : 'Selecionar imagem'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  onChange={(event) => handleSelectImage(event.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
              </label>

              <div
                style={{
                  height: 220,
                  borderRadius: 16,
                  border: '1px dashed #d1d5db',
                  background: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {currentSourceImageUrl ? (
                  <img src={currentSourceImageUrl} alt="Preview da categoria" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ color: '#9ca3af', display: 'grid', gap: 8, justifyItems: 'center' }}>
                    <FiImage size={36} />
                    <span>Sem imagem selecionada</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, background: '#fafafa' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, textAlign: 'left' }}>Miniatura da tela do cliente</div>
              <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'left', marginBottom: 16 }}>
                Ajuste o enquadramento que sera exibido no botao circular de categoria.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 120px', gap: 16, alignItems: 'center' }}>
                <div
                  style={{
                    position: 'relative',
                    width: isMobile ? '100%' : editorFrameSize,
                    maxWidth: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: 18,
                    border: '1px solid #d1d5db',
                    overflow: 'hidden',
                    background: '#f8fafc',
                    justifySelf: 'center',
                  }}
                >
                  {currentSourceImageUrl ? (
                    <>
                      <img
                        src={currentSourceImageUrl}
                        alt="Recorte da categoria"
                        style={getPreviewFrameStyle()}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: editorMaskInset,
                          borderRadius: 999,
                          border: '2px solid rgba(255,255,255,0.95)',
                          boxShadow: '0 0 0 999px rgba(15, 23, 42, 0.35)',
                        }}
                      />
                    </>
                  ) : (
                    <div style={{ color: '#9ca3af', display: 'grid', gap: 8, justifyItems: 'center', alignContent: 'center', height: '100%' }}>
                      <FiImage size={36} />
                      <span>Selecione uma imagem para recortar</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
                  <CategoryRoundImage
                    src={currentSourceImageUrl}
                    alt="Miniatura da categoria"
                    label="Prévia"
                    zoom={cropZoom}
                    offsetX={cropX}
                    offsetY={cropY}
                    style={{
                      width: 84,
                      height: 84,
                      border: '1px solid #d1d5db',
                      background: '#f8fafc',
                    }}
                    fallbackStyle={{
                      color: '#9ca3af',
                      fontSize: 11,
                      background: '#f8fafc',
                    }}
                  />
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
                    value={cropZoom}
                    onChange={(event) => setCropZoom(Number(event.target.value))}
                    style={{ width: '100%' }}
                    disabled={!currentSourceImageUrl}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, textAlign: 'left' }}>Mover horizontalmente</label>
                  <input
                    type="range"
                    min="-35"
                    max="35"
                    step="1"
                    value={cropX}
                    onChange={(event) => setCropX(Number(event.target.value))}
                    style={{ width: '100%' }}
                    disabled={!currentSourceImageUrl}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, textAlign: 'left' }}>Mover verticalmente</label>
                  <input
                    type="range"
                    min="-35"
                    max="35"
                    step="1"
                    value={cropY}
                    onChange={(event) => setCropY(Number(event.target.value))}
                    style={{ width: '100%' }}
                    disabled={!currentSourceImageUrl}
                  />
                </div>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: 14,
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                background: hidden ? '#fff7ed' : '#f9fafb',
                cursor: 'pointer',
              }}
            >
              <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: '#111827' }}>Ocultar categoria da tela do cliente</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  Quando ativado, a categoria nao aparece no filtro da home publica.
                </div>
              </div>
            </label>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 700,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <FiSave size={16} />
                {saving ? 'Salvando categoria...' : editingCategoryId ? 'Salvar alteracoes' : 'Salvar categoria'}
              </button>
              {editingCategoryId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    color: '#374151',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    width: isMobile ? '100%' : 'auto',
                  }}
                >
                  Nova categoria
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Categorias cadastradas</div>
          <div style={{ color: '#6b7280', fontSize: 14, marginBottom: 20, textAlign: 'left' }}>
            Essas categorias ficam disponiveis no cadastro de produtos e na selecao da vitrine do cliente.
          </div>

          {loading ? (
            <div style={{ color: '#6b7280', textAlign: 'left' }}>Carregando categorias...</div>
          ) : categories.length === 0 ? (
            <div style={{ color: '#6b7280', textAlign: 'left' }}>Nenhuma categoria cadastrada ainda.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {categories.map((category) => (
                <div key={category.id} style={{ border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
                  <div
                    style={{
                      height: 160,
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {category.image ? (
                      <CategoryRoundImage
                        src={category.thumbnailImage || category.image}
                        alt={category.name}
                        label={category.name}
                        zoom={Number(category.thumbnailZoom || 1)}
                        offsetX={Number(category.thumbnailOffsetX || 0)}
                        offsetY={Number(category.thumbnailOffsetY || 0)}
                        style={{
                          width: 96,
                          height: 96,
                          border: '1px solid #e5e7eb',
                          background: '#fff',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <CategoryRoundImage
                        alt={category.name}
                        label={category.name}
                        style={{ width: 82, height: 82, background: '#ede9fe' }}
                        fallbackStyle={{ color: '#7c3aed', background: '#ede9fe' }}
                      />
                    )}
                  </div>
                  <div style={{ padding: 14, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{category.name}</div>
                      {category.hidden && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#b45309', fontSize: 12, fontWeight: 700 }}>
                          <FiEyeOff size={14} />
                          Oculta
                        </div>
                      )}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 13, marginTop: 6 }}>Ordem: {category.order || 0}</div>
                    <button
                      type="button"
                      onClick={() => startEditing(category)}
                      style={{
                        marginTop: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        color: '#374151',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 700,
                      }}
                    >
                      <FiEdit2 size={15} />
                      Editar categoria
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
