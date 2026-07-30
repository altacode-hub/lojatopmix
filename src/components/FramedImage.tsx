import { useEffect, useMemo, useRef, useState } from 'react'
import loadingSvg from '../assets/loading.svg'

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
  const [isVisible, setIsVisible] = useState(false)
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!src) {
      setNaturalSize({ width: 1, height: 1 })
      setHasError(false)
      setIsVisible(false)
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current)
        visibilityTimerRef.current = null
      }
      return
    }

    setHasError(false)
    setIsVisible(false)
    if (visibilityTimerRef.current) {
      clearTimeout(visibilityTimerRef.current)
      visibilityTimerRef.current = null
    }

    const image = new Image()
    image.onload = () => {
      const w = image.naturalWidth || 1
      const h = image.naturalHeight || 1
      setNaturalSize({ width: w, height: h })
      visibilityTimerRef.current = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
    }
    image.onerror = () => {
      setHasError(true)
      setIsVisible(false)
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current)
        visibilityTimerRef.current = null
      }
      onError?.()
    }
    image.src = src

    return () => {
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current)
        visibilityTimerRef.current = null
      }
    }
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
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      ...imgStyle,
    }),
    [imgStyle, naturalSize.height, naturalSize.width, offsetX, offsetY, zoom, isVisible],
  )

  const loadingStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      userSelect: 'none',
      pointerEvents: 'none',
      display: 'block',
      opacity: isVisible ? 0 : 1,
      transition: 'opacity 0.3s ease',
    }),
    [isVisible],
  )

  if (!src || hasError) {
    if (!fallback) return null

    return <div style={fallbackStyle}>{fallback}</div>
  }

  return (
    <>
      <img
        src={loadingSvg}
        alt=""
        aria-hidden="true"
        style={loadingStyle}
      />
      <img
        src={src}
        alt={alt}
        style={style}
        onError={() => {
          setHasError(true)
          setIsVisible(false)
          if (visibilityTimerRef.current) {
            clearTimeout(visibilityTimerRef.current)
            visibilityTimerRef.current = null
          }
          onError?.()
        }}
      />
    </>
  )
}
