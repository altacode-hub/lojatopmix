import { FiSearch } from 'react-icons/fi'

interface ProductSearchBarProps {
  value: string
  onChange: (value: string) => void
}

export default function ProductSearchBar({ value, onChange }: ProductSearchBarProps) {
  return (
    <section>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          padding: '12px 0px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 999,
            padding: '12px 12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              color: '#64748b',
              alignItems: 'center',
            }}
          >
            <FiSearch size={15} />
          </div>
          <input
            type="search"
            placeholder="Faça sua busca"
            aria-label="Buscar produtos"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            style={{
              outline: 'none',
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              color: '#0f172a',
              width: '100%',
            }}
          />
        </div>
      </div>
    </section>
  )
}
