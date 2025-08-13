# Rules.md — **AI-Powered Candlestick Drill (Frontend-Only)**

> This document tells Copilot *exactly* what to build: a **responsive, frontend-only** web app that uses **Gemini API** to generate **2–5 candle** candlestick exercises. The app renders the candles from JSON, asks the user to predict **Bullish / Bearish / Not sure**, reveals the answer with micro-lessons, and tracks score + streak locally.
> **No backend. No databases.** All validation, rendering, scoring, and storage happen in the browser.

---

## 0) Non-negotiables (Constraints)

* **Frontend only.** Single-page app (SPA) with client-side routing (or a single route).
* **Device support:** mobile first (360×640), tablets, and desktop; must be fully responsive.
* **Candles per item:** **2–5** (never 1).
* **AI source:** **Gemini API** from the browser.
* **Data path:** Gemini returns **strict JSON** → client **validates** → client **renders**.
* **No trading signals.** Education only. Clear disclaimer.
* **Score & streak:** stored locally; **neutral** items never break streak.
* **Offline/fallback:** if Gemini fails or key absent, app **locally synthesizes** valid items.

---

## 1) Tech Stack

* **Framework:** Javascript
* **Styling:** Tailwind CSS (+ CSS variables for theming).
* **Charts:** Custom Canvas renderer (no heavy chart lib) for precise control and small bundle.
* **Build targets:** modern evergreen browsers and mobile phones through responsiveness
* **PWA:** optional (add later; not required for MVP).

> Do **not** add a backend. Do **not** use server components. Keep bundle < 300 KB gzip if possible.

---

## 2) Pages / Screens

1. **Home / Setup**

   * Controls:

     * **Candles slider**: integer **2–5** (default 3).
     * **Horizon**: radio **1 bar** or **3 bars** (default 3).
     * **Difficulty**: **Easy / Medium / Hard**.
     * **Start** button.
   * **Settings** button (opens modal):

     * **Gemini API key** input (masked), “Save to session”.
     * Toggle **Use local generator if API fails** (default ON).
     * Toggle **High-contrast colors**.
     * **Reset progress** (score/streak).
   * **Disclaimer** text.

2. **Drill**

   * Header: Score, Current Streak (🔥 icon), Best Streak, Difficulty chip.
   * **Candlestick panel** (Canvas) showing generated 2–5 bars.
   * Context chips (if provided by item): `Downtrend • High Vol • Gap-down`.
   * **Answer buttons:** **Bullish**, **Bearish**, **Not sure** (keyboard: B / S / N).
   * Optional timer (visible but not scored).
   * Hidden “Next up” prefetch badge when item+1 is ready.

3. **Reveal**

   * Correct/Incorrect marker.
   * **Ground truth label** and **pattern hint**.
   * **Micro-lesson bullets** (2–4).
   * Overlay showing wick/body ratios for the signal candle (brief highlight).
   * CTA: **Next**.
   * Tiny link: “Why?” → expands to show validation checks that passed.

4. **Stats**

   * Session stats: total answered, accuracy, average response time.
   * **Streaks**: current, best.
   * **Pattern heatmap** (if `pattern_hint` present): correct %, seen count.
   * Reset progress button (confirm).

5. **Errors / Empty**

   * Friendly error card with **Retry** and fallback to **Local generator**.

> All screens must be keyboard navigable and screen-reader friendly.

---

## 3) Data Contract (Gemini → App)

### 3.1 JSON Schema (strict)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TAItem",
  "type": "object",
  "required": ["id", "horizon", "candles", "label", "rationale"],
  "properties": {
    "id": { "type": "string", "minLength": 4, "maxLength": 64 },
    "horizon": { "type": "integer", "enum": [1, 3] },
    "context": {
      "type": "object",
      "required": ["trend", "vol"],
      "properties": {
        "trend": { "type": "string", "enum": ["up", "down", "side"] },
        "vol": { "type": "string", "enum": ["low", "med", "high"] },
        "gap": { "type": "boolean" }
      },
      "additionalProperties": false
    },
    "candles": {
      "type": "array",
      "minItems": 2,
      "maxItems": 5,
      "items": {
        "type": "object",
        "required": ["o", "h", "l", "c"],
        "properties": {
          "o": { "type": "number" },
          "h": { "type": "number" },
          "l": { "type": "number" },
          "c": { "type": "number" },
          "v": { "type": "number" }
        },
        "additionalProperties": false
      }
    },
    "pattern_hint": {
      "type": "string",
      "enum": [
        "Bullish Engulfing", "Bearish Engulfing",
        "Bullish Harami", "Bearish Harami",
        "Piercing Line", "Dark Cloud Cover",
        "Morning Star", "Evening Star",
        "Doji", "Hammer", "Hanging Man",
        "Shooting Star"
      ]
    },
    "label": { "type": "string", "enum": ["bullish", "bearish", "neutral"] },
    "rationale": {
      "type": "array",
      "minItems": 2,
      "maxItems": 4,
      "items": { "type": "string", "minLength": 5, "maxLength": 160 }
    },
    "seed": { "type": "integer" }
  },
  "additionalProperties": false
}
```

### 3.2 Geometry rules (must hold for each candle)

* `l <= min(o, c)`
* `h >= max(o, c)`
* `h >= l`
* Values **normalized to 0–100** (floats allowed).
* Adjacent candles may gap (if context.gap true), else keep modest overlaps.

### 3.3 Label semantics

* `label="bullish"` → textbook expectation that price is more likely to rise over `horizon` bars.
* `label="bearish"` → expectation to fall.
* `label="neutral"` → ambiguous/no clear edge; counts as correct **only** if the user chooses **Not sure**; never breaks streak.

---

## 4) Prompting (Gemini)

### 4.1 System prompt

> You generate **strict JSON** (no prose) for 2–5 OHLC candlesticks normalized to 0–100, depicting a **clear textbook candlestick setup**. Include a context summary, a concise teaching rationale (2–4 bullets), and the intended label (**bullish**, **bearish**, or **neutral**) for the next 1 or 3 bars.
> Follow the JSON schema exactly. Ensure OHLC geometry is valid for each bar. Prefer classic TA ratios (e.g., hammer lower shadow ≥ 2× body, morning star closes beyond midpoint). No financial advice. No references. Output only JSON.

### 4.2 User prompt (parameters from UI)

* Bars: **{2–5}**
* Horizon: **{1|3}**
* Difficulty: **{Easy|Medium|Hard}**
* Target distribution: avoid repeating the last 3 patterns; prefer {list} if provided.
* Enforce geometry rules and use believable ratios; include `pattern_hint` when applicable; include `seed`.

> Copilot: generate a helper that assembles this prompt string and requests `responseMimeType: "application/json"` so Gemini returns JSON.

---

## 5) Client-Side Validation & Auto-Correction

Perform **before** rendering:

1. **Schema validation:** reject if any required field missing or extra properties present.
2. **Geometry validation:** per candle rules above.
3. **Pattern sanity** (±10% tolerance); detect from candles and adjust if egregiously wrong.

   * If Gemini’s `pattern_hint` contradicts ratios badly:

     * set `label="neutral"` and mark item as **ambiguous** (internal flag; user doesn’t see the flag).
4. **Difficulty check:** if user picked `Easy`, avoid 5-bar sequences and advanced combos.

### 5.1 Pattern checks (ratios you must implement)

For last candle **k** (or last 2–3 for multi-bar):

* `body = |c - o|`, `range = h - l`, `upper = h - max(o, c)`, `lower = min(o, c) - l`.

**Doji**: `body ≤ 0.10*range`.
**Hammer**: `lower ≥ 2*body && upper ≤ 0.25*body && close near top: (h - max(o,c)) ≤ 0.25*range` and recent **down** context.
**Hanging Man**: hammer ratios but **up** context.
**Shooting Star**: `upper ≥ 2*body && lower ≤ 0.25*body && close near bottom: (min(o,c) - l) ≤ 0.25*range`.
**Bullish Engulfing**: prev red, curr green, `body2 ≥ 1.1*body1`, `o2 ≤ c1 && c2 ≥ o1`.
**Bearish Engulfing**: mirror.
**Bullish Harami**: prev red big body; curr small green within body1 bounds.
**Bearish Harami**: mirror.
**Piercing Line**: prev red; curr opens gap down; `close2 > midpoint(body1)` and `< o1`.
**Dark Cloud Cover**: mirror.
**Morning Star (3)**: big red → small body gap down (doji/small) → big green closing **≥ midpoint** of candle1.
**Evening Star (3)**: mirror.

* **Tolerance:** allow ±10% on ratio thresholds.

---

## 6) Scoring & Streak Rules

* **User choices:** `Bullish`, `Bearish`, `Not sure`.
* **Scoring:** `+1` for correct; `0` for incorrect.
* **Neutral items:**

  * Correct only if `Not sure` was chosen.
  * **Never** break streak on a miss (neutral).
* **Streak breaks** only on a wrong **directional** guess (bullish ↔ bearish).
* After **Reveal**, always show:

  * Correct label.
  * Pattern hint (if available).
  * Rationale bullets (2–4).
  * Optional note if item was auto-downgraded to neutral due to ambiguity (hide by default; available behind “Why?” link).

---

## 7) Local Storage & App State

### 7.1 Local/session storage keys

* `ta:score` → integer
* `ta:streak:current` → integer
* `ta:streak:best` → integer
* `ta:attempts` → integer
* `ta:settings` → JSON: `{ candles: number, horizon: 1|3, difficulty: "Easy"|"Medium"|"Hard", highContrast: boolean }`
* `ta:seen:recent` → array of last 10 `pattern_hint`s to avoid repetition
* `ta:apikey` → **store in `sessionStorage` only**, not local; warn user that keys in client are public.

### 7.2 Zustand slices

* `ui` (screen, dialogs), `session` (score, streak), `settings`, `queue` (prefetched items), `currentItem`.

---

## 8) Prefetching & Fallbacks

* **Prefetch** one next item after rendering Reveal. Keep a small queue of size 1–2.
* **API failure**:

  * Retry up to 2× with exponential backoff.
  * If still failing and fallback enabled → **local generator**.
* **Local generator** (must produce valid items):

  * Choose a target pattern consistent with difficulty.
  * Build 1–2 context bars then the signal bar(s).
  * Normalize to 0–100 range; introduce small random noise; assign `label` per textbook (or `neutral` if ambiguous).

---

## 9) Canvas Rendering Rules

* **Input:** validated `candles` (2–5).
* **Scaling:** map y:\[min(L)…max(H)] → canvas height with **10% padding**.
* **Body width:** \~60% of slot width; use devicePixelRatio for crisp lines.
* **Colors:**

  * Green (up close ≥ open), Red (down close < open).
  * **High-contrast mode:** use color-blind-safe palette and add patterns:

    * Up = solid body; Down = hatched body (45° stripes).
* **Wicks:** 1 px lines (scale with DPR).
* **Gaps:** show empty space where appropriate.

> Ensure **no blurry lines**; align to half-pixels as needed for crisp strokes.

---

## 10) Difficulty Mapping

* **Easy (2–3 candles):** Engulfing, Harami, Piercing/Dark Cloud. Minimal noise, clear ratios.
* **Medium (3 candles):** Morning/Evening Star; small gaps; mild noise; context trend.
* **Hard (4–5 candles):** Add 1–2 context bars; tighter ratios; near-miss shapes; occasional **neutral**.

---

## 11) Accessibility (A11y)

* All interactive controls: keyboard focusable (`Tab` / `Enter` / shortcuts **B**, **S**, **N**).
* `aria-live="polite"` region announces correctness in **Reveal**.
* Buttons have `aria-pressed` on selection.
* Color not sole indicator: add icons/text (“Up”, “Down”).
* Contrast ratio ≥ 4.5:1 (8:1 for text over chart).
* Provide “Reduce motion” setting (respect `prefers-reduced-motion`).

---

## 12) Responsive Layout

* **Mobile (≤ 480px):**

  * Single column; chart height 240–280px; buttons full-width stacked.
* **Tablet (481–1024px):**

  * Chart left (60%), answer panel right (40%), or stacked with two-column buttons.
* **Desktop (≥ 1025px):**

  * Centered max-width 960–1140px; persistent header with score/streak.

> Use CSS Grid for layouts; avoid layout shift when Reveal appears (reserve space).

---

## 13) Copy (Strings)

Centralize strings in a module for easy i18n later.

* Buttons: `Bullish`, `Bearish`, `Not sure`, `Reveal`, `Next`, `Start`, `Settings`, `Save`, `Reset`, `Retry`.
* Labels: `Candles`, `Horizon`, `Difficulty`, `Score`, `Streak`, `Best`, `Context`, `Why?`.
* Disclaimer: “Educational tool. Not financial advice. We teach textbook candlestick concepts; outcomes are simulated.”

---

## 14) Telemetry (local only)

* Track per-session:

  * Attempts, correct, accuracy by label, average response time.
  * Confusions (e.g., “Bearish guess on Bullish Engulfing”).
* Persist summary in localStorage; **do not** send anywhere.

---

## 15) Error Handling UX

* **API Key missing:** show Settings modal with key field; allow “Use local generator”.
* **Gemini errors:** toast with reason; auto-fallback if enabled.
* **Invalid JSON:** silently discard and retry; count towards “generation issues” metric shown in Settings.

---

## 16) Testing Checklist

* **Schema guard:** reject malformed items; app never crashes.
* **Geometry guard:** render only valid candles.
* **Neutral logic:** never breaks streak; scoring correct when user picks “Not sure”.
* **Accessibility:** full keyboard path; screen reader announces result.
* **Responsive:** no overflow on 320px width; chart remains legible.
* **Performance:** first load < 2s on 3G Fast; memory leak-free after 100 items.
* **Fallback:** works with airplane mode (local generator only).

---

## 17) Security Notes (Client-side API Keys)

* API keys in the browser are **inherently exposed**.
* Store key in **sessionStorage**, not localStorage; allow users to paste key each session.
* Document this in Settings. Provide default **Local generator** so app works without any key.

---

## 18) Roadmap (post-MVP, optional)

* PWA install, offline cache of lessons.
* Pattern-wise heatmap over time.
* “Explain your pick” text box with rubric scoring.
* Theming (light/dark/system).
* Multi-language strings.

---

## 19) Acceptance Criteria (MVP is Done When…)

* User can select **2–5 candles**, **1/3 horizon**, **difficulty**, press **Start**.
* App **generates** an item via Gemini (or fallback), **validates**, and **renders** candles.
* User selects **Bullish / Bearish / Not sure**, clicks **Reveal**, sees correct label + rationale.
* Score increments correctly; **streak** increments on correct directional calls and **does not** break on neutral misses.
* **Stats** screen reflects attempts, accuracy, and streaks.
* App behaves on mobile, tablet, desktop; fully keyboard accessible.
* If Gemini fails or key absent, app still works via **local generator**.

---

## 20) Example Item (for manual QA)

```json
{
  "id": "demo-001",
  "horizon": 3,
  "context": { "trend": "down", "vol": "med", "gap": false },
  "candles": [
    { "o": 78, "h": 80, "l": 68, "c": 70 },
    { "o": 70, "h": 72, "l": 60, "c": 61 },
    { "o": 61, "h": 63, "l": 48, "c": 62 }, 
    { "o": 62, "h": 64, "l": 50, "c": 63.5 }
  ],
  "pattern_hint": "Hammer",
  "label": "bullish",
  "rationale": [
    "Long lower shadow indicates rejection of lower prices",
    "Close near the high of the candle",
    "Appears after a short downtrend — classic hammer context"
  ],
  "seed": 42
}
```

---

## 21) File Structure (suggested)

```
/src
  /app         # routing & layout
  /components  # CanvasChart, Buttons, Chips, Modals
  /features
    /drill     # screens + logic
    /stats
    /settings
  /lib
    /ai        # gemini client, prompt builder
    /rules     # schema, validators, pattern checks
    /render    # canvas utilities
    /state     # zustand stores
    /util      # storage, formatters
  /styles      # tailwind.css, theme.css
index.html
```

---

## 22) Legal / Copy

* Show disclaimer on Home:
  “This is an educational tool to practice textbook candlestick analysis. It does not predict markets and is not financial advice.”
* Include a link to a short **Privacy note**: “All data stays in your browser. No servers involved.”

---

**Build it exactly to this spec.**
