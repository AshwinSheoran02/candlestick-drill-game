import { TAItemSchema } from '../ai/schema.js';
import { detectPatterns, patternsSuggestDirection } from './patterns.js';

export function validateAndFix(raw, settings){
  // Fill common omissions from LLMs
  if (!raw.id) raw.id = 'ai-'+(raw.seed ?? Math.floor(Math.random()*1e9));
  if (!raw.context || typeof raw.context !== 'object'){
    raw.context = { trend: 'side', vol: 'med', gap: false };
  }
  // 1) Schema validation (lightweight)
  requireProps(raw, TAItemSchema.required);
  denyAdditional(raw, TAItemSchema.properties);
  // 2) Geometry validation
  if (!Array.isArray(raw.candles) || raw.candles.length<2 || raw.candles.length>5) throw new Error('BAD_CANDLES_COUNT');
  for(const k of raw.candles){
    if (!(k.l <= Math.min(k.o,k.c))) throw new Error('GEOM_LOW');
    if (!(k.h >= Math.max(k.o,k.c))) throw new Error('GEOM_HIGH');
    if (!(k.h >= k.l)) throw new Error('GEOM_RANGE');
    // normalize check 0..100, allow small epsilon
    for (const f of ['o','h','l','c']){
      if (typeof k[f] !== 'number') throw new Error('BAD_TYPE');
      if (k[f] < -0.001 || k[f] > 100.001) {
        // renormalize all candles if any out of bounds
        return renormalize(raw);
      }
    }
  }
  // 3) No bar-count clamping; honor requested candles upstream
  // 4) Pattern sanity quick check (set ambiguous)
  const amb = detectAmbiguity(raw);
  if (amb) { raw.label = 'neutral'; raw._ambiguous = true; }

  // additional cross-check: if detected patterns strongly point opposite of label, downgrade to neutral
  try{
    const pats = detectPatterns(raw.candles, raw.context);
    const dir = patternsSuggestDirection(pats);
    if (dir !== 'neutral' && raw.label !== 'neutral' && dir !== raw.label){
      raw.label = 'neutral'; raw._ambiguous = true;
    }
  }catch{}

  return raw;
}

function requireProps(obj, req){
  for(const k of req){ if (!(k in obj)) throw new Error('MISSING_'+k); }
}
function denyAdditional(obj, props){
  // Be tolerant: only enforce for critical substructures already coerced; ignore unknown top-level keys instead of throwing.
  for (const k of Object.keys(obj)){
    if (!props[k] && !['context','_ambiguous'].includes(k)) {
      // drop unknown keys rather than erroring
      delete obj[k];
    }
  }
}
function renormalize(raw){
  const all = raw.candles.flatMap(c=>[c.o,c.h,c.l,c.c]);
  const min = Math.min(...all), max = Math.max(...all), span = (max-min)||1;
  raw.candles = raw.candles.map(c=>({ o: ((c.o-min)/span)*100, h: ((c.h-min)/span)*100, l: ((c.l-min)/span)*100, c: ((c.c-min)/span)*100 }));
  return raw;
}

function detectAmbiguity(item){
  // minimal heuristic: if last candle has near-zero range but pattern_hint is not Doji and label is directional, mark ambiguous
  const k = item.candles[item.candles.length-1];
  const range = Math.max(1e-6, k.h - k.l);
  const body = Math.abs(k.c - k.o);
  const isDojiLike = body <= 0.1*range;
  const hintedDoji = item.pattern_hint === 'Doji';
  if (isDojiLike && !hintedDoji && item.label !== 'neutral') return true;
  return false;
}
