// Local fallback generator: create a plausible TA item per settings
import { rand, seeded, clamp, normalizeSeries } from '../util/random.js';

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function pickR(R, arr){ return arr[Math.floor(R()*arr.length)] ; }

export function localGenerate(s){
  const bars = Math.max(2, Math.min(5, s.candles|0));
  const horizon = s.horizon===1?1:3;
  const difficulty = s.difficulty || 'Medium';
  const seed = Math.floor(Math.random()*1e9);
  const R = seeded(seed);

  // choose pattern by difficulty
  const easy = ['Bullish Engulfing','Bearish Engulfing','Bullish Harami','Bearish Harami','Piercing Line','Dark Cloud Cover','Marubozu Bull','Marubozu Bear','Belt Hold Bull','Belt Hold Bear'];
  const medium = ['Morning Star','Evening Star','Doji','Harami Cross','Spinning Top','Tweezer Bottom','Tweezer Top','Dragonfly Doji','Gravestone Doji'];
  const hard = ['Hammer','Hanging Man','Shooting Star','Inverted Hammer','Three White Soldiers','Three Black Crows','Rising Three Methods','Falling Three Methods'];
  const pool = difficulty==='Easy'? easy : difficulty==='Hard' ? [...easy,...medium,...hard] : [...easy,...medium];
  const pattern = pick(pool);

  // create rough series 0..100 baseline with trend context
  const trend = pick(['up','down','side']);
  const vol = pick(['low','med','high']);
  const gap = R()<0.2;
  const candles = buildPattern(pattern, bars, { trend, R, gap });
  const [norm] = normalizeSeries(candles);

  // derive label from pattern
  const bullishPatterns = ['Bullish Engulfing','Bullish Harami','Piercing Line','Morning Star','Hammer','Inverted Hammer','Marubozu Bull','Three White Soldiers','Tweezer Bottom','Belt Hold Bull','Rising Three Methods','Dragonfly Doji'];
  const bearishPatterns = ['Bearish Engulfing','Bearish Harami','Dark Cloud Cover','Evening Star','Hanging Man','Shooting Star','Marubozu Bear','Three Black Crows','Tweezer Top','Belt Hold Bear','Falling Three Methods','Gravestone Doji'];
  let label = bullishPatterns.includes(pattern)? 'bullish' : bearishPatterns.includes(pattern)? 'bearish' : 'neutral';

  const rationale = [
    `Context ${trend} with ${vol} volume`,
    `Ratios align with ${pattern}`,
    `Bars normalized to 0–100`
  ].slice(0, rand(2,4));

  return { id: 'local-'+seed, horizon, context: { trend, vol, gap }, candles: norm, pattern_hint: pattern, label, rationale, seed };
}

// Export pattern lists for external coordination
export const easyPatterns = ['Bullish Engulfing','Bearish Engulfing','Bullish Harami','Bearish Harami','Piercing Line','Dark Cloud Cover','Marubozu Bull','Marubozu Bear','Belt Hold Bull','Belt Hold Bear'];
export const mediumPatterns = ['Morning Star','Evening Star','Doji','Harami Cross','Spinning Top','Tweezer Bottom','Tweezer Top','Dragonfly Doji','Gravestone Doji'];
export const hardPatterns = ['Hammer','Hanging Man','Shooting Star','Inverted Hammer','Three White Soldiers','Three Black Crows','Rising Three Methods','Falling Three Methods'];

// Deterministic variant generator for a specific pattern; variantIndex ensures up to 20 unique variants per pattern per session
export function localGenerateForPattern(s, pattern, variantIndex=0){
  const bars = Math.max(2, Math.min(5, s.candles|0));
  const horizon = s.horizon===1?1:3;
  // build a deterministic seed from pattern + variant + requested settings to keep shapes varied but reproducible
  const seed = hashStr(`${pattern}|v=${variantIndex}|b=${bars}|h=${horizon}|d=${s.difficulty||'Medium'}`);
  const R = seeded(seed >>> 0);
  const trend = pickR(R, ['up','down','side']);
  const vol = pickR(R, ['low','med','high']);
  const gap = R()<0.2;
  const candles = buildPattern(pattern, bars, { trend, R, gap });
  const [norm] = normalizeSeries(candles);

  const bullishPatterns = ['Bullish Engulfing','Bullish Harami','Piercing Line','Morning Star','Hammer','Inverted Hammer','Marubozu Bull','Three White Soldiers','Tweezer Bottom','Belt Hold Bull','Rising Three Methods','Dragonfly Doji'];
  const bearishPatterns = ['Bearish Engulfing','Bearish Harami','Dark Cloud Cover','Evening Star','Hanging Man','Shooting Star','Marubozu Bear','Three Black Crows','Tweezer Top','Belt Hold Bear','Falling Three Methods','Gravestone Doji'];
  let label = bullishPatterns.includes(pattern)? 'bullish' : bearishPatterns.includes(pattern)? 'bearish' : 'neutral';
  const rationale = [
    `Context ${trend} with ${vol} volume`,
    `Ratios align with ${pattern}`,
    `Bars normalized to 0–100`
  ].slice(0, 2 + Math.floor(R()*2));
  return { id: `local-${pattern}-${variantIndex}-${seed}`, horizon, context: { trend, vol, gap }, candles: norm, pattern_hint: pattern, label, rationale, seed };
}

function hashStr(str){
  // djb2-ish hash
  let h = 5381;
  for (let i=0;i<str.length;i++){
    h = ((h<<5) + h) + str.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

function buildPattern(pattern, bars, { trend, R, gap }){
  // simple synthetic construction with OHLC geometry
  const base = 50 + (R()-0.5)*10; let level = base + (trend==='up'? -10: trend==='down'? 10: 0);
  const arr = [];
  function add(o,h,l,c){ arr.push({o,h,l,c}); }
  function upBar(size=6){ size*= (0.8+R()*0.6); const o=level; const c=level+size; const h=c+size*(0.2+R()*0.3); const l=o-size*(0.2+R()*0.3); level=c; add(o,h,l,c);} 
  function dnBar(size=6){ size*= (0.8+R()*0.6); const o=level; const c=level-size; const h=o+size*(0.2+R()*0.3); const l=c-size*(0.2+R()*0.3); level=c; add(o,h,l,c);} 
  function smallDoji(){ const o=level; const c=level+ (R()<0.5?1:-1)*0.5; const h=Math.max(o,c)+2+R()*1.5; const l=Math.min(o,c)-2-R()*1.5; add(o,h,l,c);} 
  function spinningTop(){ const o=level + (R()-0.5)*1.2; const c=o + (R()-0.5)*1.5; const body=Math.max(0.8, Math.abs(c-o)); const h=Math.max(o,c)+body*2.2; const l=Math.min(o,c)-body*2.2; add(o,h,l,c);} 
  function marubozu(up=true){ const size=8+R()*6; if (up){ const o=level; const c=level+size; const h=c+1; const l=o-1; level=c; add(o,h,l,c);} else { const o=level; const c=level-size; const h=o+1; const l=c-1; level=c; add(o,h,l,c);} }
  function invertedHammer(){ const o=level; const c=level+1; const h=Math.max(o,c)+8; const l=Math.min(o,c)-1; add(o,h,l,c);} 
  function tweezerTop(){ upBar(6); const o=level; const c=level-6; const h=Math.max(o,c)+6; const l=Math.min(o,c)-2; add(o,h,l,c);} 
  function tweezerBottom(){ dnBar(6); const o=level; const c=level+6; const h=Math.max(o,c)+2; const l=Math.min(o,c)-6; add(o,h,l,c);} 
  function dragonfly(){ const o=level; const c=o + (R()-0.5)*0.4; const h=Math.max(o,c)+0.5; const l=Math.min(o,c)-7 - R()*3; add(o,h,l,c);} 
  function gravestone(){ const o=level; const c=o + (R()-0.5)*0.4; const h=Math.max(o,c)+7 + R()*3; const l=Math.min(o,c)-0.5; add(o,h,l,c);} 
  function beltHold(up=true){ if (up){ const size=10+R()*6; const o=level; const l=o-1; const c=o+size; const h=c+3; level=c; add(o,h,l,c);} else { const size=10+R()*6; const o=level; const h=o+1; const c=o-size; const l=c-3; level=c; add(o,h,l,c);} }

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
    case 'Inverted Hammer': dnBar(5); invertedHammer(); break;
    case 'Harami Cross': (R()<0.5? dnBar(8): upBar(8)); smallDoji(); break;
    case 'Spinning Top': spinningTop(); spinningTop(); break;
    case 'Marubozu Bull': marubozu(true); break;
    case 'Marubozu Bear': marubozu(false); break;
    case 'Three White Soldiers': upBar(6); upBar(6); upBar(6); break;
    case 'Three Black Crows': dnBar(6); dnBar(6); dnBar(6); break;
    case 'Tweezer Top': tweezerTop(); break;
    case 'Tweezer Bottom': tweezerBottom(); break;
  case 'Dragonfly Doji': dragonfly(); break;
  case 'Gravestone Doji': gravestone(); break;
  case 'Belt Hold Bull': beltHold(true); break;
  case 'Belt Hold Bear': beltHold(false); break;
  case 'Rising Three Methods': upBar(8); dnBar(2); dnBar(2); dnBar(2); upBar(9); break;
  case 'Falling Three Methods': dnBar(8); upBar(2); upBar(2); upBar(2); dnBar(9); break;
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
