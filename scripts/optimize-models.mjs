// Shrinks the Sketchfab models in /models into web-ready copies in /public/models.
//   node scripts/optimize-models.mjs
// Both models are CC-BY 4.0 — the site credits them (see src/data/records.js → CREDITS_3D).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, dedup, textureCompress } from "@gltf-transform/functions";
import sharp from "sharp";
import { statSync } from "node:fs";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const kb = (f) => (statSync(f).size / 1024 / 1024).toFixed(2) + " MB";

async function run(src, out, edit) {
  const doc = await io.read(src);
  if (edit) edit(doc);
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 82 })
  );
  await io.write(out, doc);
  console.log(`${src} (${kb(src)}) -> ${out} (${kb(out)})`);
}

await run("models/vintage_gramophone.glb", "public/models/gramophone.glb");
// keep just one disc: we only need its geometry, grooves (normal map), sheen (ORM) and shellac texture
await run("models/gramophone_disk.glb", "public/models/disc.glb", (doc) => {
  for (const node of doc.getRoot().listNodes()) {
    if (node.getName() === "disk_uk001" || node.getName() === "disk_uk002") node.dispose();
  }
});
