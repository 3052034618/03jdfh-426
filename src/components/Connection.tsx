import { useMemo, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  containerRef?: React.RefObject<HTMLElement | null>
  pan?: { x: number; y: number }
  zoom?: number
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
  containerRef,
  pan = { x: 0, y: 0 },
  zoom = 1,
}: ConnectionProps) {
  const [localHovered, setLocalHovered] = useState(false)
  const [tooltipClientPos, setTooltipClientPos] = useState<{ x: number; y: number } | null>(null)

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
      strokeWidth: active ? baseStyle.strokeWidth + 2.5 : baseStyle.strokeWidth,
      stroke: isSelected ? '#fbbf24' : baseStyle.stroke,
      filter: active ? `drop-shadow(0 0 10px ${color})` : 'none',
    }
  }, [connection.lineType, active, isSelected])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect?.(connection)
  }

  const updateTooltipFromEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    setTooltipClientPos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    setLocalHovered(true)
    onHover?.(connection)
    updateTooltipFromEvent(e)
  }, [connection, onHover, updateTooltipFromEvent])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    updateTooltipFromEvent(e)
  }, [updateTooltipFromEvent])

  const handleMouseLeave = useCallback(() => {
    setLocalHovered(false)
    setTooltipClientPos(null)
    onHover?.(null)
  }, [onHover])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu?.(e, connection)
  }

  useEffect(() => {
    if (!localHovered) return

    const onGlobalMove = (e: MouseEvent) => {
      updateTooltipFromEvent(e as unknown as React.MouseEvent)
    }
    window.addEventListener('mousemove', onGlobalMove)
    return () => window.removeEventListener('mousemove', onGlobalMove)
  }, [localHovered, updateTooltipFromEvent])

  const relationLabel = relationTypeLabels[connection.relationType] || connection.relationType
  const lineLabel = lineTypeLabels[connection.lineType] || connection.lineType

  const tooltipScreenPos = useMemo(() => {
    if (!tooltipClientPos) return { x: 0, y: 0, top: true }
    const tipW = 230
    const tipH = 68
    const spaceTop = tooltipClientPos.y - 20
    const placeTop = spaceTop > tipH + 20
    return {
      x: Math.max(8, Math.min(window.innerWidth - tipW - 8, tooltipClientPos.x - tipW / 2)),
      y: placeTop ? tooltipClientPos.y - tipH - 14 : tooltipClientPos.y + 14,
      top: placeTop,
    }
  }, [tooltipClientPos])

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={32}
        style={{
          cursor: 'pointer',
          pointerEvents: 'stroke',
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      />

      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        style={{
          cursor: 'pointer',
          pointerEvents: 'stroke',
          opacity: 0.0,
        }}
        onMouseDown={handleMouseDown}
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
        strokeLinecap="round"
        markerEnd={`url(#${arrowId})`}
        style={{
          filter: lineStyle.filter,
          pointerEvents: 'none',
          transition: 'stroke-width 0.15s ease, filter 0.15s ease',
        }}
      />

      <defs>
        <marker
          id={arrowId}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="4"
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L0,8 L11,4 z"
            fill={isSelected ? '#fbbf24' : lineStyle.stroke}
            style={{ transition: 'fill 0.15s ease' }}
          />
        </marker>
      </defs>

      {(active || localHovered) && (
        <circle
          cx={midpoint.x}
          cy={midpoint.y}
          r="7"
          fill={isSelected ? '#fbbf24' : lineStyle.stroke}
          stroke="#1a1a1e"
          strokeWidth="2"
          style={{
            filter: lineStyle.filter,
            pointerEvents: 'none',
          }}
        />
      )}

      {localHovered && tooltipClientPos && typeof document !== 'undefined' && (
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: tooltipScreenPos.x,
              top: tooltipScreenPos.y,
              width: 230,
              background: 'rgba(18, 18, 22, 0.97)',
              border: `1px solid ${
                connection.lineType === 'red' ? 'rgba(139, 0, 0, 0.7)'
                  : connection.lineType === 'contaminated' ? 'rgba(124, 58, 237, 0.7)'
                  : 'rgba(107, 114, 128, 0.7)'
              }`,
              borderRadius: '8px',
              padding: '10px 12px',
              color: '#e8e8e8',
              fontSize: '12px',
              fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
              boxShadow: '0 6px 24px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
              zIndex: 9999,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <div style={{
              fontWeight: 700,
              color: connection.lineType === 'red' ? '#f87171'
                : connection.lineType === 'contaminated' ? '#c084fc'
                : '#9ca3af',
              marginBottom: '4px',
              letterSpacing: '0.02em',
            }}>
              🔗 {lineLabel} · {relationLabel}
            </div>
            {connection.reason ? (
              <div style={{
                color: '#d1d5db',
                fontSize: '11.5px',
                lineHeight: 1.45,
                maxHeight: 54,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
              }}>
                {connection.reason}
              </div>
            ) : (
              <div style={{ color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>
                （未填写连接理由，右键编辑）
              </div>
            )}
            <div style={{
              marginTop: '6px',
              paddingTop: '6px',
              borderTop: '1px dashed rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              color: '#6b7280',
              fontSize: '10px',
            }}>
              <span>点击选中</span>
              <span>右键编辑</span>
            </div>
          </div>,
          document.body
        )
      )}
    </>
  )
}
