import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { CONFIG, RECORDS, CREDITS, CHARTS } from "./data/records.js";
import { sleeveArt } from "./components/sleeveArt.js";
import { DiscSVG, R_DISC } from "./components/RecordDisc.jsx";
import Booth from "./components/Booth.jsx";
import Discography from "./components/Discography.jsx";
import LinerNotes from "./components/LinerNotes.jsx";
import Cursor from "./components/Cursor.jsx";
import Gate from "./components/Preloader.jsx";
import { Lines, Fade, ScrubText } from "./components/Reveal.jsx";
import { engine, prepare, prepareAll } from "./audio/engine.js";

const reduceMotion = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => matchMedia("(max-width: 960px)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const setHash = (h) => { try { history.replaceState(null, "", h); } catch { /* file:// can refuse */ } };

export default function App() {
  const deck = useRef(null), disco = useRef(null);
  const flyOuter = useRef(null), flyInner = useRef(null);
  const busy = useRef(false), lenis = useRef(null);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState(null);
  const [flying, setFlying] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lastShown, setLastShown] = useState(0);

  const rec = current !== null ? RECORDS[current] : null;
  const sleeves = useMemo(() => RECORDS.map((r) => ({ __html: sleeveArt(r) })), []);

  /* ---------- smooth scroll ---------- */
  useEffect(() => {
    if (reduceMotion) return;
    const l = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.current = l;
    let raf;
    const loop = (t) => { l.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); l.destroy(); };
  }, []);
  useEffect(() => { notesOpen || !ready ? lenis.current?.stop() : lenis.current?.start(); }, [notesOpen, ready]);
  // scroll position as CSS variables: drives the hero record's rotation and the progress line
  useEffect(() => {
    const root = document.documentElement;
    const on = () => {
      const max = root.scrollHeight - innerHeight;
      root.style.setProperty("--scroll", String(scrollY));
      root.style.setProperty("--progress", String(max > 0 ? scrollY / max : 0));
    };
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  // Goa clock
  const [clock, setClock] = useState("");
  useEffect(() => {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
    const t = () => setClock(f.format(new Date()));
    t();
    const id = setInterval(t, 15000);
    return () => clearInterval(id);
  }, []);
  const scrollTo = (sel) => (e) => {
    e.preventDefault();
    setNotesOpen(false);
    if (lenis.current) lenis.current.scrollTo(sel, { offset: -10 });
    else document.querySelector(sel)?.scrollIntoView({ behavior: "smooth" });
  };

  /* ---------- geometry ---------- */
  const deckGeom = () => { const g = deck.current.geometry(); return { cx: g.cx, cy: g.cy, d: (g.rx * 2 * 140) / R_DISC, sy: g.ry / g.rx, angle: g.angle }; };

  /* ---------- flight: lift, travel, tilt flat, settle ---------- */
  const flight = useCallback(async (record, from, to, ms = 950) => {
    flushSync(() => setFlying(record));
    const o = flyOuter.current, inner = flyInner.current, D = Math.max(from.d, to.d);
    o.style.width = o.style.height = D + "px";
    const tr = (cx, cy, s, sy) => `translate(${cx - D / 2}px, ${cy - D / 2}px) scale(${s}, ${s * sy})`;
    const mx = (from.cx + to.cx) / 2, my = Math.min(from.cy, to.cy) - Math.min(140, Math.abs(from.cx - to.cx) * 0.25 + 40);
    const midS = ((from.d + to.d) / 2 / D) * 1.12;
    const kf = [
      { transform: tr(from.cx, from.cy, from.d / D, from.sy), easing: "cubic-bezier(.3,0,.4,1)" },
      { transform: tr(mx, my, midS, Math.max(from.sy, 0.92)), offset: 0.5, easing: "cubic-bezier(.3,0,.3,1)" },
      { transform: tr(to.cx + (mx - to.cx) * 0.08, to.cy - 26, (to.d / D) * 1.04, (from.sy + to.sy) / 2 + 0.12), offset: 0.82, easing: "cubic-bezier(.2,0,.2,1)" },
      { transform: tr(to.cx, to.cy, to.d / D, to.sy) },
    ];
    const dur = reduceMotion ? 1 : ms;
    const a = o.animate(kf, { duration: dur, fill: "forwards" });
    inner.animate([{ transform: `rotate(${from.angle}deg)` }, { transform: `rotate(${to.angle}deg)` }], { duration: dur, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" });
    await a.finished;
  }, []);
  const endFlight = () => { flyOuter.current?.getAnimations().forEach((a) => a.cancel()); flyInner.current?.getAnimations().forEach((a) => a.cancel()); setFlying(null); };

  /* ---------- eject ---------- */
  const eject = useCallback(async (chained = false) => {
    if (current === null) return;
    if (!chained) { if (busy.current) return; busy.current = true; }
    const i = current, record = RECORDS[i];
    setNotesOpen(false);
    await deck.current.stop();
    const from = deckGeom();
    flushSync(() => setCurrent(null));
    deck.current.setHasRecord(false);
    engine.unload();
    const to = disco.current.geom(i);
    await flight(record, from, { ...to, angle: from.angle - 200 }, chained ? 650 : 850);
    flushSync(endFlight);
    if (!chained) { setHash(location.pathname + location.search); busy.current = false; }
  }, [current, flight]);

  /* ---------- play ---------- */
  const play = useCallback(async (i, fromGeom) => {
    if (busy.current) return;
    if (current === i) { setNotesOpen(true); return; }
    busy.current = true;
    engine.unlock();
    const record = RECORDS[i];
    prepare(record);
    if (current !== null) await eject(true);
    if (isMobile()) { lenis.current ? lenis.current.scrollTo(0, { duration: 0.8 }) : window.scrollTo({ top: 0, behavior: "smooth" }); await wait(450); }
    const from = fromGeom || disco.current.geom(i);
    const to = deckGeom(); to.angle = from.angle + 320;
    await flight(record, from, to);
    deck.current.setAngle(to.angle);
    deck.current.setHasRecord(true);
    flushSync(() => { setCurrent(i); setLastShown(i); setPaused(false); });
    // hand over from the flying record to the one on the deck
    await flyOuter.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduceMotion ? 1 : 220, fill: "forwards" }).finished;
    flushSync(endFlight);
    setHash("#" + record.id);
    await engine.load(record);
    const playing = deck.current.play();
    await wait(reduceMotion ? 0 : 500);
    setNotesOpen(true);
    await playing;
    busy.current = false;
  }, [current, eject, flight]);

  const step = (d) => current !== null && play((current + d + RECORDS.length) % RECORDS.length);
  const togglePause = () => { if (current === null || busy.current) return; setPaused(deck.current.togglePause()); };

  /* ---------- keyboard, deep links, preloading, audio unlock ---------- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !notesOpen) eject();
      if (current === null || busy.current) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === " " && !e.target.closest("button, a")) { e.preventDefault(); togglePause(); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    prepareAll(RECORDS);
    const unlock = () => engine.unlock();
    addEventListener("pointerdown", unlock, { once: true });
    return () => removeEventListener("pointerdown", unlock);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const i = RECORDS.findIndex((r) => r.id === location.hash.slice(1));
    if (i >= 0) setTimeout(() => play(i), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => { engine.setMuted(muted); }, [muted]);

  /* ---------- drag a record from the list onto the gramophone ---------- */
  const drag = useRef(null), suppressClick = useRef(false);
  const onRowPointerDown = (e, i) => {
    if (e.pointerType === "touch" || e.button !== 0 || busy.current || i === current) return;
    drag.current = { i, x0: e.clientX, y0: e.clientY, active: false };
  };
  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
        d.active = true;
        engine.unlock();
        const g = disco.current.geom(d.i);
        d.size = Math.max(g.d, 120); d.ox = e.clientX - g.cx; d.oy = e.clientY - g.cy;
        if (g.d < 120) { d.ox = 0; d.oy = 0; }
        d.D = deckGeom().d;
        flushSync(() => { setFlying(RECORDS[d.i]); setDragging(true); setCursor("drop"); });
        flyOuter.current.style.width = flyOuter.current.style.height = d.D + "px";
      }
      d.cx = e.clientX - d.ox; d.cy = e.clientY - d.oy;
      flyOuter.current.style.transform = `translate(${d.cx - d.D / 2}px, ${d.cy - d.D / 2}px) scale(${d.size / d.D})`;
      flyInner.current.style.transform = `rotate(${(e.clientX - d.x0) * 0.5}deg)`;
      const r = document.querySelector(".booth").getBoundingClientRect();
      d.over = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
      setDragOver(d.over);
    };
    const up = async () => {
      const d = drag.current;
      drag.current = null;
      if (!d?.active) return;
      setDragging(false); setDragOver(false); setCursor(null);
      suppressClick.current = true; setTimeout(() => (suppressClick.current = false), 60);
      const from = { cx: d.cx, cy: d.cy, d: d.size, sy: 1, angle: (d.cx - d.x0) * 0.5 };
      flyOuter.current.style.transform = ""; flyInner.current.style.transform = "";
      if (d.over) play(d.i, from);
      else { await flight(RECORDS[d.i], from, disco.current.geom(d.i), 450); endFlight(); }
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
    return () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); };
  });

  const shown = RECORDS[current ?? lastShown];
  const next = RECORDS[((current ?? lastShown) + 1) % RECORDS.length];
  const year = new Date().getFullYear();

  return (
    <>
      <Gate record={RECORDS[0]} onEnter={(withSound) => { engine.unlock(); setMuted(!withSound); setReady(true); }} />
      <div className="progress" aria-hidden="true" />
      <Cursor forced={cursor} armLabel={paused ? "Drop" : "Lift"} />
      <div className="grain" aria-hidden="true" />

      <div className={`site${ready ? " ready" : ""}`} id="top">
        <Booth
          deckRef={deck}
          record={rec}
          paused={paused}
          dragging={dragging}
          dragOver={dragOver}
          muted={muted}
          onToggleMute={() => { engine.unlock(); setMuted((m) => !m); }}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onPause={togglePause}
          onEject={() => eject()}
          onNotes={() => setNotesOpen(true)}
          onRecordTap={() => setNotesOpen(true)}
          setCursor={setCursor}
        />

        <main className="page">
          <nav className="nav">
            <span className="mono nav-clock">Goa {clock} IST</span>
            <div className="nav-links">
              <a href="#discography" onClick={scrollTo("#discography")}>Records</a>
              <a href="#credits" onClick={scrollTo("#credits")}>Credits</a>
              <a href="#charts" onClick={scrollTo("#charts")}>Charts</a>
              <a href="#contact" onClick={scrollTo("#contact")}>Contact</a>
            </div>
          </nav>

          {/* ---------- hero ---------- */}
          <section className="hero">
            <div className="hero-disc" aria-hidden="true"><DiscSVG record={RECORDS[0]} uid="hero" /></div>
            <div className="hero-meta mono">
              <span>Side A</span>
              <span>Computer engineer</span>
              <span>Class of '27</span>
            </div>
            <h1 className="hero-name" aria-label="Jai Gauns Dessai">
              <Lines lines={["Jai", "Gauns", "Dessai"]} delay={0.35} step={0.1} active={ready} />
            </h1>
            <div className="hero-foot">
              <Fade as="p" className="hero-lede" delay={0.75} active={ready}>
                Rust that ships. Models small enough to live on a phone. CTF challenges for fun.
              </Fade>
              <a className="hero-cue mono" href="#discography" onClick={scrollTo("#discography")}>
                <span className="mouse" aria-hidden="true" /> Scroll to dig through the crate
              </a>
            </div>
          </section>

          {/* ---------- statement ---------- */}
          <section className="statement">
            <ScrubText text="Every project here is pressed as a record. Pull one from the crate, drop it on the gramophone and the needle reads you the story: what I built, how it works, and what it measured. Grab the vinyl while it spins and you can scratch it." />
          </section>

          {/* ---------- discography ---------- */}
          <section className="sec" id="discography">
            <div className="sec-head">
              <Lines as="h2" className="sec-title" lines={["Discography"]} />
              <span className="sec-count">({String(RECORDS.length).padStart(2, "0")})</span>
            </div>
            <Fade as="p" className="sec-note">Projects, work and wins, pressed as records. Click one, or drag it onto the gramophone.</Fade>
            <Discography
              ref={disco}
              records={RECORDS}
              sleeves={sleeves}
              current={current}
              hidePreview={dragging || !!flying}
              onPlay={(i) => { if (!suppressClick.current) play(i); }}
              onRowPointerDown={onRowPointerDown}
            />
          </section>

          {/* ---------- credits ---------- */}
          <section className="sec" id="credits">
            <div className="sec-head">
              <Lines as="h2" className="sec-title" lines={["Credits"]} />
            </div>
            <Fade as="p" className="sec-note">As printed on the back of every sleeve.</Fade>
            <dl className="credits">
              {CREDITS.map(([k, v], i) => (
                <Fade key={k} className="credit" delay={i * 0.04}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </Fade>
              ))}
            </dl>
          </section>

          {/* ---------- charts ---------- */}
          <section className="sec" id="charts">
            <div className="sec-head">
              <Lines as="h2" className="sec-title" lines={["Charts"]} />
            </div>
            <Fade as="p" className="sec-note">Hackathons and capture-the-flag competitions.</Fade>
            <ol className="charts">
              {CHARTS.map(([pos, title, where], i) => (
                <Fade as="li" key={title} delay={i * 0.05}>
                  <span className={`pos${pos.length > 2 ? " word" : ""}`}>{pos}</span>
                  <span className="ct">{title}</span>
                  <span className="cw">{where}</span>
                </Fade>
              ))}
            </ol>
          </section>

          {/* ---------- contact ---------- */}
          <section className="contact" id="contact">
            <Lines as="h2" className="contact-title" lines={["Let's press", "something."]} />
            <a className="contact-mail" href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a>
            <div className="contact-links">
              <a href={CONFIG.github} target="_blank" rel="noopener">GitHub ↗</a>
              {CONFIG.linkedin && <a href={CONFIG.linkedin} target="_blank" rel="noopener">LinkedIn ↗</a>}
              {CONFIG.resume && <a href={CONFIG.resume} target="_blank" rel="noopener">Resume ↗</a>}
            </div>
            <footer className="foot">
              <span>© {year} Jai Gauns Dessai</span>
              <span>All music on this site is original and generated in your browser.</span>
              <span>
                3D: <a href="https://sketchfab.com/3d-models/vintage-gramophone-a8aa2304c7c743a99aa12e875ede5efb" target="_blank" rel="noopener">“Vintage Gramophone”</a> by mikelkel2,{" "}
                <a href="https://sketchfab.com/3d-models/gramophone-disk-9611c845afef4c048bfc0f93d1eed67e" target="_blank" rel="noopener">“Gramophone disk”</a> by Aleksey Kozhemyakin,{" "}
                <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a> (label art changed)
              </span>
              <a href="#top" onClick={(e) => { e.preventDefault(); lenis.current ? lenis.current.scrollTo(0) : scrollTo(0, 0); }}>Back to top ↑</a>
            </footer>
          </section>

          <LinerNotes
            record={shown}
            next={next}
            sleeve={sleeves[current ?? lastShown]}
            open={notesOpen && !!rec}
            paused={paused}
            onClose={() => setNotesOpen(false)}
            onEject={() => eject()}
            onNext={() => step(1)}
          />
        </main>
      </div>

      {/* mobile mini-player */}
      {rec && (
        <div className="mini" role="region" aria-label="Now playing">
          <button className="mini-main" onClick={() => setNotesOpen((o) => !o)}>
            <span className={`mini-disc${paused ? "" : " spin"}`}><DiscSVG record={rec} uid="mini" detail={false} /></span>
            <span className="mini-text"><b>{rec.title}</b><span>{rec.music.name}</span></span>
          </button>
          <button className="mini-btn" onClick={togglePause} aria-label={paused ? "Play" : "Pause"}>{paused ? "Play" : "Pause"}</button>
        </div>
      )}

      <div className="fly" ref={flyOuter} aria-hidden="true" style={{ display: flying ? "block" : "none" }}>
        <div className="fly-spin" ref={flyInner}>{flying && <DiscSVG record={flying} uid="fly" />}</div>
      </div>
    </>
  );
}
