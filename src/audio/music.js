// Background music: loops at VOLUME, fades in on the first user gesture (browsers block autoplay).
// #mute toggles it; the choice is remembered per device.
(() => {
  const VOLUME = 0.2, FADE_MS = 4000, KEY = 'defensa1807-muted';
  const audio = new Audio('assets/audio/musica.m4a'), btn = document.getElementById('mute');
  audio.loop = true; audio.volume = 0;
  let muted = false, started = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch {}

  function fadeIn() {
    const t0 = performance.now();
    const step = now => {
      if (muted) return;
      audio.volume = VOLUME * Math.min(1, (now - t0) / FADE_MS);
      if (now - t0 < FADE_MS) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function play() {
    audio.volume = 0;
    audio.play().then(fadeIn).catch(e => console.warn('music', e.message));
  }
  function render() { btn.textContent = muted ? '🔇' : '🔊'; btn.title = muted ? 'Activar música' : 'Silenciar música'; }

  function start() {
    if (started) return;
    started = true;
    removeEventListener('pointerdown', start, true); removeEventListener('keydown', start, true);
    if (!muted) play();
  }
  addEventListener('pointerdown', start, true); addEventListener('keydown', start, true);

  btn.onclick = () => {
    muted = !muted;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch {}
    if (muted) audio.pause(); else play();
    render();
  };
  render();
})();
