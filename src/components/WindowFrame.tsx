import { X, Minus, Square } from 'lucide-react'

interface WindowFrameProps {
  title: string
  children: React.ReactNode
  onClose?: () => void
  onMinimize?: () => void
  onMaximize?: () => void
}

export function WindowFrame({ title, children, onClose, onMinimize, onMaximize }: WindowFrameProps) {
  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-lg overflow-hidden shadow-2xl border border-gray-800">
      <div
        className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors flex items-center justify-center group"
            >
              <X className="w-2 h-2 text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={onMinimize}
              className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors flex items-center justify-center group"
            >
              <Minus className="w-2 h-2 text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={onMaximize}
              className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors flex items-center justify-center group"
            >
              <Square className="w-2 h-2 text-green-900 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
        <div className="text-gray-400 text-sm font-medium select-none">{title}</div>
        <div className="w-16" />
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
