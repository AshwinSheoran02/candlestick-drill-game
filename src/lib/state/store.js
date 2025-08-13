// tiny zustand-like store
export function createStore(initial){
  let state = initial;
  const subs = new Set();
  function set(patch){
    const prev = state;
    state = { ...state, ...patch };
    console.log('[store] set called:', { prev, patch, next: state });
    subs.forEach(fn=>fn(state));
  }
  function get(){ return state; }
  function subscribe(fn){ subs.add(fn); return ()=> subs.delete(fn); }
  return { get, set, subscribe };
}
