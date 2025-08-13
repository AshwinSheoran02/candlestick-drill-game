# Candlestick Drill (Frontend-only)

A responsive SPA that generates 2–5 candle candlestick exercises via Gemini or a local fallback, validates JSON, renders candles on Canvas, and tracks score + streak in the browser.

No backend. Keys are stored in sessionStorage only.

## Quick start

- Open `index.html` in a modern browser, or use a static server.
- Optional: add your Gemini API key in Settings. Otherwise, local generation is used.

## Dev tips

- Files are plain ES modules; no bundler required.
- Tailwind via CDN for convenience.
- All app code lives under `src/`.

## Structure

- `src/app`: app shell and router
- `src/features`: Home/Drill/Reveal/Stats/Settings
- `src/components`: Canvas candlestick chart, answer buttons
- `src/lib/ai`: Gemini client, prompt builder, pipeline, local synth
- `src/lib/rules`: schema, validators, pattern checks
- `src/lib/state`: small stores (zustand-like)
- `src/lib/util`: storage, strings, random, seen pattern tracking

## Notes

- Educational only. Not financial advice.
- Neutral items do not break streak; only directional misses do.
- Works offline with local generator.# candlestick-drill-game
candlestick drill game

## Hybrid Mode (Local-first + Batched Gemini)

- On start: seeds 5 local Easy items (2–3 bars) for instant drills.
- In parallel: fires a single Gemini batch (20 items) using current UI settings; all items are validated and deduped.
- Next item logic: prefer Gemini queue; fallback to Local queue; if both empty, synthesize one on the fly (non-blocking).
- Only one batch per session; changing difficulty/candles triggers a new session and batch.
