import { Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { engine } from "../audio/engine.js";

/*
  The 3D gramophone.
  Models (CC-BY 4.0, credited in the footer):
    "Vintage Gramophone" by mikelkel2, "Gramophone disk" by Aleksey Kozhemyakin, both via Sketchfab.
  The gramophone ships as one fused mesh, so on load it's split into connected pieces and
  regrouped: the baked-in record is replaced by a real disc that spins, and the tonearm becomes
  its own group that swings on the horn pillar.
*/
const GRAMO = "models/gramophone.glb";
export const DISC = "models/disc.glb";
useGLTF.preload(GRAMO);
useGLTF.preload(DISC);

const OMEGA = 200;                 // deg/s at normal speed
const PIVOT = new THREE.Vector2(0.129, -0.43);   // tonearm pivot (x, z), on the horn pillar
const reduceMotion = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- split the fused body mesh into its pieces ---------- */
function splitComponents(geo) {
  const pos = geo.attributes.position, idx = geo.index.array, n = pos.count;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (seen.has(k)) uni(i, seen.get(k)); else seen.set(k, i);
  }
  for (let t = 0; t < idx.length; t += 3) { uni(idx[t], idx[t + 1]); uni(idx[t + 1], idx[t + 2]); }
  const comps = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const c = find(idx[t]);
    if (!comps.has(c)) comps.set(c, []);
    comps.get(c).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const v = new THREE.Vector3();
  return [...comps.values()].map((tri) => {
    const box = new THREE.Box3();
    for (const i of tri) box.expandByPoint(v.fromBufferAttribute(pos, i));
    return { tri, box };
  });
}

function withIndex(geo, tri) {
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(geo.attributes)) g.setAttribute(k, a);
  g.setIndex(tri);
  return g;
}

function buildDeck(gramo, disc) {
  gramo.updateMatrixWorld(true);
  const meshes = [];
  gramo.traverse((o) => o.isMesh && meshes.push(o));
  const boxOf = (m) => new THREE.Box3().setFromObject(m);
  const body = meshes.find((m) => boxOf(m).min.y < 0.1);
  const horn = meshes.find((m) => m !== body);

  const bodyGeo = body.geometry.clone().applyMatrix4(body.matrixWorld);
  const comps = splitComponents(bodyGeo);
  const isRecord = (c) => c.box.max.y - c.box.min.y < 0.008 && c.box.max.x - c.box.min.x > 0.5;
  const isArm = (c) => c.box.min.y > 0.47 && c.box.max.y < 0.63;
  const record = comps.find(isRecord);
  const staticTri = [], armTri = [];
  for (const c of comps) { if (c === record) continue; (isArm(c) ? armTri : staticTri).push(...c.tri); }

  const staticGeo = withIndex(bodyGeo, staticTri);
  const armGeo = withIndex(bodyGeo.clone().translate(-PIVOT.x, 0, -PIVOT.y), armTri);
  const hornGeo = horn.geometry.clone().applyMatrix4(horn.matrixWorld);

  const material = body.material;
  material.envMapIntensity = 1.15;
  material.side = THREE.DoubleSide; // the horn is a thin sheet: keep it solid from every angle

  // record placement
  const center = record.box.getCenter(new THREE.Vector3());
  const R = (record.box.max.x - record.box.min.x) / 2;
  const recordY = record.box.max.y + 0.0012;

  // needle tip = lowest point of the arm
  const p = armGeo.attributes.position;
  let tip = null;
  for (const i of armTri) { const y = p.getY(i); if (!tip || y < tip.y) tip = { x: p.getX(i), y, z: p.getZ(i) }; }
  const rAt = (th) => {
    const x = tip.x * Math.cos(th) + tip.z * Math.sin(th) + PIVOT.x;
    const z = -tip.x * Math.sin(th) + tip.z * Math.cos(th) + PIVOT.y;
    return Math.hypot(x - center.x, z - center.z);
  };
  // find the swing direction that carries the needle off the record, then solve the arc
  const step = 0.25 * Math.PI / 180;
  const dir = rAt(5 * step) > rAt(0) ? 1 : -1;
  const solve = (target, d, cmp) => { for (let th = 0; Math.abs(th) < Math.PI / 2; th += d * step) if (cmp(rAt(th), target)) return th; return d * Math.PI / 4; };
  const arm = {
    start: solve(R * 0.9, dir, (r, t) => r >= t),
    rest: solve(R * 1.18, dir, (r, t) => r >= t),
    end: solve(R * 0.4, -dir, (r, t) => r <= t),
  };

  // disc geometry, flat, centred, scaled to fit the platter
  const { geo: discGeo, material: discMaterial } = discParts(disc);
  discGeo.scale(R * 0.985, 1, R * 0.985);

  return { staticGeo, armGeo, hornGeo, material, discGeo, discMaterial, center, R, recordY, arm };
}

/** The disc model as a flat, centred geometry of radius 1 (lying in the XZ plane), plus its material. */
const discCache = new WeakMap();
export function discParts(disc) {
  if (discCache.has(disc)) { const c = discCache.get(disc); return { geo: c.geo.clone(), material: c.material }; }
  let mesh = null;
  disc.updateMatrixWorld(true);
  disc.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  const c = geo.boundingBox.getCenter(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z);
  const r = (geo.boundingBox.max.x - geo.boundingBox.min.x) / 2;
  geo.scale(1 / r, 1, 1 / r);
  discCache.set(disc, { geo, material: mesh.material });
  return { geo: geo.clone(), material: mesh.material };
}

/* ---------- each record's label, painted onto the real shellac texture ---------- */
const labelCache = new Map();
export function labelTexture(record, discMaterial) {
  if (labelCache.has(record.id)) return labelCache.get(record.id);
  const S = 1024, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  // the shellac texture carries an alpha channel: paint it over solid black so the disc stays opaque
  g.fillStyle = "#070606"; g.fillRect(0, 0, S, S);
  const img = discMaterial.map?.image;
  if (img) g.drawImage(img, 0, 0, S, S);
  g.save();
  g.translate(S / 2, S / 2);
  g.scale(-1, 1);                        // the disc's UVs are mirrored
  const r = 178;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = record.label; g.fill();
  // paper texture
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
    g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.06})`;
    g.fillRect(Math.cos(a) * d, Math.sin(a) * d, 2, 2);
  }
  const ink = record.labelInk || "#120f0d";
  g.strokeStyle = ink; g.globalAlpha = 0.45; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, r - 12, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, r - 18, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1; g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
  const arcText = (text, radius, mid, font, spacing, outside = true) => {
    g.font = font;
    const chars = [...text], widths = chars.map((ch) => g.measureText(ch).width + spacing);
    const total = widths.reduce((a, b) => a + b, 0);
    let a = mid - (outside ? 1 : -1) * total / radius / 2;
    chars.forEach((ch, i) => {
      const w = widths[i] / radius, at = a + (outside ? 1 : -1) * w / 2;
      g.save();
      g.rotate(at);
      g.translate(0, outside ? -radius : radius);
      if (!outside) g.rotate(Math.PI);
      g.fillText(ch, 0, 0);
      g.restore();
      a += (outside ? 1 : -1) * w;
    });
  };
  arcText(record.title.toUpperCase(), 128, 0, "800 40px Syne, 'Arial Black', sans-serif", 3);
  arcText(`${record.cat}  ·  78 RPM  ·  SIDE A`, 140, Math.PI, "500 17px 'Geist Mono', monospace", 3, false);
  g.font = "800 26px Syne, 'Arial Black', sans-serif";
  g.fillText("JGD", 0, -48);
  g.font = "500 15px 'Geist Mono', monospace";
  g.globalAlpha = 0.75;
  g.fillText("RECORDS", 0, -22);
  g.fillText(record.music.name.split(" — ")[0].toUpperCase(), 0, 54);
  g.globalAlpha = 1;
  g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fillStyle = "#050505"; g.fill();
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  labelCache.set(record.id, tex);
  return tex;
}

/* ---------- environment lighting from a procedural room (no external HDR) ---------- */
export function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    return () => { env.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}

/* ---------- the scene ---------- */
function Deck({ ctl, record }) {
  const gramo = useGLTF(GRAMO), disc = useGLTF(DISC);
  const deck = useMemo(() => buildDeck(gramo.scene, disc.scene), [gramo, disc]);
  const { camera, gl, size } = useThree();
  const armRef = useRef(), recRef = useRef(), recMatRef = useRef();
  const look = useRef(new THREE.Vector3(-0.16, 0.62, -0.15));

  const recMat = useMemo(() => {
    const m = deck.discMaterial.clone();
    m.envMapIntensity = 1.4;
    m.roughness = 0.8;
    m.transparent = false;
    return m;
  }, [deck]);
  recMatRef.current = recMat;
  useEffect(() => {
    if (!record) return;
    recMat.map = labelTexture(record, deck.discMaterial);
    recMat.needsUpdate = true;
  }, [record, recMat, deck]);

  // physics + camera
  const S = ctl.current.state;
  useEffect(() => {
    S.armA = deck.arm.rest;
    ctl.current.deck = deck;
    ctl.current.camera = camera;
    ctl.current.gl = gl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, camera, gl]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw), now = performance.now();
    if (S.held) {
      if (now - S.lastMove > 60) S.hand *= Math.exp(-dt / 0.05);
      S.rate = S.hand;
    } else {
      const tau = Math.abs(S.motor) > Math.abs(S.rate) ? 0.45 : 0.9;
      S.rate += (S.motor - S.rate) * (1 - Math.exp(-dt / tau));
      S.angle += S.rate * OMEGA * dt;
    }
    S.angle %= 360;
    if (recRef.current) {
      recRef.current.visible = S.hasRecord;
      recRef.current.rotation.y = -S.angle * Math.PI / 180;
    }
    engine.setRate(S.needle ? S.rate : 0);

    const A = deck.arm;
    const target = S.mode === "play" ? A.start + (A.end - A.start) * engine.progress : S.mode === "cue" ? A.start : A.rest;
    S.armA += (target - S.armA) * (1 - Math.exp(-dt / (S.mode === "play" ? 0.3 : 0.2)));
    S.lift += (S.liftTarget - S.lift) * (1 - Math.exp(-dt / 0.09));
    if (armRef.current) { armRef.current.rotation.y = S.armA; armRef.current.position.y = S.lift * 0.03; }

    // free orbit: momentum after a throw, or easing home after a reset
    if (!S.orbiting) {
      S.oaz += S.vaz * dt; S.oel += S.vel * dt;
      const k = Math.exp(-dt * 3.5);
      S.vaz *= k; S.vel *= k;
    }
    if (S.resetting) {
      const k = 1 - Math.exp(-dt * 5);
      S.oaz += (0 - S.oaz) * k; S.oel += (0 - S.oel) * k; S.zoom += (1 - S.zoom) * k;
      if (Math.abs(S.oaz) < 0.1 && Math.abs(S.oel) < 0.1 && Math.abs(S.zoom - 1) < 0.002) S.resetting = false;
    }

    // camera: wide shot when idle, leans in over the platter while a record plays
    const focus = S.hasRecord ? 1 : 0;
    S.focus += (focus - S.focus) * (1 - Math.exp(-dt * (reduceMotion ? 50 : 1.6)));
    const f = S.focus, aspect = size.width / Math.max(1, size.height);
    const baseEl = 17 + 17 * f;
    S.oel = THREE.MathUtils.clamp(S.oel, 2 - baseEl, 86 - baseEl);   // from near floor level to top-down
    const az = THREE.MathUtils.degToRad(26 - 8 * f + S.oaz + S.px * 3);
    const el = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(baseEl + S.oel - S.py * 2, 2, 86));
    const tgt = new THREE.Vector3(
      THREE.MathUtils.lerp(-0.17, deck.center.x + 0.05, f),
      THREE.MathUtils.lerp(0.66, deck.recordY + 0.12, f),
      THREE.MathUtils.lerp(-0.16, deck.center.z, f)
    );
    const fit = Math.max(1.0 / Math.tan(THREE.MathUtils.degToRad(14)), 1.05 / (Math.tan(THREE.MathUtils.degToRad(14)) * aspect));
    const dist = THREE.MathUtils.lerp(fit * 0.98, fit * 0.62, f) * S.zoom;
    look.current.lerp(tgt, 1 - Math.exp(-dt * 6));
    camera.position.set(
      look.current.x + dist * Math.cos(el) * Math.sin(az),
      look.current.y + dist * Math.sin(el),
      look.current.z + dist * Math.cos(el) * Math.cos(az)
    );
    camera.lookAt(look.current);
  });

  return (
    <group>
      <mesh geometry={deck.staticGeo} material={deck.material} castShadow receiveShadow />
      <mesh geometry={deck.hornGeo} material={deck.material} castShadow receiveShadow />
      <group ref={armRef} position={[PIVOT.x, 0, PIVOT.y]}>
        <mesh geometry={deck.armGeo} material={deck.material} castShadow name="arm" userData={{ arm: true }} />
      </group>
      <group ref={recRef} position={[deck.center.x, deck.recordY, deck.center.z]} visible={false}>
        <mesh geometry={deck.discGeo} material={recMat} castShadow receiveShadow />
      </group>
      <ContactShadows position={[-0.15, -0.04, -0.15]} scale={3.2} blur={2.6} far={1.2} opacity={0.75} resolution={512} frames={1} color="#000" />
    </group>
  );
}

/* ---------- public component: same API as the SVG gramophone ---------- */
export default function Gramophone3D({ ref, record, onRecordTap, onArmTap, setCursor }) {
  const wrap = useRef(null);
  const ctl = useRef({
    state: {
      angle: 0, rate: 0, motor: 0, held: false, hand: 0, lastMove: 0, lastA: 0, lastT: 0, down: null, needle: false, mode: "rest",
      armA: 0, lift: 0, liftTarget: 0, hasRecord: false, focus: 0, px: 0, py: 0,
      // free orbit (degrees offset from the default view), momentum and zoom
      oaz: 0, oel: 0, vaz: 0, vel: 0, zoom: 1, orbiting: null, resetting: false,
    },
    deck: null, camera: null, gl: null,
  });
  const S = ctl.current.state;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* screen-space helpers */
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const pick = (e) => {
    const { deck, camera, gl } = ctl.current;
    if (!deck) return null;
    const b = gl.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), camera);
    const hit = new THREE.Vector3();
    const onPlane = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -deck.recordY), hit);
    const dx = hit.x - deck.center.x, dz = hit.z - deck.center.z;
    return { a: (Math.atan2(dz, dx) * 180) / Math.PI, r: onPlane ? Math.hypot(dx, dz) / deck.R : 99 };
  };
  const overArm = (e) => {
    const { gl, camera } = ctl.current, scene = gl && camera && ctl.current.scene;
    if (!scene) return false;
    const b = gl.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), camera);
    let arm = null; scene.traverse((o) => { if (o.userData?.arm) arm = o; });
    return arm ? ray.intersectObject(arm).length > 0 : false;
  };

  useImperativeHandle(ref, () => ({
    geometry() {
      const { deck, camera, gl } = ctl.current;
      const b = (gl?.domElement ?? wrap.current).getBoundingClientRect();
      if (!deck) return { cx: b.left + b.width / 2, cy: b.top + b.height * 0.6, rx: b.width * 0.25, ry: b.width * 0.1, angle: S.angle };
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      const v = new THREE.Vector3();
      for (let k = 0; k < 48; k++) {
        const t = (k / 48) * Math.PI * 2;
        v.set(deck.center.x + Math.cos(t) * deck.R, deck.recordY, deck.center.z + Math.sin(t) * deck.R).project(camera);
        const sx = b.left + ((v.x + 1) / 2) * b.width, sy = b.top + ((1 - v.y) / 2) * b.height;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2, angle: S.angle };
    },
    setAngle(a) { S.angle = a; },
    stage() { return wrap.current; },
    setHasRecord(v) { S.hasRecord = v; },
    async play() {
      S.motor = 1;
      await wait(450);
      S.mode = "cue"; S.liftTarget = 1;
      await wait(700);
      S.liftTarget = 0;
      await wait(140);
      S.mode = "play"; S.needle = true;
      engine.thump();
      engine.setGain(1, 0.08);
    },
    async stop() {
      S.needle = false; S.liftTarget = 1; engine.setGain(0, 0.03);
      await wait(150);
      S.mode = "rest"; S.motor = 0;
      await wait(550);
      S.liftTarget = 0;
      await wait(150);
    },
    togglePause() {
      if (!S.hasRecord) return false;
      const pausing = S.needle;
      if (pausing) { S.needle = false; S.liftTarget = 1; engine.setGain(0, 0.03); }
      else { S.liftTarget = 0; S.mode = "play"; S.motor = 1; setTimeout(() => { S.needle = true; engine.thump(); engine.setGain(1, 0.08); }, 120); }
      return pausing;
    },
    isNeedleDown() { return S.needle; },
  }));

  /* pointer: scratch the record, tap the arm, parallax */
  const hoverRef = useRef(null);
  const setHover = (m) => { if (hoverRef.current !== m) { hoverRef.current = m; setCursor?.(m); } };
  const [moved, setMoved] = useState(false);
  const pointers = useRef(new Map());
  const markMoved = () => { if (!moved && (Math.abs(S.oaz) > 4 || Math.abs(S.oel) > 3 || Math.abs(S.zoom - 1) > 0.03)) setMoved(true); };
  const resetView = () => { S.resetting = true; S.vaz = S.vel = 0; setMoved(false); };
  const zoomBy = (factor) => { S.resetting = false; S.zoom = THREE.MathUtils.clamp(S.zoom * factor, 0.45, 1.7); markMoved(); };

  // trackpad pinch arrives as ctrl+wheel; plain wheel keeps scrolling the page
  useEffect(() => {
    const el = wrap.current;
    const onWheel = (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.01)); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDown = (e) => {
    if (e.button > 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {           // second finger: pinch to zoom
      S.orbiting = null;
      const [a, b] = [...pointers.current.values()];
      S.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      return;
    }
    const p = pick(e);
    if (S.hasRecord && p && p.r < 1.02) {
      engine.unlock();
      e.currentTarget.setPointerCapture(e.pointerId);
      Object.assign(S, { held: true, hand: S.rate, lastA: p.a, lastT: performance.now(), lastMove: performance.now(), down: { t: performance.now(), moved: 0 } });
      setHover("scratch");
      return;
    }
    // anywhere else: grab the gramophone and turn it
    e.currentTarget.setPointerCapture(e.pointerId);
    S.orbiting = { x: e.clientX, y: e.clientY, t: performance.now(), dist: 0 };
    S.resetting = false; S.vaz = S.vel = 0;
    if (overArm(e)) S.armDown = { x: e.clientX, y: e.clientY };
    setHover("orbiting");
  };
  const onMove = (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    S.px = ((e.clientX - b.left) / b.width - 0.5) * 2;
    S.py = ((e.clientY - b.top) / b.height - 0.5) * 2;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && S.pinch) {
      const [a, c] = [...pointers.current.values()];
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      zoomBy(S.pinch / d);
      S.pinch = d;
      return;
    }
    if (S.orbiting) {
      const o = S.orbiting, now = performance.now();
      const dx = e.clientX - o.x, dy = e.clientY - o.y, dt = Math.max(0.008, (now - o.t) / 1000);
      const daz = -dx * 0.45, del = dy * 0.3;
      S.oaz += daz; S.oel += del;
      S.vaz = S.vaz * 0.5 + (daz / dt) * 0.5;
      S.vel = S.vel * 0.5 + (del / dt) * 0.5;
      o.x = e.clientX; o.y = e.clientY; o.t = now; o.dist += Math.abs(dx) + Math.abs(dy);
      markMoved();
      return;
    }
    if (S.held) {
      const now = performance.now(), p = pick(e);
      if (!p) return;
      let d = p.a - S.lastA;
      d = ((d + 540) % 360) - 180;
      const dt = Math.max(0.004, (now - S.lastT) / 1000);
      S.angle += d;
      S.hand += ((d / dt) / OMEGA - S.hand) * 0.55;
      S.hand = Math.max(-8, Math.min(8, S.hand));
      S.lastA = p.a; S.lastT = now; S.lastMove = now;
      S.down.moved += Math.abs(d);
      return;
    }
    if (e.pointerType !== "mouse") return;
    const p = pick(e);
    setHover(S.hasRecord && p && p.r < 1.02 ? "spin" : overArm(e) ? "arm" : "orbit");
  };
  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) S.pinch = null;
    if (S.held) {
      S.held = false;
      setHover(null);
      const tap = S.down && S.down.moved < 3 && performance.now() - S.down.t < 350;
      if (tap) { S.rate = S.motor; onRecordTap?.(); }
      return;
    }
    if (S.orbiting) {
      const o = S.orbiting;
      S.orbiting = null;
      if (performance.now() - o.t > 90) { S.vaz = 0; S.vel = 0; }   // let go after holding still: no throw
      S.vaz = THREE.MathUtils.clamp(S.vaz, -500, 500); S.vel = THREE.MathUtils.clamp(S.vel, -200, 200);
      setHover(e.pointerType === "mouse" ? "orbit" : null);
      if (S.armDown && o.dist < 6) onArmTap?.();
    }
    S.armDown = null;
  };
  const onLeave = () => { S.px = 0; S.py = 0; if (!S.held && !S.orbiting) setHover(null); };

  return (
    <div ref={wrap} className={`deck3d${record ? " has" : ""}`}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onLeave}
      onDoubleClick={(e) => { const p = pick(e); if (!(S.hasRecord && p && p.r < 1.02)) resetView(); }}>
      <button className={`view-reset${moved ? " show" : ""}`} onClick={resetView} onPointerDown={(e) => e.stopPropagation()} tabIndex={moved ? 0 : -1}>
        Reset view
      </button>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 28, near: 0.05, far: 30, position: [2, 1.4, 3] }}
        onCreated={({ scene }) => { ctl.current.scene = scene; }}
      >
        <Env />
        <ambientLight intensity={0.18} />
        <directionalLight position={[2.4, 4, 3]} intensity={2.4} color="#ffdcb0" castShadow
          shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} shadow-normalBias={0.02}
          shadow-camera-left={-1.6} shadow-camera-right={1.6} shadow-camera-top={1.6} shadow-camera-bottom={-1.6} />
        <directionalLight position={[-3, 2.2, -2.6]} intensity={1.1} color="#9fb6ff" />
        <pointLight position={[0.3, 1.3, 1.1]} intensity={2.2} distance={4} decay={2} color="#ffb05c" />
        <Suspense fallback={null}>
          <Deck ctl={ctl} record={record} />
        </Suspense>
      </Canvas>
    </div>
  );
}

/** WebGL available? (otherwise the booth falls back to the SVG gramophone) */
export const hasWebGL = (() => {
  if (typeof document === "undefined") return false;
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
})();
