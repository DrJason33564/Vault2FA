// SPDX-License-Identifier: MIT
'use strict';

(() => {
  const DEFAULT_SERVER = '0.pool.ntp.org';
  const REQUEST_TIMEOUT_MS = 3000;
  let offsetMs = 0;
  let lastSyncAt = null;
  let lastServer = DEFAULT_SERVER;
  let lastError = '';

  function normalizeServer(server){
    const raw = String(server || '').trim();
    return raw || DEFAULT_SERVER;
  }

  function buildCandidateUrls(server){
    const normalized = normalizeServer(server);
    if(/^https?:\/\//i.test(normalized)) return [normalized];
    return [
      `https://${normalized}`,
      `https://${normalized}/`,
    ];
  }

  async function requestServerTimeMs(server){
    const candidates = buildCandidateUrls(server);
    let lastFailure = null;
    for(const url of candidates){
      const startedAt = Date.now();
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
      try {
        const resp = await fetch(url, {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller ? controller.signal : undefined,
        });
        if(!resp || !resp.ok) throw new Error(`HTTP ${resp ? resp.status : '0'}`);
        const dateHeader = resp.headers && resp.headers.get ? resp.headers.get('Date') : '';
        if(!dateHeader) throw new Error('Missing Date header.');
        const serverTime = Date.parse(dateHeader);
        if(!Number.isFinite(serverTime)) throw new Error('Invalid Date header.');
        const endedAt = Date.now();
        const latency = Math.max(0, endedAt - startedAt);
        return serverTime + Math.floor(latency / 2);
      } catch (err) {
        lastFailure = err;
      } finally {
        if(timeoutId) clearTimeout(timeoutId);
      }
    }
    throw lastFailure || new Error('Failed to sync server time.');
  }

  async function sync(server){
    const target = normalizeServer(server);
    const localBefore = Date.now();
    const remoteNow = await requestServerTimeMs(target);
    const localAfter = Date.now();
    const localMid = localBefore + Math.floor((localAfter - localBefore) / 2);
    offsetMs = remoteNow - localMid;
    lastSyncAt = localAfter;
    lastServer = target;
    lastError = '';
    return getState();
  }

  function now(){
    return Date.now() + offsetMs;
  }

  function getState(){
    return {
      offsetMs,
      lastSyncAt,
      lastServer,
      lastError,
    };
  }

  function markError(err){
    lastError = err && err.message ? String(err.message) : String(err || 'Unknown error');
    return getState();
  }

  window.Vault2FANtpClock = {
    DEFAULT_SERVER,
    normalizeServer,
    now,
    sync,
    getState,
    markError,
  };
})();
