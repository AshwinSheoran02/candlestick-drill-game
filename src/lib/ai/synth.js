// Local fallback generator: create a plausible TA item per settings
import { rand, seeded, clamp, normalizeSeries } from '../util/random.js';

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

export function localGenerate(s){
  const bars = Math.max(2, Math.min(5, s.candles|0));
  const horizon = s.horizon===1?1:3;
  const difficulty = s.difficulty || 'Medium';
  const seed = Math.floor(Math.random()*1e9);
  const R = seeded(seed);

  // choose pattern by difficulty
  const easy = ['Bullish Engulfing','Bearish Engulfing','Bullish Harami','Bearish Harami','Piercing Line','Dark Cloud Cover'];
  const medium = ['Morning Star','Evening Star','Doji'];
  const hard = ['Hammer','Hanging Man','Shooting Star'];
  const pool = difficulty==='Easy'? easy : difficulty==='Hard' ? [...easy,...medium,...hard] : [...easy,...medium];
  const pattern = pick(pool);

  // create rough series 0..100 baseline with trend context
  const trend = pick(['up','down','side']);
  const vol = pick(['low','med','high']);
  const gap = R()<0.3;
  const candles = buildPattern(pattern, bars, { trend, R, gap });
  const [norm] = normalizeSeries(candles);

  // derive label from pattern
  const bullishPatterns = ['Bullish Engulfing','Bullish Harami','Piercing Line','Morning Star','Hammer'];
  const bearishPatterns = ['Bearish Engulfing','Bearish Harami','Dark Cloud Cover','Evening Star','Hanging Man','Shooting Star'];
  let label = bullishPatterns.includes(pattern)? 'bullish' : bearishPatterns.includes(pattern)? 'bearish' : 'neutral';

  const rationale = [
    `Context ${trend} with ${vol} volume`,
    `Ratios align with ${pattern}`,
    `Bars normalized to 0–100`
  ].slice(0, rand(2,4));

  return { id: 'local-'+seed, horizon, context: { trend, vol, gap }, candles: norm, pattern_hint: pattern, label, rationale, seed };
}

function buildPattern(pattern, bars, { trend, R, gap }){
  // simple synthetic construction with OHLC geometry
  const base = 50; let level = base + (trend==='up'? -10: trend==='down'? 10: 0);
  const arr = [];
  function add(o,h,l,c){ arr.push({o,h,l,c}); }
  function upBar(size=6){ const o=level; const c=level+size; const h=c+size*0.3; const l=o-size*0.3; level=c; add(o,h,l,c);} 
  function dnBar(size=6){ const o=level; const c=level-size; const h=o+size*0.3; const l=c-size*0.3; level=c; add(o,h,l,c);} 
  function smallDoji(){ const o=level; const c=level+ (R()<0.5?1:-1)*0.5; const h=Math.max(o,c)+2; const l=Math.min(o,c)-2; add(o,h,l,c);} 

  // context bars
  const ctxBars = Math.max(0, Math.min(2, bars-2));
  for(let i=0;i<ctxBars;i++) trend==='up'? upBar(5): trend==='down'? dnBar(5): (R()<0.5? upBar(3): dnBar(3));

  // pattern core (last 1-3 bars)
  switch(pattern){
    case 'Bullish Engulfing': dnBar(7); upBar(10); break;
    case 'Bearish Engulfing': upBar(7); dnBar(10); break;
    case 'Bullish Harami': dnBar(10); { const o=level-1; const c=level+1; const h=Math.max(o,c)+2; const l=Math.min(o,c)-2; add(o,h,l,c);} break;
    case 'Bearish Harami': upBar(10); { const o=level+1; const c=level-1; const h=Math.max(o,c)+2; const l=Math.min(o,c)-2; add(o,h,l,c);} break;
    case 'Piercing Line': dnBar(10); { const o=level-4; const c=level+6; const h=Math.max(o,c)+2; const l=Math.min(level-10,o)-2; add(o,h,l,c);} break;
    case 'Dark Cloud Cover': upBar(10); { const o=level+4; const c=level-6; const h=Math.max(level+10,o)+2; const l=Math.min(o,c)-2; add(o,h,l,c);} break;
    case 'Morning Star': dnBar(10); smallDoji(); upBar(12); break;
    case 'Evening Star': upBar(10); smallDoji(); dnBar(12); break;
    case 'Doji': smallDoji(); smallDoji(); break;
    case 'Hammer': dnBar(5); { const o=level; const c=level+1; const h=Math.max(o,c)+1; const l=Math.min(o,c)-8; add(o,h,l,c);} break;
    case 'Hanging Man': upBar(5); { const o=level; const c=level-1; const h=Math.max(o,c)+1; const l=Math.min(o,c)-8; add(o,h,l,c);} break;
    case 'Shooting Star': upBar(5); { const o=level; const c=level-1; const h=Math.max(o,c)+8; const l=Math.min(o,c)-1; add(o,h,l,c);} break;
    default: upBar(5); dnBar(5);
  }

  // fill to bars with small noise bars
  while(arr.length < bars){ (R()<0.5? upBar(3): dnBar(3)); }

  // ensure geometry h>=max(o,c) and l<=min(o,c)
  for(const k of arr){
    k.h = Math.max(k.h, k.o, k.c);
    k.l = Math.min(k.l, k.o, k.c);
  }
  return arr;
}
