// Synthesised sounds: sleigh bells jingle + music-box "Jingle Bells" (public-domain melody, 1857).
(function (root) {
  let ctx = null, master = null, musicOn = false, musicTimer = null, vol = 0.6;

  function ac() {
    if (!ctx) {
      ctx = new (root.AudioContext || root.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = vol * 0.85;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // One small metallic bell: inharmonic partials, fast decay.
  function bell(t, base, vol) {
    const c = ac();
    [1, 2.76, 5.4, 8.93].forEach((m, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.value = base * m;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol / (i + 1), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25 + 0.3 / (i + 1));
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.7);
    });
  }

  // Music-box note: sine + soft octave, long decay.
  function box(t, freq, dur, vol) {
    const c = ac();
    [[1, 1], [2, 0.35], [3, 0.12]].forEach(([m, a]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.value = freq * m;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * a, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.6, dur * 2.2));
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + Math.max(0.7, dur * 2.3));
    });
  }

  function sleighBells(dur, vol) {
    const c = ac(), t0 = c.currentTime + 0.02;
    for (let t = 0; t < dur; t += 0.06 + Math.random() * 0.05) bell(t0 + t, 2300 + Math.random() * 900, vol * (0.6 + Math.random() * 0.4));
  }

  function jingle() {
    try {
      sleighBells(1.6, 0.05);
      const c = ac(), t0 = c.currentTime + 0.25;
      [659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => box(t0 + i * 0.13, f, 0.3, 0.07));
      setTimeout(() => (root.MNlog || console.log)('audio ' + c.state), 600);
    } catch (e) { /* audio unavailable */ }
  }

  // C major, one octave up for a music-box feel. [semitone from C5, beats]
  const N = { C: 523.25, D: 587.33, E: 659.25, F: 698.46, G: 783.99 };
  const verse = [['E', 1], ['E', 1], ['E', 2], ['E', 1], ['E', 1], ['E', 2], ['E', 1], ['G', 1], ['C', 1.5], ['D', 0.5], ['E', 4],
    ['F', 1], ['F', 1], ['F', 1.5], ['F', 0.5], ['F', 1], ['E', 1], ['E', 1], ['E', 0.5], ['E', 0.5], ['E', 1], ['D', 1], ['D', 1], ['E', 1], ['D', 2], ['G', 2],
    ['E', 1], ['E', 1], ['E', 2], ['E', 1], ['E', 1], ['E', 2], ['E', 1], ['G', 1], ['C', 1.5], ['D', 0.5], ['E', 4],
    ['F', 1], ['F', 1], ['F', 1.5], ['F', 0.5], ['F', 1], ['E', 1], ['E', 1], ['E', 0.5], ['E', 0.5], ['G', 1], ['G', 1], ['F', 1], ['D', 1], ['C', 4]];
  const BEAT = 0.34;

  function playVerse() {
    if (!musicOn) return;
    const c = ac();
    let t = c.currentTime + 0.1;
    for (const [n, b] of verse) { box(t, N[n], b * BEAT, 0.045); t += b * BEAT; }
    const total = verse.reduce((a, v) => a + v[1], 0) * BEAT;
    musicTimer = setTimeout(playVerse, (total + 6) * 1000);
  }

  function setMusic(on) {
    if (on === musicOn) return;
    musicOn = on;
    clearTimeout(musicTimer);
    if (on) playVerse();
  }

  function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = vol * 0.85; }

  root.Audio2 = { jingle, setMusic, setVolume, sleighBells: (d, v) => { try { sleighBells(d, v); } catch (e) {} } };
})(this);
