interface Position {
  x: number
  y: number
}

interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function getPointerPosition(event: PointerEvent | MouseEvent | React.PointerEvent | React.MouseEvent): Position {
  if ('clientX' in event && 'clientY' in event) {
    return {
      x: event.clientX,
      y: event.clientY,
    }
  }
  return { x: 0, y: 0 }
}

export function clampPosition(pos: Position, bounds: Bounds): Position {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, pos.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, pos.y)),
  }
}

export function snapToGrid(pos: Position, gridSize: number): Position {
  return {
    x: Math.round(pos.x / gridSize) * gridSize,
    y: Math.round(pos.y / gridSize) * gridSize,
  }
}
