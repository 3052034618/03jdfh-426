import Store from 'electron-store';

export interface AppData {
  cards: any[];
  connections: any[];
  chapters: any[];
}

const store = new Store<AppData>({
  defaults: {
    cards: [],
    connections: [],
    chapters: [],
  },
  name: 'clue-wall-data',
});

export const saveData = (data: Partial<AppData>): void => {
  store.set(data);
};

export const loadData = (): AppData => {
  return store.store;
};

export const exportProject = (): string => {
  const data = store.store;
  return JSON.stringify(data, null, 2);
};

export const importProject = (data: string): AppData => {
  const parsed = JSON.parse(data) as AppData;
  store.set(parsed);
  return parsed;
};

export default store;
