import { useState, useRef, useEffect } from 'react'
import { Save, Trash2, X, Plus, Mic, Camera, FileText, UserX } from 'lucide-react'
import { ClueCard } from '../../components/Card'
import type { Card, CardType } from '../../types'

interface CardEditorProps {
  card?: Card | null
  onSave: (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt' | 'position' | 'onWall'>) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

interface FormErrors {
  title?: string
  chapter?: string
}

const cardTypeConfig: Record<
  CardType,
  { icon: React.ElementType; color: string; bgColor: string; borderColor: string; label: string }
> = {
  recording: {
    icon: Mic,
    color: 'text-red-400',
    bgColor: 'bg-red-950/50',
    borderColor: 'border-red-800/50',
    label: '录音',
  },
  photo: {
    icon: Camera,
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/50',
    borderColor: 'border-blue-800/50',
    label: '照片',
  },
  note: {
    icon: FileText,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-950/50',
    borderColor: 'border-yellow-800/50',
    label: '笔记',
  },
  missing_report: {
    icon: UserX,
    color: 'text-purple-400',
    bgColor: 'bg-purple-950/50',
    borderColor: 'border-purple-800/50',
    label: '失踪报告',
  },
}

function getReliabilityLabel(reliability: number): string {
  if (reliability >= 80) return '高'
  if (reliability >= 50) return '中'
  if (reliability >= 30) return '低'
  return '极低'
}

function getReliabilityColor(reliability: number): string {
  if (reliability >= 80) return 'text-green-400'
  if (reliability >= 50) return 'text-yellow-400'
  if (reliability >= 30) return 'text-orange-400'
  return 'text-red-400'
}

export function CardEditor({ card, onSave, onDelete, onClose }: CardEditorProps) {
  const isEditMode = !!card

  const [type, setType] = useState<CardType>(card?.type ?? 'note')
  const [title, setTitle] = useState(card?.title ?? '')
  const [chapter, setChapter] = useState(card?.chapter?.toString() ?? '1')
  const [reliability, setReliability] = useState(card?.reliability ?? 50)
  const [keywords, setKeywords] = useState<string[]>(card?.keywords ?? [])
  const [newKeyword, setNewKeyword] = useState('')
  const [content, setContent] = useState(card?.content ?? '')
  const [errors, setErrors] = useState<FormErrors>({})

  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (card) {
      setType(card.type)
      setTitle(card.title)
      setChapter(card.chapter.toString())
      setReliability(card.reliability)
      setKeywords(card.keywords)
      setContent(card.content)
    } else {
      setType('note')
      setTitle('')
      setChapter('1')
      setReliability(50)
      setKeywords([])
      setContent('')
    }
    setErrors({})
  }, [card])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  function validate(): boolean {
    const newErrors: FormErrors = {}

    if (!title.trim()) {
      newErrors.title = '标题不能为空'
    }

    const chapterNum = parseInt(chapter, 10)
    if (!chapter || isNaN(chapterNum) || chapterNum < 1) {
      newErrors.chapter = '章节必须是大于0的数字'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSave() {
    if (!validate()) return

    onSave({
      type,
      title: title.trim(),
      chapter: parseInt(chapter, 10),
      reliability,
      keywords,
      content: content.trim(),
    })
  }

  function handleDelete() {
    if (card && onDelete && window.confirm('确定要删除这张卡片吗？此操作不可撤销。')) {
      onDelete(card.id)
    }
  }

  function handleAddKeyword(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && newKeyword.trim()) {
      e.preventDefault()
      if (!keywords.includes(newKeyword.trim())) {
        setKeywords([...keywords, newKeyword.trim()])
      }
      setNewKeyword('')
    }
  }

  function handleRemoveKeyword(keywordToRemove: string) {
    setKeywords(keywords.filter((k) => k !== keywordToRemove))
  }

  const previewCard: Card = {
    id: 'preview',
    type,
    title: title || '卡片标题预览',
    content,
    chapter: parseInt(chapter, 10) || 1,
    reliability,
    keywords,
    position: { x: 0, y: 0 },
    onWall: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return (
    <div
      ref={panelRef}
      className="h-full w-96 bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white">
          {isEditMode ? '编辑卡片' : '新建卡片'}
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="p-4 bg-gray-950 rounded-lg border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-3">卡片预览</h3>
          <div className="flex justify-center">
            <ClueCard card={previewCard} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">卡片类型</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(cardTypeConfig) as CardType[]).map((cardType) => {
              const config = cardTypeConfig[cardType]
              const Icon = config.icon
              const isSelected = type === cardType
              return (
                <button
                  key={cardType}
                  type="button"
                  onClick={() => setType(cardType)}
                  className={`
                    flex items-center gap-2 p-3 rounded-lg border-2 transition-all
                    ${isSelected
                      ? `${config.bgColor} ${config.borderColor} ${config.color}`
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{config.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入卡片标题"
            className={`
              w-full px-3 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500
              focus:outline-none focus:ring-2 transition-colors
              ${errors.title
                ? 'border-red-500 focus:ring-red-500/30'
                : 'border-gray-700 focus:ring-[#8b0000]/30 focus:border-[#8b0000]'
              }
            `}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-400">{errors.title}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              章节 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              min="1"
              placeholder="1"
              className={`
                w-full px-3 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500
                focus:outline-none focus:ring-2 transition-colors
                ${errors.chapter
                  ? 'border-red-500 focus:ring-red-500/30'
                  : 'border-gray-700 focus:ring-[#8b0000]/30 focus:border-[#8b0000]'
                }
              `}
            />
            {errors.chapter && (
              <p className="mt-1 text-sm text-red-400">{errors.chapter}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              可信度
              <span className={`ml-2 font-bold ${getReliabilityColor(reliability)}`}>
                {reliability}% ({getReliabilityLabel(reliability)})
              </span>
            </label>
            <input
              type="range"
              value={reliability}
              onChange={(e) => setReliability(parseInt(e.target.value, 10))}
              min="0"
              max="100"
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#8b0000]"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">关键词</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#8b0000]/20 text-[#c41e3a] border border-[#8b0000]/40 rounded-full text-sm"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(keyword)}
                  className="hover:text-red-300 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleAddKeyword}
              placeholder="输入关键词后按 Enter 添加"
              className="
                w-full px-3 py-2.5 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-[#8b0000]/30 focus:border-[#8b0000] transition-colors
              "
            />
            <button
              type="button"
              onClick={() => {
                if (newKeyword.trim()) {
                  if (!keywords.includes(newKeyword.trim())) {
                    setKeywords([...keywords, newKeyword.trim()])
                  }
                  setNewKeyword('')
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入卡片详细内容..."
            rows={6}
            className="
              w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-[#8b0000]/30 focus:border-[#8b0000] transition-colors
              resize-none
            "
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 border-t border-gray-800 bg-gray-900">
        {isEditMode && onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-[#8b0000] hover:bg-[#6b0000] text-white border border-[#8b0000] rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          保存
        </button>
      </div>
    </div>
  )
}
