export function buildPrompt({ bars, difficulty, avoid=[] }){
  const system = `You generate strict JSON (no prose) for 2–5 OHLC candlesticks normalized to 0–100, depicting a clear textbook candlestick setup. Include a context summary, a concise teaching rationale (2–4 bullets), and the intended label (bullish, bearish, or neutral).\n\nSTRICT FORMAT: Output a single JSON OBJECT (not array), with only these keys: id, context:{trend, vol, gap}, candles:[{o,h,l,c}], pattern_hint, label, rationale, seed.\nCandles must use o/h/l/c keys only (not open/high/low/close). No extra fields, no arrays at the top level, no dates, no timestamps, no prose, no markdown, no code fences.`;
  const user = `Bars: ${bars}\nDifficulty: ${difficulty}\nTarget distribution: avoid repeating the last 3 patterns; avoid: ${avoid.join(', ') || 'None'}\nEnforce geometry rules and believable ratios; include pattern_hint when applicable; include seed.`;
  return `${system}\n\n${user}`;
}
