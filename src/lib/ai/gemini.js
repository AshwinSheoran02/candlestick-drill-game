// Minimal Gemini client using fetch. Expects an API key in sessionStorage 'ta:apikey'.
// Uses responseMimeType application/json to encourage strict JSON output per spec.

import { buildPrompt } from './prompt.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function requestGeminiItem(params){
  const key = sessionStorage.getItem('ta:apikey');
  if (!key) throw new Error('MISSING_API_KEY');
  const prompt = buildPrompt(params);
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const url = BASE + `?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const msg = await safeText(res);
    throw new Error('GEMINI_HTTP_'+res.status+': '+msg);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('GEMINI_EMPTY');
  // If the model wraps JSON in code fences, attempt to extract.
  const jsonText = extractJson(text);
  try {
  const parsed = JSON.parse(jsonText);
  const obj = Array.isArray(parsed) ? parsed[0] : parsed; // accept array-wrapped payloads
  return coerceFields(obj);
  } catch(e){
    throw new Error('GEMINI_INVALID_JSON');
  }
}

function extractJson(t){
  const m = t.match(/```json[\s\S]*?```/i) || t.match(/\{[\s\S]*\}/);
  return m ? m[0].replace(/```json|```/gi,'') : t;
}
async function safeText(res){ try{ return await res.text(); }catch{ return ''; } }

function coerceFields(item){
  // Some models return open/high/low/close; map to o/h/l/c. Also drop unknown fields.
  if (Array.isArray(item?.candles)){
    item.candles = item.candles.map(c=>{
      if (c && typeof c === 'object'){
        const o = c.o ?? c.open;
        const h = c.h ?? c.high;
        const l = c.l ?? c.low;
        const cclose = c.c ?? c.close;
        return { o, h, l, c: cclose, v: c.v };
      }
      return c;
    });
  }
  // Context coercion if given as string
  if (item && typeof item.context === 'string'){
    // naive parse hints
    const s = item.context.toLowerCase();
    const trend = /down/.test(s) ? 'down' : /up/.test(s) ? 'up' : 'side';
    const vol = /high/.test(s) ? 'high' : /low/.test(s) ? 'low' : 'med';
    item.context = { trend, vol, gap: /gap/.test(s) };
  }
  if (item && typeof item.context === 'object'){
    // normalize variants like "downtrend" -> "down", gap string -> boolean
    const t = String(item.context.trend||'').toLowerCase();
    const v = String(item.context.vol||'').toLowerCase();
    let g = item.context.gap;
  // Accept 'sideways' as 'side', fallback to 'side' for unknown
  if (/down/.test(t)) item.context.trend = 'down';
  else if (/up/.test(t)) item.context.trend = 'up';
  else if (/side/.test(t)) item.context.trend = 'side';
  else item.context.trend = 'side';
    item.context.vol = v==='high'||v==='low'||v==='med' ? v : (v.includes('high')?'high': v.includes('low')?'low':'med');
    if (typeof g === 'string') g = /true|yes|gap/.test(g.toLowerCase());
    item.context.gap = !!g;
  }
  return item;
}
