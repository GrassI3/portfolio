import { useEffect, useRef } from "react";
import Gramophone from "./Gramophone.jsx";
import Gramophone3D, { hasWebGL } from "./Gramophone3D.jsx";

// 3D when the browser can do it; the SVG drawing stays as a fallback
const Deck = hasWebGL ? Gramophone3D : Gramophone;
import { engine } from "../audio/engine.js";

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const Icon = {
  prev: <path d="M7 6v12M18 6l-8 6 8 6z" />,
  next: <path d="M17 6v12M6 6l8 6-8 6z" />,
  play: <path d="M8 5l11 7-11 7z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  eject: <path d="M5 15l7-9 7 9zM5 19h14" />,
};
const Btn = ({ icon, label, onClick, big }) => (
  <button className={`ctl${big ? " big" : ""}`} onClick={onClick} aria-label={label} title={label}>
    <svg viewBox="0 0 24 24" width={big ? 22 : 18} height={big ? 22 : 18}><g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">{Icon[icon]}</g></svg>
  </button>
);

/** The dark listening booth: gramophone + now-playing strip. */
export default function Booth({ deckRef, record, paused, dragOver, dragging, muted, onToggleMute, onPrev, onNext, onPause, onEject, onNotes, setCursor, onRecordTap }) {
  const barRef = useRef(null), timeRef = useRef(null);

  useEffect(() => {
    let raf;
    const loop = () => {
      if (barRef.current) barRef.current.style.transform = `scaleX(${record ? engine.progress : 0})`;
      if (timeRef.current && record && engine.duration) timeRef.current.textContent = `${fmt(engine.progress * engine.duration)} / ${fmt(engine.duration)}`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [record]);

  return (
    <aside className={`booth${dragging ? " dragging" : ""}${dragOver ? " over" : ""}`} aria-label="Listening booth">
      <div className="booth-top">
        <button className="sound" aria-pressed={!muted} onClick={onToggleMute}>
          <span className={`eq${record && !paused && !muted ? " live" : ""}`} aria-hidden="true"><i /><i /><i /></span>
          {muted ? "Sound off" : "Sound on"}
        </button>
      </div>

      <div className="booth-stage">
        <div className="drop-hint" aria-hidden="true">Drop it on the platter</div>
        <Deck ref={deckRef} record={record} onRecordTap={onRecordTap} onArmTap={onPause} setCursor={setCursor} />
      </div>

      <div className="np">
        {record ? (
          <>
            <div className="np-head">
              <div>
                <p className="np-label">{paused ? "Paused" : "Now spinning"}</p>
                <p className="np-title">{record.title}</p>
                <p className="np-track">{record.music.name}</p>
              </div>
              <button className="np-notes" onClick={onNotes}>Liner notes</button>
            </div>
            <div className="np-bar"><span ref={barRef} /></div>
            <div className="np-row">
              <span className="np-time" ref={timeRef}>0:00</span>
              <div className="ctls">
                <Btn icon="prev" label="Previous record" onClick={onPrev} />
                <Btn icon={paused ? "play" : "pause"} label={paused ? "Drop the needle" : "Lift the needle"} onClick={onPause} big />
                <Btn icon="next" label="Next record" onClick={onNext} />
                <Btn icon="eject" label="Eject" onClick={onEject} />
              </div>
            </div>
          </>
        ) : (
          <div className="np-idle">
            <p className="np-idle-big">Nothing spinning.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
