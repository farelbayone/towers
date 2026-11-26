/* Efek suara sintetis (WebAudio), tanpa file aset. */
(function () {
  let ctx = null, muted = false;
  const last = {};
  function tone(freq, dur, type, vol, slide, delay) {
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
  }
  const S = {
    arrow: () => tone(720, .06, 'triangle', .025, 320),
    cannon: () => tone(160, .16, 'square', .035, 60),
    frost: () => tone(1100, .1, 'sine', .025, 1600),
    zap: () => tone(900, .09, 'sawtooth', .025, 150),
    boom: () => tone(110, .25, 'sawtooth', .05, 35),
    kill: () => tone(420, .08, 'sine', .04, 760),
    build: () => { tone(330, .08, 'square', .04); tone(500, .1, 'square', .04, 0, .07); },
    upgrade: () => [440, 554, 660, 880].forEach((f, i) => tone(f, .12, 'triangle', .06, 0, i * .06)),
    sell: () => tone(600, .15, 'triangle', .05, 220),
    error: () => tone(140, .15, 'square', .04),
    wave: () => { tone(220, .25, 'sawtooth', .05); tone(330, .35, 'sawtooth', .05, 0, .2); },
    leak: () => tone(200, .35, 'sawtooth', .07, 60),
    meteor: () => tone(500, .6, 'sawtooth', .09, 30),
    freeze: () => tone(1500, .6, 'sine', .07, 300),
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, .25, 'triangle', .07, 0, i * .14)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, .35, 'triangle', .07, 0, i * .2))
  };
  window.KAudio = {
    play(name) {
      if (muted || !S[name] || !ctx) return;
      const now = performance.now();
      if (now - (last[name] || 0) < 70) return;
      last[name] = now; S[name]();
    },
    unlock() {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!ctx && A) ctx = new A();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    toggle() { muted = !muted; return muted; }
  };
})();
