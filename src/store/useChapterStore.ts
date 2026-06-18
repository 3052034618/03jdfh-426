import { create } from 'zustand';
import type { Chapter } from '../types';

interface ChapterState {
  chapters: Chapter[];
  currentChapter: number | null;
  addChapter: (chapter: Chapter) => void;
  updateChapter: (number: number, updates: Partial<Chapter>) => void;
  deleteChapter: (number: number) => void;
  setCurrentChapter: (number: number | null) => void;
}

export const useChapterStore = create<ChapterState>((set) => ({
  chapters: [
    {
      number: 1,
      name: '第1章：抵达老宅',
      description: '主角抵达废弃老宅，开始探索',
    },
    {
      number: 2,
      name: '第2章：初步发现',
      description: '发现一些奇怪的线索',
    },
    {
      number: 3,
      name: '第3章：深入调查',
      description: '揭开更多秘密',
    },
    {
      number: 4,
      name: '第4章：真相浮现',
      description: '所有线索汇聚，揭示真相',
    },
  ],
  currentChapter: null,
  addChapter: (chapter) =>
    set((state) => ({
      chapters: [...state.chapters, chapter],
    })),
  updateChapter: (chapterNumber, updates) =>
    set((state) => ({
      chapters: state.chapters.map((chapter) =>
        chapter.number === chapterNumber ? { ...chapter, ...updates } : chapter
      ),
    })),
  deleteChapter: (chapterNumber) =>
    set((state) => ({
      chapters: state.chapters.filter((chapter) => chapter.number !== chapterNumber),
      currentChapter: state.currentChapter === chapterNumber ? null : state.currentChapter,
    })),
  setCurrentChapter: (number) =>
    set(() => ({
      currentChapter: number,
    })),
}));
