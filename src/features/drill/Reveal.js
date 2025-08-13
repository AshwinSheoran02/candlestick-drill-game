import { useCurrent } from '../../lib/state/current.js';
import { useSession } from '../../lib/state/session.js';
import { useUI } from '../../lib/state/ui.js';
import { CanvasChart } from '../../components/CanvasChart.js';
import { strings } from '../../lib/util/strings.js';
import { useQueue } from '../../lib/state/queue.js';
import { fetchNextItemEnsured } from '../../lib/ai/pipeline.js';
import { markAnswered } from '../../lib/state/telemetry.js';

export function Reveal(root){
  const wrap = document.createElement('div');
  wrap.className = 'grid gap-4 md:grid-cols-5';

  const left = document.createElement('section');
  left.className = 'md:col-span-3 p-3 rounded-lg bg-[var(--card)] border border-slate-800';
  const right = document.createElement('section');
  right.className = 'md:col-span-2 p-3 rounded-lg bg-[var(--card)] border border-slate-800';

  const cur = useCurrent.get();
  const session = useSession.get();

  // result header
  const status = document.createElement('div');
  status.setAttribute('aria-live','polite');
  const isCorrect = evaluate(cur);
  status.innerHTML = `<div class="text-lg font-semibold">${isCorrect? 'Correct ✅' : 'Incorrect ❌'}</div>`;
  right.appendChild(status);

  // details
  const detail = document.createElement('div');
  detail.className = 'mt-2 text-sm text-[var(--muted)]';
  // Defensive: rationale should be array of strings
  let rationale = cur.item.rationale;
  if (!Array.isArray(rationale)) {
    if (typeof rationale === 'string') rationale = [rationale];
    else rationale = [];
  }
  detail.innerHTML = `
    <div><strong>Ground truth:</strong> ${cur.item.label}</div>
    ${cur.item.pattern_hint? `<div><strong>Pattern:</strong> ${cur.item.pattern_hint}</div>` : ''}
    <ul class="list-disc list-inside mt-2 grid gap-1">${rationale.map(r=>`<li>${r}</li>`).join('')}</ul>
    ${cur.item._ambiguous? `<details class="mt-2 text-xs"><summary>Why?</summary><div>This item was auto-marked neutral due to inconsistent ratios.</div></details>`:''}
  `;
  right.appendChild(detail);

  // ratios overlay for the last candle
  const k = cur.item.candles[cur.item.candles.length-1];
  const body = Math.abs(k.c - k.o).toFixed(2);
  const range = (k.h - k.l).toFixed(2);
  const upper = (k.h - Math.max(k.o,k.c)).toFixed(2);
  const lower = (Math.min(k.o,k.c) - k.l).toFixed(2);
  const overlay = document.createElement('div');
  overlay.className = 'mt-3 p-2 rounded bg-slate-900/60 border border-slate-800 text-xs';
  overlay.innerHTML = `<div class="font-semibold mb-1">Last candle ratios</div>
    <div>Body: ${body} • Range: ${range} • Upper wick: ${upper} • Lower wick: ${lower}</div>`;
  right.appendChild(overlay);

  const next = document.createElement('button');
  next.className = 'mt-4 px-4 py-2 rounded bg-[var(--accent)] text-black font-semibold';
  next.textContent = strings.buttons.next;
  next.onclick = ()=>{
    // move to next item from queue
    const q = useQueue.get();
    const nextItem = q.items.shift();
    useQueue.set({ items: q.items });
    useCurrent.set({ item: nextItem || null, choice: null });
    useUI.set({ screen: nextItem? 'drill' : 'home' });
    fetchNextItemEnsured();
  };
  right.appendChild(next);

  const chart = document.createElement('div');
  chart.className = 'h-[260px] sm:h-[280px] md:h-[360px]';
  left.appendChild(chart);
  console.log('[Reveal] About to chart item:', cur.item);
  CanvasChart(chart, cur.item, { highlightLast: true });

  root.appendChild(left);
  root.appendChild(right);

  // update session after showing result
  const delta = computeScoreDelta(cur);
  try{ markAnswered({ label: cur.item.label, correct: delta._correct, pattern: cur.item.pattern_hint }); }catch{}
  useSession.set(delta);
}

function evaluate(cur){
  const { choice, item } = cur;
  if (!choice) return false;
  if (item.label === 'neutral') return choice === 'neutral';
  return choice === item.label;
}

function computeScoreDelta(cur){
  const { choice, item } = cur;
  const prev = useSession.get();
  let score = prev.score;
  let streak = prev.streak;
  let bestStreak = prev.bestStreak;

  const correct = (item.label==='neutral') ? (choice==='neutral') : (choice===item.label);
  if (correct) {
    score += 1;
    if (item.label !== 'neutral') {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    }
  } else {
    // miss
    if (item.label !== 'neutral') {
      streak = 0; // only break on directional miss
    }
  }
  const attempts = prev.attempts + 1;
  return { score, streak, bestStreak, attempts, _correct: correct };
}
