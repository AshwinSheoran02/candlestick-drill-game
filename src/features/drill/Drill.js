import { CanvasChart } from '../../components/CanvasChart.js';
import { AnswerButtons } from '../../components/AnswerButtons.js';
import { strings } from '../../lib/util/strings.js';
import { useQueue } from '../../lib/state/queue.js';
import { useCurrent } from '../../lib/state/current.js';
import { fetchItem, fetchNextItemEnsured, startHybridSession, getNextHybridItem } from '../../lib/ai/pipeline.js';
import { useSession } from '../../lib/state/session.js';
import { markAnswered, markQuestionShown } from '../../lib/state/telemetry.js';

export function Drill(root){
  const wrap = document.createElement('div');
  wrap.className = 'grid md:grid-cols-5 gap-4';

  const left = document.createElement('section');
  left.className = 'md:col-span-3 p-3 rounded-lg bg-[var(--card)] border border-slate-800';
  const right = document.createElement('section');
  right.className = 'md:col-span-2 p-3 rounded-lg bg-[var(--card)] border border-slate-800';

  const cur = useCurrent.get();
  if (!cur.item) {
    const loading = document.createElement('div');
    loading.className = 'p-6 text-center text-sm text-[var(--muted)]';
    loading.textContent = 'Loading item…';
    left.appendChild(loading);
    console.log('[Drill] No item, still loading.');
  } else {
    const chart = document.createElement('div');
    chart.className = 'h-[260px] sm:h-[280px] md:h-[360px]';
    left.appendChild(chart);
    console.log('[Drill] About to chart item:', cur.item);
    CanvasChart(chart, cur.item);
  }

  const contextChips = document.createElement('div');
  contextChips.className = 'flex flex-wrap gap-2 mb-3';
  if (cur.item?.context){
    const { trend, vol, gap } = cur.item.context;
    const chips = [trend && `${trend}trend`, vol && `${vol} vol`, gap? 'gap' : null].filter(Boolean);
    chips.forEach(t=>{
      const chip = document.createElement('span');
      chip.className = 'px-2 py-1 text-xs rounded bg-slate-800';
      chip.textContent = t;
      contextChips.appendChild(chip);
    });
  }
  right.appendChild(contextChips);

  const btnHost = document.createElement('div');
  right.appendChild(btnHost);
  const resultHost = document.createElement('div');
  right.appendChild(resultHost);

  const renderStatus = (item, choice)=>{
    const correct = item.label === 'neutral' ? (choice === 'neutral') : (choice === item.label);
    const status = document.createElement('div');
    status.className = 'mt-3 p-3 rounded bg-slate-900/60 border border-slate-800';
    const rationale = Array.isArray(item.rationale) ? item.rationale : (typeof item.rationale === 'string' ? [item.rationale] : []);
    status.innerHTML = `
      <div class="text-lg font-semibold">${correct? 'Correct ✅' : 'Incorrect ❌'}</div>
      <div class="mt-2 text-sm text-[var(--muted)]">
        <div><strong>Ground truth:</strong> ${item.label}</div>
        ${item.pattern_hint? `<div><strong>Pattern:</strong> ${item.pattern_hint}</div>` : ''}
        <ul class="list-disc list-inside mt-2 grid gap-1">${rationale.map(r=>`<li>${r}</li>`).join('')}</ul>
      </div>
      <div class="mt-3"><button id="nextBtn" class="px-4 py-2 rounded bg-[var(--accent)] text-black font-semibold">${strings.buttons.next}</button></div>
    `;
    resultHost.innerHTML = '';
    resultHost.appendChild(status);
    const nextBtn = status.querySelector('#nextBtn');
    nextBtn.onclick = async ()=>{
      // Hybrid next selection
      resultHost.innerHTML = '<div class="mt-3 text-sm text-[var(--muted)]">Loading next…</div>';
      useCurrent.set({ item: null, choice: null });
      try{
        const item = await getNextHybridItem();
        useCurrent.set({ item, choice: null });
      }catch(e){
        console.error('[Drill] Failed to get next hybrid item:', e);
      }
    };
  };

  let answered = Boolean(cur.choice);
  AnswerButtons(btnHost, (choice)=>{
    if (answered) return;
    answered = true;
  // disable buttons immediately
  btnHost.querySelectorAll('button').forEach(b=> b.disabled = true);
  // compute correctness and update session, show inline result, then trigger re-render via set(choice)
  const item = useCurrent.get().item;
    const correct = item.label === 'neutral' ? (choice === 'neutral') : (choice === item.label);
    const prev = useSession.get();
    let score = prev.score;
    let streak = prev.streak;
    let bestStreak = prev.bestStreak;
    if (correct){
      score += 1;
      if (item.label !== 'neutral'){
        streak += 1; bestStreak = Math.max(bestStreak, streak);
      }
    } else {
      if (item.label !== 'neutral') streak = 0;
    }
    const attempts = prev.attempts + 1;
    useSession.set({ score, streak, bestStreak, attempts });
    try { markAnswered({ label: item.label, correct, pattern: item.pattern_hint }); } catch {}
  // render status immediately
  renderStatus(item, choice);
    useCurrent.set({ choice });
  });

  // if already answered (after re-render), reflect UI state
  if (answered && cur.item && cur.choice){
    // disable buttons
    queueMicrotask(()=>{
      btnHost.querySelectorAll('button').forEach(b=> b.disabled = true);
    });
    renderStatus(cur.item, cur.choice);
  }

  // removed timer per request

  // prefetch badge
  const q = useQueue.get();
  if (q.items.length > 0){
    const badge = document.createElement('div');
    badge.className = 'mt-2 text-xs text-emerald-400';
    badge.textContent = 'Next up ready';
    right.appendChild(badge);
  }

  wrap.appendChild(left);
  wrap.appendChild(right);
  root.appendChild(wrap);

  // Start hybrid session; ensures immediate local items and background batch
  startHybridSession();
  // start response timer for telemetry (only before answering)
  if (cur.item && !cur.choice) markQuestionShown(cur.item.id);
}
