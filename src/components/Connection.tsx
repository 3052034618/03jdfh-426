import { useMemo, useState, useCallback } from 'react'
import type { Connection, Card } from '../types'
import { getBezierPath, getMidpoint, getLineStyle, getLineColor } from '../utils/svg'

const relationTypeLabels: Record<string, string> = {
  causality: '因果关系',
  misleading: '误导性关联',
  homology: '同源关系',
  unconfirmed: '未确认关联',
}

const lineTypeLabels: Record<string, string> = {
  red: '红线',
  dashed: '虚线',
  contaminated: '污染线',
}

interface ConnectionProps {
  connection: Connection
  sourceCard: Card
  targetCard: Card
  isSelected?: boolean
  isHovered?: boolean
  onSelect?: (connection: Connection) => void
  onHover?: (connection: Connection | null) => void
  onContextMenu?: (e: React.MouseEvent, connection: Connection) => void
}

const CARD_WIDTH = 192
const CARD_HEIGHT = 120

export function ConnectionLine({
  connection,
  sourceCard,
  targetCard,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onContextMenu,
}: ConnectionProps) {
  const [localHovered, setLocalHovered] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const active = isSelected || isHovered || localHovered

  const { path, arrowId, midpoint } = useMemo(() => {
    const x1 = sourceCard.position.x + CARD_WIDTH / 2
    const y1 = sourceCard.position.y + CARD_HEIGHT / 2
    const x2 = targetCard.position.x + CARD_WIDTH / 2
    const y2 = targetCard.position.y + CARD_HEIGHT / 2

    const path = getBezierPath(x1, y1, x2, y2)
    const arrowId = `arrow-${connection.id}`
    const midpoint = getMidpoint(x1, y1, x2, y2)

    return { path, arrowId, midpoint }
  }, [sourceCard.position, targetCard.position, connection.id])

  const lineStyle = useMemo(() => {
    const baseStyle = getLineStyle(connection.lineType)
    const color = getLineColor(connection.lineType)

    return {
      ...baseStyle,
      strokeWidth: active ? baseStyle.strokeWidth + 2 : baseStyle.strokeWidth,
      stroke: isSelected ? '#fbbf24' : baseStyle.stroke,
      filter: active ? `drop-shadow(0 0 8px ${color})` : 'none',
    }
  }, [connection.lineType, active, isSelected])

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect?.(connection)
  }

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    setLocalHovered(true)
    onHover?.(connection)
    updateTooltipPos(e)
  }, [connection, onHover])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (localHovered) {
      updateTooltipPos(e)
    }
  }, [localHovered])

  const handleMouseLeave = useCallback(() => {
    setLocalHovered(false)
    setTooltipPos(null)
    onHover?.(null)
  }, [onHover])

  const updateTooltipPos = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu?.(e, connection)
  }

  const relationLabel = relationTypeLabels[connection.relationType] || connection.relationType
  const lineLabel = lineTypeLabels[connection.lineType] || connection.lineType

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      />

      <path
        d={path}
        fill="none"
        stroke={lineStyle.stroke}
        strokeWidth={lineStyle.strokeWidth}
        strokeDasharray={lineStyle.strokeDasharray}
        markerEnd={`url(#${arrowId})`}
        style={{
          filter: lineStyle.filter,
          pointerEvents: 'none',
          transition: 'all 0.2s ease',
        }}
      />

      <defs>
        <marker
          id={arrowId}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L0,6 L9,3 z"
            fill={isSelected ? '#fbbf24' : lineStyle.stroke}
          />
        </marker>
      </defs>

      {active && (
        <circle
          cx={midpoint.x}
          cy={midpoint.y}
          r="6"
          fill={isSelected ? '#fbbf24' : lineStyle.stroke}
          style={{
            filter: lineStyle.filter,
            pointerEvents: 'none',
          }}
        />
      )}

      {localHovered && tooltipPos && (
        <foreignObject
          x={midpoint.x - 100}
          y={midpoint.y - 70}
          width={200}
          height={60}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(17, 17, 20, 0.95)',
              border: '1px solid rgba(139, 0, 0, 0.6)',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#e8e8e8',
              fontSize: '12px',
              fontFamily: "'IBM Plex Mono', monospace",
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 600, color: '#f87171', marginBottom: '2px' }}>
              {lineLabel} · {relationLabel}
            </div>
            {connection.reason && (
              <div style={{ color: '#9ca3af', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {connection.reason}
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </>
  )
}
