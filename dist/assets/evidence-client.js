import {labSelection} from './research.js';

// Quarter changes reuse the same 20-point series. Cap the cache for long sessions.
const requests = new Map();
async function fetchSeries(url, wards, category) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, {signal:controller.signal, headers:{Accept:'application/json'}});
    if (!response.ok) throw Error('Evidence service unavailable');
    const payload = await response.json();
    if (payload.version !== 1 || !Number.isFinite(payload.parameters?.borrowed) ||
        !wards.every(w => Array.isArray(payload.series?.[w]) && payload.series[w].length === 20 &&
          payload.series[w].every((r,t) => r.ward === w && r.cat === category && t === r.t))) {
      throw Error('Unexpected evidence response');
    }
    return {parameters:payload.parameters, record:(w,c,t)=>c===category ? payload.series[w]?.[t] : undefined};
  } finally {
    clearTimeout(timer);
  }
}

export async function loadEvidence(hash, byId, fallback) {
  const {w,c,peer} = labSelection(hash,byId);
  const params = new URLSearchParams({ward:String(w),category:String(c)});
  if (peer) params.set('peer',String(peer));
  const url = '/api/evidence?'+params;
  if (!requests.has(url)) {
    if (requests.size >= 32) requests.delete(requests.keys().next().value);
    const request = fetchSeries(url,peer?[w,peer]:[w],c);
    requests.set(url,request);
    request.catch(()=>{if(requests.get(url)===request)requests.delete(url);});
  }
  try {return await requests.get(url);}
  catch {return fallback();}
}
