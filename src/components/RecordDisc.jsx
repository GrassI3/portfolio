// A vinyl record drawn in local units: centre (0,0), radius 138. Used in sleeves, mid-flight and on the deck.
export const R_DISC = 138;

const grooves = [];
for (let r = 58; r < 135; r += 2.1) grooves.push(r);

export function RecordDisc({ record, uid = "d", detail = true }) {
  const ink = record.labelInk || "#120f0d";
  return (
    <g>
      <circle r={R_DISC} fill="#0c0b0a" />
      <circle r={R_DISC - 1} fill="none" stroke="#2a2724" strokeWidth="1.2" />
      {detail && grooves.map((r) => <circle key={r} r={r} fill="none" stroke="#1d1b19" strokeWidth=".7" />)}
      {/* track gaps */}
      <circle r={84} fill="none" stroke="#050505" strokeWidth="2.2" />
      <circle r={108} fill="none" stroke="#050505" strokeWidth="2.2" />
      {/* a tiny pressing mark so the spin always reads, even on plain grooves */}
      <path d="M -6 -122 A 122 122 0 0 1 22 -120" stroke="#3a3632" strokeWidth="1.4" fill="none" />
      {/* label */}
      <circle r={47} fill={record.label} />
      <circle r={43} fill="none" stroke={ink} strokeOpacity=".35" strokeWidth=".8" />
      <defs>
        <path id={`arcT-${uid}`} d="M -31 0 A 31 31 0 0 1 31 0" />
        <path id={`arcB-${uid}`} d="M -35 0 A 35 35 0 0 0 35 0" />
      </defs>
      <text fill={ink} fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="10.5" letterSpacing=".5">
        <textPath href={`#arcT-${uid}`} startOffset="50%" textAnchor="middle">{record.title}</textPath>
      </text>
      <text fill={ink} fontFamily="Geist Mono, monospace" fontSize="5.2" letterSpacing="1.4" opacity=".8">
        <textPath href={`#arcB-${uid}`} startOffset="50%" textAnchor="middle">{`${record.cat} · 33⅓ RPM · SIDE A`}</textPath>
      </text>
      <text y="3" textAnchor="middle" fill={ink} fontFamily="Newsreader, Georgia, serif" fontStyle="italic" fontSize="7" opacity=".75">JGD</text>
      <circle r={3.2} fill="#0c0b0a" />
    </g>
  );
}

// Light reflections that stay put while the record turns underneath them.
export function DiscSheen() {
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id="sheenG" cx="0" cy="0" r={R_DISC} gradientUnits="userSpaceOnUse">
          <stop offset=".34" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".16" />
          <stop offset="1" stopColor="#fff" stopOpacity=".05" />
        </radialGradient>
      </defs>
      {[[-128, -104], [52, 76]].map(([a0, a1]) => {
        const p = (a) => [Math.cos((a * Math.PI) / 180) * R_DISC, Math.sin((a * Math.PI) / 180) * R_DISC];
        const [x0, y0] = p(a0), [x1, y1] = p(a1);
        return <path key={a0} d={`M0 0 L${x0} ${y0} A${R_DISC} ${R_DISC} 0 0 1 ${x1} ${y1} Z`} fill="url(#sheenG)" />;
      })}
    </g>
  );
}

/** Standalone SVG of a record (for sleeves and the flying record). */
export function DiscSVG({ record, uid, detail = true, className }) {
  return (
    <svg className={className} viewBox="-140 -140 280 280" aria-hidden="true">
      <RecordDisc record={record} uid={uid} detail={detail} />
    </svg>
  );
}
