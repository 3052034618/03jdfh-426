import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Timeline } from './Timeline'
import { InspectionReport } from './InspectionReport'
import { ClueCard } from '../../components/Card'
import { ConnectionLine } from '../../components/Connection'
import { WindowFrame } from '../../components/WindowFrame'
import { useCardStore } from '../../store/useCardStore'
import { useConnectionStore } from '../../store/useConnectionStore'
import { useChapterStore } from '../../store/useChapterStore'
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Clock, GripHorizontal } from 'lucide-react'
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

interface TimelineSegment {
  chapterNumber: number
  cardsInChapter: Card[]
  stepsInChapter: number
  startStep: number
}

const STEP_MS = 3000

export function ChapterPreview({ onClose, onMinimize, onMaximize }: ChapterPreviewProps) {
  const { cards, selectCard, selectedCardId } = useCardStore()
  const { connections } = useConnectionStore()
  const { chapters, currentChapter, setCurrentChapter, addChapter, updateChapter } = useChapterStore()
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [globalStep, setGlobalStep] = useState(0)
  const [elapsedPct, setElapsedPct] = useState(0)
  const lastTickRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)
  const [userNavigated, setUserNavigated] = useState(false)

  const scrubberRef = useRef<HTMLDivElement>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.number - b.number),
    [chapters]
  )

  useEffect(() => {
    if (currentChapter === null && sortedChapters.length > 0) {
      setCurrentChapter(sortedChapters[0].number)
    }
  }, [currentChapter, sortedChapters, setCurrentChapter])

  const globalTimeline = useMemo((): TimelineSegment[] => {
    const timeline: TimelineSegment[] = []
    let cumulative = 0
    for (const ch of sortedChapters) {
      const chCards = cards.filter((c) => c.chapter === ch.number)
      const steps = Math.max(1, chCards.length + 1)
      timeline.push({
        chapterNumber: ch.number,
        cardsInChapter: chCards,
        stepsInChapter: steps,
        startStep: cumulative,
      })
      cumulative += steps
    }
    return timeline
  }, [sortedChapters, cards])

  const totalGlobalSteps = useMemo(() => {
    if (globalTimeline.length === 0) return 0
    const last = globalTimeline[globalTimeline.length - 1]
    return last.startStep + last.stepsInChapter
  }, [globalTimeline])

  const currentSegment = useMemo((): TimelineSegment | null => {
    if (globalTimeline.length === 0) return null
    for (const seg of globalTimeline) {
      if (globalStep >= seg.startStep && globalStep < seg.startStep + seg.stepsInChapter) {
        return seg
      }
    }
    return globalTimeline[globalTimeline.length - 1]
  }, [globalTimeline, globalStep])

  const displayChapter = useMemo(() => {
    if (isPlaying && currentSegment) {
      return currentSegment.chapterNumber
    }
    return currentChapter
  }, [isPlaying, currentSegment, currentChapter])

  const playbackStep = useMemo(() => {
    if (isPlaying && currentSegment) {
      return globalStep - currentSegment.startStep
    }
    return 0
  }, [isPlaying, currentSegment, globalStep])

  useEffect(() => {
    if (isPlaying && currentSegment) {
      const chNum = currentSegment.chapterNumber
      if (currentChapter !== chNum) {
        setCurrentChapter(chNum)
      }
    }
  }, [isPlaying, currentSegment, currentChapter, setCurrentChapter])

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

  const revealedCards = useMemo((): Card[] => {
    if (displayChapter === null) return cards
    if (!isPlaying) {
      return cards.filter((c) => c.chapter <= displayChapter)
    }
    return cards.filter((card) => {
      if (card.chapter < displayChapter) return true
      if (card.chapter > displayChapter) return false
      const idx = newChapterCards.findIndex((c) => c.id === card.id)
      if (idx < 0) return true
      const appearsAtStep = idx + 1
      return playbackStep >= appearsAtStep
    })
  }, [cards, displayChapter, isPlaying, newChapterCards, playbackStep])

  const revealedConnections = useMemo(() => {
    const revealedIds = new Set(revealedCards.map((c) => c.id))
    return connections.filter(
      (conn) => revealedIds.has(conn.sourceId) && revealedIds.has(conn.targetId)
    )
  }, [revealedCards, connections])

  const tickLoop = useCallback(() => {
    if (!isPlaying || totalGlobalSteps === 0) return
    const now = performance.now()
    const dt = now - lastTickRef.current
    lastTickRef.current = now

    const seg = globalTimeline.find((s) => globalStep >= s.startStep && globalStep < s.startStep + s.stepsInChapter)
    if (!seg) {
      setIsPlaying(false)
      return
    }

    const stepMs = STEP_MS / seg.stepsInChapter

    setElapsedPct((prev) => {
      const next = prev + (dt / stepMs)
      if (next >= 1) {
        const nextGlobalStep = globalStep + 1
        if (nextGlobalStep >= totalGlobalSteps) {
          setGlobalStep(totalGlobalSteps - 1)
          setElapsedPct(0)
          setIsPlaying(false)
          return 0
        }
        setGlobalStep(nextGlobalStep)
        return 0
      }
      return next
    })
    rafRef.current = requestAnimationFrame(tickLoop)
  }, [isPlaying, globalStep, totalGlobalSteps, globalTimeline])

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

  const handlePlayPause = useCallback(() => {
    if (sortedChapters.length === 0) return

    if (isPlaying) {
      setIsPlaying(false)
      setUserNavigated(false)
      return
    }

    if (userNavigated) {
      setUserNavigated(false)
      const seg = globalTimeline.find((s) => s.chapterNumber === displayChapter)
      if (seg) {
        setGlobalStep(seg.startStep)
        setElapsedPct(0)
      }
    } else {
      setGlobalStep(0)
      setElapsedPct(0)
    }

    setIsPlaying(true)
  }, [isPlaying, sortedChapters, userNavigated, globalTimeline, displayChapter])

  const handlePrevChapter = useCallback(() => {
    if (sortedChapters.length === 0 || displayChapter === null) return
    const idx = sortedChapters.findIndex((c) => c.number === displayChapter)
    if (idx > 0) {
      const prevCh = sortedChapters[idx - 1]
      setCurrentChapter(prevCh.number)
      setUserNavigated(true)
      setIsPlaying(false)
      const seg = globalTimeline.find((s) => s.chapterNumber === prevCh.number)
      if (seg) {
        setGlobalStep(seg.startStep)
        setElapsedPct(0)
      }
    }
  }, [sortedChapters, displayChapter, setCurrentChapter, globalTimeline])

  const handleNextChapter = useCallback(() => {
    if (sortedChapters.length === 0 || displayChapter === null) return
    const idx = sortedChapters.findIndex((c) => c.number === displayChapter)
    if (idx < sortedChapters.length - 1) {
      const nextCh = sortedChapters[idx + 1]
      setCurrentChapter(nextCh.number)
      setUserNavigated(true)
      setIsPlaying(false)
      const seg = globalTimeline.find((s) => s.chapterNumber === nextCh.number)
      if (seg) {
        setGlobalStep(seg.startStep)
        setElapsedPct(0)
      }
    }
  }, [sortedChapters, displayChapter, setCurrentChapter, globalTimeline])

  const handleResetPlayback = useCallback(() => {
    setIsPlaying(false)
    setGlobalStep(0)
    setElapsedPct(0)
    setUserNavigated(false)
    if (sortedChapters.length > 0) {
      setCurrentChapter(sortedChapters[0].number)
    }
  }, [sortedChapters, setCurrentChapter])

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

  const globalPct = totalGlobalSteps > 0
    ? Math.min(1, (globalStep + elapsedPct) / totalGlobalSteps)
    : 0

  const scrubToPosition = useCallback((clientX: number) => {
    if (!scrubberRef.current || totalGlobalSteps === 0) return
    const rect = scrubberRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const step = Math.min(Math.floor(pct * totalGlobalSteps), totalGlobalSteps - 1)
    setGlobalStep(step)
    setElapsedPct(0)
    setIsPlaying(false)

    const seg = globalTimeline.find((s) => step >= s.startStep && step < s.startStep + s.stepsInChapter)
    if (seg) {
      setCurrentChapter(seg.chapterNumber)
    }
  }, [totalGlobalSteps, globalTimeline, setCurrentChapter])

  const handleScrubberMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsScrubbing(true)
    scrubToPosition(e.clientX)
  }, [scrubToPosition])

  useEffect(() => {
    if (!isScrubbing) return

    const onMove = (e: MouseEvent) => {
      scrubToPosition(e.clientX)
    }
    const onUp = () => {
      setIsScrubbing(false)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isScrubbing, scrubToPosition])

  const currentChapterName = displayChapter !== null
    ? sortedChapters.find((c) => c.number === displayChapter)?.name || `第${displayChapter}章`
    : '全部章节'

  const currentStepLabel = useMemo(() => {
    if (!currentSegment || !isPlaying) return ''
    const localStep = globalStep - currentSegment.startStep
    const total = currentSegment.cardsInChapter.length
    return `${Math.min(localStep, total)}/${total}`
  }, [currentSegment, isPlaying, globalStep])

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
            setUserNavigated(true)
            setIsPlaying(false)
            const seg = globalTimeline.find((s) => s.chapterNumber === n)
            if (seg) {
              setGlobalStep(seg.startStep)
              setElapsedPct(0)
            }
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
              disabled={sortedChapters.length === 0}
              className={cn(
                'p-1.5 rounded transition-all',
                sortedChapters.length > 0
                  ? isPlaying
                    ? 'bg-[#8b0000] text-white'
                    : 'text-gray-200 hover:bg-gray-700 hover:text-white'
                  : 'text-gray-600 cursor-not-allowed'
              )}
              title={isPlaying ? '暂停播放' : (userNavigated ? '从当前章节播放' : '全剧播放')}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={handleResetPlayback}
              className="p-1.5 text-gray-300 hover:bg-gray-700 hover:text-white rounded transition-all"
              title="重置到开头"
            >
              <RotateCcw className="w-3.5 h-3.5" />
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

          <div className="text-xs text-gray-400 font-mono tabular-nums min-w-[100px] text-right">
            {isPlaying && currentStepLabel
              ? `新卡片 ${currentStepLabel}`
              : displayChapter !== null
                ? `${revealedCards.filter((c) => c.chapter <= displayChapter).length} 张`
                : '—'
            }
          </div>
        </div>

        <div className="px-4 pb-2.5 bg-gray-900/60 border-t border-gray-800/50">
          <div
            ref={scrubberRef}
            className="relative h-6 flex items-center cursor-pointer group"
            onMouseDown={handleScrubberMouseDown}
          >
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-gray-800 rounded-full border border-gray-700">
              {globalTimeline.map((seg) => {
                const startPct = (seg.startStep / totalGlobalSteps) * 100
                const widthPct = (seg.stepsInChapter / totalGlobalSteps) * 100
                return (
                  <div
                    key={seg.chapterNumber}
                    className="absolute top-0 bottom-0 bg-gray-700/40 border-l border-gray-600/50"
                    style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                  />
                )
              })}
              <div
                className="h-full bg-gradient-to-r from-[#8b0000] to-[#dc2626] rounded-full transition-[width] duration-75 ease-linear"
                style={{ width: `${globalPct * 100}%` }}
              />
            </div>

            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg border-2 border-[#8b0000] transition-[left] duration-75 ease-linear group-hover:scale-125"
              style={{ left: `${globalPct * 100}%` }}
            >
              <GripHorizontal className="w-2.5 h-2.5 text-[#8b0000] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>

            {globalTimeline.map((seg) => {
              const pct = ((seg.startStep + seg.stepsInChapter / 2) / totalGlobalSteps) * 100
              return (
                <div
                  key={`label-${seg.chapterNumber}`}
                  className="absolute -bottom-0.5 -translate-x-1/2 text-[9px] text-gray-500 font-mono"
                  style={{ left: `${pct}%` }}
                >
                  {seg.chapterNumber}
                </div>
              )
            })}
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
        cards={revealedCards}
        connections={revealedConnections}
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
