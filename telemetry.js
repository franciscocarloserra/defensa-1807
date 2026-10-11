// Dev only: console errors/warnings, uncaught exceptions and long tasks -> POST /log (serve.py)
(() => {
  const LONGTASK_MS = 100;
  if (location.hostname.endsWith('github.io') || location.protocol === 'file:') return;
  const send = (kind, msg) => {
    try { navigator.sendBeacon('/log', JSON.stringify({ t: Date.now(), kind, msg: String(msg).slice(0, 2000), ua: navigator.userAgent })); } catch {}
  };
  addEventListener('error', e => send('error', `${e.message} @${e.filename}:${e.lineno}`));
  addEventListener('unhandledrejection', e => send('rejection', (e.reason && e.reason.stack) || e.reason));
  for (const k of ['error', 'warn']) {
    const orig = console[k];
    console[k] = (...a) => { send(k, a.join(' ')); orig.apply(console, a); };
  }
  try {
    new PerformanceObserver(l => l.getEntries().forEach(e => e.duration >= LONGTASK_MS && send('longtask', Math.round(e.duration) + 'ms')))
      .observe({ type: 'longtask', buffered: true });
  } catch {}
})();
