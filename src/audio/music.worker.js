import { renderStyle, SR } from "./compose.js";

// Renders music off the main thread so the record animations never stutter.
self.onmessage = (e) => {
  const { id, style } = e.data;
  const data = renderStyle(style);
  self.postMessage({ id, data, sr: SR }, [data.buffer]);
};
