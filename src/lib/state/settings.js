import { createStore } from './store.js';
import { writeLocal, readLocal } from '../util/storage.js';

const defaults = { candles: 3, difficulty: 'Medium', highContrast: false, useLocalOnFail: true };
const persisted = readLocal('ta:settings') || defaults;

export const useSettings = createStore(persisted);
useSettings.subscribe((s)=> writeLocal('ta:settings', s));
