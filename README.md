# The Listening Room

Portfolio of Jai Gauns Dessai, built with React and Vite. Projects and experience are records in a crate. Drag one onto the gramophone (or click it) and it spins, the needle drops, and the liner notes open.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Editing

- `src/data/records.js`: all the content (records, tracks, links) plus `CONFIG` for LinkedIn and the resume.
- `src/audio/compose.js`: the original music, one generated piece per record (lo-fi, synthwave, ambient, dark minimal, bossa, raag Yaman, chiptune, swing, blues). To use your own audio file instead, add `src: "music/file.mp3"` to a record's `music` and put the file in `public/music/`.
- `src/components/Gramophone.jsx`: the gramophone SVG, platter physics and tonearm.

## Interactions

- Grab the spinning vinyl to scratch it, slow it down or spin it backwards. The music follows the platter's speed. Hold still to stop it, and let go to hear it spin back up.
- Tap the tonearm or press Space to lift or drop the needle.
- ←/→ change records, and Esc ejects.
- Deep links: `/#phish`, `#spectre`, `#kasse`, `#mogra`, `#vikas`, `#itt`, `#hits`, `#live` and `#self`.

## Deploy (GitHub Pages)

Run `npm run build` and publish the contents of `dist/` (for example, push them to a `GrassI3.github.io` repo or use a Pages GitHub Action).
