// Generates the sleeve artwork for each record as an SVG string (all inputs are our own data, escaped).
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function sleeveArt(r) {
  const { bg, fg, accent } = r, R = rng(r.id);
  const T = (x, y, txt, size, opts = "") => `<text x="${x}" y="${y}" font-family="Bricolage Grotesque, sans-serif" font-size="${size}" fill="${fg}" ${opts}>${esc(txt)}</text>`;
  const small = (x, y, txt, fill = fg, anchor = "start") => `<text x="${x}" y="${y}" font-family="Geist Mono, monospace" font-size="7" letter-spacing="1.2" fill="${fill}" text-anchor="${anchor}">${esc(txt)}</text>`;
  let g = "";
  switch (r.art) {
    case "type":
      g = `${T(-6, 132, "JGD", 104, 'font-weight="800" letter-spacing="-6"')}
           <circle cx="160" cy="44" r="22" fill="${accent}"/>
           <line x1="12" y1="150" x2="188" y2="150" stroke="${fg}" stroke-width="1"/>
           ${T(12, 176, "self-titled", 20, 'font-style="italic"')}
           ${small(12, 190, "JAI GAUNS DESSAI · LP")}`;
      break;
    case "kanban": {
      [3, 5, 2, 4].forEach((n, c) => {
        g += `<rect x="${14 + c * 45}" y="18" width="38" height="6" fill="${accent}"/>`;
        for (let i = 0; i < n; i++) g += `<rect x="${14 + c * 45}" y="${30 + i * 21}" width="38" height="16" rx="2" fill="${fg}" opacity="${0.18 + R() * 0.55}"/>`;
      });
      g += `${T(14, 176, "mograCRM", 26, 'font-weight="700" letter-spacing="-1"')}${small(14, 190, "RUST · 36K LOC · 24× FASTER")}`;
      break;
    }
    case "hook":
      for (let i = 6; i > 0; i--) g += `<circle cx="100" cy="132" r="${i * 15}" fill="none" stroke="${accent}" stroke-opacity="${0.12 + (6 - i) * 0.1}" stroke-width="1.5"/>`;
      g += `<path d="M100 0 V96 a16 16 0 1 1 -16 -16" fill="none" stroke="${fg}" stroke-width="5" stroke-linecap="round"/>
            <path d="M84 80 l-6 -8 m6 8 l8 -5" stroke="${fg}" stroke-width="4" stroke-linecap="round"/>
            ${T(14, 40, "Phisherman", 26, 'font-weight="700" letter-spacing="-1"')}${small(14, 190, "ON-DEVICE · 96% PRECISION")}`;
      break;
    case "graph": {
      const pts = Array.from({ length: 26 }, () => [16 + R() * 168, 16 + R() * 140]);
      pts.forEach((p, i) => pts.slice(i + 1).forEach((q) => {
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 48) g += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${accent}" stroke-opacity=".45" stroke-width=".8"/>`;
      }));
      pts.forEach((p, i) => (g += `<circle cx="${p[0]}" cy="${p[1]}" r="${i % 7 === 0 ? 4.5 : 2}" fill="${i % 7 === 0 ? accent : fg}"/>`));
      g += `${T(14, 182, "SPECTRE", 30, 'font-weight="800" letter-spacing="4"')}${small(186, 192, "BITS GOA · 1ST", fg, "end")}`;
      break;
    }
    case "barcode": {
      let x = 18;
      while (x < 182) { const w = 1 + Math.floor(R() * 5); g += `<rect x="${x}" y="22" width="${w}" height="108" fill="${fg}"/>`; x += w + 1 + Math.floor(R() * 4); }
      g += `${small(18, 142, "4 006381 333931", fg)}${T(16, 184, "Kasse", 40, 'font-weight="800" letter-spacing="-2"')}${small(184, 184, "SCAN·PAY·GO", fg, "end")}`;
      break;
    }
    case "wave": {
      for (let i = 0; i < 34; i++) {
        const h = 6 + Math.abs(Math.sin(i * 0.55) * 34 + Math.sin(i * 1.7) * 14) * (0.6 + R() * 0.5);
        g += `<rect x="${14 + i * 5.2}" y="${86 - h / 2}" width="2.6" height="${h}" rx="1.3" fill="${fg}"/>`;
      }
      g += `${T(14, 40, "Vikas.ai", 30, 'font-weight="700" letter-spacing="-1" font-style="italic"')}${small(14, 186, "NO APP · NO INTERNET · 8+ LANGUAGES")}`;
      break;
    }
    case "ascii": {
      const ramp = " .:-=+*#%@";
      for (let y = 0; y < 15; y++) {
        let row = "";
        for (let x = 0; x < 26; x++) {
          const d = Math.hypot((x - 13) / 1.9, y - 7) / 7.2;
          row += ramp[Math.max(0, Math.min(9, Math.floor((1 - d) * 10 + R() * 1.4)))];
        }
        g += `<text x="14" y="${18 + y * 9.6}" font-family="Geist Mono, monospace" font-size="11" fill="${fg}" opacity="${0.5 + y / 30}" xml:space="preserve">${esc(row)}</text>`;
      }
      g += `<text x="14" y="184" font-family="Geist Mono, monospace" font-size="17" font-weight="700" fill="${fg}">$ imageToTerm_</text>`;
      break;
    }
    case "sun":
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        g += `<line x1="100" y1="96" x2="${100 + Math.cos(a) * 140}" y2="${96 + Math.sin(a) * 140}" stroke="${accent}" stroke-opacity="${i % 2 ? 0.18 : 0.4}" stroke-width="${i % 2 ? 1 : 3}"/>`;
      }
      g += `<circle cx="100" cy="96" r="34" fill="${accent}"/>
            <text x="100" y="108" font-family="Bricolage Grotesque, sans-serif" font-size="30" font-weight="800" fill="#151210" text-anchor="middle">1st</text>
            <rect x="0" y="152" width="200" height="48" fill="${bg}"/>${T(14, 178, "Greatest Hits", 24, 'font-style="italic"')}${small(14, 191, "3× FIRST · NASA TOP 600")}`;
      break;
    case "flag":
      for (let i = 0; i < 5; i++) g += `<path d="M${82 - i * 30} 200 L100 -10 L${118 + i * 30} 200 Z" fill="${fg}" opacity=".05"/>`;
      g += `<line x1="62" y1="30" x2="62" y2="150" stroke="${fg}" stroke-width="3"/>
            <path d="M64 32 h70 l-12 18 l12 18 h-70 Z" fill="${fg}"/>
            <text x="76" y="56" font-family="Geist Mono, monospace" font-size="10" font-weight="700" fill="${bg}">FLAG{}</text>
            ${T(14, 180, "Live at Technix", 22, 'font-weight="600" font-style="italic"')}${small(14, 192, "CTF 2026 · COORDINATOR")}`;
      break;
  }
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(r.title)} sleeve"><rect width="200" height="200" fill="${bg}"/>${g}</svg>`;
}
