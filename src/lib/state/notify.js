import { createStore } from './store.js';

export const useNotify = createStore({ items: [] });

export function notify(text, type = 'info', ttl = 3000){
  const id = Math.random().toString(36).slice(2);
  const cur = useNotify.get().items;
  useNotify.set({ items: [...cur, { id, text, type }] });
  if (ttl > 0){
    setTimeout(()=>{
      const next = useNotify.get().items.filter(t=> t.id !== id);
      useNotify.set({ items: next });
    }, ttl);
  }
}
