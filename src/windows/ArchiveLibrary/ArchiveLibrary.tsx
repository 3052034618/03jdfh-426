import { useState, useMemo } from 'react'
import {
  Search, Plus, Filter, ChevronDown, Mic, Camera, FileText, UserX,
  X, Upload, FileJson, FileText as FileTextIcon, Check, AlertCircle,
} from 'lucide-react'
import { useCardStore } from '../../store/useCardStore'
import { CardList } from './CardList'
import { CardEditor } from './CardEditor'
import type { Card, CardType } from '../../types'
import { cn } from '../../lib/utils'

const cardTypeConfig: Record<
  CardType,
  { icon: React.ElementType; color: string; label: string; aliases: string[] }
> = {
  recording: { icon: Mic, color: 'text-red-400', label: '录音', aliases: ['录音', '音频', 'recording', 'audio', '声音', '证词录音', '口供'] },
  photo: { icon: Camera, color: 'text-blue-400', label: '照片', aliases: ['照片', '图片', 'photo', 'image', '截图', '影像', '拍立得'] },
  note: { icon: FileText, color: 'text-yellow-400', label: '笔记', aliases: ['手记', '笔记', 'note', '信件', '日记', '文档', '研究笔记'] },
  missing_report: { icon: UserX, color: 'text-purple-400', label: '失踪报告', aliases: ['失踪', 'missing', '报告', '寻人', '失踪报告', '档案', '警局'] },
}

const reliabilityHints: Record<string, number> = {
  '非常可靠': 95, '可靠': 80, '较高': 70, '中等': 55, '一般': 40, '较低': 30, '存疑': 20, '不可靠': 10,
}

interface ImportedCard {
  type: CardType
  title: string
  content: string
  chapter: number
  reliability: number
  keywords: string[]
  raw: string
}

interface ImportResult {
  imported: ImportedCard[]
  skipped: { raw: string; reason: string }[]
}

function inferType(raw: string): CardType {
  const lower = raw.toLowerCase()
  for (const [key, cfg] of Object.entries(cardTypeConfig) as [CardType, typeof cardTypeConfig[CardType]][]) {
    for (const alias of cfg.aliases) {
      if (lower.includes(alias.toLowerCase())) return key
    }
  }
  return 'note'
}

function inferReliability(raw: string, fallback = 60): number {
  const lower = raw.toLowerCase()
  for (const [hint, val] of Object.entries(reliabilityHints)) {
    if (lower.includes(hint.toLowerCase())) return val
  }
  const percentMatch = raw.match(/可靠(?:度)?\s*[:：]\s*(\d{1,3})%?/)
  if (percentMatch) return Math.min(100, Math.max(0, Number(percentMatch[1])))
  const numMatch = raw.match(/\b(可信度|可靠度)\s*[:：]\s*(\d{1,3})/)
  if (numMatch) return Math.min(100, Math.max(0, Number(numMatch[2])))
  return fallback
}

function inferChapter(raw: string, fallback = 1): number {
  const m = raw.match(/第\s*(\d+)\s*[章节话]/)
  if (m) return Number(m[1])
  const m2 = raw.match(/(?:章节|chapter|ch)\s*[:：#]?\s*(\d+)/i)
  if (m2) return Number(m2[1])
  const m3 = raw.match(/(?:^|\s)(\d{1,2})\s*[、.．](?=\s*[^\d])/)
  if (m3 && Number(m3[1]) <= 30) return Number(m3[1])
  return fallback
}

function inferKeywords(raw: string, type: CardType, title: string): string[] {
  const keywords: string[] = []
  const bracketMatches = raw.match(/[【\[#]([^】\]#]+)[】\]#]/g)
  if (bracketMatches) {
    bracketMatches.forEach((m) => {
      const k = m.replace(/^[【\[#]|[】\]#]$/g, '').trim()
      if (k && !keywords.includes(k)) keywords.push(k)
    })
  }
  const tagMatch = raw.match(/标签[：:]\s*([^\n]+)/)
  if (tagMatch) {
    tagMatch[1].split(/[,，、\s]+/).forEach((t) => {
      const k = t.trim()
      if (k && !keywords.includes(k)) keywords.push(k)
    })
  }
  if (!keywords.length) {
    const typeLabel = cardTypeConfig[type].label
    keywords.push(typeLabel)
  }
  return keywords.slice(0, 6)
}

function parseTextImport(text: string): ImportResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const imported: ImportedCard[] = []
  const skipped: { raw: string; reason: string }[] = []
  let chapterCursor = 1

  lines.forEach((rawLine) => {
    if (rawLine.startsWith('---') || rawLine.startsWith('===')) return
    if (!rawLine) return

    let title = ''
    let content = rawLine
    let type: CardType = 'note'
    let reliability = 60
    let chapter = chapterCursor
    let keywords: string[] = []

    const explicitSplit = rawLine.match(/^[【\[]([^\]】]+)[】\]]\s*[:：-]?\s*(.*)$/)
    if (explicitSplit) {
      const tagPart = explicitSplit[1]
      const rest = explicitSplit[2]
      type = inferType(tagPart + ' ' + rest)
      const titleContent = rest.split(/\n|。|；|;/)
      title = titleContent[0].trim().slice(0, 40) || rest.slice(0, 30).trim()
      content = rest.trim()
    } else {
      const pipeParts = rawLine.split(/[|｜]/).map((s) => s.trim())
      if (pipeParts.length >= 3) {
        const [t, c, rest] = pipeParts
        title = t.slice(0, 40)
        type = inferType(t + ' ' + c + ' ' + rest)
        chapter = inferChapter(rawLine, chapterCursor)
        reliability = inferReliability(rawLine)
        content = pipeParts.slice(2).join(' | ')
      } else {
        type = inferType(rawLine)
        const sentences = rawLine.split(/[。；;\n]+/)
        title = sentences[0].trim().slice(0, 40) || rawLine.slice(0, 30).trim()
        content = rawLine.trim()
      }
    }

    chapter = inferChapter(rawLine, chapterCursor)
    chapterCursor = Math.max(chapterCursor, chapter)
    reliability = inferReliability(rawLine, type === 'missing_report' ? 100 : type === 'note' ? 80 : 60)
    keywords = inferKeywords(rawLine, type, title)

    if (!title) {
      skipped.push({ raw: rawLine.slice(0, 50), reason: '无法解析标题' })
      return
    }
    if (title.length < 2) {
      skipped.push({ raw: rawLine.slice(0, 50), reason: '标题太短' })
      return
    }

    imported.push({ type, title, content, chapter, reliability, keywords, raw: rawLine })
  })

  return { imported, skipped }
}

function parseJsonImport(text: string): ImportResult {
  const imported: ImportedCard[] = []
  const skipped: { raw: string; reason: string }[] = []
  let data: any

  try {
    data = JSON.parse(text)
  } catch (e: any) {
    return { imported: [], skipped: [{ raw: text.slice(0, 60), reason: `JSON 解析失败：${e.message?.slice(0, 30) || '未知错误'}` }] }
  }

  const arr = Array.isArray(data) ? data : Array.isArray(data?.cards) ? data.cards : null
  if (!arr) {
    return { imported: [], skipped: [{ raw: '格式不正确', reason: '需要 JSON 数组或含 cards 字段的对象' }] }
  }

  arr.forEach((item: any, idx: number) => {
    if (!item || typeof item !== 'object') {
      skipped.push({ raw: `第${idx + 1}项`, reason: '不是有效对象' })
      return
    }

    const rawType: any = item.type || item.cardType || item.kind || 'note'
    let type: CardType = 'note'
    if (typeof rawType === 'string') {
      const lower = rawType.toLowerCase()
      const match = (Object.keys(cardTypeConfig) as CardType[]).find(
        (k) => cardTypeConfig[k].aliases.some((a) => a.toLowerCase() === lower) || k === lower
      )
      type = match || inferType(rawType)
    } else {
      type = inferType(JSON.stringify(item))
    }

    const title = (item.title || item.name || item.header || '').toString().trim().slice(0, 60)
    if (!title) {
      skipped.push({ raw: `第${idx + 1}项`, reason: '缺少 title 字段' })
      return
    }

    const content = (item.content || item.description || item.body || item.text || title).toString()
    let chapter = Number(item.chapter) || inferChapter(JSON.stringify(item), 1)
    if (chapter < 1) chapter = 1
    chapter = Math.floor(chapter)

    let reliability = Number(item.reliability ?? item.confidence ?? null)
    if (!Number.isFinite(reliability)) reliability = inferReliability(JSON.stringify(item), 60)
    reliability = Math.min(100, Math.max(0, Math.floor(reliability)))

    let keywords: string[] = []
    if (Array.isArray(item.keywords) || Array.isArray(item.tags)) {
      keywords = (item.keywords || item.tags).map((k: any) => k.toString().trim()).filter(Boolean).slice(0, 6)
    }
    if (!keywords.length) keywords = inferKeywords(JSON.stringify(item), type, title)

    imported.push({ type, title, content, chapter, reliability, keywords, raw: JSON.stringify(item).slice(0, 80) })
  })

  return { imported, skipped }
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

  const [showImportModal, setShowImportModal] = useState(false)
  const [importMode, setImportMode] = useState<'text' | 'json'>('text')
  const [importInput, setImportInput] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [previewCards, setPreviewCards] = useState<ImportedCard[]>([])
  const [selectedForImport, setSelectedForImport] = useState<Set<number>>(new Set())

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

  function openImport() {
    setShowImportModal(true)
    setImportInput('')
    setImportResult(null)
    setPreviewCards([])
    setSelectedForImport(new Set())
  }

  function closeImport() {
    setShowImportModal(false)
    setImportInput('')
    setImportResult(null)
    setPreviewCards([])
    setSelectedForImport(new Set())
  }

  function parsePreview() {
    const trimmed = importInput.trim()
    if (!trimmed) {
      setImportResult(null)
      setPreviewCards([])
      setSelectedForImport(new Set())
      return
    }

    const result = importMode === 'json'
      ? parseJsonImport(trimmed)
      : parseTextImport(trimmed)
    setImportResult(result)
    setPreviewCards(result.imported)
    setSelectedForImport(new Set(result.imported.map((_, i) => i)))
  }

  function toggleSelect(i: number) {
    setSelectedForImport((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedForImport.size === previewCards.length && previewCards.length > 0) {
      setSelectedForImport(new Set())
    } else {
      setSelectedForImport(new Set(previewCards.map((_, i) => i)))
    }
  }

  function executeImport() {
    const toImport = previewCards.filter((_, i) => selectedForImport.has(i))
    const existingKeys = new Set(cards.map((c) => `${c.type}|${c.title}|${c.chapter}`))

    let added = 0
    let skipped = 0
    toImport.forEach((c) => {
      const key = `${c.type}|${c.title}|${c.chapter}`
      if (existingKeys.has(key)) {
        skipped++
        return
      }
      addCard({
        type: c.type,
        title: c.title,
        content: c.content,
        chapter: c.chapter,
        reliability: c.reliability,
        keywords: c.keywords,
      })
      existingKeys.add(key)
      added++
    })

    window.setTimeout(() => {
      window.alert(
        `导入完成：\n✅ 新增 ${added} 张卡片\n${skipped > 0 ? `⚠️ 跳过 ${skipped} 张（已存在相同标题+类型+章节）` : ''}`
      )
    }, 0)

    closeImport()
  }

  const importExample = importMode === 'text'
    ? `示例（每行一张卡片，可手动标注类型或自动推断）：
【录音】第1章 深夜走廊脚步声 | 可靠度：85% | 2024年3月15日凌晨2点录制，三楼走廊有节奏脚步声突然停止
【照片】地下室模糊人影 | 第1章 | 保安夜间巡逻拍摄，左上方角落半透明人影
【手记】第2章 李教授研究笔记 | 量子纠缠与意识投射，最后一行颤抖笔迹写着"它们已经知道"
【失踪报告】保洁员王阿姨 | 第2章 | 22:15进入四楼卫生间后从未离开，物品都在原地`
    : `示例（JSON 数组，title 必需）：
[
  {
    "type": "recording",
    "title": "深夜走廊脚步声录音",
    "chapter": 1,
    "reliability": 85,
    "keywords": ["录音", "脚步声", "三楼"],
    "content": "凌晨2点录制..."
  },
  {
    "type": "photo",
    "title": "地下室模糊人影照片",
    "chapter": 1,
    "reliability": 72,
    "content": "保安拍摄..."
  }
]`

  return (
    <div className="flex h-full bg-gray-950 overflow-hidden relative">
      <div className="flex-1 flex flex-col">
        <div className="bg-gray-900 border-b border-gray-800 p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={handleNewCard}
              className="flex items-center gap-2 px-4 py-2 bg-[#8b0000] hover:bg-[#6b0000] text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              新建卡片
            </button>

            <button
              onClick={openImport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 hover:border-gray-500 rounded-lg transition-colors font-medium"
            >
              <Upload className="w-4 h-4" />
              批量导入
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  setShowTypeDropdown(!showTypeDropdown)
                  setShowChapterDropdown(false)
                  setShowReliabilityDropdown(false)
                }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-colors',
                  filter.type && 'border-[#8b0000] bg-[#8b0000]/10'
                )}
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
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors',
                      filter.type === null && 'text-[#8b0000] font-medium'
                    )}
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
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors flex items-center justify-between',
                          filter.type === type && 'text-[#8b0000] font-medium'
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className={cn('w-4 h-4', config.color)} />
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
                className={cn(
                  'flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-colors',
                  filter.chapter && 'border-[#8b0000] bg-[#8b0000]/10'
                )}
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
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors',
                      filter.chapter === null && 'text-[#8b0000] font-medium'
                    )}
                  >
                    全部章节
                  </button>
                  {availableChapters.map((chapter) => (
                    <button
                      key={chapter}
                      onClick={() => handleChapterSelect(chapter)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors',
                        filter.chapter === chapter && 'text-[#8b0000] font-medium'
                      )}
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
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg transition-colors"
              >
                <span className="text-sm">可信度</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showReliabilityDropdown && (
                <div className="absolute top-full left-0 mt-1 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  {[
                    { label: '全部', value: null },
                    { label: '高可信度 (≥80%)', value: 80 },
                    { label: '中可信度 (≥50%)', value: 50 },
                    { label: '低可信度 (≥30%)', value: 30 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleReliabilityFilter(opt.value)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-gray-300 transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
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
                className="w-72 pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8b0000]/30 focus:border-[#8b0000] transition-colors"
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
        className={cn(
          'absolute right-0 top-0 h-full transition-all duration-300 ease-in-out z-10',
          isEditorOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <CardEditor
          card={isNewCardMode ? null : selectedCard}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={handleCloseEditor}
        />
      </div>

      {showImportModal && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-black/70 backdrop-blur-sm"
          onClick={closeImport}
        >
          <div
            className="w-full max-w-3xl max-h-full flex flex-col bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/80">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-red-400" />
                <div>
                  <h2 className="text-lg font-semibold text-white">批量导入卡片</h2>
                  <p className="text-xs text-gray-500">支持文本格式和 JSON 格式，不会覆盖已有卡片</p>
                </div>
              </div>
              <button
                onClick={closeImport}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    setImportMode('text')
                    setImportResult(null)
                    setPreviewCards([])
                    setSelectedForImport(new Set())
                  }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm font-medium',
                    importMode === 'text'
                      ? 'bg-[#8b0000]/20 border-[#8b0000]/60 text-red-300'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  )}
                >
                  <FileTextIcon className="w-4 h-4" />
                  文本格式
                </button>
                <button
                  onClick={() => {
                    setImportMode('json')
                    setImportResult(null)
                    setPreviewCards([])
                    setSelectedForImport(new Set())
                  }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm font-medium',
                    importMode === 'json'
                      ? 'bg-[#8b0000]/20 border-[#8b0000]/60 text-red-300'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  )}
                >
                  <FileJson className="w-4 h-4" />
                  JSON 格式
                </button>
              </div>

              <div className="mb-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
                  粘贴内容
                </label>
                <textarea
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8b0000]/30 focus:border-[#8b0000] resize-none font-mono text-sm"
                  placeholder={importExample}
                />
                <div className="mt-2 text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                  {importExample.split('\n').slice(0, 3).join('\n')}
                  {'\n...'}
                </div>
              </div>

              <button
                onClick={parsePreview}
                disabled={!importInput.trim()}
                className={cn(
                  'w-full py-2.5 rounded-xl font-medium transition-all mb-4',
                  importInput.trim()
                    ? 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 hover:border-gray-500'
                    : 'bg-gray-800/40 text-gray-500 border border-gray-800 cursor-not-allowed'
                )}
              >
                🔍 解析并预览
              </button>

              {importResult && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-sm">
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-green-300 font-medium">{importResult.imported.length}</span>
                        <span className="text-gray-400">条解析成功</span>
                      </span>
                      {importResult.skipped.length > 0 && (
                        <span className="flex items-center gap-1.5 text-sm">
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                          <span className="text-yellow-300 font-medium">{importResult.skipped.length}</span>
                          <span className="text-gray-400">条跳过</span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                    >
                      {selectedForImport.size === previewCards.length && previewCards.length > 0
                        ? '全不选'
                        : '全选'}
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-700 divide-y divide-gray-800 bg-gray-950">
                    {previewCards.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-500">没有可导入的卡片</div>
                    ) : (
                      previewCards.map((pc, i) => {
                        const cfg = cardTypeConfig[pc.type]
                        const Icon = cfg.icon
                        const existingKey = `${pc.type}|${pc.title}|${pc.chapter}`
                        const duplicate = cards.some(
                          (c) => `${c.type}|${c.title}|${c.chapter}` === existingKey
                        )
                        const sel = selectedForImport.has(i)
                        return (
                          <div
                            key={i}
                            className={cn(
                              'flex items-center gap-3 p-3 transition-colors cursor-pointer',
                              sel ? 'bg-[#8b0000]/10' : 'hover:bg-gray-900/60',
                              duplicate && 'opacity-60'
                            )}
                            onClick={() => !duplicate && toggleSelect(i)}
                          >
                            <div
                              className={cn(
                                'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                                sel
                                  ? 'bg-[#8b0000] border-[#8b0000]'
                                  : duplicate
                                    ? 'border-gray-700 bg-gray-800'
                                    : 'border-gray-600 hover:border-gray-500'
                              )}
                            >
                              {sel && <Check className="w-3 h-3 text-white" />}
                              {duplicate && <AlertCircle className="w-3 h-3 text-gray-500" />}
                            </div>
                            <Icon className={cn('w-4 h-4 flex-shrink-0', cfg.color)} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-100 truncate">
                                {pc.title}
                                {duplicate && (
                                  <span className="ml-2 text-xs text-yellow-500/80">（已存在，将跳过）</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 truncate mt-0.5">
                                第{pc.chapter}章 · 可靠度 {pc.reliability}%
                                {pc.keywords.length > 0 && (
                                  <span className="ml-2">· {pc.keywords.slice(0, 3).join(' ')}</span>
                                )}
                              </div>
                            </div>
                            <span className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0',
                              pc.type === 'recording' && 'text-red-400 border-red-800/50 bg-red-950/40',
                              pc.type === 'photo' && 'text-blue-400 border-blue-800/50 bg-blue-950/40',
                              pc.type === 'note' && 'text-yellow-400 border-yellow-800/50 bg-yellow-950/40',
                              pc.type === 'missing_report' && 'text-purple-400 border-purple-800/50 bg-purple-950/40',
                            )}>
                              {cfg.label}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {importResult.skipped.length > 0 && (
                    <details className="rounded-xl border border-yellow-900/40 bg-yellow-950/10">
                      <summary className="px-4 py-2 text-xs text-yellow-500 cursor-pointer hover:text-yellow-400">
                        查看跳过的 {importResult.skipped.length} 条
                      </summary>
                      <div className="px-4 pb-3 space-y-1">
                        {importResult.skipped.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <AlertCircle className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-gray-300">{s.raw}</span>
                              <span className="text-yellow-600 ml-2">— {s.reason}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-900/60">
              <button
                onClick={closeImport}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeImport}
                disabled={selectedForImport.size === 0}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm font-medium transition-all',
                  selectedForImport.size > 0
                    ? 'bg-[#8b0000] hover:bg-[#6b0000] text-white shadow-lg shadow-[#8b0000]/20'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                )}
              >
                导入选中的 {selectedForImport.size > 0 ? `(${selectedForImport.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
