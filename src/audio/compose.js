/*
  Original, generated music, one piece per record. Every note is synthesized here, so there are no
  samples and nothing copyrighted. Each piece renders to a mono Float32Array that loops seamlessly
  (note tails wrap around to the start), which is what lets the record be scratched and spun forever.
*/
export const SR = 22050;
const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function seeded(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

class Buf {
  constructor(sec) { this.n = Math.round(sec * SR); this.d = new Float32Array(this.n); }
  // write a generated voice starting at time t; fn(k, tt) returns the sample
  voice(t, len, fn) {
    const start = Math.round(t * SR), N = Math.min(Math.round(len * SR), this.n), d = this.d, n = this.n;
    let idx = ((start % n) + n) % n;
    for (let k = 0; k < N; k++) {
      d[idx] += fn(k, k / SR);
      if (++idx >= n) idx = 0;
    }
  }
}

/* ---------------- instruments ---------------- */
const I = {
  ep(B, t, m, dur, vel = 0.5) { // electric piano
    const f = mtof(m);
    B.voice(t, dur + 1.6, (k, tt) => {
      const env = Math.min(1, tt / 0.004) * Math.exp(-tt * 1.6) * (tt > dur ? Math.exp(-(tt - dur) * 9) : 1);
      const s = Math.sin(TAU * f * tt) + 0.32 * Math.exp(-tt * 4) * Math.sin(TAU * 2 * f * tt) + 0.1 * Math.exp(-tt * 7) * Math.sin(TAU * 3 * f * tt);
      return vel * 0.22 * env * s * (1 + 0.12 * Math.sin(TAU * 4.5 * tt));
    });
  },
  bell(B, t, m, dur, vel = 0.4) { // vibraphone-ish
    const f = mtof(m);
    B.voice(t, dur + 2.2, (k, tt) => {
      const env = Math.min(1, tt / 0.002) * Math.exp(-tt * 2.0) * (tt > dur + 0.6 ? Math.exp(-(tt - dur - 0.6) * 6) : 1);
      const s = Math.sin(TAU * f * tt) + 0.22 * Math.exp(-tt * 7) * Math.sin(TAU * 4.01 * f * tt) + 0.08 * Math.sin(TAU * 10.2 * f * tt) * Math.exp(-tt * 18);
      return vel * 0.2 * env * s * (1 + 0.25 * Math.sin(TAU * 5.2 * tt));
    });
  },
  flute(B, t, m, dur, vel = 0.4) {
    const f = mtof(m), R = seeded("fl" + m + t);
    let ph = 0;
    B.voice(t, dur + 0.25, (k, tt) => {
      const vib = tt > 0.15 ? 1 + 0.004 * Math.sin(TAU * 5.2 * tt) : 1;
      ph += (TAU * f * vib) / SR;
      const env = Math.min(1, tt / 0.05) * (tt > dur ? Math.exp(-(tt - dur) * 18) : 1);
      return vel * 0.2 * env * (Math.sin(ph) + 0.12 * Math.sin(2 * ph) + 0.04 * (R() - 0.5) * Math.min(1, tt * 20));
    });
  },
  pluck(B, t, m, dur, vel = 0.5, { decay = 0.996, bright = 0.5, drive = 0, mute = 14 } = {}) { // Karplus-Strong
    const f = mtof(m), N = Math.max(2, Math.round(SR / f)), ring = new Float32Array(N), R = seeded("pk" + m + t);
    let prev = 0;
    for (let i = 0; i < N; i++) { const w = R() * 2 - 1; prev = prev + bright * (w - prev); ring[i] = prev; }
    let p = 0;
    B.voice(t, dur + 1.2, (k, tt) => {
      const y = ring[p], nx = ring[(p + 1) % N];
      ring[p] = decay * 0.5 * (y + nx);
      p = (p + 1) % N;
      let s = y * (tt > dur ? Math.exp(-(tt - dur) * mute) : 1);
      if (drive) s = Math.tanh(s * drive) / Math.tanh(drive);
      return vel * 0.5 * s;
    });
  },
  bass(B, t, m, dur, vel = 0.6, thump = 1.2) {
    const f = mtof(m);
    B.voice(t, dur + 0.2, (k, tt) => {
      const env = Math.min(1, tt / 0.008) * Math.exp(-tt * thump) * (tt > dur ? Math.exp(-(tt - dur) * 35) : 1);
      return vel * 0.42 * env * (Math.sin(TAU * f * tt) + 0.25 * Math.sin(TAU * 2 * f * tt) + 0.08 * Math.sin(TAU * 3 * f * tt));
    });
  },
  sawBass(B, t, m, dur, vel = 0.5) {
    const f = mtof(m);
    let lp = 0;
    B.voice(t, dur + 0.1, (k, tt) => {
      const saw = 2 * ((f * tt) % 1) - 1, cut = 0.05 + 0.25 * Math.exp(-tt * 14);
      lp += cut * (saw - lp);
      return vel * 0.35 * lp * Math.min(1, tt / 0.004) * (tt > dur ? Math.exp(-(tt - dur) * 40) : 1);
    });
  },
  pad(B, t, m, dur, vel = 0.2, cutoff = 0.06) {
    const f = mtof(m);
    let lp = 0;
    B.voice(t, dur + 1.2, (k, tt) => {
      const saw = ((f * tt) % 1) + ((f * 1.003 * tt + 0.3) % 1) + ((f * 0.997 * tt + 0.6) % 1) - 1.5;
      lp += cutoff * (saw - lp);
      const env = Math.min(1, tt / 0.5) * (tt > dur ? Math.exp(-(tt - dur) * 3) : 1);
      return vel * 0.3 * env * lp;
    });
  },
  square(B, t, m, dur, vel = 0.3, duty = 0.5) {
    const f = mtof(m);
    let ph = 0;
    B.voice(t, dur + 0.05, (k, tt) => {
      ph += (f * (tt > 0.12 ? 1 + 0.005 * Math.sin(TAU * 6 * tt) : 1)) / SR;
      const env = Math.min(1, tt / 0.003) * (0.7 + 0.3 * Math.exp(-tt * 8)) * (tt > dur ? Math.exp(-(tt - dur) * 60) : 1);
      return vel * 0.16 * env * ((ph % 1) < duty ? 1 : -1);
    });
  },
  tri(B, t, m, dur, vel = 0.5) {
    const f = mtof(m);
    B.voice(t, dur + 0.03, (k, tt) => {
      const x = (f * tt) % 1, tri = 4 * Math.abs(x - 0.5) - 1;
      return vel * 0.35 * tri * (tt > dur ? Math.exp(-(tt - dur) * 80) : 1);
    });
  },
  /* drums */
  kick(B, t, vel = 0.8) {
    let ph = 0;
    B.voice(t, 0.45, (k, tt) => { ph += (TAU * (46 + 110 * Math.exp(-tt * 32))) / SR; return vel * 0.75 * Math.sin(ph) * Math.exp(-tt * 7.5); });
  },
  snare(B, t, vel = 0.5) {
    const R = seeded("sn" + t); let prev = 0;
    B.voice(t, 0.3, (k, tt) => { const n = R() * 2 - 1, hp = n - prev; prev = n; return vel * (0.32 * hp * Math.exp(-tt * 15) + 0.35 * Math.sin(TAU * 190 * tt) * Math.exp(-tt * 24)); });
  },
  hat(B, t, vel = 0.25, open = false) {
    const R = seeded("ht" + t); let p1 = 0, p2 = 0;
    B.voice(t, open ? 0.35 : 0.07, (k, tt) => { const n = R() * 2 - 1, h = n - 2 * p1 + p2; p2 = p1; p1 = n; return vel * 0.16 * h * Math.exp(-tt * (open ? 11 : 70)); });
  },
  rim(B, t, vel = 0.4) {
    B.voice(t, 0.05, (k, tt) => vel * 0.4 * Math.sin(TAU * 1650 * tt) * Math.exp(-tt * 90));
  },
  shaker(B, t, vel = 0.2) {
    const R = seeded("sh" + t); let p = 0;
    B.voice(t, 0.09, (k, tt) => { const n = R() * 2 - 1, h = n - p; p = n; return vel * 0.12 * h * Math.min(1, tt / 0.012) * Math.exp(-tt * 40); });
  },
  ride(B, t, vel = 0.25) {
    const R = seeded("rd" + t); let p = 0;
    B.voice(t, 0.9, (k, tt) => { const n = R() * 2 - 1, h = n - p; p = n; return vel * (0.06 * h * Math.exp(-tt * 9) + 0.03 * (Math.sin(TAU * 3150 * tt) + Math.sin(TAU * 4570 * tt)) * Math.exp(-tt * 4)); });
  },
  // tabla: "na/ta" (dayan, ringing), "tin" (dayan, short), "ge" (bayan, bending bass)
  tabla(B, t, bol, vel = 0.5) {
    const dayan = (ring) => B.voice(t, 0.6, (k, tt) => vel * 0.3 * (Math.sin(TAU * 560 * tt) + 0.5 * Math.sin(TAU * 1590 * tt) * Math.exp(-tt * 30) + 0.25 * Math.sin(TAU * 1120 * tt)) * Math.exp(-tt * ring));
    const bayan = () => { let ph = 0; B.voice(t, 0.7, (k, tt) => { ph += (TAU * (78 + 34 * (1 - Math.exp(-tt * 7)))) / SR; return vel * 0.5 * Math.sin(ph) * Math.exp(-tt * 5); }); };
    if (bol === "na" || bol === "ta") dayan(9);
    if (bol === "tin") dayan(22);
    if (bol === "ge") bayan();
    if (bol === "dha") { dayan(9); bayan(); }
    if (bol === "dhin") { dayan(20); bayan(); }
  },
};

/* ---------------- theory helpers ---------------- */
const Q = {
  maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14], 13: [0, 4, 10, 14, 21], "7b9": [0, 4, 7, 10, 13], sus: [0, 5, 7, 10], 5: [0, 7, 12],
};
const chord = (root, q) => Q[q].map((x) => root + x);
const scaleNotes = (root, steps, lo, hi) => { const out = []; for (let m = lo; m <= hi; m++) if (steps.includes((((m - root) % 12) + 12) % 12)) out.push(m); return out; };
const MAJ = [0, 2, 4, 5, 7, 9, 11], DOR = [0, 2, 3, 5, 7, 9, 10], PENT = [0, 2, 4, 7, 9], MPENT = [0, 3, 5, 7, 10], PHRY = [0, 1, 3, 5, 7, 8, 10];

/* Motif-based melody: a 2-bar idea, repeated, varied and answered (A A' B A). */
function melody(R, scale, chordAt, bars, bpb, { rhythms, rest = 0.2, startBar = 0 }) {
  const notes = [];
  const phrase = (len) => {
    const out = []; let pos = 0, idx = Math.floor(scale.length / 2);
    while (pos < len) {
      const d = rhythms[Math.floor(R() * rhythms.length)];
      if (R() > rest) out.push({ pos, d, step: idx });
      idx = Math.max(0, Math.min(scale.length - 1, idx + [-2, -1, -1, 1, 1, 2, 0, 3, -3][Math.floor(R() * 9)]));
      pos += d;
    }
    return out;
  };
  const A = phrase(bpb * 2), Bp = phrase(bpb * 2);
  const plan = ["A", "A2", "B", "A"];
  for (let bar = startBar; bar < bars; bar += 2) {
    const which = plan[((bar - startBar) / 2) % 4];
    const src = which === "B" ? Bp : A;
    src.forEach((n, i) => {
      let step = n.step;
      if (which === "A2" && i >= src.length - 2) step = Math.max(0, step - 2);
      const beat = bar * bpb + n.pos;
      // land on a chord tone when we're on a downbeat
      let m = scale[step];
      if (n.pos % bpb === 0) {
        const tones = chordAt(beat).map((x) => x % 12);
        let best = m, bd = 99;
        scale.forEach((s) => { if (tones.includes(s % 12) && Math.abs(s - m) < bd) { bd = Math.abs(s - m); best = s; } });
        m = best;
      }
      if (beat < bars * bpb) notes.push({ beat, d: Math.min(n.d, bars * bpb - beat), m });
    });
  }
  return notes;
}

/* ---------------- mastering: reverb + normalize ---------------- */
function finish(B, wet = 0.25) {
  const d = B.d, n = B.n;
  const combs = [558, 594, 638, 678].map((len) => ({ buf: new Float32Array(len), i: 0, lp: 0 }));
  const aps = [278, 220].map((len) => ({ buf: new Float32Array(len), i: 0 }));
  const out = new Float32Array(n);
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < n; k++) {
      const x = d[k] * 0.3;
      let y = 0;
      for (const c of combs) { const o = c.buf[c.i]; c.lp = o * 0.6 + c.lp * 0.4; c.buf[c.i] = x + c.lp * 0.8; c.i = (c.i + 1) % c.buf.length; y += o; }
      for (const a of aps) { const o = a.buf[a.i]; const v = y + o * 0.5; a.buf[a.i] = v; a.i = (a.i + 1) % a.buf.length; y = o - v * 0.5; }
      if (pass === 1) out[k] = d[k] + y * wet;
    }
  }
  let peak = 0;
  for (let k = 0; k < n; k++) peak = Math.max(peak, Math.abs(out[k]));
  const g = 0.9 / (peak || 1);
  for (let k = 0; k < n; k++) out[k] = Math.tanh(out[k] * g * 1.1) * 0.9;
  return out;
}

/* ---------------- the pieces ---------------- */
function grid(bpm, swing = 0) {
  const b = 60 / bpm;
  return (beat) => { const f = beat % 1; return (Math.floor(beat) + (Math.abs(f - 0.5) < 1e-6 ? 0.5 + swing : f)) * b; };
}

const STYLES = {
  lofi() {
    const bpm = 78, bars = 16, T = grid(bpm, 0.14), B = new Buf((bars * 4 * 60) / bpm), R = seeded("lofi");
    const A = [[65, "maj7"], [64, "m7"], [62, "m7"], [60, "maj7"]], Bs = [[58, "maj7"], [57, "m7"], [55, "m7"], [60, "sus"]];
    const prog = [...A, ...A, ...Bs, ...A];
    const chordAt = (beat) => chord(...prog[Math.floor(beat / 4) % 16]);
    prog.forEach(([root, q], bar) => {
      const c = chord(root, q), b0 = bar * 4;
      c.forEach((m, i) => { I.ep(B, T(b0) + i * 0.012, m, T(1.4) - T(0), 0.5); I.ep(B, T(b0 + 2.5) + i * 0.012, m, T(1) - T(0), 0.32); });
      I.bass(B, T(b0), root - 24, 60 / bpm * 1.5, 0.7); I.bass(B, T(b0 + 2.5), root - 24 + 7, 60 / bpm * 0.8, 0.5);
      [0, 1.75, 2.5].forEach((x) => I.kick(B, T(b0 + x), x ? 0.55 : 0.75));
      [1, 3].forEach((x) => I.snare(B, T(b0 + x), 0.38));
      for (let e = 0; e < 8; e++) I.hat(B, T(b0 + e / 2), e % 2 ? 0.16 : 0.24);
    });
    melody(R, scaleNotes(65, PENT, 72, 89), chordAt, bars, 4, { rhythms: [0.5, 1, 1, 1.5], rest: 0.35, startBar: 4 })
      .forEach((n) => I.bell(B, T(n.beat), n.m, (n.d * 60) / bpm, 0.42));
    return finish(B, 0.3);
  },
  synthwave() {
    const bpm = 104, bars = 16, T = grid(bpm), b = 60 / bpm, B = new Buf(bars * 4 * b), R = seeded("synth");
    const prog = [[57, "min"], [53, "maj"], [60, "maj"], [55, "maj"]];
    const chordAt = (beat) => chord(...prog[Math.floor(beat / 4) % 4]);
    for (let bar = 0; bar < bars; bar++) {
      const [root, q] = prog[bar % 4], c = chord(root, q), b0 = bar * 4;
      const arp = [c[0], c[1], c[2], c[0] + 12, c[2], c[1], c[0] + 12, c[1] + 12];
      for (let s = 0; s < 16; s++) I.pluck(B, T(b0 + s / 4), arp[s % 8] + 12, b * 0.22, 0.32, { decay: 0.994, bright: 0.7, mute: 22 });
      for (let e = 0; e < 8; e++) I.sawBass(B, T(b0 + e / 2), root - 12 + (e % 2 ? 12 : 0) - 12, b * 0.4, 0.6);
      c.forEach((m) => I.pad(B, T(b0), m, b * 4, 0.16));
      for (let x = 0; x < 4; x++) I.kick(B, T(b0 + x), 0.75);
      if (bar >= 2) [1, 3].forEach((x) => I.snare(B, T(b0 + x), 0.5));
      for (let e = 0; e < 4; e++) I.hat(B, T(b0 + e + 0.5), 0.22, true);
    }
    melody(R, scaleNotes(57, MPENT, 69, 84), chordAt, bars, 4, { rhythms: [0.5, 1, 1, 2], rest: 0.25, startBar: 8 })
      .forEach((n) => I.square(B, T(n.beat), n.m, n.d * b * 0.9, 0.35, 0.3));
    return finish(B, 0.35);
  },
  ambient() {
    const bpm = 72, bars = 16, T = grid(bpm), b = 60 / bpm, B = new Buf(bars * 4 * b), R = seeded("ambient");
    const prog = [[62, "maj9"], [59, "m9"], [55, "maj7"], [57, "sus"]];
    for (let i = 0; i < 8; i++) {
      const [root, q] = prog[i % 4], c = chord(root, q), b0 = i * 8;
      c.forEach((m) => I.pad(B, T(b0), m - 12, b * 8, 0.2, 0.04));
      I.bass(B, T(b0), root - 24, b * 7.5, 0.5, 0.3);
      for (let e = 0; e < 16; e++) if (R() < 0.55) I.bell(B, T(b0 + e / 2), c[Math.floor(R() * c.length)] + 12 * (R() < 0.4 ? 1 : 0), b * 0.5, 0.18 + R() * 0.16);
      for (let x = 0; x < 8; x++) I.shaker(B, T(b0 + x + 0.5), 0.12);
    }
    return finish(B, 0.55);
  },
  dark() {
    const bpm = 118, bars = 16, T = grid(bpm), b = 60 / bpm, B = new Buf(bars * 4 * b), R = seeded("dark");
    const prog = [[52, "min"], [52, "min"], [48, "maj7"], [47, "7"]];
    const chordAt = (beat) => chord(...prog[Math.floor(beat / 4) % 4]);
    for (let bar = 0; bar < bars; bar++) {
      const [root, q] = prog[bar % 4], b0 = bar * 4;
      for (let x = 0; x < 4; x++) {
        I.kick(B, T(b0 + x), 0.85);
        [0.25, 0.5, 0.75].forEach((s, j) => I.sawBass(B, T(b0 + x + s), root - 12 + (j === 1 ? 0 : 0), b * 0.18, j === 1 ? 0.55 : 0.4));
        I.hat(B, T(b0 + x + 0.5), 0.2, x % 2 === 1);
      }
      if (bar >= 4) [1, 3].forEach((x) => I.snare(B, T(b0 + x), 0.42));
      if (bar % 2 === 0) chord(root, q).forEach((m) => I.pluck(B, T(b0 + 1.75), m + 12, b * 1.5, 0.28, { decay: 0.998, bright: 0.4 }));
      I.pad(B, T(b0), root - 24, b * 4, 0.14, 0.03);
    }
    melody(R, scaleNotes(52, PHRY, 64, 81), chordAt, bars, 4, { rhythms: [1, 1.5, 2, 0.5], rest: 0.4, startBar: 8 })
      .forEach((n) => I.bell(B, T(n.beat), n.m, n.d * b, 0.3));
    return finish(B, 0.4);
  },
  bossa() {
    const bpm = 128, bars = 16, T = grid(bpm), b = 60 / bpm, B = new Buf(bars * 4 * b), R = seeded("bossa");
    const prog = [[50, "m9"], [43, "13"], [48, "maj9"], [45, "7b9"]];
    const chordAt = (beat) => chord(...prog[Math.floor(beat / 4) % 4]);
    const comp = [[0, 1.5, 3], [0.5, 2, 3.5]], clave = [[0, 1.5, 3], [1, 2.5]];
    for (let bar = 0; bar < bars; bar++) {
      const [root, q] = prog[bar % 4], c = chord(root, q).slice(1).map((m) => (m < 55 ? m + 12 : m > 72 ? m - 12 : m)), b0 = bar * 4;
      comp[bar % 2].forEach((x) => c.forEach((m, i) => I.pluck(B, T(b0 + x) + i * 0.014, m, b * 0.8, 0.3, { decay: 0.995, bright: 0.25, mute: 10 })));
      [[0, 0, 1.4], [1.5, 7, 0.45], [2, 7, 1.4], [3.5, 0, 0.45]].forEach(([x, iv, d]) => I.bass(B, T(b0 + x), root - 12 + iv - (root > 46 ? 12 : 0), d * b, 0.65));
      clave[bar % 2].forEach((x) => I.rim(B, T(b0 + x), 0.35));
      for (let e = 0; e < 8; e++) I.shaker(B, T(b0 + e / 2), e % 2 ? 0.14 : 0.22);
      [0, 2].forEach((x) => I.kick(B, T(b0 + x), 0.4));
    }
    melody(R, scaleNotes(50, DOR, 69, 86), chordAt, bars, 4, { rhythms: [0.5, 1, 1.5, 2], rest: 0.25, startBar: 4 })
      .forEach((n) => I.flute(B, T(n.beat), n.m, n.d * b * 0.95, 0.4));
    return finish(B, 0.3);
  },
  raag() {
    const bpm = 84, bars = 16, b = 60 / bpm, B = new Buf(bars * 4 * b);
    // tanpura: Pa Sa Sa Sa(low), ringing, with a soft drone underneath
    for (let x = 0; x < bars * 4; x++) I.pluck(B, x * b, [55, 60, 60, 48][x % 4], b * 3, 0.28, { decay: 0.9992, bright: 0.85, drive: 1.6 });
    I.pad(B, 0, 36, bars * 4 * b - 1, 0.1, 0.02); I.pad(B, 0, 43, bars * 4 * b - 1, 0.07, 0.02);
    // teentaal theka, 16 beats
    const theka = ["dha", "dhin", "dhin", "dha", "dha", "dhin", "dhin", "dha", "dha", "tin", "tin", "ta", "ta", "dhin", "dhin", "dha"];
    for (let x = 0; x < bars * 4; x++) {
      I.tabla(B, x * b, theka[x % 16], x % 16 === 0 ? 0.7 : 0.5);
      if (x >= 48 && x % 2 === 1) I.tabla(B, (x + 0.5) * b, "na", 0.28);
    }
    // sitar phrases in raag Yaman (N R G M# P D N S')
    const P = [
      [[59, 0.5], [62, 0.5], [64, 1], [62, 0.5], [60, 1.5]],
      [[59, 0.5], [62, 0.5], [64, 0.5], [66, 0.5], [67, 2]],
      [[66, 0.5], [64, 0.5], [66, 0.5], [69, 0.5], [67, 1], [66, 0.5], [64, 0.5], [62, 1], [60, 1]],
      [[64, 0.5], [66, 0.5], [69, 0.5], [71, 0.5], [72, 2], [71, 0.5], [69, 0.5], [67, 1]],
      [[71, 0.5], [74, 0.5], [72, 1], [71, 0.5], [69, 0.5], [67, 1], [66, 0.5], [64, 0.5], [62, 0.5], [60, 1.5]],
    ];
    let pos = 4;
    for (const i of [0, 1, 2, 3, 4, 1, 3, 4, 0]) {
      for (const [m, d] of P[i]) { if (pos + d > bars * 4) break; I.pluck(B, pos * b, m + 12, d * b, 0.42, { decay: 0.997, bright: 0.9, drive: 2.2, mute: 6 }); pos += d; }
      pos += 1;
    }
    return finish(B, 0.35);
  },
  chiptune() {
    const bpm = 132, bars = 16, T = grid(bpm), b = 60 / bpm, B = new Buf(bars * 4 * b), R = seeded("chip");
    const prog = [[60, "maj"], [57, "min"], [53, "maj"], [55, "maj"]];
    const chordAt = (beat) => chord(...prog[Math.floor(beat / 4) % 4]);
    for (let bar = 0; bar < bars; bar++) {
      const [root, q] = prog[bar % 4], c = chord(root, q), b0 = bar * 4;
      for (let s = 0; s < 16; s++) I.square(B, T(b0 + s / 4), c[s % 3] + 12, b * 0.2, 0.14, 0.125);
      for (let e = 0; e < 8; e++) I.tri(B, T(b0 + e / 2), root - 24 + (e % 2 ? 12 : 0), b * 0.42, 0.7);
      [0, 2].forEach((x) => I.kick(B, T(b0 + x), 0.6));
      [1, 3].forEach((x) => I.snare(B, T(b0 + x), 0.4));
      for (let e = 0; e < 8; e++) I.hat(B, T(b0 + e / 2), 0.18);
    }
    melody(R, scaleNotes(60, MAJ, 67, 86), chordAt, bars, 4, { rhythms: [0.5, 0.5, 1, 1.5], rest: 0.12 })
      .forEach((n) => I.square(B, T(n.beat), n.m, n.d * b * 0.85, 0.42, 0.5));
    return finish(B, 0.15);
  },
  swing() {
    const bpm = 156, bars = 16, T = grid(bpm, 0.17), b = 60 / bpm, B = new Buf(bars * 4 * b), R = seeded("swing");
    const prog = [[48, "m7"], [41, "7"], [46, "maj7"], [43, "7"]];
    const chordAt = (beat) => chord(...prog[Math.floor(beat / 4) % 4]);
    for (let bar = 0; bar < bars; bar++) {
      const [root, q] = prog[bar % 4], c = chord(root, q), b0 = bar * 4, next = prog[(bar + 1) % 4][0];
      // walking bass: root, 3rd, 5th, then a chromatic step into the next chord
      [root, c[1], c[2], next + (R() < 0.5 ? 1 : -1)].forEach((m, x) => I.bass(B, T(b0 + x), m - 12, b * 0.9, 0.62, 3));
      // rootless piano comping, charleston
      const voicing = [c[1], c[3] ?? c[2], c[1] + 10 - (q === "m7" ? 0 : 1)].map((m) => (m < 60 ? m + 12 : m));
      [0, 1.5].forEach((x) => voicing.forEach((m) => I.ep(B, T(b0 + x), m, b * 0.45, 0.32)));
      [0, 1, 1.5, 2, 3, 3.5].forEach((x) => I.ride(B, T(b0 + x), x % 1 ? 0.18 : 0.26));
      [1, 3].forEach((x) => I.hat(B, T(b0 + x), 0.18));
      if (bar % 4 === 3) I.snare(B, T(b0 + 3.5), 0.25);
    }
    melody(R, scaleNotes(46, MAJ, 67, 84), chordAt, bars, 4, { rhythms: [0.5, 0.5, 0.5, 1, 1.5], rest: 0.2, startBar: 4 })
      .forEach((n) => I.bell(B, T(n.beat), n.m, n.d * b, 0.4));
    return finish(B, 0.28);
  },
  blues() {
    const bpm = 96, bars = 12, T = grid(bpm, 0.17), b = 60 / bpm, B = new Buf(bars * 4 * b);
    const roots = [40, 40, 40, 40, 45, 45, 40, 40, 47, 45, 40, 47];
    roots.forEach((root, bar) => {
      const b0 = bar * 4, upper = [7, 7, 9, 9, 10, 10, 9, 9];
      for (let e = 0; e < 8; e++) {
        I.pluck(B, T(b0 + e / 2), root, b * 0.4, 0.4, { decay: 0.995, bright: 0.8, drive: 4, mute: 20 });
        I.pluck(B, T(b0 + e / 2) + 0.008, root + upper[e], b * 0.4, 0.34, { decay: 0.995, bright: 0.8, drive: 4, mute: 20 });
        I.hat(B, T(b0 + e / 2), e % 2 ? 0.14 : 0.22);
      }
      [0, 4, 7, 9].forEach((iv, x) => I.bass(B, T(b0 + x), root - 12 + iv, b * 0.85, 0.6, 2));
      [0, 2, 2.5].forEach((x) => I.kick(B, T(b0 + x), 0.7));
      [1, 3].forEach((x) => I.snare(B, T(b0 + x), 0.5));
    });
    // a little lick over the turnaround
    [[76, 0.5], [79, 0.5], [76, 0.5], [74, 0.5], [71, 1], [69, 0.5], [67, 1.5]].reduce((pos, [m, d]) => { I.flute(B, T(pos), m, d * b, 0.35); return pos + d; }, 36);
    return finish(B, 0.25);
  },
};

export function renderStyle(style) {
  return (STYLES[style] || STYLES.lofi)();
}
