import { useEffect, useMemo, useState } from 'react'

interface FramedImageProps {
  src: string
  alt: string
  zoom?: number
  offsetX?: number
  offsetY?: number
  imgStyle?: React.CSSProperties
  fallback?: React.ReactNode
  fallbackStyle?: React.CSSProperties
  onError?: () => void
}

export default function FramedImage({
  src,
  alt,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
  imgStyle,
  fallback,
  fallbackStyle,
  onError,
}: FramedImageProps) {
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 })
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!src) {
      setNaturalSize({ width: 1, height: 1 })
      setHasError(false)
      return
    }

    setHasError(false)

    const image = new Image()
    image.onload = () => {
      setNaturalSize({
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1,
      })
    }
    image.onerror = () => {
      setHasError(true)
      onError?.()
    }
    image.src = src
  }, [onError, src])

  const style = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: naturalSize.width >= naturalSize.height ? `${(naturalSize.width / naturalSize.height) * 100}%` : '100%',
      height: naturalSize.width >= naturalSize.height ? '100%' : `${(naturalSize.height / naturalSize.width) * 100}%`,
      maxWidth: 'none',
      maxHeight: 'none',
      transform: `translate(calc(-50% + ${offsetX}%), calc(-50% + ${offsetY}%)) scale(${zoom})`,
      transformOrigin: 'center center',
      userSelect: 'none',
      pointerEvents: 'none',
      display: 'block',
      ...imgStyle,
    }),
    [imgStyle, naturalSize.height, naturalSize.width, offsetX, offsetY, zoom],
  )

  if (!src || hasError) {
    if (!fallback) return null

    return <div style={fallbackStyle}>{fallback}</div>
  }

  return (
    <img
      src={src}
      alt={alt}
      style={style}
      onError={() => {
        setHasError(true)
        onError?.()
      }}
    />
  )
}
