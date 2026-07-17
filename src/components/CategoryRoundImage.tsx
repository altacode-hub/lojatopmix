import FramedImage from './FramedImage'

interface CategoryRoundImageProps {
  src?: string
  alt: string
  label?: string
  zoom?: number
  offsetX?: number
  offsetY?: number
  style?: React.CSSProperties
  fallbackStyle?: React.CSSProperties
}

export default function CategoryRoundImage({
  src,
  alt,
  label = '',
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
  style,
  fallbackStyle,
}: CategoryRoundImageProps) {
  const initials = label.trim().slice(0, 2).toUpperCase() || 'CT'

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 999,
        ...style,
      }}
    >
      {src ? (
        <FramedImage
          src={src}
          alt={alt}
          zoom={zoom}
          offsetX={offsetX}
          offsetY={offsetY}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            ...fallbackStyle,
          }}
        >
          {initials}
        </div>
      )}
    </div>
  )
}
