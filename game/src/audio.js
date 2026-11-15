const SHOTS = {
  pistol: {
    noise: 0.105, level: 0.65, high: 7600, low: 1150,
    body: 158, drop: 53, weight: 0.72, tail: 0.14,
    crack: 2450, snap: 0.27
  },
  smg: {
    noise: 0.065, level: 0.45, high: 8800, low: 1900,
    body: 205, drop: 72, weight: 0.45, tail: 0.095,
    crack: 3100, snap: 0.19
  },
  rifle: {
    noise: 0.15, level: 0.79, high: 10500, low: 1250,
    body: 135, drop: 42, weight: 0.85, tail: 0.19,
    crack: 3500, snap: 0.32
  },
  sniper: {
    noise: 0.25, level: 0.95, high: 11500, low: 700,
    body: 105, drop: 31, weight: 1.05, tail: 0.32,
    crack: 4200, snap: 0.38
  }
};

const FLOOR = 0.0001;

export function createAudio() {
  const state = { muted: false, ready: false };
  let context = null;
  let master = null;
  let compressor = null;
  let bus = null;
  let noiseBuffer = null;
  let openCutoff = 18000;

  function available() {
    return state.ready && context !== null && context.state !== 'closed';
  }

  // Sources are disposable; the single white-noise buffer is shared forever.
  function retire(source, nodes, start, duration, offset) {
    source.onended = () => {
      for (const node of nodes) node.disconnect();
      source.onended = null;
    };
    if (offset === undefined) source.start(start);
    else source.start(start, offset);
    source.stop(start + duration);
  }

  function envelope(param, start, duration, level, attack) {
    const peak = Math.max(FLOOR, level);
    const rise = Math.min(attack, duration * 0.3);
    param.setValueAtTime(FLOOR, start);
    param.linearRampToValueAtTime(peak, start + rise);
    param.exponentialRampToValueAtTime(FLOOR, start + duration);
  }

  function tone(type, hz, endHz, duration, level, delay = 0, cutoff = 0) {
    if (!available()) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    const nodes = [osc, gain];
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(15, hz), start);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(15, endHz), start + duration
    );
    envelope(gain.gain, start, duration, level, 0.002);

    if (cutoff > 0) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = Math.min(cutoff, openCutoff);
      filter.Q.value = 0.6;
      osc.connect(filter);
      filter.connect(gain);
      nodes.push(filter);
    } else {
      osc.connect(gain);
    }
    gain.connect(bus);
    retire(osc, nodes, start, duration);
  }

  function noise(
    duration, level, from, to, type = 'lowpass', delay = 0, resonance = 0.7
  ) {
    if (!available()) return;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = type;
    filter.Q.value = resonance;
    filter.frequency.setValueAtTime(
      Math.min(openCutoff, Math.max(25, from)), start
    );
    filter.frequency.exponentialRampToValueAtTime(
      Math.min(openCutoff, Math.max(25, to)), start + duration
    );
    envelope(gain.gain, start, duration, level, 0.003);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    // Keep the entire scheduled burst inside the one-second buffer.
    const offset = Math.random() * Math.max(0, 1 - duration - 0.002);
    retire(source, [source, filter, gain], start, duration, offset);
  }

  async function unlock() {
    if (context && context.state === 'closed') {
      state.ready = false;
      return false;
    }

    if (!context) {
      const AudioContextClass =
        globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;

      try {
        context = new AudioContextClass();
        noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
          samples[i] = Math.random() * 2 - 1;
        }

        openCutoff = Math.min(18000, context.sampleRate * 0.45);
        // A normally open input filter supplies the brief hurt muffling.
        bus = context.createBiquadFilter();
        bus.type = 'lowpass';
        bus.frequency.value = openCutoff;
        bus.Q.value = 0.5;

        master = context.createGain();
        master.gain.value = state.muted ? 0 : 0.22;
        compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -17;
        compressor.knee.value = 16;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.16;

        bus.connect(master);
        master.connect(compressor);
        compressor.connect(context.destination);
        state.ready = true;
      } catch {
        state.ready = false;
        if (context) {
          try {
            const closing = context.close();
            if (closing && closing.catch) closing.catch(() => {});
          } catch {}
        }
        context = master = compressor = bus = noiseBuffer = null;
        return false;
      }
    }

    try {
      if (context.state !== 'running') await context.resume();
      return context.state === 'running';
    } catch {
      // Autoplay restrictions or interruption may require another gesture.
      return false;
    }
  }

  function shot(kind) {
    if (!available()) return;
    const p = Object.prototype.hasOwnProperty.call(SHOTS, kind)
      ? SHOTS[kind] : SHOTS.pistol;
    const variation = 0.97 + Math.random() * 0.06;
    noise(p.noise, p.level, p.high, p.low);
    tone('sine', p.body * variation, p.drop, p.tail, p.weight);
    tone('triangle', p.crack * variation, 850, 0.023, p.snap);
    noise(0.022, p.snap * 0.7, 6500, 3800, 'highpass');
    if (kind === 'sniper') {
      noise(0.42, 0.22, 1450, 170, 'lowpass', 0.055);
      tone('sine', 63, 27, 0.39, 0.24, 0.015);
    } else if (kind === 'rifle') {
      noise(0.19, 0.11, 2100, 450, 'bandpass', 0.035);
    }
  }

  function dryFire() {
    if (!available()) return;
    noise(0.021, 0.12, 4100, 1900, 'bandpass');
    tone('square', 1250, 620, 0.014, 0.04, 0, 4200);
  }

  function reload(stage) {
    if (!available()) return;
    if (stage === 'out') {
      tone('triangle', 680, 270, 0.043, 0.12);
      noise(0.055, 0.19, 3400, 1100, 'bandpass', 0.006);
      noise(0.095, 0.09, 1900, 650, 'highpass', 0.045);
      tone('sine', 175, 100, 0.07, 0.08, 0.028);
    } else if (stage === 'in') {
      noise(0.075, 0.16, 1700, 3600, 'bandpass');
      tone('triangle', 330, 190, 0.065, 0.16, 0.025);
      noise(0.025, 0.22, 5400, 2200, 'highpass', 0.06);
      tone('square', 1450, 720, 0.018, 0.045, 0.065, 3500);
    } else if (stage === 'done') {
      noise(0.085, 0.19, 2200, 4800, 'bandpass');
      noise(0.033, 0.25, 6200, 1700, 'highpass', 0.082);
      tone('triangle', 980, 290, 0.048, 0.17, 0.083);
      tone('sine', 160, 80, 0.07, 0.1, 0.087);
    }
  }

  function hit(head) {
    if (!available()) return;
    const pitch = head ? 2240 : 1280;
    tone('sine', pitch, pitch * 0.87, 0.065, head ? 0.22 : 0.17);
    tone('triangle', pitch * 1.5, pitch * 1.25, 0.025, 0.055);
  }

  function kill() {
    if (!available()) return;
    tone('sine', 1046.5, 1046.5, 0.12, 0.2);
    tone('triangle', 523.25, 523.25, 0.18, 0.13, 0.095, 2400);
  }

  function hurt() {
    if (!available()) return;
    const now = context.currentTime;
    // Cancel previous recovery, so repeated hits extend rather than stack it.
    const cutoff = bus.frequency;
    if (typeof cutoff.cancelAndHoldAtTime === 'function') {
      cutoff.cancelAndHoldAtTime(now);
    } else {
      cutoff.cancelScheduledValues(now);
      cutoff.setValueAtTime(openCutoff, now);
    }
    cutoff.exponentialRampToValueAtTime(720, now + 0.012);
    cutoff.setValueAtTime(720, now + 0.065);
    cutoff.exponentialRampToValueAtTime(openCutoff, now + 0.29);
    noise(0.18, 0.5, 620, 100);
    tone('sine', 94, 34, 0.23, 0.65);
  }

  function explosion() {
    if (!available()) return;
    noise(0.075, 0.8, 7200, 1500);
    noise(0.88, 0.95, 2300, 65, 'lowpass', 0.008);
    noise(0.52, 0.28, 750, 120, 'bandpass', 0.045, 1.1);
    tone('sine', 145, 25, 0.78, 1.05);
    tone('triangle', 73, 22, 0.62, 0.28, 0.015, 370);
  }

  function plant() {
    if (!available()) return;
    // One arming pulse only; the caller owns the repeat cadence.
    tone('sine', 1760, 1760, 0.085, 0.16);
    tone('triangle', 3520, 3520, 0.038, 0.025, 0, 5000);
  }

  function beep(freq = 880, dur = 0.1) {
    if (!available()) return;
    if (!Number.isFinite(freq) || !Number.isFinite(dur) || dur <= 0) return;
    const hz = Math.min(openCutoff, Math.max(30, freq));
    tone('sine', hz, hz, Math.min(4, Math.max(0.008, dur)), 0.16);
  }

  function step(surface) {
    if (!available()) return;
    const variation = 0.88 + Math.random() * 0.24;
    if (surface === 'gravel') {
      noise(0.085, 0.065, 3400 * variation, 900, 'bandpass');
      noise(0.038, 0.032, 5400, 2100, 'highpass', 0.023);
      tone('sine', 95 * variation, 48, 0.07, 0.035);
    } else {
      noise(0.062, 0.055, 1050 * variation, 240);
      tone('sine', 88 * variation, 43, 0.075, 0.055);
    }
  }

  function setMuted(muted) {
    state.muted = Boolean(muted);
    if (!available()) return;
    master.gain.setValueAtTime(state.muted ? 0 : 0.22, context.currentTime);
  }

  return {
    unlock,
    shot,
    dryFire,
    reload,
    hit,
    kill,
    hurt,
    explosion,
    plant,
    beep,
    step,
    setMuted,
    state
  };
}
