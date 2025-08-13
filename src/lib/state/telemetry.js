import { createStore } from './store.js';
import { readLocal, writeLocal } from '../util/storage.js';

const DEFAULT = {
  startedAt: 0,
  lastStart: 0,
  responseTimes: [], // ms per answered item
  byLabel: { bullish:{attempts:0,correct:0}, bearish:{attempts:0,correct:0}, neutral:{attempts:0,correct:0} },
  byPattern: {}, // pattern_hint -> { seen:0, correct:0 }
  genIssues: 0,
};

const persisted = readLocal('ta:telemetry') || DEFAULT;
export const useTelemetry = createStore(persisted);
useTelemetry.subscribe((s)=> writeLocal('ta:telemetry', s));

let lastStartedItemId = null;
export function markQuestionShown(itemId){
  if (!itemId || itemId === lastStartedItemId) return;
  lastStartedItemId = itemId;
  const t = useTelemetry.get();
  const now = Date.now();
  useTelemetry.set({ startedAt: t.startedAt || now, lastStart: now });
}

export function markAnswered({ label, correct, pattern }){
  const t = useTelemetry.get();
  const now = Date.now();
  const rt = t.lastStart ? (now - t.lastStart) : 0;
  const responseTimes = [...t.responseTimes, rt].slice(-100);
  const byLabel = { ...t.byLabel };
  if (label && byLabel[label]){
    byLabel[label] = { attempts: byLabel[label].attempts+1, correct: byLabel[label].correct + (correct?1:0) };
  }
  const byPattern = { ...t.byPattern };
  if (pattern){
    const prev = byPattern[pattern] || { seen:0, correct:0 };
    byPattern[pattern] = { seen: prev.seen + 1, correct: prev.correct + (correct?1:0) };
  }
  useTelemetry.set({ responseTimes, byLabel, byPattern });
}

export function bumpGenIssue(){
  const t = useTelemetry.get();
  useTelemetry.set({ genIssues: (t.genIssues||0) + 1 });
}
