Hybrid Generation Mode (Local-first + Batched Gemini)
Overview
Goal: Zero-wait start + AI variety.

Behavior: The first 5 items are locally generated at Easy difficulty, then a single batched Gemini request (20 items) fills the queue for instant subsequent drills.

Constraint: Frontend-only; all validation and storage in the browser.

Session Timeline
Session Start

Immediately generate 5 local items (Easy, 2–3 candles preferred).

Render Item #1 instantly.

In parallel, fire one Gemini batch request for 20 items matching the current UI settings (candles 2–5, horizon 1|3, difficulty from UI).

After Each Reveal

If GeminiQueue.size ≥ 1 → next item = dequeue from GeminiQueue.

Else → next item = dequeue from LocalQueue (or generate local if empty).

Queue Exhaustion

If both queues empty (unlikely) → generate a single local item on the fly (same UI settings), do not block UI.

No Additional Batch Calls

Only one batch of 20 per session unless the user changes Difficulty or Candles—then start a new session (reset queues, repeat step 1).

Queues & State
LocalQueue (Array<TAItem>): seeded with 5 Easy local items at start.

GeminiQueue (Array<TAItem>): filled by the single Gemini batch (20 items).

CurrentItem: the item shown to the user.

Provenance: each item carries source: "local" | "gemini" for telemetry and QA.

Difficulty & Item Mix
Local first 5: force Easy difficulty and 2–3 candles for clarity.

Gemini 20: use UI-selected difficulty and candles (2–5); request a mix:

Target class distribution: ≈35% bullish / 35% bearish / 30% neutral.

Avoid repeating the last 3 pattern_hints (use a short “seen” cache).

Validator is authoritative: If a Gemini item fails ratio checks or contradicts its label, downgrade to neutral.

Gemini Batch Request (Spec)
Count: 20 items in one response (array of TAItem).

Format: strict JSON only; set responseMimeType: "application/json".

Fields per item: id, horizon, context, candles[2..5], pattern_hint, label, rationale[2..3], seed.

Geometry constraints: per Rules.md (OHLC validity; 0–100 normalization).

Prompt constraints: ask for varied patterns, plausible ratios, and include seed.

Validation & Gating (Client)
Run for both Local and Gemini items before enqueue:

Schema check (reject extras/missing fields).

OHLC geometry (l ≤ min(o,c), h ≥ max(o,c), h ≥ l).

Pattern sanity (±10% tolerance on ratios). If conflicting with label ⇒ set label="neutral".

Deduplication: Hash (rounded candles + pattern_hint + context); drop if in last 50 seen.

Reveal Rules (unchanged)
Scoring: +1 for correct; 0 for incorrect.

Streak: breaks only on a wrong directional guess; neutral misses never break streak.

Teaching: show pattern_hint (if any) + 2–3 bullets (rationale).

Settings (additions)
Generation Mode: locked to Hybrid (5 Local + 20 Gemini) for MVP.

Batch Size: fixed at 20 for MVP.

Local Seed Count: fixed at 5 Easy.

Fallback: if Gemini batch fails, continue using Local items only; show a tiny “Offline AI” pill.

Telemetry (local only)
items.local.count, items.gemini.count

accuracy.local, accuracy.gemini

validation.discards (Gemini invalid JSON / geometry / ratio fails)

duplicates.dropped

Acceptance Criteria (Hybrid)
On Start, an item appears instantly (from LocalQueue).

Exactly 5 local items are generated at session start; exactly 1 Gemini batch (20 items) is requested in parallel.

After the first few reveals, items are served from GeminiQueue without visible delay.

If Gemini fails, drills continue seamlessly from LocalQueue with no spinners.

All items pass geometry validation; contradictory patterns are auto-neutraled.

Streak/score behave per neutral/dir rules; stats show separate local vs gemini accuracy.