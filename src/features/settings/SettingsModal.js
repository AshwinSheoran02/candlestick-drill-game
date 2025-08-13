import { useUI } from '../../lib/state/ui.js';
import { useSettings } from '../../lib/state/settings.js';

export function SettingsModal(root){
  const s = useSettings.get();
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center p-4';
  const card = document.createElement('div');
  card.className = 'w-full max-w-md bg-[var(--card)] border border-slate-800 rounded-lg p-4';
  card.innerHTML = `
    <h2 class="text-lg font-semibold mb-3">Settings</h2>
    <label class="grid gap-2 mb-3">
      <span class="text-sm">Gemini API key (stored in session)</span>
      <input id="apiKey" type="password" class="bg-slate-900 border border-slate-800 rounded px-2 py-2" placeholder="AIza..." />
      <span class="text-xs text-[var(--muted)]">Keys in the browser are public. The app works without a key using local generation.</span>
    </label>
    <label class="inline-flex items-center gap-2 mb-3 text-sm">
      <input id="fallback" type="checkbox" ${s.useLocalOnFail? 'checked':''} /> Use local generator if API fails
    </label>
    <label class="inline-flex items-center gap-2 mb-3 text-sm">
      <input id="contrast" type="checkbox" ${s.highContrast? 'checked':''} /> High-contrast colors
    </label>
    <div class="flex justify-end gap-2">
      <button id="closeBtn" class="px-3 py-2 rounded bg-slate-800">Close</button>
      <button id="saveBtn" class="px-3 py-2 rounded bg-[var(--accent)] text-black font-semibold">Save</button>
    </div>
  `;
  overlay.appendChild(card);
  root.appendChild(overlay);

  const apiInput = "AIzaSyCRTc5G9hPlmuX6lBmT5J6Vylzi2-32o-8";
  apiInput.value = sessionStorage.getItem('ta:apikey') || '';

  card.querySelector('#closeBtn').onclick = ()=> useUI.set({ showSettings: false });
  card.querySelector('#saveBtn').onclick = ()=>{
    const key = apiInput.value.trim();
    if (key) sessionStorage.setItem('ta:apikey', key);
    else sessionStorage.removeItem('ta:apikey');
    useSettings.set({ useLocalOnFail: card.querySelector('#fallback').checked, highContrast: card.querySelector('#contrast').checked });
    useUI.set({ showSettings: false });
  };
}
