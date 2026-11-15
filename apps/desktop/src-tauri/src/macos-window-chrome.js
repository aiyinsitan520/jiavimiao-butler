// Injected only into macOS document windows that have native decorations.
// Do not infer this from the browser user agent: mobile/web previews have no title bar.
(() => {
  const mark = () => { document.documentElement.dataset.windowChrome = "macos-native"; };
  if (document.documentElement) mark();
  else document.addEventListener("DOMContentLoaded", mark, { once: true });
})();
