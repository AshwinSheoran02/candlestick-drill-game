import { createStore } from './store.js';

export const useUI = createStore({
  screen: 'home', // home | drill | reveal | stats
  showSettings: false,
});
