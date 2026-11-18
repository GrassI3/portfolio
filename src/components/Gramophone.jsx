import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { RecordDisc, DiscSheen, R_DISC } from "./RecordDisc.jsx";
import { engine } from "../audio/engine.js";

/* ---------- geometry (SVG units, viewBox 0 0 600 660) ---------- */
const C = { x: 300, y: 352 };        // platter centre on screen
const K = 0.34;                      // vertical squash of the platter plane (viewing angle)
const ELBOW = { x: 150, y: 268 };    // where the tonearm leaves the horn neck
const PIVOT = { x: -150, y: -153 };  // the same point, in record-plane coordinates
const ARM_L = 250;
export const ARM = { REST: 0, START: 14.8, END: 35.3 };
const OMEGA = 200;                   // deg/s at normal speed (33⅓ rpm)

const toScreen = (x, y) => ({ x: C.x + x, y: C.y + y * K });
const tip = (deg) => {
  const a = (deg * Math.PI) / 180;
  return toScreen(PIVOT.x + ARM_L * Math.cos(a), PIVOT.y + ARM_L * Math.sin(a));
};

/* ---------- horn geometry ---------- */
function useHorn() {
  return useMemo(() => {
    const HC = { x: 318, y: 118 }, RX = 205, RY = 100, ROT = (-14 * Math.PI) / 180, LOBES = 10;
    const H0 = { x: 205, y: 205 };           // where the neck enters the horn
    const G = { x: 266, y: 158 };            // visible depth of the throat
    const pt = (th, s = 1) => {
      const m = (1 + 0.05 * Math.abs(Math.sin((LOBES / 2) * th))) * s;
      const x = RX * m * Math.cos(th), y = RY * m * Math.sin(th);
      return { x: HC.x + x * Math.cos(ROT) - y * Math.sin(ROT), y: HC.y + x * Math.sin(ROT) + y * Math.cos(ROT) };
    };
    const N = 240, rim = [];
    for (let i = 0; i < N; i++) rim.push(pt((i / N) * Math.PI * 2));
    const poly = (arr) => arr.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("") + "Z";
    const rimD = poly(rim);
    // petal panels (wedges from the throat to the rim)
    const panels = [], seams = [];
    for (let j = 0; j < LOBES; j++) {
      const a0 = (j / LOBES) * N, a1 = ((j + 1) / LOBES) * N, pts = [G];
      for (let i = a0; i <= a1; i++) pts.push(rim[i % N]);
      panels.push(poly(pts));
      const s = rim[a0 % N], mx = G.x + (s.x - G.x) * 0.55, my = G.y + (s.y - G.y) * 0.55;
      seams.push(`M${G.x} ${G.y} Q${(mx + (s.y - G.y) * 0.06).toFixed(1)} ${(my - (s.x - G.x) * 0.06).toFixed(1)} ${s.x.toFixed(1)} ${s.y.toFixed(1)}`);
    }
    const rivets = Array.from({ length: 44 }, (_, i) => pt((i / 44) * Math.PI * 2 + 0.03, 0.975));
    // outer cone silhouette: tangents from the neck to the rim
    let lo = null, hi = null;
    const ax = Math.atan2(HC.y - H0.y, HC.x - H0.x);
    rim.forEach((p) => {
      let a = Math.atan2(p.y - H0.y, p.x - H0.x) - ax;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (!lo || a < lo.a) lo = { a, p };
      if (!hi || a > hi.a) hi = { a, p };
    });
    const nx = -Math.sin(ax) * 13, ny = Math.cos(ax) * 13;
    const cone = `M${H0.x - nx} ${H0.y - ny} L${lo.p.x} ${lo.p.y} L${HC.x} ${HC.y} L${hi.p.x} ${hi.p.y} L${H0.x + nx} ${H0.y + ny} Z`;
    return { rimD, panels, seams, rivets, cone, G, H0 };
  }, []);
}

const columnPath = (cx) => {
  const prof = [[428, 14], [434, 14], [437, 9], [446, 8], [452, 11.5], [459, 8], [490, 6.5], [500, 10], [509, 6.5], [538, 7.5], [545, 11.5], [551, 9], [555, 14], [560, 14]];
  const right = prof.map(([y, w]) => `L${cx + w} ${y}`).join("");
  const left = [...prof].reverse().map(([y, w]) => `L${cx - w} ${y}`).join("");
  return `M${cx - prof[0][1]} ${prof[0][0]}${right}${left}Z`;
};

const Daisy = ({ x, y, s = 1, fill = "#f6d98a", stroke = "#7a4f14", center = "#7a4a12" }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <ellipse key={a} cx="0" cy="-4.6" rx="2.1" ry="4.2" transform={`rotate(${a})`} fill={fill} stroke={stroke} strokeWidth=".5" />
    ))}
    <circle r="2.2" fill={center} />
  </g>
);

export default function Gramophone({ ref, record, onRecordTap, onArmTap, setCursor }) {
  const horn = useHorn();
  const svgRef = useRef(null), planeRef = useRef(null), spinRef = useRef(null);
  const armRef = useRef(null), armHiRef = useRef(null), boxRef = useRef(null);
  const S = useRef({
    angle: 0, rate: 0, motor: 0, held: false, hand: 0, lastMove: 0, lastA: 0, lastT: 0, down: null,
    needle: false, mode: "rest", armA: ARM.REST, lift: 0, liftTarget: 0, hasRecord: false,
  });

  /* ---------- animation / physics loop ---------- */
  useEffect(() => {
    let raf, last = performance.now();
    const loop = (now) => {
      const s = S.current, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (s.held) {
        if (now - s.lastMove > 60) s.hand *= Math.exp(-dt / 0.05); // a still hand stops the record
        s.rate = s.hand;
      } else {
        const tau = Math.abs(s.motor) > Math.abs(s.rate) ? 0.45 : 0.9; // motor spin-up / friction
        s.rate += (s.motor - s.rate) * (1 - Math.exp(-dt / tau));
        s.angle += s.rate * OMEGA * dt;
      }
      s.angle %= 360;
      spinRef.current?.setAttribute("transform", `rotate(${s.angle.toFixed(2)})`);
      engine.setRate(s.needle ? s.rate : 0);

      // tonearm follows the groove while playing
      const target = s.mode === "play" ? ARM.START + (ARM.END - ARM.START) * engine.progress : s.mode === "cue" ? ARM.START : ARM.REST;
      s.armA += (target - s.armA) * (1 - Math.exp(-dt / (s.mode === "play" ? 0.3 : 0.18)));
      s.lift += (s.liftTarget - s.lift) * (1 - Math.exp(-dt / 0.09));
      drawArm(s.armA, s.lift);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function drawArm(a, lift) {
    const t = tip(a), ex = t.x, ey = t.y - 22 - lift * 16;
    const d = `M${ELBOW.x} ${ELBOW.y} Q${((ELBOW.x + ex) / 2).toFixed(1)} ${(Math.min(ELBOW.y, ey) - 20).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    armRef.current?.setAttribute("d", d);
    armHiRef.current?.setAttribute("d", d);
    boxRef.current?.setAttribute("transform", `translate(${t.x.toFixed(1)} ${(t.y - 13 - lift * 16).toFixed(1)})`);
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- public controls ---------- */
  useImperativeHandle(ref, () => ({
    /** Where the record sits on screen (for flights in/out). */
    geometry() {
      const m = planeRef.current.getScreenCTM();
      return { cx: m.e, cy: m.f, rx: R_DISC * m.a, ry: R_DISC * m.d, angle: S.current.angle };
    },
    setAngle(a) { S.current.angle = a; },
    stage() { return svgRef.current; },
    setHasRecord(v) { S.current.hasRecord = v; },
    async play() {
      const s = S.current;
      s.motor = 1;                       // platter spins up first…
      await wait(450);
      s.mode = "cue"; s.liftTarget = 1;  // …arm swings over, lifted…
      await wait(650);
      s.liftTarget = 0;                  // …and the needle drops
      await wait(140);
      s.mode = "play"; s.needle = true;
      engine.thump();
      engine.setGain(1, 0.08);
    },
    async stop() {
      const s = S.current;
      s.needle = false; s.liftTarget = 1; engine.setGain(0, 0.03);
      await wait(150);
      s.mode = "rest"; s.motor = 0;
      await wait(500);
      s.liftTarget = 0;
      await wait(150);
    },
    togglePause() {
      const s = S.current;
      if (!s.hasRecord) return false;
      const pausing = s.needle;
      if (pausing) { s.needle = false; s.liftTarget = 1; engine.setGain(0, 0.03); }
      else { s.liftTarget = 0; s.mode = "play"; s.motor = 1; setTimeout(() => { s.needle = true; engine.thump(); engine.setGain(1, 0.08); }, 120); }
      return pausing; // true = now paused
    },
    isNeedleDown() { return S.current.needle; },
  }));

  /* ---------- touching the record ---------- */
  const localAngle = (e) => {
    const svg = svgRef.current, p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const l = p.matrixTransform(planeRef.current.getScreenCTM().inverse());
    return { a: (Math.atan2(l.y, l.x) * 180) / Math.PI, r: Math.hypot(l.x, l.y) };
  };
  const onDown = (e) => {
    const s = S.current;
    if (!s.hasRecord || e.button > 0) return;
    const { a, r } = localAngle(e);
    if (r > R_DISC + 4) return;
    engine.unlock();
    e.currentTarget.setPointerCapture(e.pointerId);
    Object.assign(s, { held: true, hand: s.rate, lastA: a, lastT: performance.now(), lastMove: performance.now(), down: { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 } });
    setCursor?.("scratch");
  };
  const onMove = (e) => {
    const s = S.current;
    if (!s.held) return;
    const now = performance.now(), { a } = localAngle(e);
    let d = a - s.lastA;
    d = ((d + 540) % 360) - 180;
    const dt = Math.max(0.004, (now - s.lastT) / 1000);
    s.angle += d;
    s.hand += ((d / dt) / OMEGA - s.hand) * 0.55;
    s.hand = Math.max(-8, Math.min(8, s.hand));
    s.lastA = a; s.lastT = now; s.lastMove = now;
    s.down.moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) + Math.abs(d) * 0.5;
  };
  const onUp = () => {
    const s = S.current;
    if (!s.held) return;
    s.held = false;
    setCursor?.(null);
    const tap = s.down && s.down.moved < 6 && performance.now() - s.down.t < 350;
    if (tap) { s.rate = s.motor; onRecordTap?.(); }   // a quick tap: don't disturb the music
  };

  const t0 = tip(ARM.REST);

  return (
    <svg ref={svgRef} className="gramophone" viewBox="0 0 600 660" role="img" aria-label="Gramophone">
      <defs>
        <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe6a6" /><stop offset=".35" stopColor="#d4a148" /><stop offset=".7" stopColor="#9a6a24" /><stop offset="1" stopColor="#5e3c12" />
        </linearGradient>
        <linearGradient id="brassTube" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6e4814" /><stop offset=".45" stopColor="#f6dc95" /><stop offset="1" stopColor="#7d5419" />
        </linearGradient>
        <linearGradient id="cone" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#4a2e0c" /><stop offset=".45" stopColor="#c89040" /><stop offset=".6" stopColor="#f0cf82" /><stop offset="1" stopColor="#6b4614" />
        </linearGradient>
        <radialGradient id="hornIn" cx={horn.G.x} cy={horn.G.y} r="240" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0a0401" /><stop offset=".1" stopColor="#24100a" /><stop offset=".26" stopColor="#6b3112" />
          <stop offset=".5" stopColor="#ad6f28" /><stop offset=".78" stopColor="#d9ac58" /><stop offset="1" stopColor="#f1d48a" />
        </radialGradient>
        {/* the upper inner wall of the bell faces away from the light */}
        <linearGradient id="hornShade" x1="0" y1="0" x2=".25" y2="1">
          <stop offset="0" stopColor="#1a0c02" stopOpacity=".55" /><stop offset=".55" stopColor="#1a0c02" stopOpacity="0" />
          <stop offset="1" stopColor="#fff4cf" stopOpacity=".12" />
        </linearGradient>
        <radialGradient id="hornFade" cx={horn.G.x} cy={horn.G.y} r="230" gradientUnits="userSpaceOnUse">
          <stop offset=".18" stopColor="#000" /><stop offset=".55" stopColor="#fff" />
        </radialGradient>
        <mask id="embossMask"><path d={horn.rimD} fill="url(#hornFade)" /></mask>
        <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6d6a65" /><stop offset=".4" stopColor="#f2f0eb" /><stop offset=".6" stopColor="#bdb9b1" /><stop offset="1" stopColor="#55524d" />
        </linearGradient>
        <linearGradient id="lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a160d" /><stop offset="1" stopColor="#6a2414" />
        </linearGradient>
        <linearGradient id="mahog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a1d11" /><stop offset="1" stopColor="#2c0a06" />
        </linearGradient>
        <linearGradient id="turned" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#250705" /><stop offset=".4" stopColor="#8d3b22" /><stop offset=".55" stopColor="#6a2615" /><stop offset="1" stopColor="#2a0806" />
        </linearGradient>
        <linearGradient id="metalSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".3" />
        </linearGradient>
        <radialGradient id="felt" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#3e1a14" /><stop offset="1" stopColor="#21100c" />
        </radialGradient>
        <radialGradient id="ball" cx=".35" cy=".35" r=".7">
          <stop offset="0" stopColor="#fff3c8" /><stop offset=".4" stopColor="#d6a24a" /><stop offset="1" stopColor="#5e3c12" />
        </radialGradient>
        <pattern id="floral" width="36" height="28" patternUnits="userSpaceOnUse">
          <rect width="36" height="28" fill="#c4923b" />
          <path d="M0 14 C9 3 18 25 36 14" stroke="#6e4714" strokeWidth="1.5" fill="none" />
          <ellipse cx="7" cy="9" rx="1.6" ry="3.4" transform="rotate(-40 7 9)" fill="#e9c46a" stroke="#6e4714" strokeWidth=".4" />
          <ellipse cx="29" cy="19" rx="1.6" ry="3.4" transform="rotate(-40 29 19)" fill="#e9c46a" stroke="#6e4714" strokeWidth=".4" />
          <Daisy x={18} y={14} s={0.95} />
          <circle cx="3" cy="24" r=".9" fill="#6e4714" /><circle cx="33" cy="4" r=".9" fill="#6e4714" />
        </pattern>
        <pattern id="floralSmall" href="#floral" patternTransform="scale(.5)" />
        <pattern id="emboss" width="46" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)">
          <g opacity=".55"><Daisy x={23} y={20} s={1.15} fill="none" stroke="#6a4310" center="none" /></g>
          <path d="M0 36 C10 30 14 40 23 36 S36 30 46 36" stroke="#6a4310" strokeWidth=".7" fill="none" opacity=".45" />
          <circle cx="4" cy="6" r="1" fill="#fff2c4" opacity=".5" />
        </pattern>
        <filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>

      {/* floor shadow */}
      <ellipse cx="300" cy="612" rx="275" ry="16" fill="#000" opacity=".55" filter="url(#soft)" />

      {/* ---------- plinth ---------- */}
      <rect x="66" y="568" width="468" height="36" rx="2" fill="url(#mahog)" />
      <rect x="82" y="576" width="436" height="18" fill="url(#floralSmall)" />
      <rect x="82" y="576" width="436" height="18" fill="url(#metalSheen)" />
      <rect x="82" y="576" width="436" height="18" fill="none" stroke="#2a0806" strokeWidth="1.5" />
      <path d="M84 556 L516 556 L526 568 L74 568 Z" fill="#7a2c18" />
      <path d="M84 556 L516 556" stroke="#c46a45" strokeOpacity=".5" />

      {/* ---------- cabinet front ---------- */}
      <rect x="100" y="430" width="400" height="128" fill="url(#mahog)" />
      {[[128, 441, 51], [128, 499, 50]].map(([x, y, h]) => (
        <g key={y}>
          <rect x={x} y={y} width="344" height={h} fill="url(#floral)" />
          <rect x={x} y={y} width="344" height={h} fill="url(#metalSheen)" />
          <rect x={x} y={y} width="344" height={h} fill="none" stroke="#2a0806" strokeWidth="2.5" />
        </g>
      ))}
      {[108, 492].map((cx) => (
        <g key={cx}>
          <path d={columnPath(cx)} fill="url(#turned)" />
          <rect x={cx - 11.5} y="450" width="23" height="3" fill="#d6a54f" opacity=".85" />
          <rect x={cx - 11.5} y="543" width="23" height="3" fill="#d6a54f" opacity=".85" />
        </g>
      ))}

      {/* crank */}
      <g>
        <rect x="508" y="478" width="30" height="5" rx="2" fill="url(#chrome)" />
        <circle cx="510" cy="480.5" r="6" fill="url(#chrome)" />
        <rect x="535" y="478" width="6" height="34" rx="3" fill="url(#chrome)" />
        <rect x="532" y="506" width="12" height="26" rx="6" fill="url(#turned)" />
      </g>

      {/* ---------- lid (top) ---------- */}
      <path d="M118 290 L482 290 L508 418 L92 418 Z" fill="url(#lid)" />
      <g opacity=".1" stroke="#000" fill="none">
        <path d="M130 312 C230 300 360 326 470 306" /><path d="M120 348 C240 338 330 362 488 344" /><path d="M110 386 C210 376 380 398 498 380" />
      </g>
      <path d="M133 300 L467 300 L490 408 L110 408 Z" fill="none" stroke="url(#floralSmall)" strokeWidth="7" />
      <path d="M128 296 L472 296 L496 412 L104 412 Z" fill="none" stroke="#e2b660" strokeOpacity=".5" strokeWidth=".8" />
      <path d="M138 304 L462 304 L484 404 L116 404 Z" fill="none" stroke="#e2b660" strokeOpacity=".5" strokeWidth=".8" />
      <path d="M86 418 L514 418 L514 432 L86 432 Z" fill="#7a2c18" />
      <path d="M86 418 L514 418" stroke="#d27b52" strokeOpacity=".55" strokeWidth="1.2" />
      <path d="M86 432 L514 432" stroke="#1a0503" strokeWidth="1.5" />

      {/* ---------- horn bracket, neck & horn ---------- */}
      <path d="M140 304 C133 290 139 280 143 272 L157 272 C161 280 167 290 160 304 Z" fill="url(#chrome)" />
      <circle cx="150" cy="292" r="3.2" fill="#3a3733" />
      <path d={horn.cone} fill="url(#cone)" />
      <path d="M150 272 C150 238 166 214 205 205" stroke="url(#brassTube)" strokeWidth="22" fill="none" strokeLinecap="round" />
      <path d="M145 268 C146 238 160 216 200 207" stroke="#fff1c2" strokeOpacity=".45" strokeWidth="3" fill="none" />
      <ellipse cx="205" cy="205" rx="16" ry="11" transform="rotate(-38 205 205)" fill="url(#brass)" stroke="#5e3c12" strokeWidth="1" />
      {/* bell: lip thickness, inside, panels, embossing, seams, rim, rivets */}
      <path d={horn.rimD} transform="translate(2 6)" fill="#5e3c12" />
      <path d={horn.rimD} fill="url(#hornIn)" />
      {horn.panels.map((d, i) => <path key={i} d={d} fill={i % 2 ? "#000" : "#fff"} opacity={i % 2 ? 0.1 : 0.05} />)}
      <rect x="80" y="-20" width="480" height="280" fill="url(#emboss)" mask="url(#embossMask)" opacity=".7" />
      <path d={horn.rimD} fill="url(#hornShade)" />
      <ellipse cx={horn.G.x} cy={horn.G.y} rx="55" ry="34" transform={`rotate(-30 ${horn.G.x} ${horn.G.y})`} fill="#c0602a" opacity=".22" filter="url(#soft)" />
      {horn.seams.map((d, i) => (
        <g key={i}>
          <path d={d} stroke="#4a2c08" strokeWidth="1.6" fill="none" opacity=".55" />
          <path d={d} transform="translate(1.4 -1)" stroke="#fff0bf" strokeWidth=".8" fill="none" opacity=".4" />
        </g>
      ))}
      <path d={horn.rimD} fill="none" stroke="url(#brass)" strokeWidth="9" />
      <path d={horn.rimD} fill="none" stroke="#fff3c9" strokeOpacity=".35" strokeWidth="1.5" />
      {horn.rivets.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.7" fill="#fbe7a8" stroke="#6b4512" strokeWidth=".6" />)}
      <circle cx={ELBOW.x} cy={ELBOW.y} r="14" fill="url(#ball)" />

      {/* arm rest post */}
      <rect x={t0.x - 4} y={t0.y - 12} width="8" height="12" fill="url(#chrome)" />
      <ellipse cx={t0.x} cy={t0.y - 12} rx="4" ry="1.6" fill="#e8e5df" />

      {/* ---------- platter + record ---------- */}
      <ellipse cx={C.x} cy={C.y + 6} rx="150" ry={150 * K} fill="#1b1714" />
      <ellipse cx={C.x} cy={C.y} rx="150" ry={150 * K} fill="url(#felt)" stroke="#bdb7ab" strokeWidth="3" />
      <g
        ref={planeRef}
        transform={`translate(${C.x} ${C.y}) scale(1 ${K})`}
        className={record ? "deck-record has" : "deck-record"}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onPointerEnter={() => record && setCursor?.("spin")} onPointerLeave={() => !S.current.held && setCursor?.(null)}
      >
        {record && (
          <>
            <circle r={R_DISC + 3} cy="10" fill="#000" opacity=".5" />
            <g ref={spinRef}><RecordDisc record={record} uid="deck" /></g>
            <DiscSheen />
          </>
        )}
        <circle r="4" fill="url(#chrome)" />
      </g>

      {/* ---------- tonearm + soundbox ---------- */}
      <g className="arm" onClick={onArmTap} onPointerEnter={() => setCursor?.("arm")} onPointerLeave={() => setCursor?.(null)}>
        <path ref={armRef} stroke="url(#brassTube)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path ref={armHiRef} stroke="#fff1c2" strokeOpacity=".5" strokeWidth="2.4" fill="none" transform="translate(-1 -2.5)" />
        <g ref={boxRef}>
          <line x1="0" y1="10" x2="0" y2="14" stroke="#ddd" strokeWidth="1.4" />
          <ellipse rx="15" ry="17" fill="url(#chrome)" stroke="#4d4a45" strokeWidth=".8" />
          <ellipse rx="11" ry="13" fill="#1d1a17" />
          <ellipse rx="7" ry="8.5" fill="none" stroke="#8d877c" strokeWidth=".9" />
          <circle r="2" fill="url(#chrome)" />
          <ellipse cx="-4" cy="-6" rx="3" ry="5" fill="#fff" opacity=".18" />
        </g>
      </g>
    </svg>
  );
}
