import { useEffect, useRef, useState } from "react";

export function useInView(opts = { threshold: 0.2 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, opts);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, inView];
}

/** Each line slides up from behind a mask when it scrolls into view. */
export function Lines({ as: Tag = "div", lines, className = "", delay = 0, step = 0.08, active = true }) {
  const [ref, inView] = useInView();
  return (
    <Tag ref={ref} className={`lines ${inView && active ? "in" : ""} ${className}`}>
      {lines.map((l, i) => (
        <span className="line" key={i}>
          <span style={{ transitionDelay: `${delay + i * step}s` }}>{l}</span>
        </span>
      ))}
    </Tag>
  );
}

/** Words light up one by one as the paragraph scrolls through the viewport. */
export function ScrubText({ text, className = "" }) {
  const ref = useRef(null);
  const words = text.split(" ");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = [...el.querySelectorAll("span")];
    let raf;
    const loop = () => {
      const b = el.getBoundingClientRect(), vh = innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.85 - b.top) / (b.height + vh * 0.35)));
      const lit = p * spans.length * 1.15;
      spans.forEach((s, i) => { s.style.opacity = String(0.14 + 0.86 * Math.min(1, Math.max(0, lit - i))); });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  return (
    <p ref={ref} className={`scrub ${className}`}>
      {words.map((w, i) => <span key={i}>{w} </span>)}
    </p>
  );
}

/** Fades/lifts a block when it enters. */
export function Fade({ as: Tag = "div", className = "", delay = 0, active = true, children, ...rest }) {
  const [ref, inView] = useInView({ threshold: 0.15 });
  return (
    <Tag ref={ref} className={`fade ${inView && active ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}s` }} {...rest}>
      {children}
    </Tag>
  );
}
