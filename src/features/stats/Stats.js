import { useSession } from '../../lib/state/session.js';
import { useUI } from '../../lib/state/ui.js';
import { useTelemetry } from '../../lib/state/telemetry.js';

export function Stats(root){
  const s = useSession.get();
  const t = useTelemetry.get();
  const wrap = document.createElement('section');
  wrap.className = 'p-4 rounded-lg bg-[var(--card)] border border-slate-800 max-w-2xl mx-auto';
  const accuracy = s.attempts? Math.round((s.score/s.attempts)*100): 0;
  const avgRt = t.responseTimes.length? Math.round(t.responseTimes.reduce((a,b)=>a+b,0)/t.responseTimes.length) : 0;
  const al = t.byLabel;
  const labelRows = ['bullish','bearish','neutral'].map(k=>{
    const a = al[k]?.attempts||0, c = al[k]?.correct||0; const pct = a? Math.round((c/a)*100):0;
    return `<div class="flex justify-between text-xs"><span class="capitalize">${k}</span><span>${c}/${a} (${pct}%)</span></div>`;
  }).join('');
  const patEntries = Object.entries(t.byPattern).sort((a,b)=> b[1].seen - a[1].seen).slice(0,12);
  const patList = patEntries.length? patEntries.map(([p,stat])=>{
    const pct = stat.seen? Math.round((stat.correct/stat.seen)*100):0;
    return `<div class="flex justify-between text-xs"><span>${p}</span><span>${stat.correct}/${stat.seen} (${pct}%)</span></div>`;
  }).join('') : '<div class="text-xs text-[var(--muted)]">No pattern stats yet</div>';
  wrap.innerHTML = `
    <h1 class="text-xl font-semibold mb-4">Session Stats</h1>
    <div class="grid grid-cols-2 gap-4 text-sm">
      <div class="p-3 bg-slate-900/60 rounded">Total answered: <strong>${s.attempts}</strong></div>
      <div class="p-3 bg-slate-900/60 rounded">Accuracy: <strong>${accuracy}%</strong></div>
      <div class="p-3 bg-slate-900/60 rounded">Current streak: <strong>${s.streak}</strong></div>
      <div class="p-3 bg-slate-900/60 rounded">Best streak: <strong>${s.bestStreak}</strong></div>
      <div class="p-3 bg-slate-900/60 rounded col-span-2">Avg response time: <strong>${avgRt} ms</strong></div>
      <div class="p-3 bg-slate-900/60 rounded col-span-2">
        <div class="font-semibold mb-2">Accuracy by label</div>
        ${labelRows}
      </div>
      <div class="p-3 bg-slate-900/60 rounded col-span-2">
        <div class="font-semibold mb-2">Pattern heatmap (top 12)</div>
        ${patList}
      </div>
    </div>
    <div class="mt-4 flex gap-2">
      <button id="backBtn" class="px-3 py-2 rounded bg-slate-800">Back</button>
      <button id="resetBtn" class="px-3 py-2 rounded bg-red-600/80 hover:bg-red-600">Reset progress</button>
    </div>
  `;
  root.appendChild(wrap);

  wrap.querySelector('#backBtn').onclick = ()=> useUI.set({ screen: 'home' });
  wrap.querySelector('#resetBtn').onclick = ()=>{
    useSession.reset();
  };
}
