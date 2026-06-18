import { create } from 'zustand';
import type { Card, Connection, Chapter, AppState } from '../types';
import { useCardStore } from './useCardStore';
import { useConnectionStore } from './useConnectionStore';
import { useChapterStore } from './useChapterStore';

interface AppStoreState {
  cards: Card[];
  connections: Connection[];
  chapters: Chapter[];
  selectedCardId: string | null;
  selectedConnectionId: string | null;
  currentChapter: number | null;
  isLoading: boolean;
  isSaving: boolean;
  initialize: () => Promise<void>;
  exportProject: () => Promise<string>;
  importProject: () => Promise<void>;
  saveState: () => Promise<void>;
}

const parseDateFields = (data: any): AppState => {
  return {
    ...data,
    cards: (data.cards || []).map((card: Card) => ({
      ...card,
      createdAt: new Date(card.createdAt),
      updatedAt: new Date(card.updatedAt),
    })),
    connections: (data.connections || []).map((conn: Connection) => ({
      ...conn,
      createdAt: new Date(conn.createdAt),
    })),
    chapters: data.chapters || [],
    selectedCardId: data.selectedCardId || null,
    selectedConnectionId: data.selectedConnectionId || null,
    currentChapter: data.currentChapter || null,
  };
};

const getCurrentState = (): AppState => {
  const cardState = useCardStore.getState();
  const connectionState = useConnectionStore.getState();
  const chapterState = useChapterStore.getState();

  return {
    cards: cardState.cards,
    connections: connectionState.connections,
    chapters: chapterState.chapters,
    selectedCardId: cardState.selectedCardId,
    selectedConnectionId: connectionState.selectedConnectionId,
    currentChapter: chapterState.currentChapter,
  };
};

const applyState = (state: AppState) => {
  useCardStore.setState({
    cards: state.cards,
    selectedCardId: state.selectedCardId,
  });
  useConnectionStore.setState({
    connections: state.connections,
    selectedConnectionId: state.selectedConnectionId,
  });
  useChapterStore.setState({
    chapters: state.chapters,
    currentChapter: state.currentChapter,
  });
};

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const debouncedSave = async () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const state = getCurrentState();
      try {
        await window.electronAPI.saveData(state);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }
  }, 500);
};

const syncAppState = (set: any) => {
  const currentState = getCurrentState();
  set({
    cards: currentState.cards,
    connections: currentState.connections,
    chapters: currentState.chapters,
    selectedCardId: currentState.selectedCardId,
    selectedConnectionId: currentState.selectedConnectionId,
    currentChapter: currentState.currentChapter,
  });
};

export const useAppStore = create<AppStoreState>((set, get) => ({
  cards: [],
  connections: [],
  chapters: [],
  selectedCardId: null,
  selectedConnectionId: null,
  currentChapter: null,
  isLoading: false,
  isSaving: false,

  initialize: async () => {
    if (get().isLoading) return;

    set({ isLoading: true });

    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const savedData = await window.electronAPI.loadData();
        if (savedData) {
          const parsedState = parseDateFields(savedData);
          applyState(parsedState);
          syncAppState(set);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      set({ isLoading: false });
    }

    useCardStore.subscribe(() => {
      syncAppState(set);
      debouncedSave();
    });

    useConnectionStore.subscribe(() => {
      syncAppState(set);
      debouncedSave();
    });

    useChapterStore.subscribe(() => {
      syncAppState(set);
      debouncedSave();
    });
  },

  saveState: async () => {
    if (get().isSaving) return;

    set({ isSaving: true });

    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const state = getCurrentState();
        await window.electronAPI.saveData(state);
      }
    } catch (error) {
      console.error('Failed to save data:', error);
    } finally {
      set({ isSaving: false });
    }
  },

  exportProject: async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.exportProject('json');
      }
      return JSON.stringify(getCurrentState(), null, 2);
    } catch (error) {
      console.error('Failed to export project:', error);
      throw error;
    }
  },

  importProject: async () => {
    if (get().isLoading) return;

    set({ isLoading: true });

    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const importedData = await window.electronAPI.importProject();
        if (importedData) {
          const parsedState = parseDateFields(importedData);
          applyState(parsedState);
          syncAppState(set);
        }
      }
    } catch (error) {
      console.error('Failed to import project:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));
