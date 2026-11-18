/*
  Turntable playback head. Reads the current record's audio at a variable speed, including
  backwards, so scratching, slowing down and spin-up behave like a real platter.
  `rate` = 1 is normal speed, 0 is stopped, negative plays in reverse.
*/
class TurntableHead extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rate", defaultValue: 0, automationRate: "a-rate" },
      { name: "gain", defaultValue: 0, automationRate: "a-rate" },
    ];
  }
  constructor() {
    super();
    this.buf = null; this.pos = 0; this.ratio = 1; this.tick = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === "load") { this.buf = d.data; this.ratio = d.sr / sampleRate; this.pos = 0; }
      if (d.type === "seek" && this.buf) this.pos = d.at * this.buf.length;
      if (d.type === "unload") this.buf = null;
    };
  }
  process(_inputs, outputs, params) {
    const out = outputs[0], L = out[0], b = this.buf;
    if (!b) { for (const ch of out) ch.fill(0); return true; }
    const n = b.length, rate = params.rate, gain = params.gain;
    for (let i = 0; i < L.length; i++) {
      this.pos += (rate.length > 1 ? rate[i] : rate[0]) * this.ratio;
      if (this.pos >= n) this.pos -= n; else if (this.pos < 0) this.pos += n;
      const i0 = this.pos | 0, f = this.pos - i0;
      L[i] = (b[i0] * (1 - f) + b[i0 + 1 < n ? i0 + 1 : 0] * f) * (gain.length > 1 ? gain[i] : gain[0]);
    }
    for (let c = 1; c < out.length; c++) out[c].set(L);
    if ((this.tick++ & 7) === 0) this.port.postMessage(this.pos / n);
    return true;
  }
}
registerProcessor("turntable-head", TurntableHead);
