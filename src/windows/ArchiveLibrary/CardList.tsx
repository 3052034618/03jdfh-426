import { useMemo } from 'react'
import { ClueCard } from '../../components/Card'
import type { Card, CardFilter } from '../../types'

interface CardListProps {
  cards: Card[]
  onCardClick: (card: Card) => void
  filter: CardFilter
}

type SortField = 'chapter' | 'type' | 'title'

function filterCards(cards: Card[], filter: CardFilter): Card[] {
  return cards.filter((card) => {
    if (filter.type !== null && card.type !== filter.type) {
      return false
    }

    if (filter.chapter !== null && card.chapter !== filter.chapter) {
      return false
    }

    if (filter.search.trim() !== '') {
      const searchLower = filter.search.toLowerCase()
      const searchMatch =
        card.title.toLowerCase().includes(searchLower) ||
        card.content.toLowerCase().includes(searchLower) ||
        card.keywords.some((keyword) => keyword.toLowerCase().includes(searchLower))
      if (!searchMatch) {
        return false
      }
    }

    return true
  })
}

function sortCards(cards: Card[], sortField: SortField): Card[] {
  return [...cards].sort((a, b) => {
    switch (sortField) {
      case 'chapter':
        return a.chapter - b.chapter
      case 'type':
        return a.type.localeCompare(b.type)
      case 'title':
        return a.title.localeCompare(b.title)
      default:
        return 0
    }
  })
}

function handleDragStart(e: React.DragEvent, card: Card) {
  e.dataTransfer.setData('application/json', JSON.stringify(card))
  e.dataTransfer.effectAllowed = 'copy'
}

export function CardList({ cards, onCardClick, filter }: CardListProps) {
  const sortField: SortField = 'chapter'

  const filteredAndSortedCards = useMemo(() => {
    const filtered = filterCards(cards, filter)
    return sortCards(filtered, sortField)
  }, [cards, filter])

  if (filteredAndSortedCards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium mb-2">没有找到匹配的卡片</p>
          <p className="text-sm">请尝试调整筛选条件或搜索关键词</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredAndSortedCards.map((card) => (
          <ClueCard
            key={card.id}
            card={card}
            onSelect={onCardClick}
            onDragStart={handleDragStart}
          />
        ))}
      </div>
    </div>
  )
}
