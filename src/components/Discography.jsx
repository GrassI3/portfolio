import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { FORMATS } from "../data/records.js";
import { DiscSVG } from "./RecordDisc.jsx";
import { prepare } from "../audio/engine.js";

const hoverable = typeof window !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * The record list. On hover-capable screens a sleeve follows the cursor and its vinyl slides out;
 * on touch screens every row carries a small sleeve instead.
 */
export default function Discography({ ref, records, sleeves, current, hidePreview, onPlay, onRowPointerDown }) {
  const [hover, setHover] = useState(null);
  const prevRef = useRef(null), discRef = useRef(null), rowsRef = useRef([]);
  const pos = useRef({ x: 0, y: 0, tx: 0, ty: 0, vx: 0 });

  useEffect(() => {
    if (!hoverable) return;
    let raf;
    const move = (e) => { pos.current.tx = e.clientX; pos.current.ty = e.clientY; };
    const loop = () => {
      const p = pos.current, nx = p.x + (p.tx - p.x) * 0.16, ny = p.y + (p.ty - p.y) * 0.16;
      p.vx += ((nx - p.x) - p.vx) * 0.2; p.x = nx; p.y = ny;
      if (prevRef.current) prevRef.current.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${Math.max(-10, Math.min(10, p.vx * 0.6))}deg)`;
      raf = requestAnimationFrame(loop);
    };
    addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => { removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);

  useImperativeHandle(ref, () => ({
    /** where record i's vinyl currently is (for flights in and out of the crate) */
    geom(i) {
      if (hoverable && hover === i && discRef.current && !hidePreview) {
        const b = discRef.current.getBoundingClientRect();
        if (b.width) return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, d: b.width, sy: 1, angle: 0 };
      }
      const row = rowsRef.current[i], thumb = row?.querySelector(".row-thumb");
      const tb = thumb?.getBoundingClientRect();
      if (tb && tb.width) return { cx: tb.left + tb.width / 2, cy: tb.top + tb.height / 2, d: tb.width, sy: 1, angle: 0 };
      const b = row.querySelector(".row-go").getBoundingClientRect();
      return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, d: 70, sy: 1, angle: 0 };
    },
  }));

  const showing = hover !== null && !hidePreview;

  return (
    <>
      <ol className="disco" onPointerLeave={() => setHover(null)}>
        {records.map((r, i) => (
          <li key={r.id} ref={(el) => (rowsRef.current[i] = el)}>
            <button
              className={`row${current === i ? " playing" : ""}${hover !== null && hover !== i ? " dim" : ""}`}
              style={{ "--rc": r.paper }}
              onPointerEnter={() => { setHover(i); prepare(r); }}
              onFocus={() => prepare(r)}
              onPointerDown={(e) => onRowPointerDown(e, i)}
              onClick={() => onPlay(i)}
              aria-label={`Play ${r.title} — ${r.kind}`}
            >
              <span className="row-no">{String(i + 1).padStart(2, "0")}</span>
              <span className="row-thumb" dangerouslySetInnerHTML={sleeves[i]} />
              <span className="row-main">
                <span className="row-title">
                  {r.title}
                  {current === i && <span className="eq live" aria-hidden="true"><i /><i /><i /></span>}
                </span>
                <span className="row-kind">{r.kind}</span>
              </span>
              <span className="row-format">{FORMATS[r.id]}</span>
              <span className="row-go" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {hoverable && (
        <div className={`preview${showing ? " show" : ""}`} ref={prevRef} aria-hidden="true">
          {records.map((r, i) => (
            <div key={r.id} className={`preview-item${hover === i ? " on" : ""}`}>
              <div className={`preview-disc${current === i ? " gone" : ""}`} ref={hover === i ? discRef : null}>
                <DiscSVG record={r} uid={`pv-${r.id}`} detail={false} />
              </div>
              <div className="preview-sleeve" dangerouslySetInnerHTML={sleeves[i]} />
              <span className="preview-tag">{current === i ? "On the deck" : "Click or drag to play"}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
