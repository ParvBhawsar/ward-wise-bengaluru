// Raw evidence uses integer application counts. Selection and rounded scores
// come directly from the Python research run, including below-budget cases.
export function researchIndex(atlas, audit) {
  const counts = new Map();
  const city = Array.from({length:20}, () => new Array(11).fill(0));
  for (const [ward, t, category, fresh, renewal] of atlas.rows) {
    const key = ward * 20 + t;
    if (!counts.has(key)) counts.set(key, new Array(11).fill(0));
    const cell = counts.get(key);
    const n = fresh + renewal;
    cell[category] += n;
    cell[10] += n;
    city[t][category] += n;
    city[t][10] += n;
  }
  const scores = new Map();
  const keyOf = (w,c,t) => (w * 10 + c) * 20 + t;
  for (const [w,c,t,expected,low,high,z,decision] of audit.scores) {
    scores.set(keyOf(w,c,t), {expected,low,high,z,decision});
  }
  const empty = Array(11).fill(0);
  function record(w,c,t) {
    const local = counts.get(w*20+t) || empty;
    let H = 0, T = 0, A = 0, B = 0;
    for (let i=t%4; i<t; i+=4) {
      const past = counts.get(w*20+i) || empty;
      H += past[c]; T += past[10];
      A += city[i][c]-past[c]; B += city[i][10]-past[10];
    }
    const O=local[c], N=local[10], C=city[t][c]-O, D=city[t][10]-N;
    const score=scores.get(keyOf(w,c,t)) || null;
    const prev=t>0 ? scores.get(keyOf(w,c,t-1)) || null : null;
    let reason;
    if (t < 4) reason='baseline';
    else if (N < audit.parameters.volume || T < audit.parameters.volume) reason='volume';
    else if (!score) reason='small';
    else reason=score.decision;
    return {ward:w,cat:c,t,O,N,H,T,A,B,C,D,score,prev,reason};
  }
  return {record, parameters:audit.parameters};
}

export function labSelection(hash, wards) {
  const [,ws,cs,ts,ps] = hash.replace(/^#/,'').split('/');
  const integer = (s,lo,hi,fallback) => /^\d+$/.test(s||'') && Number(s)>=lo && Number(s)<=hi ? Number(s) : fallback;
  const w=integer(ws,1,198,85);
  const peer=integer(ps,1,198,0);
  return {w:wards.has(w)?w:85,c:integer(cs,0,7,1),t:integer(ts,0,19,19),peer:peer!==w && wards.has(peer)?peer:0};
}

export function expectedSteps(r,borrowed) {
  if (!r.score) return null;
  const u=(r.A+0.5)/(r.B+1), v=(r.C+0.5)/(r.D+1);
  const s=(r.H+borrowed*u)/(r.T+borrowed);
  const odds=p=>p/(1-p);
  const movement=odds(v)/odds(u);
  const adjusted=odds(s)*movement;
  return {u,v,s,movement,p:adjusted/(1+adjusted)};
}
