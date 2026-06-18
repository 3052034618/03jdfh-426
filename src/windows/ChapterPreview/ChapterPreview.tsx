import { useState, useMemo, useRef, useEffect } from 'react'
import { Timeline } from './Timeline'
import { InspectionReport } from './InspectionReport'
import { ClueCard } from '../../components/Card'
import { ConnectionLine } from '../../components/Connection'
import { WindowFrame } from '../../components/WindowFrame'
import { useCardStore } from '../../store/useCardStore'
import { useConnectionStore } from '../../store/useConnectionStore'
import { useChapterStore } from '../../store/useChapterStore'
import type { Card } from '../../types'

interface VisibleCard extends Card {
  opacity: number
  visible: boolean
}

interface ChapterPreviewProps {
  onClose?: () => void
  onMinimize?: () => void
  onMaximize?: () => void
}

export function ChapterPreview({ onClose, onMinimize, onMaximize }: ChapterPreviewProps) {
  const { cards, selectCard, selectedCardId } = useCardStore()
  const { connections } = useConnectionStore()
  const { chapters, currentChapter, setCurrentChapter, addChapter, updateChapter } = useChapterStore()
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.number - b.number),
    [chapters]
  )

  const visibleCards = useMemo((): VisibleCard[] => {
    return cards.map((card) => {
      if (currentChapter === null) {
        return { ...card, opacity: 1, visible: true }
      }

      let opacity = 1
      let visible = true

      if (card.chapter < currentChapter) {
        opacity = 0.3
      } else if (card.chapter > currentChapter) {
        opacity = 0.1
        visible = false
      }

      return {
        ...card,
        opacity,
        visible,
      }
    })
  }, [cards, currentChapter])

  const visibleConnections = useMemo(() => {
    if (currentChapter === null) return connections

    const visibleCardIds = new Set(visibleCards.filter((c) => c.visible || c.opacity > 0.1).map((c) => c.id))

    return connections.filter(
      (conn) => visibleCardIds.has(conn.sourceId) && visibleCardIds.has(conn.targetId)
    )
  }, [connections, visibleCards, currentChapter])

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

  const getCardOpacity = (card: Card) => {
    if (currentChapter === null) return 1
    if (card.chapter === currentChapter) return 1
    if (card.chapter < currentChapter) return 0.3
    return 0.1
  }

  const getCardFilter = (card: Card) => {
    if (currentChapter === null) return 'none'
    if (card.chapter > currentChapter) return 'grayscale(100%)'
    return 'none'
  }

  useEffect(() => {
    if (currentChapter === null && sortedChapters.length > 0) {
      setCurrentChapter(sortedChapters[0].number)
    }
  }, [currentChapter, sortedChapters, setCurrentChapter])

  const canvasContent = (
    <div className="flex flex-col h-full overflow-hidden">
      <Timeline
        chapters={chapters}
        currentChapter={currentChapter}
        cards={cards}
        onSelectChapter={setCurrentChapter}
        onAddChapter={handleAddChapter}
        onUpdateChapterName={handleUpdateChapterName}
      />

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

              return (
                <g key={connection.id} style={{ opacity: Math.min(getCardOpacity(sourceCard), getCardOpacity(targetCard)) }}>
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

          {visibleCards.map((card) => (
            <div
              key={card.id}
              className="absolute transition-all duration-300"
              style={{
                left: card.position.x,
                top: card.position.y,
                opacity: getCardOpacity(card),
                filter: getCardFilter(card),
                zIndex: highlightedCardId === card.id ? 10 : card.chapter === currentChapter ? 5 : 2,
              }}
            >
              <div
                className={`
                  transition-all duration-300
                  ${highlightedCardId === card.id
                    ? 'animate-pulse scale-110'
                    : ''
                  }
                `}
              >
                <ClueCard
                  card={card}
                  isSelected={selectedCardId === card.id}
                  isDragging={false}
                  onSelect={handleCardSelect}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <InspectionReport
        cards={cards}
        connections={connections}
        currentChapter={currentChapter}
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
