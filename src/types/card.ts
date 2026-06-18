export type CardType = 'recording' | 'photo' | 'note' | 'missing_report'

export interface CardFilter {
  type: CardType | null
  chapter: number | null
  search: string
}

export interface Card {
  id: string
  type: CardType
  title: string
  content: string
  chapter: number
  reliability: number
  keywords: string[]
  position: {
    x: number
    y: number
  }
  onWall: boolean
  createdAt: Date
  updatedAt: Date
}
