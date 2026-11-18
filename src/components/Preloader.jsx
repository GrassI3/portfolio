import { useEffect, useState } from "react";
import GateDisc from "./GateDisc.jsx";
import { hasWebGL } from "./Gramophone3D.jsx";

const reduce = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Entry gate. Waits for fonts, then asks how you want to listen.
 * The click is also the user gesture browsers need before any audio can play.
 */
export default function Gate({ record, onEnter }) {
  const [n, setN] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let raf, fontsReady = false;
    const start = performance.now();
    document.fonts?.ready.then(() => (fontsReady = true)) ?? (fontsReady = true);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (reduce ? 1 : 1300));
      setN(Math.round((1 - Math.pow(1 - t, 3)) * (fontsReady ? 100 : 94)));
      if (t < 1 || !fontsReady) raf = requestAnimationFrame(tick);
      else setLoaded(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const enter = (withSound) => {
    onEnter(withSound);
    setLeaving(true);
    setTimeout(() => setGone(true), reduce ? 0 : 1200);
  };

  if (gone) return null;
  return (
    <div className={`gate${loaded ? " loaded" : ""}${leaving ? " leave" : ""}`} role="dialog" aria-label="Welcome">
      <div className="gate-top mono">
        <span>JGD-001</span>
        <span>Goa, IN</span>
      </div>
      {hasWebGL && <GateDisc record={record} />}
      <div className="gate-center">
        <h1 className="gate-name"><span>Jai Gauns</span><span>Dessai</span></h1>
        <div className="gate-actions">
          {loaded ? (
            <>
              <button className="btn-solid" onClick={() => enter(true)} autoFocus>Enter with sound ♪</button>
              <button className="btn-link" onClick={() => enter(false)}>Enter without sound</button>
            </>
          ) : (
            <span className="mono gate-count">Warming the valves · {String(n).padStart(3, "0")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
