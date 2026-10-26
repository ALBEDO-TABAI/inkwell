// Minimal CDP client (node --experimental-websocket) for driving the Electron shell.
import fs from 'node:fs';
export async function targets(port = 9333) {
  return (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter(t => t.type === 'page');
}
export function connect(wsUrl) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl); let id = 0; const pend = new Map();
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { const [r, j] = pend.get(m.id); pend.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } };
    ws.onerror = rej;
    ws.onopen = () => {
      const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; pend.set(i, [r, j]); ws.send(JSON.stringify({ id: i, method, params })); });
      const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
      const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); };
      res({ send, evaluate, shot, close: () => ws.close() });
    };
  });
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
