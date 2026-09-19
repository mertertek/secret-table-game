/** Realtime WS gözlemcisi (yalnız ölçüm; uygulama kodu değişmez). */
export const WS_INIT = `
(() => {
  const Orig = window.WebSocket;
  window.__ws = [];
  class Spy extends Orig {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', (e) => {
        if (typeof e.data === 'string' && e.data.includes('"head"')) {
          try { window.__ws.push({ dir: 'in', t: Date.now(), d: e.data.length > 900 ? e.data.slice(0, 900) : e.data }); } catch {}
        }
      });
      const send = Orig.prototype.send;
      this.send = function (data) {
        if (typeof data === 'string' && data.includes('"head"')) {
          try { window.__ws.push({ dir: 'out', t: Date.now(), d: data.length > 900 ? data.slice(0, 900) : data }); } catch {}
        }
        return send.call(this, data);
      };
    }
  }
  window.WebSocket = Spy;
})();
`;
