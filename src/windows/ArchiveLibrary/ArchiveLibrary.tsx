import { useState, useMemo } from 'react'
import { Search, Plus, Filter, ChevronDown, Mic, Camera, FileText, UserX, X } from 'lucide-react'
import { useCardStore } from '../../store/useCardStore'
import { CardList } from './CardList'
import { CardEditor } from './CardEditor'
import type { Card, CardType } from '../../types'

const cardTypeConfig: Record<
  CardType,
  { icon: React.ElementType; color: string; label: string }
> = {
  recording: { icon: Mic, color: 'text-red-400', label: '录音' },
  photo: { icon: Camera, color: 'text-blue-400', label: '照片' },
  note: { icon: FileText, color: 'text-yellow-400', label: '笔记' },
  missing_report: { icon: UserX, color: 'text-purple-400', label: '失踪报告' },
}

export function ArchiveLibrary() {
  const {
    cards,
    filter,
    selectedCardId,
    selectCard,
    setFilter,
    addCard,
    updateCard,
    deleteCard,
  } = useCardStore()

  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [showChapterDropdown, setShowChapterDropdown] = useState(false)
  const [showReliabilityDropdown, setShowReliabilityDropdown] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isNewCardMode, setIsNewCardMode] = useState(false)

  const typeCounts = useMemo(() => {
    const counts: Record<CardType, number> = {
      recording: 0,
      photo: 0,
      note: 0,
      missing_report: 0,
    }
    cards.forEach((card) => {
      counts[card.type]++
    })
    return counts
  }, [cards])

  const availableChapters = useMemo(() => {
    const chapters = new Set<number>()
    cards.forEach((card) => chapters.add(card.chapter))
    return Array.from(chapters).sort((a, b) => a - b)
  }, [cards])

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) || null,
    [cards, selectedCardId]
  )

  function handleCardClick(card: Card) {
    selectCard(card.id)
    setIsNewCardMode(false)
    setIsEditorOpen(true)
    setShowTypeDropdown(false)
    setShowChapterDropdown(false)
    setShowReliabilityDropdown(false)
  }

  function handleNewCard() {
    selectCard(null)
    setIsNewCardMode(true)
    setIsEditorOpen(true)
    setShowTypeDropdown(false)
    setShowChapterDropdown(false)
    setShowReliabilityDropdown(false)
  }

  function handleCloseEditor() {
    setIsEditorOpen(false)
    setIsNewCardMode(false)
    selectCard(null)
  }

  function handleSave(
    cardData: Omit<Card, 'id' | 'createdAt' | 'updatedAt' | 'position' | 'onWall'>
  ) {
    if (isNewCardMode) {
      addCard(cardData)
    } else if (selectedCardId) {
      updateCard(selectedCardId, cardData)
    }
    handleCloseEditor()
  }

  function handleDelete(id: string) {
    deleteCard(id)
    handleCloseEditor()
  }

  function handleTypeSelect(type: CardType | null) {
    setFilter({ type })
    setShowTypeDropdown(false)
  }

  function handleChapterSelect(chapter: number | null) {
    setFilter({ chapter })
    setShowChapterDropdown(false)
  }

  function handleReliabilityFilter(min: number | null) {
    setShowReliabilityDropdown(false)
  }

  return (
    <div className="flex h-full bg-gray-950 overflow-hidden">
      <div className="flex-1 flex flex-col">
        <div className="bg-gray-900 border-b border-gray-800 p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleNewCard}
              className="flex items-center gap-2 px-4 py-2 bg-[#8b0000] hover:bg-[#6b0000] text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              新建卡片
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  setShowTypeDropdown(!showTypeDropdown)
                  setShowChapterDropdown(false)
                  setShowReliabilityDropdown(false)
                }}
                className={`
                  flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-colors
                  ${filter.type ? 'border-[#8b0000] bg-[#8b0000]/10' : ''}
                `}
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">
                  {filter.type ? cardTypeConfig[filter.type].label : '类型'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showTypeDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => handleTypeSelect(null)}
                    className={`
                      w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors
                      ${filter.type === null ? 'text-[#8b0000] font-medium' : 'text-gray-300'}
                    `}
                  >
                    全部类型
                  </button>
                  {(Object.keys(cardTypeConfig) as CardType[]).map((type) => {
                    const config = cardTypeConfig[type]
                    const Icon = config.icon
                    return (
                      <button
                        key={type}
                        onClick={() => handleTypeSelect(type)}
                        className={`
                          w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors flex items-center justify-between
                          ${filter.type === type ? 'text-[#8b0000] font-medium' : 'text-gray-300'}
                        `}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          {config.label}
                        </span>
                        <span className="text-gray-500">{typeCounts[type]}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowChapterDropdown(!showChapterDropdown)
                  setShowTypeDropdown(false)
                  setShowReliabilityDropdown(false)
                }}
                className={`
                  flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-colors
                  ${filter.chapter ? 'border-[#8b0000] bg-[#8b0000]/10' : ''}
                `}
              >
                <span className="text-sm">
                  {filter.chapter ? `第${filter.chapter}章` : '章节'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showChapterDropdown && (
                <div className="absolute top-full left-0 mt-1 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => handleChapterSelect(null)}
                    className={`
                      w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors
                      ${filter.chapter === null ? 'text-[#8b0000] font-medium' : 'text-gray-300'}
                    `}
                  >
                    全部章节
                  </button>
                  {availableChapters.map((chapter) => (
                    <button
                      key={chapter}
                      onClick={() => handleChapterSelect(chapter)}
                      className={`
                        w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors
                        ${filter.chapter === chapter ? 'text-[#8b0000] font-medium' : 'text-gray-300'}
                      `}
                    >
                      第{chapter}章
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowReliabilityDropdown(!showReliabilityDropdown)
                  setShowTypeDropdown(false)
                  setShowChapterDropdown(false)
                }}
                className="
                  flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-colors
                "
              >
                <span className="text-sm">可信度</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showReliabilityDropdown && (
                <div className="absolute top-full left-0 mt-1 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => handleReliabilityFilter(null)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-gray-300 transition-colors"
                  >
                    全部
                  </button>
                  <button
                    onClick={() => handleReliabilityFilter(80)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-gray-300 transition-colors"
                  >
                    高可信度 (≥80%)
                  </button>
                  <button
                    onClick={() => handleReliabilityFilter(50)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-gray-300 transition-colors"
                  >
                    中可信度 (≥50%)
                  </button>
                  <button
                    onClick={() => handleReliabilityFilter(30)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-gray-300 transition-colors"
                  >
                    低可信度 (≥30%)
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1" />

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter({ search: e.target.value })}
                placeholder="搜索卡片..."
                className="
                  w-72 pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-[#8b0000]/30 focus:border-[#8b0000] transition-colors
                "
              />
              {filter.search && (
                <button
                  onClick={() => setFilter({ search: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <CardList
            cards={cards}
            onCardClick={handleCardClick}
            filter={filter}
          />
        </div>
      </div>

      <div
        className={`
          absolute right-0 top-0 h-full transition-all duration-300 ease-in-out z-10
          ${isEditorOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <CardEditor
          card={isNewCardMode ? null : selectedCard}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={handleCloseEditor}
        />
      </div>
    </div>
  )
}
