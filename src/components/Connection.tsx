import { useMemo, useState } from 'react'
import type { Connection, Card } from '../types'
import { getBezierPath, getMidpoint, getLineStyle, getLineColor } from '../utils/svg'
import { Tooltip } from './Tooltip'

const relationTypeLabels: Record<string, string> = {
  causality: '因果关系',
  misleading: '误导性关联',
  homology: '同源关系',
  unconfirmed: '未确认关联',
}

interface ConnectionProps {
  connection: Connection
  sourceCard: Card
  targetCard: Card
  isSelected?: boolean
  isHovered?: boolean
  onSelect?: (connection: Connection) => void
  onHover?: (connection: Connection | null) => void
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
}: ConnectionProps) {
  const [localHovered, setLocalHovered] = useState(false)
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
    onSelect?.(connection)
  }

  const handleMouseEnter = () => {
    setLocalHovered(true)
    onHover?.(connection)
  }

  const handleMouseLeave = () => {
    setLocalHovered(false)
    onHover?.(null)
  }

  const tooltipContent = (
    <div className="text-sm">
      <div className="font-semibold text-white mb-1">
        {relationTypeLabels[connection.relationType] || connection.relationType}
      </div>
      <div className="text-gray-300 text-xs">{connection.reason}</div>
    </div>
  )

  return (
    <g>
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

      <Tooltip content={tooltipContent} position="top">
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
          style={{ cursor: 'pointer' }}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      </Tooltip>

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
    </g>
  )
}
