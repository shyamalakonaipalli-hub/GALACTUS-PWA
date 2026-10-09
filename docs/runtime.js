/* GALACTUS PWA Build 2 runtime adapter. No secrets are stored here. */
(() => {
  const KEY = 'galactus-pwa-backend-url-v1';
  const normalize = (value) => value.trim().replace(/\/+$/, '');
  const readBaseUrl = () => {
    try { return normalize(localStorage.getItem(KEY) || ''); } catch { return ''; }
  };
  const saveBaseUrl = (value) => {
    const base = normalize(value || '');
    if (base) {
      const url = new URL(base);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS backend URL.');
      if (url.username || url.password) throw new Error('Do not put usernames, passwords, or API keys in the backend URL.');
      if (url.search || url.hash) throw new Error('Backend URL must not contain query parameters or a fragment.');
      if (url.protocol === 'http:' && location.protocol === 'https:') throw new Error('An HTTPS website cannot safely call an HTTP backend. Use HTTPS.');
    }
    localStorage.setItem(KEY, base);
    return base;
  };
  async function health() {
    const base = readBaseUrl();
    if (!base) throw new Error('Save your backend URL first.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${base}/api/health`, { method: 'GET', headers: { 'Accept': 'application/json' }, signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}.`);
      const data = await response.json();
      if (data.ok !== true) throw new Error('Backend responded, but did not report { "ok": true }.');
      if (data.model_ready !== true) throw new Error(data.model_note || 'Backend is reachable, but no model endpoint is configured.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Connection test timed out after 8 seconds.');
      if (error instanceof TypeError) throw new Error('Could not reach backend. Check the URL, server status, HTTPS, and CORS configuration.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function chat(messages, mode = 'auto') {
    const base = readBaseUrl();
    if (!base) throw new Error('No AI backend configured. Open Model Manager to connect one.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(`${base}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ messages, mode }), signal: controller.signal
      });
      if (!response.ok) throw new Error(`AI backend returned HTTP ${response.status}.`);
      const data = await response.json();
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('Backend response must contain a non-empty string field named "reply".');
      return data.reply;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('AI request timed out after 90 seconds.');
      if (error instanceof TypeError) throw new Error('Could not reach AI backend. Check server status, HTTPS, and CORS.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  window.GalactusRuntime = { readBaseUrl, saveBaseUrl, health, chat };
})();
