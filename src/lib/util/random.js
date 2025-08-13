export function rand(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
export function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
export function seeded(seed){ let s = seed>>>0; return function(){ s = (1664525*s + 1013904223)>>>0; return (s>>>0)/0xffffffff; }; }
export function normalizeSeries(candles){
  let minL = Infinity, maxH = -Infinity;
  for(const c of candles){ minL = Math.min(minL, c.l, c.o, c.c); maxH = Math.max(maxH, c.h, c.o, c.c); }
  const span = maxH - minL || 1;
  const norm = candles.map(k=>({
    o: ((k.o - minL)/span)*100,
    h: ((k.h - minL)/span)*100,
    l: ((k.l - minL)/span)*100,
    c: ((k.c - minL)/span)*100,
    v: k.v
  }));
  return [norm, minL, maxH];
}
