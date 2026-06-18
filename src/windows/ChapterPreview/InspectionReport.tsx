import { useState, useMemo } from 'react'
import { AlertTriangle, Eye, EyeOff, Link2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Card, Connection, CardType } from '../../types'

interface LeakedClue {
  type: 'leaked'
  card: Card
  suggestedAction: string
}

interface DeeplyBuried {
  type: 'buried'
  card: Card
  suggestedAction: string
}

interface OrphanedCard {
  type: 'orphaned'
  card: Card
  suggestedAction: string
}

type InspectionIssue = LeakedClue | DeeplyBuried | OrphanedCard

interface InspectionReportProps {
  cards: Card[]
  connections: Connection[]
  currentChapter: number | null
  onHighlightCard: (cardId: string) => void
}

const cardTypeLabels: Record<CardType, string> = {
  recording: '录音',
  photo: '照片',
  note: '笔记',
  missing_report: '失踪报告',
}

export function InspectionReport({ cards, connections, currentChapter, onHighlightCard }: InspectionReportProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [expandedSections, setExpandedSections] = useState({
    leaked: true,
    buried: true,
    orphaned: true,
  })

  const issues = useMemo(() => {
    if (currentChapter === null) return { leaked: [], buried: [], orphaned: [] }

    const leaked: LeakedClue[] = cards
      .filter((card) => card.chapter > currentChapter)
      .map((card) => ({
        type: 'leaked' as const,
        card,
        suggestedAction: `将卡片移至第${currentChapter}章或之后`,
      }))

    const buried: DeeplyBuried[] = cards
      .filter((card) => {
        if (card.chapter <= 3) return false
        const hasEarlyConnections = connections.some(
          (conn) => {
            const connectedCardId = conn.sourceId === card.id ? conn.targetId : conn.targetId === card.id ? conn.sourceId : null
            if (!connectedCardId) return false
            const connectedCard = cards.find((c) => c.id === connectedCardId)
            return connectedCard && connectedCard.chapter < card.chapter
          }
        )
        return !hasEarlyConnections && card.reliability >= 70
      })
      .map((card) => ({
        type: 'buried' as const,
        card,
        suggestedAction: '考虑提前引入此关键线索或添加与早期章节的关联',
      }))

    const orphaned: OrphanedCard[] = cards
      .filter((card) => {
        const hasConnections = connections.some(
          (conn) => conn.sourceId === card.id || conn.targetId === card.id
        )
        return !hasConnections
      })
      .map((card) => ({
        type: 'orphaned' as const,
        card,
        suggestedAction: '为此卡片建立与其他线索的关联',
      }))

    return { leaked, buried, orphaned }
  }, [cards, connections, currentChapter])

  const toggleSection = (section: 'leaked' | 'buried' | 'orphaned') => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const IssueIcon = ({ type }: { type: InspectionIssue['type'] }) => {
    switch (type) {
      case 'leaked':
        return <Eye className="w-4 h-4 text-red-400" />
      case 'buried':
        return <EyeOff className="w-4 h-4 text-yellow-400" />
      case 'orphaned':
        return <Link2 className="w-4 h-4 text-blue-400" />
    }
  }

  const SectionHeader = ({
    title,
    count,
    section,
    icon,
  }: {
    title: string
    count: number
    section: 'leaked' | 'buried' | 'orphaned'
    icon: React.ReactNode
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between px-4 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-gray-300">{title}</span>
        <span className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-400 rounded-full">
          {count}
        </span>
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="w-4 h-4 text-gray-500" />
      ) : (
        <ChevronDown className="w-4 h-4 text-gray-500" />
      )}
    </button>
  )

  const IssueItem = ({ issue }: { issue: InspectionIssue }) => (
    <div
      onClick={() => onHighlightCard(issue.card.id)}
      className="px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <IssueIcon type={issue.type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-white truncate">{issue.card.title}</h4>
            <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
              {cardTypeLabels[issue.card.type]}
            </span>
            <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
              第{issue.card.chapter}章
            </span>
          </div>
          <p className="text-xs text-gray-500">{issue.suggestedAction}</p>
        </div>
      </div>
    </div>
  )

  const totalIssues = issues.leaked.length + issues.buried.length + issues.orphaned.length

  return (
    <div className="border-t border-gray-800 bg-gray-950">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-sm font-semibold text-white">检查报告</span>
          {totalIssues > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
              {totalIssues}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="max-h-64 overflow-y-auto">
          <SectionHeader
            title="泄露的线索"
            count={issues.leaked.length}
            section="leaked"
            icon={<Eye className="w-4 h-4 text-red-400" />}
          />
          {expandedSections.leaked && (
            <div>
              {issues.leaked.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  没有发现泄露的线索
                </div>
              ) : (
                issues.leaked.map((issue) => (
                  <IssueItem key={`leaked-${issue.card.id}`} issue={issue} />
                ))
              )}
            </div>
          )}

          <SectionHeader
            title="埋藏过深"
            count={issues.buried.length}
            section="buried"
            icon={<EyeOff className="w-4 h-4 text-yellow-400" />}
          />
          {expandedSections.buried && (
            <div>
              {issues.buried.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  没有发现埋藏过深的线索
                </div>
              ) : (
                issues.buried.map((issue) => (
                  <IssueItem key={`buried-${issue.card.id}`} issue={issue} />
                ))
              )}
            </div>
          )}

          <SectionHeader
            title="孤立卡片"
            count={issues.orphaned.length}
            section="orphaned"
            icon={<Link2 className="w-4 h-4 text-blue-400" />}
          />
          {expandedSections.orphaned && (
            <div>
              {issues.orphaned.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  没有发现孤立卡片
                </div>
              ) : (
                issues.orphaned.map((issue) => (
                  <IssueItem key={`orphaned-${issue.card.id}`} issue={issue} />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
