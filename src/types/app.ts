import type { Card } from './card';
import type { Connection } from './connection';
import type { Chapter } from './chapter';

export interface AppState {
  cards: Card[];
  connections: Connection[];
  chapters: Chapter[];
  selectedCardId: string | null;
  selectedConnectionId: string | null;
  currentChapter: number | null;
}
