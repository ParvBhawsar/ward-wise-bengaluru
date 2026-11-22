export const statuses = ['Plausible real change','Likely administrative cause','Need more information','Not relevant'];
export const legacyKey = 'wardwise-review-v1';
export const prefix = 'wardwise-case-v2:';
export const caseKey = r => [r.ward,r.cat,r.t].join('-');
const temporary = new Map();

function storageEntry(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); }
  catch { return null; }
}
export function readEntry(r) {
  const key=caseKey(r);
  const value=temporary.get(key) || storageEntry(prefix+key) || storageEntry(legacyKey)?.[key];
  if (!value || !statuses.includes(value.status) || typeof value.note!=='string' ||
      typeof value.updated!=='string' || !Number.isFinite(Date.parse(value.updated))) return null;
  return {status:value.status, note:value.note.slice(0,600), updated:value.updated};
}
// Per-case writes prevent saves in unrelated tabs from replacing the entire log.
export async function revise(r, entry, original) {
  const key=caseKey(r);
  const write=()=>{
    const current=readEntry(r);
    if (JSON.stringify(current)!==JSON.stringify(original)) return 'conflict';
    try {
      localStorage.setItem(prefix+key,JSON.stringify(entry));temporary.delete(key);
      return 'saved';
    } catch { temporary.set(key,entry);return 'session'; }
  };
  if (globalThis.navigator?.locks) return navigator.locks.request(prefix+key,write);
  return write();
}
export function parseTransfer(text,cases,categories,quarterName) {
  const list=JSON.parse(text);
  if (!Array.isArray(list)||list.length>cases.length) throw Error('Choose a Ward Wise review-log JSON export.');
  const used=new Set();
  return list.map((x,i)=>{
    const found=cases.find(r=>r.ward===x?.ward && categories[r.cat]===x?.category && quarterName(r.t)===x?.period);
    if (!found || !statuses.includes(x.status) || typeof x.note!=='string' || x.note.length>600 ||
        typeof x.updated!=='string' || !/^\d{4}-\d{2}-\d{2}T/.test(x.updated) ||
        !Number.isFinite(Date.parse(x.updated)) || used.has(caseKey(found)))
      throw Error('Entry '+(i+1)+' is invalid or repeated. No entries were imported.');
    used.add(caseKey(found));
    return {r:found,entry:{status:x.status,note:x.note,updated:new Date(x.updated).toISOString()}};
  });
}
