/** Window-focus class for the tab-strip fade, and `?motion=0` to switch every animation off (frame-exact parity shots). */
export function initMotion() {
  const q = new URLSearchParams(location.search);
  if (q.get('motion') === '0') document.documentElement.classList.add('no-motion');
  const set = () => document.documentElement.classList.toggle('is-blurred', !document.hasFocus());
  window.addEventListener('focus', set); window.addEventListener('blur', set);
  if (!q.has('harness')) set();
}
