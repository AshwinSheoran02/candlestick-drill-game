import { useSettings } from '../../lib/state/settings.js';
import { useUI } from '../../lib/state/ui.js';
import { strings } from '../../lib/util/strings.js';
import { startHybridSession } from '../../lib/ai/pipeline.js';

export function Home(root){
  const s = useSettings.get();
  const wrap = document.createElement('div');
  wrap.className = 'grid gap-6 md:grid-cols-2';
  wrap.innerHTML = `
    <section class="p-4 rounded-lg bg-[var(--card)] border border-slate-800">
      <h1 class="text-xl font-semibold mb-3">AI-Powered Candlestick Drill</h1>
      <p class="text-sm text-[var(--muted)] mb-4">Educational tool. Not financial advice. Outcomes are simulated.</p>
      <div class="grid gap-4">
        <label class="grid gap-2">
          <span class="text-sm">${strings.labels.candles}: <strong id="candlesVal">${s.candles}</strong></span>
          <input id="candles" type="range" min="2" max="5" value="${s.candles}" class="w-full" />
        </label>
        <fieldset class="grid gap-2">
          <legend class="text-sm">${strings.labels.horizon}</legend>
          <label class="inline-flex items-center gap-2">
            <input type="radio" name="horizon" value="1" ${s.horizon===1?'checked':''} /> <span>1 bar</span>
          </label>
          <label class="inline-flex items-center gap-2">
            <input type="radio" name="horizon" value="3" ${s.horizon===3?'checked':''} /> <span>3 bars</span>
          </label>
        </fieldset>
        <label class="grid gap-2">
          <span class="text-sm">${strings.labels.difficulty}</span>
          <select id="difficulty" class="bg-slate-900 border border-slate-800 rounded px-2 py-2">
            ${['Easy','Medium','Hard'].map(d=>`<option ${s.difficulty===d?'selected':''}>${d}</option>`).join('')}
          </select>
        </label>
        <div class="flex gap-2">
          <button id="startBtn" class="px-4 py-2 rounded bg-[var(--accent)] text-black font-semibold">${strings.buttons.start}</button>
          <button id="settingsBtn" class="px-4 py-2 rounded bg-slate-800">${strings.buttons.settings}</button>
        </div>
        <p class="text-xs text-[var(--muted)]">This is an educational tool to practice textbook candlestick analysis. It does not predict markets and is not financial advice. All data stays in your browser.</p>
      </div>
    </section>
    <section class="p-4 rounded-lg bg-[var(--card)] border border-slate-800">
      <h2 class="font-semibold mb-2">How it works</h2>
      <ul class="list-disc list-inside text-sm text-[var(--muted)] grid gap-1">
        <li>Choose candles, horizon, and difficulty</li>
        <li>We generate 2–5 normalized OHLC candles via Gemini or local fallback</li>
        <li>Predict Bullish/Bearish/Not sure; then review a micro-lesson</li>
        <li>Score and streak are saved locally; neutral items never break streak</li>
      </ul>
    </section>
  `;
  root.appendChild(wrap);

  // events
  wrap.querySelector('#candles').oninput = (e)=>{
    wrap.querySelector('#candlesVal').textContent = e.target.value;
  };
  wrap.querySelector('#candles').onchange = (e)=> useSettings.set({ candles: parseInt(e.target.value,10) });
  wrap.querySelectorAll('input[name="horizon"]').forEach(r=>{
    r.onchange = ()=> useSettings.set({ horizon: parseInt(r.value,10) });
  });
  wrap.querySelector('#difficulty').onchange = (e)=> useSettings.set({ difficulty: e.target.value });
  wrap.querySelector('#settingsBtn').onclick = ()=> useUI.set({ showSettings: true });
  wrap.querySelector('#startBtn').onclick = ()=> { startHybridSession(); useUI.set({ screen: 'drill' }); };
}
