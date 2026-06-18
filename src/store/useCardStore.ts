import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Card, CardType, CardFilter } from '../types';

interface CardState {
  cards: Card[];
  selectedCardId: string | null;
  filter: CardFilter;
  addCard: (card: Omit<Card, 'id' | 'createdAt' | 'updatedAt' | 'position' | 'onWall'>) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  selectCard: (id: string | null) => void;
  setFilter: (filter: Partial<{ type: CardType | null; chapter: number | null; search: string }>) => void;
  moveCardToWall: (id: string, position: { x: number; y: number }) => void;
  updateCardPosition: (id: string, position: { x: number; y: number }) => void;
}

const CARD_WIDTH = 192
const CARD_HEIGHT = 120
const COLS = 4
const SPACING_X = 60
const SPACING_Y = 60
const START_X = 80
const START_Y = 80

function calcGridPosition(index: number): { x: number; y: number } {
  const row = Math.floor(index / COLS)
  const col = index % COLS
  return {
    x: START_X + col * (CARD_WIDTH + SPACING_X),
    y: START_Y + row * (CARD_HEIGHT + SPACING_Y),
  }
}

const sampleCards: Card[] = [
  {
    id: 'sample-1',
    type: 'recording',
    title: '深夜走廊脚步声录音',
    content: '2024年3月15日凌晨2点，在三楼东侧走廊录制。录音中可以清晰听到有节奏的脚步声，从走廊尽头向录制方向移动，随后突然停止。音频分析显示脚步声频率与人类行走不符，间隔时间存在不规则变化。',
    chapter: 1,
    reliability: 85,
    keywords: ['录音', '脚步声', '三楼', '异常音频'],
    position: calcGridPosition(0),
    onWall: true,
    createdAt: new Date('2024-03-15'),
    updatedAt: new Date('2024-03-15'),
  },
  {
    id: 'sample-2',
    type: 'photo',
    title: '地下室模糊人影照片',
    content: '保安在夜间巡逻时使用相机拍摄的地下室照片。在照片左上方角落，似乎有一个半透明的人影站在立柱旁。经过图像增强处理，发现该人影没有明显的面部特征，且身体比例异常。',
    chapter: 1,
    reliability: 72,
    keywords: ['照片', '地下室', '人影', '保安'],
    position: calcGridPosition(1),
    onWall: true,
    createdAt: new Date('2024-03-18'),
    updatedAt: new Date('2024-03-18'),
  },
  {
    id: 'sample-3',
    type: 'note',
    title: '李教授的研究笔记',
    content: '李教授失踪前留下的最后一页笔记。内容涉及"量子纠缠与意识投射"相关理论，以及多次提到"门"和"另一侧"的存在。笔记最后一行写着："它们已经知道我们在观察了。"笔迹在最后几行明显颤抖。',
    chapter: 2,
    reliability: 95,
    keywords: ['笔记', '李教授', '量子理论', '失踪前'],
    position: calcGridPosition(2),
    onWall: true,
    createdAt: new Date('2024-03-20'),
    updatedAt: new Date('2024-03-20'),
  },
  {
    id: 'sample-4',
    type: 'missing_report',
    title: '保洁员王阿姨失踪报告',
    content: '王阿姨，52岁，在本建筑工作8年。2024年3月22日晚班期间失踪。最后被目击是在22:15分，进入四楼西侧卫生间。监控显示她从未离开该区域，但卫生间内空无一人。随身物品包括清洁推车、手机和钥匙都在原地。',
    chapter: 2,
    reliability: 100,
    keywords: ['失踪报告', '保洁员', '四楼', '监控'],
    position: calcGridPosition(3),
    onWall: true,
    createdAt: new Date('2024-03-23'),
    updatedAt: new Date('2024-03-23'),
  },
]

export const useCardStore = create<CardState>((set, get) => ({
  cards: sampleCards,
  selectedCardId: null,
  filter: {
    type: null,
    chapter: null,
    search: '',
  },
  addCard: (card) =>
    set((state) => {
      const wallCards = state.cards.filter((c) => c.onWall)
      const nextIndex = wallCards.length
      return {
        cards: [
          ...state.cards,
          {
            ...card,
            id: uuidv4(),
            position: calcGridPosition(nextIndex),
            onWall: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }
    }),
  updateCard: (id, updates) =>
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id ? { ...card, ...updates, updatedAt: new Date() } : card
      ),
    })),
  deleteCard: (id) =>
    set((state) => ({
      cards: state.cards.filter((card) => card.id !== id),
      selectedCardId: state.selectedCardId === id ? null : state.selectedCardId,
    })),
  selectCard: (id) =>
    set(() => ({
      selectedCardId: id,
    })),
  setFilter: (newFilter) =>
    set((state) => ({
      filter: { ...state.filter, ...newFilter },
    })),
  moveCardToWall: (id, position) =>
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id
          ? { ...card, position, onWall: true, updatedAt: new Date() }
          : card
      ),
    })),
  updateCardPosition: (id, position) =>
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id
          ? { ...card, position, updatedAt: new Date() }
          : card
      ),
    })),
}));
