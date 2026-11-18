import { useEffect, useRef } from "react";
import { FORMATS } from "../data/records.js";
import { DiscSVG } from "./RecordDisc.jsx";

/** Full record page, slides over the editorial column. */
export default function LinerNotes({ record, next, sleeve, open, paused, onClose, onEject, onNext }) {
  const scroller = useRef(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; }, [record?.id]);
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    addEventListener("keydown", k, true);
    return () => removeEventListener("keydown", k, true);
  }, [open, onClose]);

  return (
    <section className={`record-page${open ? " open" : ""}`} aria-hidden={!open} aria-label="Record details" style={record ? { "--rc": record.paper } : undefined}>
      {record && (
        <div className="rp-scroll" ref={scroller} data-lenis-prevent key={record.id}>
          <div className="rp-bar">
            <button className="rp-back" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M19 12H6M11 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              All records
            </button>
            <span className="rp-cat">{record.cat}</span>
            <button className="rp-eject" onClick={onEject}>Eject</button>
          </div>

          <header className="rp-hero">
            <div className="rp-art">
              <div className="rp-art-disc"><DiscSVG record={record} uid={`rp-${record.id}`} detail={false} /></div>
              <div className="rp-art-sleeve" dangerouslySetInnerHTML={sleeve} />
            </div>
            <div className="rp-head">
              <p className="rp-kind"><span className={`dot${paused ? "" : " live"}`} />{record.kind}</p>
              <h2 className="rp-title">{record.title}</h2>
              <p className="rp-artist">{record.artist}</p>
            </div>
          </header>

          <p className="rp-blurb">{record.blurb}</p>

          <dl className="rp-meta">
            <div><dt>Format</dt><dd>{FORMATS[record.id]}</dd></div>
            <div><dt>On the deck</dt><dd>{record.music.name}</dd></div>
            <div className="wide"><dt>{record.stackLabel || "Personnel"}</dt><dd>{record.stack.join(" / ")}</dd></div>
          </dl>

          <h3 className="rp-h">Side A</h3>
          <ol className="rp-tracks">
            {record.tracks.map(([t, m], k) => (
              <li key={k}>
                <span className="n">A{k + 1}</span>
                <span className="t">{t}</span>
                <span className="m">{m}</span>
              </li>
            ))}
          </ol>

          {record.links.length > 0 && (
            <div className="rp-links">
              {record.links.map(([t, u]) =>
                u ? <a key={t} className="pill" href={u} {...(u.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}>{t}<span aria-hidden="true">↗</span></a>
                  : <span key={t} className="pill ghost">{t}</span>
              )}
            </div>
          )}

          <button className="rp-next" onClick={onNext}>
            <span className="rp-next-label">Next record</span>
            <span className="rp-next-title">{next.title}<span aria-hidden="true"> →</span></span>
          </button>
        </div>
      )}
    </section>
  );
}
