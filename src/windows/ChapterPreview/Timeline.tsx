import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { Chapter } from '../../types'
import type { Card } from '../../types'

interface TimelineProps {
  chapters: Chapter[]
  currentChapter: number | null
  cards: Card[]
  onSelectChapter: (chapterNumber: number) => void
  onAddChapter: () => void
  onUpdateChapterName: (chapterNumber: number, name: string) => void
}

export function Timeline({
  chapters,
  currentChapter,
  cards,
  onSelectChapter,
  onAddChapter,
  onUpdateChapterName,
}: TimelineProps) {
  const [editingChapter, setEditingChapter] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingChapter !== null && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingChapter])

  const getCardCount = (chapterNumber: number) => {
    return cards.filter((card) => card.chapter === chapterNumber).length
  }

  const handleDoubleClick = (chapter: Chapter) => {
    setEditingChapter(chapter.number)
    setEditingName(chapter.name)
  }

  const handleNameSubmit = () => {
    if (editingChapter !== null && editingName.trim()) {
      onUpdateChapterName(editingChapter, editingName.trim())
    }
    setEditingChapter(null)
    setEditingName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit()
    } else if (e.key === 'Escape') {
      setEditingChapter(null)
      setEditingName('')
    }
  }

  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number)

  return (
    <div className="sticky top-0 z-20 bg-gray-950 border-b border-gray-800">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="text-sm font-medium text-gray-400 mr-2">章节</div>
        <div
          ref={scrollRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900 pb-1"
        >
          {sortedChapters.map((chapter) => {
            const cardCount = getCardCount(chapter.number)
            const isSelected = currentChapter === chapter.number
            const isEditing = editingChapter === chapter.number

            return (
              <div
                key={chapter.number}
                onClick={() => !isEditing && onSelectChapter(chapter.number)}
                onDoubleClick={() => handleDoubleClick(chapter)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all cursor-pointer min-w-fit
                  ${isSelected
                    ? 'border-red-500 bg-red-950/30 shadow-lg shadow-red-500/20'
                    : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                  }
                  ${isEditing ? 'cursor-text' : ''}
                `}
              >
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                    ${isSelected ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300'}
                  `}
                >
                  {chapter.number}
                </div>

                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleNameSubmit}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gray-800 text-white px-2 py-1 rounded text-sm border border-red-500 outline-none min-w-24"
                  />
                ) : (
                  <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {chapter.name}
                  </span>
                )}

                {cardCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-800 text-gray-400 rounded-full">
                    {cardCount}
                  </span>
                )}
              </div>
            )
          })}

          <button
            onClick={onAddChapter}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-700 bg-gray-900/50 hover:border-red-500/50 hover:bg-red-950/20 transition-all min-w-fit"
          >
            <Plus className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">添加章节</span>
          </button>
        </div>
      </div>
    </div>
  )
}
