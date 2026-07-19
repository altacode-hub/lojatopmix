import { FiImage } from 'react-icons/fi'
import CategoryRoundImage from './CategoryRoundImage'
import FramedImage from './FramedImage'

interface CategoryRoundCropEditorProps {
  src?: string
  zoom: number
  offsetX: number
  offsetY: number
  onZoomChange: (value: number) => void
  onOffsetXChange: (value: number) => void
  onOffsetYChange: (value: number) => void
  frameSize?: number
  maskInset?: number
  isMobile?: boolean
}

export default function CategoryRoundCropEditor({
  src,
  zoom,
  offsetX,
  offsetY,
  onZoomChange,
  onOffsetXChange,
  onOffsetYChange,
  frameSize = 280,
  maskInset = 0,
  isMobile = false,
}: CategoryRoundCropEditorProps) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, background: '#fafafa' }}>
      <div style={{ fontWeight: 700, marginBottom: 8, textAlign: 'left' }}>Miniatura da tela do cliente</div>
      <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'left', marginBottom: 16 }}>
        Ajuste o enquadramento que sera exibido no botao circular de categoria.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 120px', gap: 16, alignItems: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: isMobile ? '100%' : frameSize,
            maxWidth: '100%',
            aspectRatio: '1 / 1',
            borderRadius: 18,
            border: '1px solid #d1d5db',
            overflow: 'hidden',
            background: '#f8fafc',
            justifySelf: 'center',
          }}
        >
          {src ? (
            <>
              <FramedImage
                src={src}
                alt="Recorte da categoria"
                zoom={zoom}
                offsetX={offsetX}
                offsetY={offsetY}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: maskInset,
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
            src={src}
            alt="Miniatura da categoria"
            label="Previa"
            zoom={zoom}
            offsetX={offsetX}
            offsetY={offsetY}
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
            value={zoom}
            onChange={(event) => onZoomChange(Number(event.target.value))}
            style={{ width: '100%' }}
            disabled={!src}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, textAlign: 'left' }}>Mover horizontalmente</label>
          <input
            type="range"
            min="-35"
            max="35"
            step="1"
            value={offsetX}
            onChange={(event) => onOffsetXChange(Number(event.target.value))}
            style={{ width: '100%' }}
            disabled={!src}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, textAlign: 'left' }}>Mover verticalmente</label>
          <input
            type="range"
            min="-35"
            max="35"
            step="1"
            value={offsetY}
            onChange={(event) => onOffsetYChange(Number(event.target.value))}
            style={{ width: '100%' }}
            disabled={!src}
          />
        </div>
      </div>
    </div>
  )
}
