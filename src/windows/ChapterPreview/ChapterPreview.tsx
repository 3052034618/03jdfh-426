import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Timeline } from './Timeline'
import { InspectionReport } from './InspectionReport'
import { ClueCard } from '../../components/Card'
import { ConnectionLine } from '../../components/Connection'
import { WindowFrame } from '../../components/WindowFrame'
import { useCardStore } from '../../store/useCardStore'
import { useConnectionStore } from '../../store/useConnectionStore'
import { useChapterStore } from '../../store/useChapterStore'
import { Play, Pause, SkipBack, SkipForward, ChevronRight, Clock } from 'lucide-react'
import type { Card } from '../../types'
import { cn } from '../../lib/utils'

interface VisibleCard extends Card {
  opacity: number
  visible: boolean
  appearPhase: number
}

interface ChapterPreviewProps {
  onClose?: () => void
  onMinimize?: () => void
  onMaximize?: () => void
}

const STEP_MS = 3000

export function ChapterPreview({ onClose, onMinimize, onMaximize }: ChapterPreviewProps) {
  const { cards, selectCard, selectedCardId } = useCardStore()
  const { connections } = useConnectionStore()
  const { chapters, currentChapter, setCurrentChapter, addChapter, updateChapter } = useChapterStore()
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const playbackTimerRef = useRef<number | null>(null)
  const [playbackStep, setPlaybackStep] = useState(0)
  const [elapsedPct, setElapsedPct] = useState(0)
  const lastTickRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.number - b.number),
    [chapters]
  )

  useEffect(() => {
    if (currentChapter === null && sortedChapters.length > 0) {
      setCurrentChapter(sortedChapters[0].number)
    }
  }, [currentChapter, sortedChapters, setCurrentChapter])

  const displayChapter = useMemo(() => {
    if (currentChapter === null) return null
    return currentChapter
  }, [currentChapter])

  const visibleCards = useMemo((): VisibleCard[] => {
    return cards
      .filter((card) => {
        if (displayChapter === null) return true
        return card.chapter <= displayChapter
      })
      .map((card) => {
        let opacity = 1
        let visible = true
        let appearPhase = 0

        if (displayChapter !== null) {
          if (card.chapter === displayChapter) {
            appearPhase = isPlaying ? playbackStep : 2
          } else if (card.chapter < displayChapter) {
            opacity = 0.35
            appearPhase = 2
          }
        } else {
          appearPhase = 2
        }

        return {
          ...card,
          opacity,
          visible,
          appearPhase,
        }
      })
  }, [cards, displayChapter, isPlaying, playbackStep])

  const visibleConnections = useMemo(() => {
    if (displayChapter === null) return connections

    const visibleCardIds = new Set(visibleCards.map((c) => c.id))

    return connections.filter(
      (conn) => visibleCardIds.has(conn.sourceId) && visibleCardIds.has(conn.targetId)
    )
  }, [connections, visibleCards, displayChapter])

  const newChapterCards = useMemo(() => {
    if (displayChapter === null) return []
    return visibleCards.filter((c) => c.chapter === displayChapter)
  }, [visibleCards, displayChapter])

  const tickLoop = useCallback(() => {
    if (!isPlaying) return
    const now = performance.now()
    const dt = now - lastTickRef.current
    lastTickRef.current = now
    const totalSteps = Math.max(1, newChapterCards.length + 1)
    const stepMs = STEP_MS / totalSteps

    setElapsedPct((prev) => {
      const next = prev + (dt / stepMs)
      if (next >= 1) {
        setPlaybackStep((p) => {
          const nextStep = p + 1
          if (nextStep >= totalSteps) {
            setIsPlaying(false)
            return p
          }
          return nextStep
        })
        return 0
      }
      return next
    })
    rafRef.current = requestAnimationFrame(tickLoop)
  }, [isPlaying, newChapterCards])

  useEffect(() => {
    if (isPlaying) {
      lastTickRef.current = performance.now()
      rafRef.current = requestAnimationFrame(tickLoop)
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isPlaying, tickLoop])

  const handlePlayPause = () => {
    if (!displayChapter || sortedChapters.length === 0) return
    const totalSteps = Math.max(1, newChapterCards.length + 1)
    if (!isPlaying && playbackStep >= totalSteps) {
      setPlaybackStep(0)
      setElapsedPct(0)
    }
    setIsPlaying((p) => !p)
  }

  const handlePrevChapter = () => {
    if (sortedChapters.length === 0 || displayChapter === null) return
    const idx = sortedChapters.findIndex((c) => c.number === displayChapter)
    if (idx > 0) {
      setPlaybackStep(0)
      setElapsedPct(0)
      setIsPlaying(false)
      setCurrentChapter(sortedChapters[idx - 1].number)
    }
  }

  const handleNextChapter = () => {
    if (sortedChapters.length === 0 || displayChapter === null) return
    const idx = sortedChapters.findIndex((c) => c.number === displayChapter)
    if (idx < sortedChapters.length - 1) {
      setPlaybackStep(0)
      setElapsedPct(0)
      setIsPlaying(false)
      setCurrentChapter(sortedChapters[idx + 1].number)
    }
  }

  const handleResetChapterPlayback = () => {
    setPlaybackStep(0)
    setElapsedPct(0)
    setIsPlaying(false)
  }

  useEffect(() => {
    setPlaybackStep(0)
    setElapsedPct(0)
  }, [displayChapter])

  const handleAddChapter = () => {
    const nextNumber = sortedChapters.length > 0 ? sortedChapters[sortedChapters.length - 1].number + 1 : 1
    addChapter({
      number: nextNumber,
      name: `第${nextNumber}章`,
      description: '',
    })
    setCurrentChapter(nextNumber)
  }

  const handleUpdateChapterName = (chapterNumber: number, name: string) => {
    updateChapter(chapterNumber, { name })
  }

  const handleHighlightCard = (cardId: string) => {
    setHighlightedCardId(cardId)
    selectCard(cardId)

    const card = cards.find((c) => c.id === cardId)
    if (card && canvasRef.current) {
      const canvas = canvasRef.current
      const cardWidth = 192
      const cardHeight = 120

      const targetX = card.position.x - canvas.clientWidth / 2 + cardWidth / 2
      const targetY = card.position.y - canvas.clientHeight / 2 + cardHeight / 2

      canvas.scrollTo({
        left: Math.max(0, targetX),
        top: Math.max(0, targetY),
        behavior: 'smooth',
      })
    }

    setTimeout(() => {
      setHighlightedCardId(null)
    }, 3000)
  }

  const handleCardSelect = (card: Card) => {
    selectCard(card.id)
  }

  const getCardOpacity = (card: Card, appearPhase: number) => {
    if (displayChapter === null) return 1
    if (card.chapter === displayChapter) {
      if (!isPlaying) return 1
      const cardsByOrder = newChapterCards.map((c) => c.id).indexOf(card.id)
      if (cardsByOrder < 0) return 1
      const appearsAtStep = cardsByOrder + 1
      if (appearPhase < appearsAtStep) return 0
      return 1
    }
    if (card.chapter < displayChapter) return 0.35
    return 0
  }

  const getCardFilter = (card: Card, appearPhase: number) => {
    if (displayChapter === null) return 'none'
    if (card.chapter === displayChapter && isPlaying && appearPhase < newChapterCards.length + 1) {
      const cardsByOrder = newChapterCards.map((c) => c.id).indexOf(card.id)
      const appearsAtStep = cardsByOrder + 1
      if (appearPhase === appearsAtStep) {
        return 'none'
      }
      if (appearPhase < appearsAtStep) return 'opacity(0) blur(8px)'
    }
    if (card.chapter < displayChapter) return 'grayscale(70%)'
    return 'none'
  }

  const getCardScale = (card: Card, appearPhase: number) => {
    if (displayChapter !== null && card.chapter === displayChapter && isPlaying) {
      const cardsByOrder = newChapterCards.map((c) => c.id).indexOf(card.id)
      const appearsAtStep = cardsByOrder + 1
      if (appearPhase === appearsAtStep) {
        const t = elapsedPct
        return 0.92 + 0.08 * Math.min(1, t)
      }
    }
    return 1
  }

  const currentChapterName = displayChapter !== null
    ? sortedChapters.find((c) => c.number === displayChapter)?.name || `第${displayChapter}章`
    : '全部章节'
  const totalSteps = Math.max(1, newChapterCards.length + 1)
  const overallPct = displayChapter === null || !isPlaying
    ? playbackStep >= totalSteps ? 1 : 0
    : Math.min(1, (playbackStep + elapsedPct) / totalSteps)
  const canPrev = displayChapter !== null && sortedChapters.findIndex((c) => c.number === displayChapter) > 0
  const canNext = displayChapter !== null && sortedChapters.findIndex((c) => c.number === displayChapter) < sortedChapters.length - 1

  const canvasContent = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-gray-900 border-b border-gray-800">
        <Timeline
          chapters={chapters}
          currentChapter={displayChapter}
          cards={cards}
          onSelectChapter={(n) => {
            setCurrentChapter(n)
            handleResetChapterPlayback()
          }}
          onAddChapter={handleAddChapter}
          onUpdateChapterName={handleUpdateChapterName}
        />

        <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900/60 border-t border-gray-800">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8b0000]/15 border border-[#8b0000]/40 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-medium text-red-300 font-mono tracking-wide">{currentChapterName}</span>
          </div>

          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
            <button
              onClick={handlePrevChapter}
              disabled={!canPrev}
              className={cn(
                'p-1.5 rounded transition-all',
                canPrev ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 cursor-not-allowed'
              )}
              title="上一章"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={handlePlayPause}
              disabled={displayChapter === null || sortedChapters.length === 0}
              className={cn(
                'p-1.5 rounded transition-all',
                displayChapter !== null
                  ? isPlaying
                    ? 'bg-[#8b0000] text-white'
                    : 'text-gray-200 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-600 cursor-not-allowed'
              )}
              title={isPlaying ? '暂停播放' : '开始播放'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={handleResetChapterPlayback}
              className="p-1.5 text-gray-300 hover:bg-gray-700 hover:text-white rounded transition-all"
              title="重置本章"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <button
              onClick={handleNextChapter}
              disabled={!canNext}
              className={cn(
                'p-1.5 rounded transition-all',
                canNext ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 cursor-not-allowed'
              )}
              title="下一章"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div
              className="h-full bg-gradient-to-r from-[#8b0000] to-[#dc2626] transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${overallPct * 100}%` }}
            />
          </div>

          <div className="text-xs text-gray-400 font-mono tabular-nums min-w-[140px] text-right">
            {displayChapter !== null
              ? `新卡片 ${Math.min(playbackStep, newChapterCards.length)}/${newChapterCards.length}`
              : '—'
            }
          </div>
        </div>
      </div>

      <div
        ref={canvasRef}
        className="flex-1 overflow-auto bg-gray-950"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(75, 85, 99, 0.15) 1px,
            transparent 0
          `,
          backgroundSize: '24px 24px',
        }}
      >
        <div className="relative" style={{ minWidth: '2000px', minHeight: '2000px' }}>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            {visibleConnections.map((connection) => {
              const sourceCard = cards.find((c) => c.id === connection.sourceId)
              const targetCard = cards.find((c) => c.id === connection.targetId)
              if (!sourceCard || !targetCard) return null

              const srcVisible = visibleCards.find((c) => c.id === sourceCard.id)
              const tgtVisible = visibleCards.find((c) => c.id === targetCard.id)
              const srcOpacity = srcVisible ? getCardOpacity(sourceCard, srcVisible.appearPhase) : 0
              const tgtOpacity = tgtVisible ? getCardOpacity(targetCard, tgtVisible.appearPhase) : 0

              return (
                <g
                  key={connection.id}
                  style={{
                    opacity: Math.min(srcOpacity, tgtOpacity),
                    transition: 'opacity 0.5s ease',
                  }}
                >
                  <ConnectionLine
                    connection={connection}
                    sourceCard={sourceCard}
                    targetCard={targetCard}
                    isSelected={false}
                    isHovered={false}
                  />
                </g>
              )
            })}
          </svg>

          {visibleCards.map((card) => {
            const opacity = getCardOpacity(card, card.appearPhase)
            const filter = getCardFilter(card, card.appearPhase)
            const scale = getCardScale(card, card.appearPhase)

            return (
              <div
                key={card.id}
                className="absolute"
                style={{
                  left: card.position.x,
                  top: card.position.y,
                  opacity,
                  filter,
                  transform: `scale(${scale})`,
                  transformOrigin: 'center',
                  zIndex: highlightedCardId === card.id ? 10 : card.chapter === displayChapter ? 5 : 2,
                  transition: isPlaying && displayChapter !== null && card.chapter === displayChapter
                    ? 'opacity 0.5s ease, filter 0.5s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    : 'opacity 0.3s ease, filter 0.3s ease',
                }}
              >
                <div
                  className={cn(
                    'transition-all',
                    highlightedCardId === card.id && 'animate-pulse scale-110'
                  )}
                >
                  <ClueCard
                    card={card}
                    isSelected={selectedCardId === card.id}
                    isDragging={false}
                    onSelect={handleCardSelect}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <InspectionReport
        cards={cards}
        connections={connections}
        currentChapter={displayChapter}
        onHighlightCard={handleHighlightCard}
      />
    </div>
  )

  return (
    <WindowFrame
      title="章节预览"
      onClose={onClose}
      onMinimize={onMinimize}
      onMaximize={onMaximize}
    >
      {canvasContent}
    </WindowFrame>
  )
}
