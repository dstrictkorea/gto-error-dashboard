'use strict';

const { C } = require('./config');

// ══════════════════════════════════════════════
//  Fetch with timeout (AbortController)
// ══════════════════════════════════════════════
const FETCH_TIMEOUT = 15000; // 15 seconds
async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timeout = opts.timeout ?? FETCH_TIMEOUT;
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    return r;
  } catch(e) {
    if (e.name === 'AbortError') throw new Error(`Request timeout (>${timeout}ms)`);
    throw e;
  } finally {
    clearTimeout(id);
  }
}

// ══════════════════════════════════════════════
//  TOKEN 자동 갱신
// ══════════════════════════════════════════════
let _token = null, _exp = 0, _tokenPromise = null;
async function getToken() {
  if (_token && Date.now() < _exp - 300000) return _token;
  // Prevent concurrent token refresh — reuse in-flight promise
  if (_tokenPromise) return _tokenPromise;
  _tokenPromise = _fetchToken();
  try { return await _tokenPromise; } finally { _tokenPromise = null; }
}
async function _fetchToken() {
  const r = await fetchWithTimeout(
    `https://login.microsoftonline.com/${C.tenant}/oauth2/v2.0/token`,
    { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({ grant_type:'client_credentials', client_id:C.clientId,
        client_secret:C.secret, scope:'https://graph.microsoft.com/.default' }),
      timeout: 10000 }
  );
  if (!r.ok) throw new Error(`Token fetch failed: HTTP ${r.status}`);
  let d;
  try { d = await r.json(); } catch(_) { throw new Error('Token response: invalid JSON'); }
  if (d.error) throw new Error(d.error_description || d.error);
  _token = d.access_token;
  _exp = Date.now() + d.expires_in * 1000;
  return _token;
}

// ══════════════════════════════════════════════
//  Graph API
// ══════════════════════════════════════════════
async function graph(ep) {
  const t = await getToken();
  const r = await fetchWithTimeout('https://graph.microsoft.com/v1.0' + ep, {
    headers: { Authorization: 'Bearer ' + t },
    timeout: FETCH_TIMEOUT
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error('Graph ' + r.status + ': ' + errText.slice(0,200));
  }
  try { return await r.json(); } catch(_) { throw new Error('Graph response: invalid JSON'); }
}

async function getSheet(name) {
  if (!name || typeof name !== 'string') throw new Error('Sheet name required');
  try {
    const r = await graph(`/drives/${C.driveId}/items/${C.fileId}/workbook/worksheets/${encodeURIComponent(name)}/usedRange(valuesOnly=true)`);
    if (!r.values || r.values.length < 2) return [];
    const h = r.values[0].map(v => String(v??'').trim());
    return r.values.slice(1).filter(row => row.some(v => v!==null&&v!==''&&v!==0))
      .map(row => { const o={}; h.forEach((k,i)=>{ if(k) o[k]=row[i]??''; }); return o; });
  } catch(e) { console.error(`[Auth] Sheet "${name}" fetch failed: ${e.message}`); throw e; }
}

module.exports = { getToken, graph, getSheet };
