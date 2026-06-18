import { Mic, Camera, FileText, UserX } from 'lucide-react'
import type { Card, CardType } from '../types'

interface CardProps {
  card: Card
  isSelected?: boolean
  isDragging?: boolean
  onSelect?: (card: Card) => void
  onDragStart?: (e: React.DragEvent, card: Card) => void
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

function getReliabilityColor(reliability: number): string {
  if (reliability >= 80) return 'bg-green-500'
  if (reliability >= 50) return 'bg-yellow-500'
  if (reliability >= 30) return 'bg-orange-500'
  return 'bg-red-500'
}

export function ClueCard({ card, isSelected, isDragging, onSelect, onDragStart }: CardProps) {
  const config = cardTypeConfig[card.type]
  const Icon = config.icon

  const handleClick = () => {
    onSelect?.(card)
  }

  const handleDragStart = (e: React.DragEvent) => {
    onDragStart?.(e, card)
  }

  return (
    <div
      draggable
      onClick={handleClick}
      onDragStart={handleDragStart}
      className={`
        relative w-48 rounded-lg border-2 p-3 transition-all duration-200
        ${config.bgColor}
        ${config.borderColor}
        ${isSelected ? 'ring-2 ring-white/50 shadow-lg shadow-white/10 scale-105' : ''}
        ${isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-grab hover:scale-102'}
        hover:shadow-lg hover:shadow-black/30
      `}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`p-1.5 rounded-md ${config.bgColor} ${config.borderColor} border`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex items-center gap-1">
          <span className="px-2 py-0.5 text-xs font-medium text-gray-300 bg-gray-800 rounded">
            第{card.chapter}章
          </span>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-white mb-2 line-clamp-2">{card.title}</h3>

      <div className="flex items-center justify-between text-xs">
        <span className={`${config.color} font-medium`}>{config.label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">可信度</span>
          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getReliabilityColor(card.reliability)} transition-all duration-300`}
              style={{ width: `${card.reliability}%` }}
            />
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="absolute inset-0 rounded-lg ring-2 ring-white/50 pointer-events-none" />
      )}
    </div>
  )
}
