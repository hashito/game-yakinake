// The game's own sounds. Shots, strikes, reloading and the body are made on the spot with WebAudio (noise bursts and clicks);
// the zombies' groans, screams and bursting are files (assets/sfx/*.mp3, made from voices through the local media queue by
// tools/gen-sfx.mjs and roughened with ffmpeg), played from where the zombie is (distance and left / right).
const SFX = new URL('../../assets/sfx/', import.meta.url).href;
const FILES = ['z-groan-1', 'z-groan-2', 'z-groan-3', 'z-groan-4', 'z-groan-5', 'z-groan-6', 'z-attack-1', 'z-attack-2', 'z-attack-3', 'z-die-1', 'z-die-2', 'z-die-3', 'z-scream', 'z-spit', 'z-burst', 'hurt-1', 'hurt-2'];

export function installSound(ext, G) {
  let ac = null, master = null, noiseBuf = null, ctx = null;
  const bufs = new Map();
  const ensure = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const f of FILES) fetch(`${SFX}${f}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => b && ac.decodeAudioData(b)).then((b) => b && bufs.set(f, b)).catch(() => {});
    return ac;
  };
  addEventListener('pointerdown', ensure, { once: false, passive: true });
  addEventListener('keydown', ensure, { passive: true });
  ext.on('game:ready', (c) => { ctx = c; });
  const vol = () => { try { const s = ctx && ctx.settings; return s && s.volume != null ? s.volume : 1; } catch (e) { return 1; } };

  // a burst of noise through a filter: shots, thuds, whooshes
  function burst({ dur = 0.2, f = 1200, q = 0.7, type = 'lowpass', gain = 0.6, attack = 0.002, sweep = 0, pan = 0, out = null }) {
    const a = ensure(); if (!a) return;
    const t = a.currentTime, s = a.createBufferSource(); s.buffer = noiseBuf;
    const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * sweep), t + dur); fl.Q.value = q;
    const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * vol(), t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    const p = a.createStereoPanner ? a.createStereoPanner() : null;
    s.connect(fl); fl.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(out || master); } else g.connect(out || master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function click(f = 2400, dur = 0.03, gain = 0.3) {
    const a = ensure(); if (!a) return;
    const t = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(gain * vol(), t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  // the weight of a shot: a low thump that drops in pitch, through a shaper (the crack of the powder) and a short echo of the room
  function thump(f0 = 140, f1 = 40, dur = 0.3, gain = 0.9) {
    const a = ensure(); if (!a) return;
    const t = a.currentTime, o = a.createOscillator(), g = a.createGain(), sh = a.createWaveShaper();
    const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3.2); } sh.curve = curve;
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain * vol(), t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(sh); sh.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const echo = (dur, gain) => setTimeout(() => burst({ dur, f: 700, sweep: 0.3, gain, attack: 0.02 }), 90);
  const SYN = {
    pistol: () => { burst({ dur: 0.3, f: 3200, sweep: 0.15, gain: 1.0 }); thump(150, 42, 0.28, 1.0); burst({ dur: 0.9, f: 400, sweep: 0.4, gain: 0.4, attack: 0.01 }); echo(0.7, 0.18); },
    shotgun: () => { burst({ dur: 0.45, f: 2400, sweep: 0.12, gain: 1.0 }); thump(110, 30, 0.5, 1.3); burst({ dur: 1.4, f: 260, sweep: 0.5, gain: 0.6, attack: 0.01 }); echo(1.1, 0.25); },
    rifle: () => { burst({ dur: 0.4, f: 4000, sweep: 0.1, gain: 1.0 }); thump(130, 34, 0.42, 1.2); burst({ dur: 1.6, f: 300, sweep: 0.4, gain: 0.5, attack: 0.01 }); echo(1.3, 0.24); },
    nailgun: () => { burst({ dur: 0.08, f: 3000, type: 'bandpass', q: 2, gain: 0.55 }); click(900, 0.05, 0.25); thump(220, 90, 0.08, 0.5); },
    empty: () => click(3200, 0.02, 0.2),
    reload: () => { click(1400, 0.04, 0.25); setTimeout(() => click(1800, 0.04, 0.22), 180); },
    reloaded: () => { click(1100, 0.05, 0.3); setTimeout(() => click(2200, 0.03, 0.25), 90); },
    swing: () => burst({ dur: 0.22, f: 900, type: 'bandpass', q: 1.2, gain: 0.25, attack: 0.05, sweep: 2.2 }),
    thud: () => { burst({ dur: 0.18, f: 260, gain: 0.8 }); burst({ dur: 0.06, f: 1800, type: 'highpass', gain: 0.25 }); },
    stab: () => { burst({ dur: 0.12, f: 700, type: 'bandpass', q: 3, gain: 0.45 }); },
    shove: () => burst({ dur: 0.25, f: 420, gain: 0.5 }),
    'hit-flesh': (o) => burst({ dur: 0.16, f: 380, q: 1.5, gain: 0.55 * o.g, pan: o.pan }),
    'hit-armor': (o) => { burst({ dur: 0.12, f: 3200, type: 'bandpass', q: 6, gain: 0.4 * o.g, pan: o.pan }); },
    'hit-person': (o) => burst({ dur: 0.18, f: 300, gain: 0.5 * o.g, pan: o.pan }),
    sever: (o) => { burst({ dur: 0.35, f: 520, q: 2, gain: 0.6 * o.g, pan: o.pan, sweep: 0.4 }); },
    fall: (o) => burst({ dur: 0.3, f: 160, gain: 0.7 * o.g, pan: o.pan }),
  };
  G.sfx = (name) => {
    if (name === 'hurt') return G.sfx3d(`hurt-${1 + Math.floor(Math.random() * 2)}`, null);
    if (SYN[name]) return SYN[name]({ g: 1, pan: 0 });
  };
  // from a place in the world: quieter with distance (nothing past 24 m), panned by where it is
  G.sfx3d = (name, pos) => {
    const a = ensure(); if (!a || !ctx) return;
    let g = 1, pan = 0;
    if (pos) {
      const c = ctx.camera, dx = pos.x - c.position.x, dz = pos.z - c.position.z, d = Math.hypot(dx, dz);
      if (d > 24 || Math.abs(pos.y - c.position.y) > 2.6) return;
      g = Math.max(0, 1 - d / 24) ** 1.3;
      const yaw = Math.atan2(-Math.sin(c.rotation.y), -Math.cos(c.rotation.y));
      const fx = Math.sin(yaw), fz = Math.cos(yaw); pan = Math.max(-1, Math.min(1, (dx * fz - dz * fx) / Math.max(1, d) * -1));
    }
    if (SYN[name]) return SYN[name]({ g, pan });
    const b = bufs.get(name); if (!b) return;
    const s = a.createBufferSource(); s.buffer = b; s.playbackRate.value = 0.92 + Math.random() * 0.16;
    const gn = a.createGain(); gn.gain.value = g * 0.9 * vol();
    const p = a.createStereoPanner ? a.createStereoPanner() : null;
    s.connect(gn); if (p) { p.pan.value = pan; gn.connect(p); p.connect(master); } else gn.connect(master);
    s.start();
  };
}
