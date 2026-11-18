import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { DISC, discParts, labelTexture } from "./Gramophone3D.jsx";

const reduceMotion = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* The real 78 from the disc model, facing you, turning slowly and catching the light. */
function Disc({ record, onReady }) {
  const disc = useGLTF(DISC);
  const { geo, mat } = useMemo(() => {
    const { geo, material } = discParts(disc.scene);
    const mat = material.clone();
    mat.map = labelTexture(record, material);
    mat.envMapIntensity = 0.9;
    mat.transparent = false;
    mat.roughness = 0.62;           // glossier shellac: narrow glints instead of a grey wash
    return { geo, mat };
  }, [disc, record]);
  const spin = useRef(), tilt = useRef();
  const mouse = useRef({ x: 0, y: 0 });
  const ready = useRef(false);

  useFrame((state, dt) => {
    if (!ready.current) { ready.current = true; onReady(); }
    if (spin.current && !reduceMotion) spin.current.rotation.y -= dt * 0.6;
    // a little tilt toward the pointer, so the grooves flash as you move
    mouse.current.x += (state.pointer.x - mouse.current.x) * 0.05;
    mouse.current.y += (state.pointer.y - mouse.current.y) * 0.05;
    if (tilt.current) {
      tilt.current.rotation.x = Math.PI / 2 - 0.16 - mouse.current.y * 0.12;
      tilt.current.rotation.z = mouse.current.x * 0.1;
    }
  });

  return (
    <group ref={tilt} rotation={[Math.PI / 2 - 0.16, 0, 0]}>
      <group ref={spin}>
        <mesh geometry={geo} material={mat} />
      </group>
    </group>
  );
}

export default function GateDisc({ record }) {
  const [shown, setShown] = useState(false);
  // the label is painted with the site fonts, so wait for them before drawing it
  const [fonts, setFonts] = useState(!document.fonts);
  useEffect(() => { document.fonts?.ready.then(() => setFonts(true)); }, []);
  return (
    <div className={`gate-disc3d${shown ? " shown" : ""}`} aria-hidden="true">
      <Canvas resize={{ offsetSize: true }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, toneMappingExposure: 1 }} camera={{ fov: 22, position: [0, 0, 5.4] }}>
        <ambientLight intensity={0.6} />
        <hemisphereLight args={["#ffe9cc", "#1a1410", 0.6]} />
        <directionalLight position={[-4, 2.6, 1.4]} intensity={3} color="#ffe2bd" />
        <pointLight position={[1.6, 1.4, 1.6]} intensity={6} distance={6} color="#ffb05c" />
        <directionalLight position={[4, -1, 0.8]} intensity={0.35} color="#9fb6ff" />
        <directionalLight position={[-2.5, 3.5, 0.6]} intensity={1.4} color="#c9d6ff" />
        <Suspense fallback={null}>
          {fonts && <Disc record={record} onReady={() => setShown(true)} />}
        </Suspense>
      </Canvas>
    </div>
  );
}
