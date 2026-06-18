import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Connection } from '../types';

interface ConnectionState {
  connections: Connection[];
  selectedConnectionId: string | null;
  creatingConnection: {
    sourceId: string | null;
    mousePos: { x: number; y: number } | null;
  };
  addConnection: (connection: Omit<Connection, 'id' | 'createdAt'>) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  deleteConnection: (id: string) => void;
  selectConnection: (id: string | null) => void;
  startCreatingConnection: (sourceId: string) => void;
  updateCreatingConnectionPos: (pos: { x: number; y: number }) => void;
  cancelCreatingConnection: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connections: [],
  selectedConnectionId: null,
  creatingConnection: {
    sourceId: null,
    mousePos: null,
  },
  addConnection: (connection) =>
    set((state) => ({
      connections: [
        ...state.connections,
        {
          ...connection,
          id: uuidv4(),
          createdAt: new Date(),
        },
      ],
    })),
  updateConnection: (id, updates) =>
    set((state) => ({
      connections: state.connections.map((conn) =>
        conn.id === id ? { ...conn, ...updates } : conn
      ),
    })),
  deleteConnection: (id) =>
    set((state) => ({
      connections: state.connections.filter((conn) => conn.id !== id),
      selectedConnectionId: state.selectedConnectionId === id ? null : state.selectedConnectionId,
    })),
  selectConnection: (id) =>
    set(() => ({
      selectedConnectionId: id,
    })),
  startCreatingConnection: (sourceId) =>
    set(() => ({
      creatingConnection: {
        sourceId,
        mousePos: null,
      },
    })),
  updateCreatingConnectionPos: (pos) =>
    set((state) => ({
      creatingConnection: {
        ...state.creatingConnection,
        mousePos: pos,
      },
    })),
  cancelCreatingConnection: () =>
    set(() => ({
      creatingConnection: {
        sourceId: null,
        mousePos: null,
      },
    })),
}));
