import { useState } from 'react'
import { X, Check } from 'lucide-react'
import type { LineType, RelationType } from '../../types'
import { getLineStyle, getLineColor } from '../../utils/svg'

interface ConnectionToolbarProps {
  position: { x: number; y: number }
  onSave: (data: { lineType: LineType; relationType: RelationType; reason: string }) => void
  onCancel: () => void
  initialLineType?: LineType
  initialRelationType?: RelationType
  initialReason?: string
  mode?: 'create' | 'edit'
}

const lineTypeOptions: { value: LineType; label: string }[] = [
  { value: 'red', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'contaminated', label: '污染线' },
]

const relationTypeOptions: { value: RelationType; label: string; description: string }[] = [
  { value: 'causality', label: '因果关系', description: 'A 导致 B' },
  { value: 'misleading', label: '误导性关联', description: '看似相关实则无关' },
  { value: 'homology', label: '同源关系', description: '来自同一来源' },
  { value: 'unconfirmed', label: '未确认关联', description: '有待验证' },
]

export function ConnectionToolbar({
  position,
  onSave,
  onCancel,
  initialLineType = 'red',
  initialRelationType = 'unconfirmed',
  initialReason = '',
  mode = 'create',
}: ConnectionToolbarProps) {
  const [lineType, setLineType] = useState<LineType>(initialLineType)
  const [relationType, setRelationType] = useState<RelationType>(initialRelationType)
  const [reason, setReason] = useState(initialReason)

  const handleSave = () => {
    onSave({ lineType, relationType, reason })
  }

  return (
    <div
      className="absolute z-50 bg-gray-900/95 backdrop-blur-sm border-2 border-red-900/50 rounded-lg shadow-2xl p-4 w-80"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">
          {mode === 'create' ? '创建连接' : '编辑连接'}
        </h3>
        <button
          onClick={onCancel}
          className="p-1 text-gray-400 hover:text-white transition-colors rounded hover:bg-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">线条类型</label>
          <div className="flex gap-2">
            {lineTypeOptions.map((option) => {
              const style = getLineStyle(option.value)
              const color = getLineColor(option.value)
              const isSelected = lineType === option.value

              return (
                <button
                  key={option.value}
                  onClick={() => setLineType(option.value)}
                  className={`
                    flex-1 p-3 rounded-lg border-2 transition-all
                    ${isSelected ? 'border-red-500 bg-red-950/30' : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'}
                  `}
                >
                  <div className="h-6 flex items-center justify-center mb-1">
                    <svg width="100%" height="100%" viewBox="0 0 60 24">
                      <line
                        x1="5"
                        y1="12"
                        x2="55"
                        y2="12"
                        stroke={color}
                        strokeWidth={style.strokeWidth}
                        strokeDasharray={style.strokeDasharray}
                      />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-300">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">关系类型</label>
          <div className="grid grid-cols-2 gap-2">
            {relationTypeOptions.map((option) => {
              const isSelected = relationType === option.value

              return (
                <button
                  key={option.value}
                  onClick={() => setRelationType(option.value)}
                  className={`
                    p-2 rounded-lg border-2 text-left transition-all
                    ${isSelected ? 'border-red-500 bg-red-950/30' : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'}
                  `}
                >
                  <div className="text-xs font-medium text-white">{option.label}</div>
                  <div className="text-[10px] text-gray-500">{option.description}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">关联说明</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="描述这个关联的原因..."
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
            rows={3}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {mode === 'create' ? '创建' : '保存'}
          </button>
        </div>
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 border-r-2 border-b-2 border-red-900/50 rotate-45"
        style={{ bottom: -6 }}
      />
    </div>
  )
}
