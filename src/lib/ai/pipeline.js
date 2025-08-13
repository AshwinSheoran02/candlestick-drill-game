import { requestGeminiItem } from './gemini.js';
import { validateAndFix } from '../rules/validate.js';
import { localGenerate } from './synth.js';
import { useSettings } from '../state/settings.js';
import { useQueue } from '../state/queue.js';
import { useCurrent } from '../state/current.js';
import { getRecentPatterns, pushPattern } from '../util/seen.js';
import { bumpGenIssue } from '../state/telemetry.js';
import { notify } from '../state/notify.js';

export async function fetchItem(){
  const s = useSettings.get();
  const params = { bars: s.candles, horizon: s.horizon, difficulty: s.difficulty, avoid: getRecentPatterns().slice(0,3) };
  let err;
  for (let attempt=0; attempt<3; attempt++){
    try {
      const raw = await requestGeminiItem(params);
      console.log('[pipeline] Gemini raw:', raw);
      const item = validateAndFix(raw, s);
      console.log('[pipeline] After validateAndFix:', item);
      pushPattern(item.pattern_hint);
      return item;
    } catch(e){
      err = e;
      if (String(e?.message||'').includes('INVALID_JSON')) bumpGenIssue();
      await new Promise(r=> setTimeout(r, (2**attempt)*300));
    }
  }
  if (s.useLocalOnFail) {
  if (err && /GEMINI_HTTP_503|UNAVAILABLE|overloaded/i.test(String(err))) {
    notify('Model is overloaded. Using local generator.', 'info', 3000);
  } else if (err) {
    notify('Gemini failed. Using local generator.', 'info', 3000);
  }
  const item = validateAndFix(localGenerate(s), s);
  pushPattern(item.pattern_hint);
    return item;
  }
  throw err || new Error('GENERATION_FAILED');
}

export async function fetchNextItemEnsured(){
  // prevent concurrent or runaway prefetch
  if (prefetching) return;
  const q = useQueue.get();
  const hasCur = !!useCurrent.get().item;
  if (hasCur && q.items.length >= 2) return;
  prefetching = true;
  try{
    const item = await fetchItem();
    if (!useCurrent.get().item) {
      // defer state set to next microtask to avoid immediate re-entrancy in render
      console.log('[pipeline] Setting useCurrent item:', item);
      queueMicrotask(()=> useCurrent.set({ item }));
    } else {
      const qi = useQueue.get().items;
      console.log('[pipeline] Setting useQueue item:', item);
      queueMicrotask(()=> useQueue.set({ items: [...qi, item] }));
    }
  }catch(e){
    console.error(e);
  } finally {
    prefetching = false;
  }
}

let prefetching = false;
