import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const positionStyles: Record<
  NonNullable<TooltipProps['position']>,
  { tooltip: string; arrow: string }
> = {
  top: {
    tooltip: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    arrow: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900',
  },
  bottom: {
    tooltip: 'top-full left-1/2 -translate-x-1/2 mt-2',
    arrow: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900',
  },
  left: {
    tooltip: 'right-full top-1/2 -translate-y-1/2 mr-2',
    arrow: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900',
  },
  right: {
    tooltip: 'left-full top-1/2 -translate-y-1/2 ml-2',
    arrow: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900',
  },
}

export function Tooltip({ children, content, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const updatePosition = () => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      setCoords({ x: rect.left, y: rect.top })
    }
  }

  const handleMouseEnter = () => {
    updatePosition()
    setIsVisible(true)
  }

  const handleMouseLeave = () => {
    setIsVisible(false)
  }

  const styles = positionStyles[position]

  const tooltipContent = mounted && (
    <div
      className={`fixed z-50 pointer-events-none transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ left: coords.x, top: coords.y }}
    >
      <div
        className={`absolute px-3 py-2 text-sm text-white bg-gray-900 rounded-md shadow-lg whitespace-nowrap ${styles.tooltip}`}
      >
        {content}
        <div
          className={`absolute w-0 h-0 border-4 border-transparent ${styles.arrow}`}
        />
      </div>
    </div>
  )

  return (
    <div
      ref={wrapperRef}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {mounted && typeof document !== 'undefined' && createPortal(tooltipContent, document.body)}
    </div>
  )
}
