import { useEffect, useMemo, useState } from 'react'
import { onValue, push, ref, update } from 'firebase/database'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiEdit2, FiEyeOff, FiFolderPlus, FiImage, FiSave } from 'react-icons/fi'
import CategoryRoundCropEditor from '../../components/CategoryRoundCropEditor'
import CategoryRoundImage from '../../components/CategoryRoundImage'
import { rtdb, storage } from '../../service/firebase'
import type { CatalogCategoryRecord } from '../../types/catalog'
import { CATALOG_SYNC_PATH } from './stockCache'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { logistaCardStyle, logistaInputStyle, logistaTheme } from './logistaTheme'

interface CategoryListItem extends CatalogCategoryRecord {
  id: string
}

const cardStyle: React.CSSProperties = {
  ...logistaCardStyle,
}

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
              color: logistaTheme.colors.accentDark,
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
          <p style={{ margin: '8px 0 0', color: logistaTheme.colors.textMuted, maxWidth: 760 }}>
            Cadastre as categorias em uma tela exclusiva, com imagem, para organizar a vitrine e facilitar a consulta dos produtos pelos clientes.
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            ...cardStyle,
            borderColor: logistaTheme.colors.errorBorder,
            background: logistaTheme.colors.errorBackground,
            color: logistaTheme.colors.errorText,
          }}
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            ...cardStyle,
            borderColor: logistaTheme.colors.successBorder,
            background: logistaTheme.colors.successBackground,
            color: logistaTheme.colors.successText,
          }}
        >
          {successMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(320px, 420px) minmax(0, 1fr)', gap: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiFolderPlus />
            {editingCategoryId ? 'Editar categoria' : 'Nova categoria'}
          </div>
          <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14, marginBottom: 20, textAlign: 'left' }}>
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
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
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
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
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
                  border: `1px solid ${logistaTheme.colors.borderStrong}`,
                  background: logistaTheme.colors.surface,
                  color: logistaTheme.colors.text,
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
            </div>

            <CategoryRoundCropEditor
              src={currentSourceImageUrl}
              zoom={cropZoom}
              offsetX={cropX}
              offsetY={cropY}
              onZoomChange={setCropZoom}
              onOffsetXChange={setCropX}
              onOffsetYChange={setCropY}
              isMobile={isMobile}
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: 14,
                border: `1px solid ${logistaTheme.colors.border}`,
                borderRadius: 14,
                background: hidden ? logistaTheme.colors.warningBackground : logistaTheme.colors.surfaceAlt,
                cursor: 'pointer',
              }}
            >
              <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: logistaTheme.colors.text }}>Ocultar categoria da tela do cliente</div>
                <div style={{ fontSize: 13, color: logistaTheme.colors.textMuted, marginTop: 4 }}>
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
                  background: logistaTheme.colors.accent,
                  color: logistaTheme.colors.surface,
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
                    border: `1px solid ${logistaTheme.colors.border}`,
                    background: logistaTheme.colors.surface,
                    color: logistaTheme.colors.text,
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
          <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14, marginBottom: 20, textAlign: 'left' }}>
            Essas categorias ficam disponiveis no cadastro de produtos e na selecao da vitrine do cliente.
          </div>

          {loading ? (
            <div style={{ color: logistaTheme.colors.textMuted, textAlign: 'left' }}>Carregando categorias...</div>
          ) : categories.length === 0 ? (
            <div style={{ color: logistaTheme.colors.textMuted, textAlign: 'left' }}>Nenhuma categoria cadastrada ainda.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {categories.map((category) => (
                <div
                  key={category.id}
                  style={{
                    border: `1px solid ${logistaTheme.colors.border}`,
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: logistaTheme.colors.surface,
                  }}
                >
                  <div
                    style={{
                      height: 160,
                      background: logistaTheme.colors.surfaceAlt,
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
                          border: `1px solid ${logistaTheme.colors.border}`,
                          background: logistaTheme.colors.surface,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <CategoryRoundImage
                        alt={category.name}
                        label={category.name}
                        style={{ width: 82, height: 82, background: logistaTheme.colors.accentSoft }}
                        fallbackStyle={{ color: logistaTheme.colors.accentDark, background: logistaTheme.colors.accentSoft }}
                      />
                    )}
                  </div>
                  <div style={{ padding: 14, textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{category.name}</div>
                      {category.hidden && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            color: logistaTheme.colors.warningText,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          <FiEyeOff size={14} />
                          Oculta
                        </div>
                      )}
                    </div>
                    <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13, marginTop: 6 }}>Ordem: {category.order || 0}</div>
                    <button
                      type="button"
                      onClick={() => startEditing(category)}
                      style={{
                        marginTop: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: `1px solid ${logistaTheme.colors.border}`,
                        background: logistaTheme.colors.surface,
                        color: logistaTheme.colors.text,
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
