/*
  Audio engine: one "playback head" (AudioWorklet) whose speed follows the platter.
  Music is rendered in a Web Worker (compose.js) or decoded from a file if a record has music.src.
*/
const cache = new Map();   // record id -> Promise<{ data: Float32Array, sr }>
let worker = null;
const waiting = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./music.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (w) { waiting.delete(e.data.id); w(e.data); } };
  }
  return worker;
}

/** Start rendering a record's music (safe to call repeatedly; it's cached). */
export function prepare(record) {
  if (cache.has(record.id)) return cache.get(record.id);
  let p;
  if (record.music?.src) {
    p = fetch(record.music.src)
      .then((r) => r.arrayBuffer())
      .then((ab) => new OfflineAudioContext(1, 1, 44100).decodeAudioData(ab))
      .then((buf) => ({ data: buf.getChannelData(0), sr: buf.sampleRate }));
  } else {
    p = new Promise((res) => { waiting.set(record.id, res); getWorker().postMessage({ id: record.id, style: record.music?.style }); });
  }
  cache.set(record.id, p);
  return p;
}

/** Warm the cache for every record, one at a time, while the visitor looks around. */
export function prepareAll(records) {
  let i = 0;
  const next = () => { if (i < records.length) prepare(records[i++]).then(() => setTimeout(next, 60)); };
  setTimeout(next, 1200);
}

export const engine = {
  ctx: null, node: null, master: null, ready: null, progress: 0, muted: false, loadedId: null,

  /** Must be called from a user gesture (click / pointerdown) the first time. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return Promise.resolve(false);
      this.ctx = new AC();
      this.ready = this.ctx.audioWorklet
        .addModule(new URL("turntable-worklet.js", document.baseURI).href)
        .then(() => {
          const ctx = this.ctx;
          this.node = new AudioWorkletNode(ctx, "turntable-head", { outputChannelCount: [2] });
          this.node.port.onmessage = (e) => (this.progress = e.data);
          // gentle "gramophone" voicing: no hiss, just a warm band-limited tone
          const hp = new BiquadFilterNode(ctx, { type: "highpass", frequency: 70 });
          const mid = new BiquadFilterNode(ctx, { type: "peaking", frequency: 2400, Q: 0.7, gain: 2.5 });
          const lp = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 8000, Q: 0.5 });
          this.master = new GainNode(ctx, { gain: this.muted ? 0 : 0.9 });
          this.node.connect(hp).connect(mid).connect(lp).connect(this.master).connect(ctx.destination);
          return true;
        })
        .catch((err) => { console.warn("Audio unavailable:", err); return false; });
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ready;
  },

  async load(record) {
    const ok = await this.ready;
    const track = await prepare(record);
    if (!ok) return;
    this.node.port.postMessage({ type: "load", data: track.data.slice(), sr: track.sr });
    this.loadedId = record.id;
    this.progress = 0;
    this.duration = track.data.length / track.sr;
  },

  unload() { this.node?.port.postMessage({ type: "unload" }); this.loadedId = null; },

  setRate(r) { if (this.node) this.node.parameters.get("rate").setTargetAtTime(r, this.ctx.currentTime, 0.012); },

  setGain(g, tau = 0.06) { if (this.node) this.node.parameters.get("gain").setTargetAtTime(g, this.ctx.currentTime, tau); },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  },

  /** soft needle-drop thump */
  thump() {
    if (!this.master || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime, o = new OscillatorNode(ctx, { frequency: 110 }), g = new GainNode(ctx, { gain: 0 });
    o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.2);
  },
};
