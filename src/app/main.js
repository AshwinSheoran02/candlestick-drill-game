import { App } from './router.js';
import { useUI } from '../lib/state/ui.js';
import { useSession } from '../lib/state/session.js';
import { useSettings } from '../lib/state/settings.js';
import { useNotify } from '../lib/state/notify.js';
import { useCurrent } from '../lib/state/current.js';
import { useQueue } from '../lib/state/queue.js';

const app = document.getElementById('app');

function render() {
  app.innerHTML = '';
  App(app);
}

// simple reactive store subscription
const subs = [useUI, useSession, useSettings, useNotify, useCurrent, useQueue];
subs.forEach(s => s.subscribe(() => render()));

render();
