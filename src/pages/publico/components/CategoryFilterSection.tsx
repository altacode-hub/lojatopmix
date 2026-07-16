interface CategoryOption {
  id: string
  label: string
  imageUrl?: string
  thumbnailZoom?: number
  thumbnailOffsetX?: number
  thumbnailOffsetY?: number
}

interface CategoryFilterSectionProps {
  categories: CategoryOption[]
  selectedCategoryId: string
  onSelect: (categoryId: string) => void
}

export default function CategoryFilterSection({
  categories,
  selectedCategoryId,
  onSelect,
}: CategoryFilterSectionProps) {
  const options = [{ id: '', label: 'Todos' }, ...categories]

  return (
    <section>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '12px 16px' }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 'var(--font-size-grande)',
            color: '#797979',
            wordBreak: 'break-word',
            marginBottom: 10,
            textAlign: 'left',
          }}
        >
          Categorias
        </div>
        <div
          style={{
            display: 'flex',
            gap: 18,
            overflowX: 'auto',
            paddingBottom: 8,
            scrollbarWidth: 'thin',
          }}
        >
          {options.map((category) => {
            const isSelected = selectedCategoryId === category.id

            return (
              <button
                key={category.id || 'all'}
                type="button"
                title={category.label}
                onClick={() => onSelect(category.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  minWidth: 72,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    background: isSelected ? '#b58516' : '#f1f5f9',
                    border: `1px solid ${isSelected ? '#b58516' : '#e2e8f0'}`,
                    color: isSelected ? '#fff' : '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    textAlign: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {category.imageUrl ? (
                    <img
                      src={category.imageUrl}
                      alt={category.label}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: `translate(${Number(category.thumbnailOffsetX || 0)}%, ${Number(category.thumbnailOffsetY || 0)}%) scale(${Number(category.thumbnailZoom || 1)})`,
                        transformOrigin: 'center center',
                      }}
                    />
                  ) : (
                    <span style={{ padding: 8 }}>{category.label.slice(0, 2).toUpperCase()}</span>
                  )}
                </span>
                <span style={{ fontSize: 12, color: isSelected ? '#0f172a' : '#334155', fontWeight: isSelected ? 700 : 500 }}>
                  {category.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
