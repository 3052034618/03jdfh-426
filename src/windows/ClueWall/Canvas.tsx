import React, { useRef, useCallback, useEffect } from 'react'

interface CanvasProps {
  children: React.ReactNode
  zoom: number
  pan: { x: number; y: number }
  onZoomChange: (zoom: number) => void
  onPanChange: (pan: { x: number; y: number }) => void
  showGrid?: boolean
  onDrop?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.0
const ZOOM_STEP = 0.1

export function Canvas({
  children,
  zoom,
  pan,
  onZoomChange,
  onPanChange,
  showGrid = false,
  onDrop,
  onDragOver,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const isSpacePressed = useRef(false)
  const lastMousePos = useRef({ x: 0, y: 0 })

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta))

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const mouseX = e.clientX - rect.left
          const mouseY = e.clientY - rect.top

          const scaleChange = newZoom / zoom
          const newPanX = mouseX - (mouseX - pan.x) * scaleChange
          const newPanY = mouseY - (mouseY - pan.y) * scaleChange

          onPanChange({ x: newPanX, y: newPanY })
        }

        onZoomChange(newZoom)
      }
    },
    [zoom, pan, onZoomChange, onPanChange]
  )

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      const isMiddleMouse = e.button === 1
      const isSpaceDrag = isSpacePressed.current && e.button === 0

      if (isMiddleMouse || isSpaceDrag) {
        e.preventDefault()
        isPanning.current = true
        lastMousePos.current = { x: e.clientX, y: e.clientY }

        if (containerRef.current) {
          containerRef.current.style.cursor = 'grabbing'
        }
      }
    },
    []
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - lastMousePos.current.x
        const dy = e.clientY - lastMousePos.current.y
        onPanChange({
          x: pan.x + dx,
          y: pan.y + dy,
        })
        lastMousePos.current = { x: e.clientX, y: e.clientY }
      }
    },
    [pan, onPanChange]
  )

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
    if (containerRef.current) {
      containerRef.current.style.cursor = isSpacePressed.current ? 'grab' : 'default'
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        isSpacePressed.current = true
        if (containerRef.current && !isPanning.current) {
          containerRef.current.style.cursor = 'grab'
        }
      }
    },
    []
  )

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressed.current = false
        if (containerRef.current && !isPanning.current) {
          containerRef.current.style.cursor = 'default'
        }
      }
    },
    []
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, handleKeyDown, handleKeyUp])

  const gridSize = 40
  const gridStyle = showGrid
    ? {
        backgroundImage: `
          linear-gradient(rgba(139, 0, 0, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(139, 0, 0, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }
    : {}

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{
        backgroundColor: '#1a1a1e',
        ...gridStyle,
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(139, 0, 0, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(139, 0, 0, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.02) 0%, transparent 30%),
            radial-gradient(circle at 60% 60%, rgba(255, 255, 255, 0.02) 0%, transparent 30%)
          `,
        }}
      />
      <div
        className="absolute"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          minWidth: '3000px',
          minHeight: '3000px',
        }}
      >
        {children}
      </div>
    </div>
  )
}
