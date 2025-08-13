import { createStore } from './store.js';
import { writeLocal, readLocal } from '../util/storage.js';

const persisted = readLocal('ta:session') || { score: 0, streak: 0, bestStreak: 0, attempts: 0 };

export const useSession = createStore(persisted);

useSession.subscribe((s)=>{
  writeLocal('ta:session', s);
});

useSession.reset = ()=>{
  useSession.set({ score:0, streak:0, bestStreak:0, attempts:0 });
};
