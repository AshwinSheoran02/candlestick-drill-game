import { useSettings } from '../lib/state/settings.js';

export function CanvasChart(host, item, opts={}){
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const canvas = document.createElement('canvas');
  const rect = host.getBoundingClientRect();
  const width = Math.max(320, rect.width || host.clientWidth || 320);
  const height = Math.max(240, host.clientHeight || 260);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const candles = item.candles;
  const minL = Math.min(...candles.map(c=>c.l));
  const maxH = Math.max(...candles.map(c=>c.h));
  const pad = (maxH - minL) * 0.1;
  const yMin = minL - pad;
  const yMax = maxH + pad;
  const toY = v => height - ((v - yMin) / (yMax - yMin)) * height;

  // bg
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.fillRect(0,0,width,height);

  const slot = width / candles.length;
  const bodyW = Math.floor(slot * 0.6);

  const s = useSettings.get();

  candles.forEach((c, i)=>{
    const xCenter = i * slot + slot/2;
    const o = toY(c.o), h = toY(c.h), l = toY(c.l), close = toY(c.c);
    const up = c.c >= c.o;

    // wick
    ctx.strokeStyle = '#a7b7cc';
    ctx.lineWidth = 1;
    const x = Math.round(xCenter) + 0.5; // crisp
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x, l);
    ctx.stroke();

    // body
    const bodyX = Math.round(xCenter - bodyW/2) + 0.5;
    const bodyY = Math.min(o, close);
    const bodyH = Math.max(2, Math.abs(close - o));
    ctx.fillStyle = up ? '#16a34a' : '#ef4444';

    if (s.highContrast && !up) {
      // hatched for down
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      for (let y = bodyY; y < bodyY + bodyH; y += 4) {
        ctx.beginPath();
        ctx.moveTo(bodyX, y);
        ctx.lineTo(bodyX + bodyW, y + 4);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
    }
  });

  if (opts.highlightLast) {
    const i = candles.length - 1;
    const xCenter = i * (width / candles.length) + (width / candles.length)/2;
    ctx.strokeStyle = 'rgba(124,217,146,0.8)';
    ctx.strokeRect(Math.round(xCenter - bodyW/2) + 0.5, 4.5, bodyW, height - 9);
  }
}
