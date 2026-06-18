import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  ZoomIn, ZoomOut, Maximize2, Grid3X3, LayoutGrid, Trash2,
  Link, Edit2, Trash, X, Filter, SlidersHorizontal, ChevronDown,
} from 'lucide-react'
import { Canvas } from './Canvas'
import { ConnectionToolbar } from './ConnectionToolbar'
import { ClueCard } from '../../components/Card'
import { ConnectionLine } from '../../components/Connection'
import { useCardStore } from '../../store/useCardStore'
import { useConnectionStore } from '../../store/useConnectionStore'
import type { Card, Connection, LineType, RelationType, Chapter } from '../../types'
import { getBezierPath } from '../../utils/svg'
import { useChapterStore } from '../../store/useChapterStore'
import { cn } from '../../lib/utils'

const CARD_WIDTH = 192
const CARD_HEIGHT = 120
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.0

interface ContextMenuState {
  type: 'card' | 'connection'
  x: number
  y: number
  data: Card | Connection
}

interface ConnectionFilter {
  lineTypes: Set<LineType>
  relationTypes: Set<RelationType>
  chapterMin: number | null
  chapterMax: number | null
}

const lineTypeLabels: Record<LineType, string> = {
  red: '红线',
  dashed: '虚线',
  contaminated: '污染线',
}
const relationTypeLabels: Record<RelationType, string> = {
  causality: '因果',
  misleading: '误导',
  homology: '同源',
  unconfirmed: '未确认',
}
const allLineTypes: LineType[] = ['red', 'dashed', 'contaminated']
const allRelationTypes: RelationType[] = ['causality', 'misleading', 'homology', 'unconfirmed']

export function ClueWall() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(false)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<Record<string, { dx: number; dy: number }>>({})
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [pendingConnection, setPendingConnection] = useState<{
    sourceId: string
    targetId: string
    targetPosition: { x: number; y: number }
  } | null>(null)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  const [isDraggingCardOnCanvas, setIsDraggingCardOnCanvas] = useState(false)

  const [filter, setFilter] = useState<ConnectionFilter>({
    lineTypes: new Set<LineType>(),
    relationTypes: new Set<RelationType>(),
    chapterMin: null,
    chapterMax: null,
  })
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const { cards, moveCardToWall, updateCardPosition, updateCard, deleteCard, selectCard, selectedCardId } = useCardStore()
  const {
    connections,
    addConnection,
    updateConnection,
    deleteConnection,
    startCreatingConnection,
    updateCreatingConnectionPos,
    cancelCreatingConnection,
    creatingConnection,
    selectedConnectionId,
    selectConnection,
  } = useConnectionStore()
  const { chapters } = useChapterStore()

  const wallCards = useMemo(() => cards.filter((c) => c.onWall), [cards])
  const sortedChapters: Chapter[] = useMemo(
    () => [...chapters].sort((a, b) => a.number - b.number),
    [chapters]
  )

  const {
    matchedConnectionIds,
    relatedCardIds,
    filterActive,
  } = useMemo(() => {
    const hasLine = filter.lineTypes.size > 0
    const hasRelation = filter.relationTypes.size > 0
    const hasMin = filter.chapterMin !== null
    const hasMax = filter.chapterMax !== null
    const active = hasLine || hasRelation || hasMin || hasMax

    if (!active) {
      return {
        matchedConnectionIds: new Set<string>(),
        relatedCardIds: new Set<string>(),
        filterActive: false,
      }
    }

    const matched = new Set<string>()
    const related = new Set<string>()

    connections.forEach((conn) => {
      if (hasLine && !filter.lineTypes.has(conn.lineType)) return
      if (hasRelation && !filter.relationTypes.has(conn.relationType)) return

      const sourceCard = cards.find((c) => c.id === conn.sourceId)
      const targetCard = cards.find((c) => c.id === conn.targetId)
      if (!sourceCard || !targetCard) return

      if (hasMin || hasMax) {
        const minChapter = Math.min(sourceCard.chapter, targetCard.chapter)
        const maxChapter = Math.max(sourceCard.chapter, targetCard.chapter)
        if (filter.chapterMin !== null && minChapter < filter.chapterMin) return
        if (filter.chapterMax !== null && maxChapter > filter.chapterMax) return
      }

      matched.add(conn.id)
      related.add(conn.sourceId)
      related.add(conn.targetId)
    })

    return {
      matchedConnectionIds: matched,
      relatedCardIds: related,
      filterActive: active,
    }
  }, [filter, connections, cards])

  const getCardById = useCallback(
    (id: string) => cards.find((c) => c.id === id),
    [cards]
  )

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 }
      const rect = containerRef.current.getBoundingClientRect()
      return {
        x: (screenX - rect.left - pan.x) / zoom,
        y: (screenY - rect.top - pan.y) / zoom,
      }
    },
    [pan, zoom]
  )

  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))

  const handleFitToView = useCallback(() => {
    if (wallCards.length === 0) {
      setPan({ x: 0, y: 0 })
      setZoom(1)
      return
    }

    const minX = Math.min(...wallCards.map((c) => c.position.x))
    const maxX = Math.max(...wallCards.map((c) => c.position.x + CARD_WIDTH))
    const minY = Math.min(...wallCards.map((c) => c.position.y))
    const maxY = Math.max(...wallCards.map((c) => c.position.y + CARD_HEIGHT))

    const padding = 100
    const contentWidth = maxX - minX + padding * 2
    const contentHeight = maxY - minY + padding * 2

    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const scaleX = rect.width / contentWidth
    const scaleY = rect.height / contentHeight
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)))

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const newPanX = rect.width / 2 - centerX * newZoom
    const newPanY = rect.height / 2 - centerY * newZoom

    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }, [wallCards])

  const handleAutoArrange = useCallback(() => {
    const cols = Math.max(2, Math.ceil(Math.sqrt(wallCards.length)))
    const spacing = 60
    const startX = 100
    const startY = 100

    wallCards.forEach((card, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      const x = startX + col * (CARD_WIDTH + spacing)
      const y = startY + row * (CARD_HEIGHT + spacing)
      updateCardPosition(card.id, { x, y })
    })
  }, [wallCards, updateCardPosition])

  const handleClearConnections = useCallback(() => {
    connections.forEach((conn) => deleteConnection(conn.id))
  }, [connections, deleteConnection])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const cardId = e.dataTransfer.getData('text/plain')
      if (!cardId) return

      const pos = screenToCanvas(e.clientX, e.clientY)
      const adjustedPos = {
        x: pos.x - CARD_WIDTH / 2,
        y: pos.y - CARD_HEIGHT / 2,
      }
      moveCardToWall(cardId, adjustedPos)
    },
    [screenToCanvas, moveCardToWall]
  )

  function isConnectionTarget(target: EventTarget | null): boolean {
    if (!target) return false
    const el = target as SVGElement
    return el.hasAttribute?.('data-connection-hit') || false
  }

  const handleCardMouseDown = useCallback(
    (e: React.MouseEvent, card: Card) => {
      if (e.button === 2) return
      if (isConnectionTarget(e.target)) return

      const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey

      if (isMultiSelect) {
        setSelectedCardIds((prev) => {
          const next = new Set(prev)
          if (next.has(card.id)) {
            next.delete(card.id)
          } else {
            next.add(card.id)
          }
          return next
        })
      } else if (!selectedCardIds.has(card.id)) {
        setSelectedCardIds(new Set([card.id]))
        selectCard(card.id)
      }

      selectConnection(null)

      const pos = screenToCanvas(e.clientX, e.clientY)
      const offset: Record<string, { dx: number; dy: number }> = {}
      const idsToDrag = selectedCardIds.has(card.id) ? selectedCardIds : new Set([card.id])

      idsToDrag.forEach((id) => {
        const c = getCardById(id)
        if (c) {
          offset[id] = {
            dx: pos.x - c.position.x,
            dy: pos.y - c.position.y,
          }
        }
      })

      setDragOffset(offset)
      setIsDragging(true)
      setIsDraggingCardOnCanvas(true)
    },
    [selectedCardIds, screenToCanvas, getCardById, selectCard, selectConnection]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (creatingConnection.sourceId) {
        const pos = screenToCanvas(e.clientX, e.clientY)
        updateCreatingConnectionPos(pos)
      }

      if (isDragging && Object.keys(dragOffset).length > 0) {
        const pos = screenToCanvas(e.clientX, e.clientY)
        Object.entries(dragOffset).forEach(([id, offset]) => {
          const newPos = {
            x: pos.x - offset.dx,
            y: pos.y - offset.dy,
          }
          updateCardPosition(id, newPos)
        })
      }
    },
    [creatingConnection.sourceId, isDragging, dragOffset, screenToCanvas, updateCreatingConnectionPos, updateCardPosition]
  )

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (creatingConnection.sourceId) {
        const pos = screenToCanvas(e.clientX, e.clientY)
        const targetCard = wallCards.find(
          (c) =>
            pos.x >= c.position.x &&
            pos.x <= c.position.x + CARD_WIDTH &&
            pos.y >= c.position.y &&
            pos.y <= c.position.y + CARD_HEIGHT
        )

        if (targetCard && targetCard.id !== creatingConnection.sourceId) {
          setPendingConnection({
            sourceId: creatingConnection.sourceId,
            targetId: targetCard.id,
            targetPosition: {
              x: targetCard.position.x + CARD_WIDTH / 2,
              y: targetCard.position.y,
            },
          })
        } else {
          cancelCreatingConnection()
        }
      }

      setIsDragging(false)
      setDragOffset({})
      setIsDraggingCardOnCanvas(false)
    },
    [creatingConnection.sourceId, wallCards, screenToCanvas, cancelCreatingConnection]
  )

  const handleCardContextMenu = useCallback(
    (e: React.MouseEvent, card: Card) => {
      e.preventDefault()
      e.stopPropagation()
      selectCard(card.id)
      setSelectedCardIds(new Set([card.id]))
      selectConnection(null)
      setContextMenu({
        type: 'card',
        x: e.clientX,
        y: e.clientY,
        data: card,
      })
    },
    [selectCard, selectConnection]
  )

  const handleConnectionContextMenu = useCallback(
    (e: React.MouseEvent, connection: Connection) => {
      e.preventDefault()
      e.stopPropagation()
      selectConnection(connection.id)
      selectCard(null)
      setSelectedCardIds(new Set())
      setContextMenu({
        type: 'connection',
        x: e.clientX,
        y: e.clientY,
        data: connection,
      })
    },
    [selectConnection, selectCard]
  )

  const handleStartConnection = useCallback(() => {
    if (contextMenu?.type === 'card') {
      startCreatingConnection(contextMenu.data.id)
    }
    setContextMenu(null)
  }, [contextMenu, startCreatingConnection])

  const handleEditCard = useCallback(() => {
    if (contextMenu?.type === 'card') {
      const card = contextMenu.data as Card
      const newTitle = window.prompt('编辑卡片标题:', card.title)
      if (newTitle !== null && newTitle.trim()) {
        updateCard(card.id, { title: newTitle.trim() })
      }
    }
    setContextMenu(null)
  }, [contextMenu, updateCard])

  const handleRemoveFromWall = useCallback(() => {
    if (contextMenu?.type === 'card') {
      const card = contextMenu.data as Card
      updateCard(card.id, { onWall: false, position: { x: 0, y: 0 } })
      connections
        .filter((c) => c.sourceId === card.id || c.targetId === card.id)
        .forEach((c) => deleteConnection(c.id))
    }
    setContextMenu(null)
  }, [contextMenu, updateCard, connections, deleteConnection])

  const handleDeleteCard = useCallback(() => {
    if (contextMenu?.type === 'card' && window.confirm('确定要删除这张卡片吗？')) {
      const card = contextMenu.data as Card
      connections
        .filter((c) => c.sourceId === card.id || c.targetId === card.id)
        .forEach((c) => deleteConnection(c.id))
      deleteCard(card.id)
    }
    setContextMenu(null)
  }, [contextMenu, connections, deleteConnection, deleteCard])

  const handleEditConnection = useCallback(() => {
    if (contextMenu?.type === 'connection') {
      const connection = contextMenu.data as Connection
      setEditingConnection(connection)
      const sourceCard = getCardById(connection.sourceId)
      if (sourceCard) {
        setPendingConnection({
          sourceId: connection.sourceId,
          targetId: connection.targetId,
          targetPosition: {
            x: sourceCard.position.x + CARD_WIDTH / 2,
            y: sourceCard.position.y,
          },
        })
      }
    }
    setContextMenu(null)
  }, [contextMenu, getCardById])

  const handleDeleteConnection = useCallback(() => {
    if (contextMenu?.type === 'connection' && window.confirm('确定要删除这条连接吗？')) {
      const connection = contextMenu.data as Connection
      deleteConnection(connection.id)
    }
    setContextMenu(null)
  }, [contextMenu, deleteConnection])

  const handleSaveConnection = useCallback(
    (data: { lineType: LineType; relationType: RelationType; reason: string }) => {
      if (pendingConnection) {
        if (editingConnection) {
          updateConnection(editingConnection.id, data)
          setEditingConnection(null)
        } else {
          addConnection({
            sourceId: pendingConnection.sourceId,
            targetId: pendingConnection.targetId,
            ...data,
          })
        }
      }
      setPendingConnection(null)
      cancelCreatingConnection()
    },
    [pendingConnection, editingConnection, addConnection, updateConnection, cancelCreatingConnection]
  )

  const handleCancelConnection = useCallback(() => {
    setPendingConnection(null)
    setEditingConnection(null)
    cancelCreatingConnection()
  }, [cancelCreatingConnection])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (isConnectionTarget(e.target)) return
      setContextMenu(null)
      setShowFilterPanel(false)
      if (!creatingConnection.sourceId) {
        setSelectedCardIds(new Set())
        selectCard(null)
        selectConnection(null)
      }
    },
    [creatingConnection.sourceId, selectCard, selectConnection]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelCreatingConnection()
        setPendingConnection(null)
        setEditingConnection(null)
        setContextMenu(null)
        setShowFilterPanel(false)
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        if (selectedCardIds.size > 0) {
          selectedCardIds.forEach((id) => {
            connections
              .filter((c) => c.sourceId === id || c.targetId === id)
              .forEach((c) => deleteConnection(c.id))
            deleteCard(id)
          })
          setSelectedCardIds(new Set())
        } else if (selectedConnectionId) {
          deleteConnection(selectedConnectionId)
        }
      }
    },
    [cancelCreatingConnection, selectedCardIds, selectedConnectionId, connections, deleteConnection, deleteCard]
  )

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleMouseMove, handleMouseUp, handleKeyDown])

  const getConnectionPreviewPath = useMemo(() => {
    if (!creatingConnection.sourceId || !creatingConnection.mousePos) return null
    const sourceCard = getCardById(creatingConnection.sourceId)
    if (!sourceCard) return null

    const x1 = sourceCard.position.x + CARD_WIDTH / 2
    const y1 = sourceCard.position.y + CARD_HEIGHT / 2
    const x2 = creatingConnection.mousePos.x
    const y2 = creatingConnection.mousePos.y

    return getBezierPath(x1, y1, x2, y2)
  }, [creatingConnection, getCardById])

  const toolbarPosition = useMemo(() => {
    if (!pendingConnection || !containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: rect.left + pan.x + pendingConnection.targetPosition.x * zoom,
      y: rect.top + pan.y + pendingConnection.targetPosition.y * zoom - 10,
    }
  }, [pendingConnection, pan, zoom])

  const toggleLineType = (t: LineType) => {
    setFilter((prev) => {
      const next = new Set(prev.lineTypes)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return { ...prev, lineTypes: next }
    })
  }
  const toggleRelationType = (t: RelationType) => {
    setFilter((prev) => {
      const next = new Set(prev.relationTypes)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return { ...prev, relationTypes: next }
    })
  }
  const resetFilter = () => {
    setFilter({
      lineTypes: new Set(),
      relationTypes: new Set(),
      chapterMin: null,
      chapterMax: null,
    })
  }
  const hasAnyFilter = filter.lineTypes.size > 0 || filter.relationTypes.size > 0 || filter.chapterMin !== null || filter.chapterMax !== null

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-[#1a1a1e]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/80 border-b border-red-900/30 flex-wrap">
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-400 w-12 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleFitToView}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="适应视图"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        <button
          onClick={() => setShowGrid(!showGrid)}
          className={cn(
            'p-2 rounded transition-colors',
            showGrid ? 'text-red-400 bg-red-950/50' : 'text-gray-400 hover:text-white hover:bg-gray-700'
          )}
          title="显示网格"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>

        <button
          onClick={handleAutoArrange}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="自动排列"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>

        <button
          onClick={handleClearConnections}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-950/50 rounded transition-colors"
          title="清除所有连接"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        <div className="relative">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded transition-colors',
              hasAnyFilter
                ? 'bg-[#8b0000]/20 text-red-300 border border-[#8b0000]/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-700 border border-transparent'
            )}
            title="筛选连接"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-sm">连接筛选</span>
            {hasAnyFilter && (
              <span className="ml-1 px-1.5 py-0.5 bg-[#8b0000] text-white text-xs rounded">
                {filter.lineTypes.size + filter.relationTypes.size + (filter.chapterMin ? 1 : 0) + (filter.chapterMax ? 1 : 0)}
              </span>
            )}
            <ChevronDown className={cn('w-4 h-4 transition-transform', showFilterPanel && 'rotate-180')} />
          </button>

          {showFilterPanel && (
            <div
              className="absolute top-full left-0 mt-2 w-80 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-200">
                  <Filter className="w-4 h-4 text-red-400" />
                  连接筛选器
                </div>
                {hasAnyFilter && (
                  <button
                    onClick={resetFilter}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                  >
                    重置
                  </button>
                )}
              </div>

              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">线条类型</div>
                <div className="flex flex-wrap gap-2">
                  {allLineTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleLineType(t)}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-lg border transition-all',
                        filter.lineTypes.has(t)
                          ? t === 'red'
                            ? 'bg-red-900/50 border-red-600 text-red-300'
                            : t === 'dashed'
                              ? 'bg-gray-700 border-gray-400 text-gray-200'
                              : 'bg-purple-900/50 border-purple-500 text-purple-300'
                          : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500'
                      )}
                    >
                      {lineTypeLabels[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">关系类型</div>
                <div className="grid grid-cols-2 gap-2">
                  {allRelationTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleRelationType(t)}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-lg border text-left transition-all',
                        filter.relationTypes.has(t)
                          ? 'bg-[#8b0000]/30 border-[#8b0000]/60 text-red-300'
                          : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-500'
                      )}
                    >
                      {relationTypeLabels[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">章节范围</div>
                <div className="flex items-center gap-2">
                  <select
                    value={filter.chapterMin ?? ''}
                    onChange={(e) => setFilter((p) => ({ ...p, chapterMin: e.target.value ? Number(e.target.value) : null }))}
                    className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#8b0000]"
                  >
                    <option value="">最早：不限</option>
                    {sortedChapters.map((ch) => (
                      <option key={ch.number} value={ch.number}>第{ch.number}章</option>
                    ))}
                  </select>
                  <span className="text-gray-500 text-sm">—</span>
                  <select
                    value={filter.chapterMax ?? ''}
                    onChange={(e) => setFilter((p) => ({ ...p, chapterMax: e.target.value ? Number(e.target.value) : null }))}
                    className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-[#8b0000]"
                  >
                    <option value="">最晚：不限</option>
                    {sortedChapters.map((ch) => (
                      <option key={ch.number} value={ch.number}>第{ch.number}章</option>
                    ))}
                  </select>
                </div>
              </div>

              {hasAnyFilter && (
                <div className="mt-4 pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-400 flex items-center justify-between">
                    <span>匹配 {matchedConnectionIds.size} 条连接 / {relatedCardIds.size} 张卡片</span>
                    <span className="text-red-400">未匹配内容已淡化</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="text-xs text-gray-500">
          卡片: <span className="text-gray-300">{wallCards.length}</span> |
          连接: <span className="text-gray-300">{connections.length}</span>
        </div>
      </div>

      <div className="flex-1 relative" onClick={handleCanvasClick}>
        <Canvas
          zoom={zoom}
          pan={pan}
          onZoomChange={setZoom}
          onPanChange={setPan}
          showGrid={showGrid}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="absolute" style={{ width: '3000px', height: '3000px' }}>
            <svg
              className="absolute inset-0"
              style={{ width: '3000px', height: '3000px', zIndex: 3, pointerEvents: 'none' }}
            >
              {connections.map((conn) => {
                const sourceCard = getCardById(conn.sourceId)
                const targetCard = getCardById(conn.targetId)
                if (!sourceCard || !targetCard) return null
                const matched = !filterActive || matchedConnectionIds.has(conn.id)
                const opacity = matched ? 1 : 0.08
                return (
                  <g key={conn.id} style={{ opacity }}>
                    <ConnectionLine
                      connection={conn}
                      sourceCard={sourceCard}
                      targetCard={targetCard}
                      isSelected={selectedConnectionId === conn.id}
                      onSelect={() => {
                        selectConnection(conn.id)
                        selectCard(null)
                        setSelectedCardIds(new Set())
                      }}
                      onContextMenu={handleConnectionContextMenu}
                      containerRef={containerRef}
                      pan={pan}
                      zoom={zoom}
                    />
                  </g>
                )
              })}

              {getConnectionPreviewPath && (
                <path
                  d={getConnectionPreviewPath}
                  fill="none"
                  stroke="#8b0000"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  style={{
                    filter: 'drop-shadow(0 0 4px #8b0000)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </svg>

            <div className="absolute" style={{ width: '3000px', height: '3000px', zIndex: 2 }}>
              {wallCards.map((card) => {
                const related = !filterActive || relatedCardIds.has(card.id)
                const opacity = related ? 1 : 0.12
                const grayscale = related ? 'none' : 'grayscale(80%)'
                return (
                  <div
                    key={card.id}
                    className="absolute transition-opacity duration-200"
                    style={{
                      left: card.position.x,
                      top: card.position.y,
                      opacity,
                      filter: grayscale,
                      zIndex:
                        selectedCardIds.has(card.id) || creatingConnection.sourceId === card.id
                          ? 10
                          : 1,
                    }}
                    onMouseDown={(e) => handleCardMouseDown(e, card)}
                    onContextMenu={(e) => handleCardContextMenu(e, card)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', card.id)
                    }}
                  >
                    <ClueCard
                      card={card}
                      isSelected={selectedCardIds.has(card.id) || selectedCardId === card.id}
                      isDragging={isDraggingCardOnCanvas && selectedCardIds.has(card.id)}
                      onSelect={() => {}}
                    />
                    {creatingConnection.sourceId === card.id && (
                      <div className="absolute inset-0 rounded-lg ring-2 ring-red-500 ring-offset-2 ring-offset-[#1a1a1e] animate-pulse pointer-events-none" />
                    )}
                    {isDraggingCardOnCanvas && selectedCardIds.has(card.id) && (
                      <div
                        className="absolute inset-0 rounded-lg pointer-events-none"
                        style={{
                          boxShadow: '0 0 20px rgba(139, 0, 0, 0.5)',
                          opacity: 0.8,
                        }}
                      />
                    )}
                    {filterActive && related && (
                      <div className="absolute -inset-0.5 rounded-lg border border-red-500/60 pointer-events-none" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </Canvas>
      </div>

      {pendingConnection && (
        <ConnectionToolbar
          position={toolbarPosition}
          onSave={handleSaveConnection}
          onCancel={handleCancelConnection}
          initialLineType={editingConnection?.lineType}
          initialRelationType={editingConnection?.relationType}
          initialReason={editingConnection?.reason}
          mode={editingConnection ? 'edit' : 'create'}
        />
      )}

      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl py-1 min-w-48"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'card' ? (
            <>
              <button
                onClick={handleStartConnection}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 flex items-center gap-2"
              >
                <Link className="w-4 h-4" />
                开始连接
              </button>
              <button
                onClick={handleEditCard}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                编辑卡片
              </button>
              <div className="border-t border-gray-700 my-1" />
              <button
                onClick={handleRemoveFromWall}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                从墙上移除
              </button>
              <button
                onClick={handleDeleteCard}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-950/50 flex items-center gap-2"
              >
                <Trash className="w-4 h-4" />
                删除卡片
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEditConnection}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                编辑连接
              </button>
              <button
                onClick={handleDeleteConnection}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-950/50 flex items-center gap-2"
              >
                <Trash className="w-4 h-4" />
                删除连接
              </button>
            </>
          )}
        </div>
      )}

      {creatingConnection.sourceId && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-900/90 text-white text-sm rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
          拖拽到另一张卡片创建连接，按 ESC 取消
        </div>
      )}
    </div>
  )
}
