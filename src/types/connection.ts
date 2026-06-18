export type LineType = 'red' | 'dashed' | 'contaminated'

export type RelationType = 'causality' | 'misleading' | 'homology' | 'unconfirmed'

export interface Connection {
  id: string
  sourceId: string
  targetId: string
  lineType: LineType
  relationType: RelationType
  reason: string
  createdAt: Date
}
