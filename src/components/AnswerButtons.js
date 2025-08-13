import { strings } from '../lib/util/strings.js';

export function AnswerButtons(host, onPick){
  const wrap = document.createElement('div');
  wrap.className = 'grid gap-2';
  wrap.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <button id="bull" class="px-3 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600">${strings.buttons.bullish}</button>
      <button id="bear" class="px-3 py-2 rounded bg-rose-600/80 hover:bg-rose-600">${strings.buttons.bearish}</button>
      <button id="neutral" class="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600">${strings.buttons.notSure}</button>
    </div>
    <p class="text-xs text-[var(--muted)]">Shortcuts: B (Bullish), S (Bearish), N (Not sure)</p>
  `;
  host.appendChild(wrap);

  wrap.querySelector('#bull').onclick = ()=> onPick('bullish');
  wrap.querySelector('#bear').onclick = ()=> onPick('bearish');
  wrap.querySelector('#neutral').onclick = ()=> onPick('neutral');

  const key = (e)=>{
    if (e.key.toLowerCase()==='b') onPick('bullish');
    if (e.key.toLowerCase()==='s') onPick('bearish');
    if (e.key.toLowerCase()==='n') onPick('neutral');
  };
  window.addEventListener('keydown', key, { once: true });
}
