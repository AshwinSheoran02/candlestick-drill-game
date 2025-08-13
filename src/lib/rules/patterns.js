// Pattern checks with ±10% tolerance per spec

function metrics(k){
  const body = Math.abs(k.c - k.o);
  const range = Math.max(1e-6, k.h - k.l);
  const upper = k.h - Math.max(k.o, k.c);
  const lower = Math.min(k.o, k.c) - k.l;
  const green = k.c >= k.o;
  const red = !green;
  return { body, range, upper, lower, green, red };
}

function tol(v, t=0.1){ return v * (1 + t); }
function ge(a, b, t=0.1){ return a >= b * (1 - t); }
function le(a, b, t=0.1){ return a <= b * (1 + t); }

export function detectPatterns(candles, context={}){
  const out = new Set();
  const n = candles.length;
  if (n < 2) return Array.from(out);
  const k1 = candles[n-2];
  const k2 = candles[n-1];
  const m1 = metrics(k1); const m2 = metrics(k2);

  // Doji
  if (le(m2.body, 0.10*m2.range)) out.add('Doji');

  // Hammer / Hanging Man
  const closeNearTop = le(k2.h - Math.max(k2.o, k2.c), 0.25*m2.range);
  const closeNearBottom = le(Math.min(k2.o, k2.c) - k2.l, 0.25*m2.range);
  if (ge(m2.lower, 2*m2.body) && le(m2.upper, 0.25*m2.body) && closeNearTop) {
    if (context?.trend === 'down') out.add('Hammer');
    if (context?.trend === 'up') out.add('Hanging Man');
  }

  // Shooting Star
  if (ge(m2.upper, 2*m2.body) && le(m2.lower, 0.25*m2.body) && closeNearBottom) {
    out.add('Shooting Star');
  }

  // Two-candle patterns
  // Engulfing
  const body1 = m1.body, body2 = m2.body;
  const isBullEngulf = m1.red && m2.green && ge(body2, 1.1*body1) && (k2.o <= k1.c + tol(0)) && (k2.c >= k1.o - tol(0));
  const isBearEngulf = m1.green && m2.red && ge(body2, 1.1*body1) && (k2.o >= k1.c - tol(0)) && (k2.c <= k1.o + tol(0));
  if (isBullEngulf) out.add('Bullish Engulfing');
  if (isBearEngulf) out.add('Bearish Engulfing');

  // Harami (inside)
  const within = (x) => (Math.min(k1.o, k1.c) <= x && x <= Math.max(k1.o, k1.c));
  const small2 = le(body2, 0.6*body1);
  if (m1.red && m2.green && small2 && within(k2.o) && within(k2.c)) out.add('Bullish Harami');
  if (m1.green && m2.red && small2 && within(k2.o) && within(k2.c)) out.add('Bearish Harami');

  // Piercing Line / Dark Cloud Cover
  const mid1 = (k1.o + k1.c)/2;
  const gapDown = k2.o < k1.l; // approximation
  const gapUp = k2.o > k1.h;
  if (m1.red && gapDown && (k2.c > mid1) && (k2.c < k1.o)) out.add('Piercing Line');
  if (m1.green && gapUp && (k2.c < mid1) && (k2.c > k1.o)) out.add('Dark Cloud Cover');

  // Three-candle patterns
  if (n >= 3){
    const a = candles[n-3], b = k1, c = k2;
    const ma = metrics(a), mb = m1, mc = m2;
    const big = (m)=> ge(m.body, 0.6*(m.range));
    const small = (m)=> le(m.body, 0.25*(m.range));
    const aMid = (a.o + a.c)/2;

    // Morning Star: big red → small gap down → big green closing ≥ midpoint of candle1
    if (ma.red && big(ma) && small(mb) && (b.o < Math.min(a.c, a.l)) && m2.green && big(mc) && (c.c >= aMid)) out.add('Morning Star');
    // Evening Star: mirror
    if (ma.green && big(ma) && small(mb) && (b.o > Math.max(a.c, a.h)) && m2.red && big(mc) && (c.c <= aMid)) out.add('Evening Star');
  }

  return Array.from(out);
}

export function patternsSuggestDirection(patterns){
  const bull = new Set(['Bullish Engulfing','Bullish Harami','Piercing Line','Morning Star','Hammer']);
  const bear = new Set(['Bearish Engulfing','Bearish Harami','Dark Cloud Cover','Evening Star','Hanging Man','Shooting Star']);
  let b=0, s=0;
  for(const p of patterns){ if (bull.has(p)) b++; if (bear.has(p)) s++; }
  if (b>0 && s===0) return 'bullish';
  if (s>0 && b===0) return 'bearish';
  return 'neutral';
}
