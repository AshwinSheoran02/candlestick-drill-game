import { Home } from '../features/drill/Home.js';
import { Drill } from '../features/drill/Drill.js';
import { Reveal } from '../features/drill/Reveal.js';
import { Stats } from '../features/stats/Stats.js';
import { SettingsModal } from '../features/settings/SettingsModal.js';
import { useUI } from '../lib/state/ui.js';
import { useSession } from '../lib/state/session.js';
import { useSettings } from '../lib/state/settings.js';
import { useNotify } from '../lib/state/notify.js';

export function App(root) {
  const ui = useUI.get();
  const session = useSession.get();
  const settings = useSettings.get();

  const header = document.createElement('header');
  header.className = 'sticky top-0 z-10 border-b border-slate-800 bg-[var(--bg)]/80 backdrop-blur';
  header.innerHTML = `
    <div class="mx-auto max-w-5xl px-4 py-3 grid grid-cols-3 items-center gap-2">
      <div class="text-sm">
        <strong>Score:</strong> <span id="score">${session.score}</span>
        <span class="ml-3">🔥 <strong id="streak">${session.streak}</strong> (best <span id="best">${session.bestStreak}</span>)</span>
      </div>
      <div class="text-center font-semibold">Candlestick Drill — <span class="text-[var(--accent)]">${settings.difficulty}</span></div>
      <div class="text-right">
        <button id="settingsBtn" class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sm">Settings</button>
        <button id="statsBtn" class="ml-2 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sm">Stats</button>
      </div>
    </div>`;

  root.appendChild(header);

  const main = document.createElement('main');
  main.className = 'mx-auto max-w-5xl px-4 py-4 min-h-[calc(100vh-60px)]';

  switch (ui.screen) {
    case 'home':
      Home(main);
      break;
    case 'drill':
      Drill(main);
      break;
    case 'reveal':
      Reveal(main);
      break;
    case 'stats':
      Stats(main);
      break;
  }

  root.appendChild(main);

  // notifications layer
  const toasts = document.createElement('div');
  toasts.className = 'fixed bottom-3 right-3 space-y-2 z-50';
  const notes = useNotify.get().items;
  toasts.innerHTML = notes.map(n=>`
    <div class="px-3 py-2 rounded text-sm shadow border ${n.type==='error'?'bg-rose-600/20 border-rose-500 text-rose-200':'bg-slate-800 border-slate-700'}">${n.text}</div>
  `).join('');
  root.appendChild(toasts);

  if (ui.showSettings) {
    SettingsModal(root);
  }

  // wire header actions
  header.querySelector('#settingsBtn').onclick = () => useUI.set({ showSettings: true });
  header.querySelector('#statsBtn').onclick = () => useUI.set({ screen: 'stats' });
}
