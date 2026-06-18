import type { LineType } from '../types'

export function getBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const controlOffset = Math.min(Math.abs(dx) * 0.5, 100)

  const cx1 = x1 + controlOffset
  const cy1 = y1
  const cx2 = x2 - controlOffset
  const cy2 = y2

  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
}

export function getMidpoint(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
  }
}

export function getLineColor(lineType: LineType): string {
  const colors: Record<LineType, string> = {
    red: '#ef4444',
    dashed: '#6b7280',
    contaminated: '#a855f7',
  }
  return colors[lineType]
}

export function getLineStyle(lineType: LineType): {
  stroke: string
  strokeDasharray: string
  strokeWidth: number
} {
  const styles: Record<
    LineType,
    { stroke: string; strokeDasharray: string; strokeWidth: number }
  > = {
    red: {
      stroke: '#ef4444',
      strokeDasharray: 'none',
      strokeWidth: 2,
    },
    dashed: {
      stroke: '#6b7280',
      strokeDasharray: '8 4',
      strokeWidth: 2,
    },
    contaminated: {
      stroke: '#a855f7',
      strokeDasharray: '4 2',
      strokeWidth: 3,
    },
  }
  return styles[lineType]
}
