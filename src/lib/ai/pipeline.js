import { requestGeminiItem } from './gemini.js';
import { validateAndFix } from '../rules/validate.js';
import { localGenerate, localGenerateForPattern, easyPatterns, mediumPatterns, hardPatterns } from './synth.js';
import { useSettings } from '../state/settings.js';
import { useQueue } from '../state/queue.js';
import { useCurrent } from '../state/current.js';
import { getRecentPatterns, pushPattern } from '../util/seen.js';
import { bumpGenIssue, markItemServed, bumpValidationDiscard, bumpDuplicateDropped, setOffline } from '../state/telemetry.js';
import { notify } from '../state/notify.js';
import { readLocal, writeLocal } from '../util/storage.js';

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
  // In hybrid mode we manage queues ourselves.
  if (HYBRID.active) return;
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

// ---------------- HYBRID MODE (Local-first + Batched Gemini) ----------------

const HY_KEY = 'ta:hybrid:session';
const LOCAL_VARIANTS = 50; // per-pattern variant space to avoid repeats
const HYBRID = {
  active: false,
  geminiQueued: [],
  localQueued: [],
  batchFired: false,
  sessionHash: '',
  variantOrders: {}, // pattern -> shuffled [0..LOCAL_VARIANTS-1]
  variantCursor: {}, // pattern -> next index into order
  usedLocalKeys: [], // persisted as array; rehydrated to Set on resume
  patternOrder: [],
  patternCursor: 0,
};

function makeSessionHash(s){
  return `d=${s.difficulty}|c=${s.candles}|h=${s.horizon}`;
}

export function startHybridSession(){
  const s = useSettings.get();
  const hash = makeSessionHash(s);
  const prev = readLocal(HY_KEY);
  if (prev?.sessionHash === hash && prev?.geminiQueued && prev?.localQueued){
    // resume existing
  Object.assign(HYBRID, prev, { active: true });
  // rehydrate runtime-only
  HYBRID.usedLocalKeys = new Set(Array.isArray(prev.usedLocalKeys)? prev.usedLocalKeys : []);
  } else {
    HYBRID.active = true;
    HYBRID.sessionHash = hash;
    HYBRID.geminiQueued = [];
    HYBRID.localQueued = [];
  HYBRID.batchFired = false;
  HYBRID.variantOrders = {};
  HYBRID.variantCursor = {};
  HYBRID.usedLocalKeys = new Set();
  HYBRID.patternOrder = [];
  HYBRID.patternCursor = 0;
    // Seed 5 local Easy items (2–3 candles preferred) using deterministic variants to avoid repeats
    const seedSettings = { ...s, difficulty: 'Easy', candles: Math.min(3, Math.max(2, s.candles|0)) };
    while (HYBRID.localQueued.length < 5){
      const item = getNextLocalItem(seedSettings, easyPatterns);
      if (!item) break;
      HYBRID.localQueued.push(item);
    }
    persistHybrid();
    // Fire a single Gemini batch in parallel
    fireGeminiBatch().catch(()=>{/* handled in notify */});
  }
  // Set current item immediately if not set
  if (!useCurrent.get().item){
  const next = HYBRID.localQueued.shift() || HYBRID.geminiQueued.shift();
  if (next){ useCurrent.set({ item: next, choice: null }); markItemServed(next.source); }
  }
}

function persistHybrid(){
  const usedLocalKeys = Array.isArray(HYBRID.usedLocalKeys) ? HYBRID.usedLocalKeys : Array.from(HYBRID.usedLocalKeys || []);
  writeLocal(HY_KEY, {
    sessionHash: HYBRID.sessionHash,
    geminiQueued: HYBRID.geminiQueued,
    localQueued: HYBRID.localQueued,
    batchFired: HYBRID.batchFired,
    variantOrders: HYBRID.variantOrders,
    variantCursor: HYBRID.variantCursor,
    usedLocalKeys,
    patternOrder: HYBRID.patternOrder,
    patternCursor: HYBRID.patternCursor,
  });
}

async function fireGeminiBatch(){
  if (HYBRID.batchFired) return;
  HYBRID.batchFired = true;
  const s = useSettings.get();
  try{
    const batch = await requestGeminiBatch({ bars: s.candles, horizon: s.horizon, difficulty: s.difficulty, avoid: getRecentPatterns().slice(0,3), count: 20 });
    // validate/gate each item, drop dups, push to geminiQueued
    for(const raw of batch){
      try{
    const fixed = annotateSource(validateAndFix(raw, s), 'gemini');
        const isDup = isDuplicate(fixed);
    if (isDup){ bumpDuplicateDropped(); continue; }
        pushPattern(fixed.pattern_hint);
        HYBRID.geminiQueued.push(fixed);
      }catch(e){
    bumpGenIssue(); bumpValidationDiscard();
      }
    }
  }catch(e){
  notify('Gemini batch failed. Continuing offline.', 'info', 3000); setOffline(true);
  } finally {
    persistHybrid();
  }
}

function isDuplicate(item){
  // hash by rounded candles + pattern + context
  const key = JSON.stringify({
    c: item.candles.map(k=>({ o: Math.round(k.o), h: Math.round(k.h), l: Math.round(k.l), c: Math.round(k.c) })),
    p: item.pattern_hint,
    x: item.context
  });
  const prev = readLocal('ta:dup:last200') || [];
  if (prev.includes(key)) return true;
  const next = [key, ...prev].slice(0,200);
  writeLocal('ta:dup:last200', next);
  return false;
}

function annotateSource(item, src){ item.source = src; return item; }

export async function getNextHybridItem(){
  // If gemini has items, prefer them; else use local; else synthesize one on the fly
  let next = HYBRID.geminiQueued.shift();
  if (!next) next = HYBRID.localQueued.shift();
  if (!next){
    const s = useSettings.get();
    // When queues empty, synthesize using deterministic pattern variants to avoid repeats within session
    next = getNextLocalItem(s);
    if (!next){
      // as last resort use nondeterministic local
      const item = annotateSource(validateAndFix(localGenerate(s), s), 'local');
      pushPattern(item.pattern_hint);
      next = item;
    }
  }
  persistHybrid();
  if (next) markItemServed(next.source);
  return next;
}

// Batch request: expect an array of 20 TAItem objects
async function requestGeminiBatch(params){
  const GEMINI_API_KEY1 = 'AIzaSyCRTc5G9hPlmuX6lBmT';
    const GEMINI_API_KEY2 = '5J6Vylzi2-32o-8';

  const key = GEMINI_API_KEY1 + GEMINI_API_KEY2;

  const body = buildBatchPrompt(params);
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent' + `?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('GEMINI_HTTP_'+res.status);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('GEMINI_EMPTY');
  const jsonText = extractJson(text);
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error('GEMINI_BATCH_NOT_ARRAY');
  return parsed;
}

function buildBatchPrompt({ bars, horizon, difficulty, avoid=[], count=20 }){
  const prompt = `You generate STRICT JSON array (length ${count}) of TA items for candlestick drills. Each element must be an OBJECT with ONLY these keys: id, horizon, context:{trend, vol, gap}, candles:[{o,h,l,c}], pattern_hint, label, rationale (2-3 short strings), seed. Candles must be 2..5 elements based on request, 0..100 normalized. No prose.

Constraints:
- Use difficulty: ${difficulty}
- Bars per item: 2..${Math.max(2, bars)}
- Horizon: ${horizon}
- Target distribution: ~35% bullish / 35% bearish / 30% neutral
- Avoid repeating any of: ${avoid.join(', ') || '—'} in pattern_hint across items
- Geometry must satisfy OHLC rules; if pattern contradicts label, still output but label should be neutral

Output ONLY JSON array. No markdown.`;
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };
}

function extractJson(t){
  const m = t.match(/```json[\s\S]*?```/i) || t.match(/\[[\s\S]*\]/);
  return m ? m[0].replace(/```json|```/gi,'') : t;
}

function pickFromAllPatterns(difficulty){
  if (difficulty === 'Easy') return easyPatterns[Math.floor(Math.random()*easyPatterns.length)];
  if (difficulty === 'Hard'){
    const all = [...easyPatterns, ...mediumPatterns, ...hardPatterns];
    return all[Math.floor(Math.random()*all.length)];
  }
  const mid = [...easyPatterns, ...mediumPatterns];
  return mid[Math.floor(Math.random()*mid.length)];
}

function shuffleArray(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ensureOrder(pattern){
  if (!HYBRID.variantOrders[pattern]){
    HYBRID.variantOrders[pattern] = shuffleArray([...Array(LOCAL_VARIANTS).keys()]);
    HYBRID.variantCursor[pattern] = 0;
  }
}

function nextVariant(pattern){
  ensureOrder(pattern);
  const order = HYBRID.variantOrders[pattern];
  let cur = HYBRID.variantCursor[pattern] || 0;
  if (cur >= order.length){
    // reshuffle after exhausting to keep variety
    HYBRID.variantOrders[pattern] = shuffleArray(order);
    cur = 0;
  }
  const v = order[cur];
  HYBRID.variantCursor[pattern] = cur + 1;
  return v;
}

function allowedPatternsByDifficulty(difficulty){
  if (difficulty === 'Easy') return easyPatterns.slice();
  if (difficulty === 'Hard') return [...easyPatterns, ...mediumPatterns, ...hardPatterns];
  return [...easyPatterns, ...mediumPatterns];
}

function rotateNextPattern(patterns){
  if (!HYBRID.patternOrder || HYBRID.patternOrder.length === 0){
    HYBRID.patternOrder = shuffleArray(patterns.slice());
    HYBRID.patternCursor = 0;
  }
  const p = HYBRID.patternOrder[HYBRID.patternCursor % HYBRID.patternOrder.length];
  HYBRID.patternCursor = (HYBRID.patternCursor + 1) % HYBRID.patternOrder.length;
  return p;
}

function getNextLocalItem(s, restrictPatterns){
  const patterns = (restrictPatterns && restrictPatterns.length>0) ? restrictPatterns.slice() : allowedPatternsByDifficulty(s.difficulty);
  let tries = 0;
  const maxTries = patterns.length * LOCAL_VARIANTS;
  const usedSet = HYBRID.usedLocalKeys instanceof Set ? HYBRID.usedLocalKeys : new Set(HYBRID.usedLocalKeys || []);
  HYBRID.usedLocalKeys = usedSet;
  while (tries++ < maxTries){
    const pattern = rotateNextPattern(patterns);
    const variant = nextVariant(pattern);
    const key = `${pattern}#${variant}`;
    if (usedSet.has(key)) continue;
    try{
      const candidate = annotateSource(validateAndFix(localGenerateForPattern(s, pattern, variant), s), 'local');
      if (isDuplicate(candidate)) { bumpDuplicateDropped(); continue; }
      pushPattern(candidate.pattern_hint);
      usedSet.add(key);
      return candidate;
    }catch(e){
      bumpValidationDiscard();
      continue;
    }
  }
  return null;
}
