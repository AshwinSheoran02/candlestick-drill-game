export function writeLocal(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch{}
}
export function readLocal(key){
  try{ const v = localStorage.getItem(key); return v? JSON.parse(v): null; }catch{ return null; }
}
