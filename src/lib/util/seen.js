// Track last 10 seen pattern_hint values to avoid repeats in prompts
import { readLocal, writeLocal } from './storage.js';

const KEY = 'ta:seen:recent';

export function getRecentPatterns(){
  const arr = readLocal(KEY);
  return Array.isArray(arr) ? arr : [];
}

export function pushPattern(p){
  if (!p) return;
  const arr = getRecentPatterns();
  // move to front, unique
  const next = [p, ...arr.filter(x=>x!==p)].slice(0,10);
  writeLocal(KEY, next);
}
