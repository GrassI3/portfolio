import { useEffect, useRef, useState } from "react";

const LABELS = { play: "Play", playing: "On deck", drop: "Drop", spin: "Grab", scratch: "Scratch", arm: "Lift", notes: "Notes", orbit: "Drag", orbiting: "Turn" };
const fine = typeof window !== "undefined" && matchMedia("(pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Follows the mouse; `forced` (from dragging/scratching) beats whatever is hovered. */
export default function Cursor({ forced, armLabel }) {
  const el = useRef(null);
  const [hover, setHover] = useState(null);
  const [link, setLink] = useState(false);

  useEffect(() => {
    if (!fine) return;
    document.body.classList.add("has-cursor");
    let mx = -100, my = -100, cx = -100, cy = -100, raf;
    const move = (e) => { mx = e.clientX; my = e.clientY; };
    const over = (e) => {
      const s = e.target.closest?.(".row");
      setHover(s ? (s.classList.contains("playing") ? "playing" : "play") : null);
      setLink(!!e.target.closest?.("a, button"));
    };
    const loop = () => { cx += (mx - cx) * 0.25; cy += (my - cy) * 0.25; if (el.current) el.current.style.transform = `translate(${cx}px, ${cy}px)`; raf = requestAnimationFrame(loop); };
    addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over);
    raf = requestAnimationFrame(loop);
    return () => { removeEventListener("pointermove", move); document.removeEventListener("pointerover", over); cancelAnimationFrame(raf); };
  }, []);

  if (!fine) return null;
  const mode = forced || hover;
  const label = mode === "arm" ? armLabel : LABELS[mode];
  return (
    <div ref={el} className={`cursor${mode ? " big" : link ? " link" : ""}${mode === "scratch" ? " scratching" : ""}`} aria-hidden="true">
      <span>{label}</span>
    </div>
  );
}
