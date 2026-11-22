import {labSelection, expectedSteps} from './research.js';

const decisions = {
  baseline:['Baseline period','The first year supplies seasonal history. There is no earlier matching quarter in this extract.'],
  volume:['Insufficient volume','Scoring requires at least 25 current applications and 25 historical applications in the same season.'],
  small:['Sparse trade split','The expected counts inside and outside the trade must both reach five to receive a score.'],
  unconfirmed:['Outside the shortlist','Two consecutive eligible quarters must cross the threshold in the same direction.'],
  budget:['Outside the quarterly budget','The pair passed persistence. Other eligible pairs filled the three available places.'],
  shared:['Common movement','This trade moved in the same direction across enough eligible wards to be suppressed.'],
  selected:['Selected for review','Two consecutive deviations in the same direction qualified this case for the quarterly review queue.']
};
const num=n=>n.toLocaleString('en-IN');
const share=(n,d)=>d?(100*n/d).toFixed(2)+'%':'—';
const scoreText=z=>z==null?'—':(z>0?'+':'')+z.toFixed(3);
const option=(v,label,active,escape)=>'<option value="'+v+'"'+(v===active?' selected':'')+'>'+escape(label)+'</option>';
const link=(w,c,t,peer=0)=>'#lab/'+[w,c,t,...(peer?[peer]:[])].join('/');
const short=t=>'Q'+(t%4+1)+' '+(2020+Math.floor(t/4));

function timeline(records,selected) {
  const width=760, height=180, left=38, right=18, top=24, bottom=30;
  const max=Math.max(1,...records.flatMap(r=>[r.O,r.score?.high??0]));
  const x=i=>left+(width-left-right)*i/19;
  const y=n=>height-bottom-(height-bottom-top)*n/max;
  const line=(arr)=>arr.map((d,i)=>(i?'L':'M')+x(d.t).toFixed(1)+' '+y(d.O).toFixed(1)).join(' ');
  const grid=[0,.5,1].map(f=>'<line x1="'+left+'" x2="'+(width-right)+'" y1="'+y(f*max)+'" y2="'+y(f*max)+'"/><text x="2" y="'+(y(f*max)+4)+'">'+Math.round(f*max)+'</text>').join('');
  const ticks=[0,4,8,12,16].map(t=>'<text x="'+x(t)+'" y="174">'+(2020+t/4)+'</text>').join('');
  const bands=records.filter(r=>r.score).map(r=>'<line class="band-stick" x1="'+x(r.t)+'" x2="'+x(r.t)+'" y1="'+y(r.score.high)+'" y2="'+y(r.score.low)+'"/><circle class="band-dot" cx="'+x(r.t)+'" cy="'+y(r.score.expected)+'" r="3"/>').join('');
  const active=records[selected];
  return '<svg class="research-chart" viewBox="0 0 760 180" role="img" aria-label="Twenty quarterly filing counts, with working model bands where eligible. A table follows.">'+grid+ticks+bands+'<line class="at-period" x1="'+x(selected)+'" x2="'+x(selected)+'" y1="12" y2="150"/><path class="obs-line" d="'+line(records)+'"/><circle class="obs-dot" cx="'+x(selected)+'" cy="'+y(active.O)+'" r="5"/></svg>';
}

export function renderLab({main,atlas,wards,byId,index,escape,download,notify,openCase}) {
  const {w,c,t,peer}=labSelection(location.hash,byId);
  const sorted=[...wards].sort((a,b)=>a.name.localeCompare(b.name));
  const ward=byId.get(w), category=atlas.categories[c];
  const series=Array.from({length:20},(_,i)=>index.record(w,c,i));
  const r=series[t], previous=t>0?series[t-1]:null, s=r.score;
  const other=peer?index.record(peer,c,t):null;
  const [result,explanation]=decisions[r.reason];
  const steps=expectedSteps(r,index.parameters.borrowed);
  const wardSelect=(omit,selected)=>sorted.filter(v=>v.id!==omit).map(v=>option(v.id,v.name+' · '+v.id,selected,escape)).join('');
  const options=atlas.categories.slice(0,8).map((name,i)=>option(i,name,c,escape)).join('');
  const periods=[...series].reverse();
  const quarterOptions=periods.map(i=>option(i.t,short(i.t),t,escape)).join('');
  const renderCount=(label,n,caption)=>'<div><span>'+label+'</span><strong>'+n+'</strong><small>'+caption+'</small></div>';
  const title=escape(ward.name);
  const rawRows=[['Ward · this quarter',r.O,r.N],['Other 197 wards · this quarter',r.C,r.D],['Ward · matching quarters in earlier years',r.H,r.T],['Other wards · matching quarters in earlier years',r.A,r.B]];
  const rawTable=rawRows.map(([label,n,d])=>'<tr><th scope="row">'+label+'</th><td>'+num(n)+'</td><td>'+num(d)+'</td><td>'+share(n,d)+'</td></tr>').join('');
  const peerRows=[r,...(other?[other]:[])].map(v=>'<tr><th scope="row">'+escape(byId.get(v.ward).name)+'</th><td>'+num(v.O)+'</td><td>'+num(v.N)+'</td><td>'+share(v.O,v.N)+'</td><td>'+scoreText(v.score?.z)+'</td></tr>').join('');
  const eligibleSeries=series.map(v=>'<tr'+(v.t===t?' class="current-row"':'')+'><th scope="row"><a href="'+link(w,c,v.t,peer)+'">'+short(v.t)+'</a></th><td>'+num(v.O)+'</td><td>'+(v.score?v.score.expected.toFixed(1):'—')+'</td><td>'+scoreText(v.score?.z)+'</td><td>'+decisions[v.reason][0]+'</td></tr>').join('');
  main.innerHTML=`
    <section class="hero lab-hero"><div><div class="eyebrow">Research / model inspection</div><h1>Evidence <i>lab</i></h1><p>Trace any ward’s filings from the source counts to the quarterly decision.</p></div>
    <div class="tools"><button class="btn" id="copy-case">Copy link</button><button class="btn" id="export-case">Export evidence</button></div></section>
    <section class="lab-filters" aria-label="Evidence filters">
      <label>Historical ward<select id="lab-ward">${wardSelect(0,w)}</select></label>
      <label>Trade category<select id="lab-trade">${options}</select></label>
      <label>Quarter<select id="lab-quarter">${quarterOptions}</select></label>
      <label>Compare with<select id="lab-peer"><option value="0">No second ward</option>${wardSelect(w,peer)}</select></label></section>
    <div class="lab-grid"><section class="case-plate"><div class="eyebrow">Ward ${w} · ${short(t)}</div>
      <h2>${title}</h2><p>${escape(category)} · all application types</p>
      <div class="case-values">${renderCount('Observed',num(r.O),'recorded filings')}${renderCount('Expected',s?s.expected.toFixed(1):'—',s?'peer-adjusted filings':'outside scoring gates')}${renderCount('Working band',s?s.low.toFixed(1)+'–'+s.high.toFixed(1):'—','model range')}</div>
      <div class="case-verdict"><strong>${result}</strong><p>${explanation}</p></div></section>
    <section class="panel decision-panel"><span class="over orange">Quarterly decision</span><h2>Why this outcome?</h2>
      <dl><dt>Ward volume</dt><dd>${num(r.N)} current · ${num(r.T)} historical</dd><dt>This quarter’s score</dt><dd>${scoreText(s?.z)}</dd><dt>Previous quarter’s score</dt><dd>${scoreText(previous?.score?.z)}</dd><dt>Threshold</dt><dd>±2 in the same direction, twice</dd></dl>
      ${r.reason==='selected'?'<button class="action" id="assess-case">Assess this case →</button>':'<a class="textbtn" href="#radar/'+t+'">View this quarter’s queue →</a>'}</section></div>
    <section class="panel history-panel"><div class="panel-header"><div><div class="over orange">2020–2024</div><h2>Quarterly filing history</h2></div><div class="chart-key"><span>● Observed</span><span>┃ Working range</span></div></div>${timeline(series,t)}
    <details><summary>Inspect all 20 quarters</summary><div class="table-scroll"><table class="datatable"><thead><tr><th>Quarter</th><th>Observed</th><th>Expected</th><th>Score</th><th>Decision</th></tr></thead><tbody>${eligibleSeries}</tbody></table></div></details></section>
    <div class="lab-grid equal"><section class="panel"><div class="over orange">Source counts</div><h2>Where the numbers come from</h2><div class="table-scroll"><table class="datatable"><thead><tr><th>Population</th><th>Trade</th><th>All</th><th>Share</th></tr></thead><tbody>${rawTable}</tbody></table></div>
    ${steps?`<details><summary>Reconstruct the expectation</summary><ol class="formula-list"><li>Smooth peer shares with half a filing on each side. Historical share is ${(100*steps.u).toFixed(2)}%, current share is ${(100*steps.v).toFixed(2)}%.</li><li>Blend the ward’s history with ${index.parameters.borrowed} peer filings. Local baseline becomes ${(100*steps.s).toFixed(2)}%.</li><li>Multiply historical local odds by the peer odds change of ${steps.movement.toFixed(3)}×. Expected share is ${(100*steps.p).toFixed(2)}%.</li><li>${num(r.N)} × ${steps.p.toFixed(4)} ≈ ${s.expected.toFixed(1)} filings. The working band uses fixed dispersion of two.</li></ol></details>`:''}</section>
    <section class="panel"><div class="over orange">Same trade and quarter</div><h2>Compare wards</h2>
      <div class="table-scroll"><table class="datatable"><thead><tr><th>Ward</th><th>Trade</th><th>All</th><th>Share</th><th>Score</th></tr></thead><tbody>${peerRows}</tbody></table></div>
      <p>${other?(r.N&&other.N?'The first ward’s trade share is '+Math.abs(100*(r.O/r.N-other.O/other.N)).toFixed(2)+' percentage points '+(r.O/r.N>=other.O/other.N?'higher':'lower')+' than the second ward’s.':'At least one ward has zero recorded applications this quarter. A share difference cannot be calculated.'):'Choose a second ward above to compare volumes and shares side by side.'}</p>
      <p class="small">Each score uses its own historical baseline. Choosing a comparison ward does not change either score.</p></section></div>
    ${steps?`<section class="panel scenario"><div class="over orange">Sensitivity check</div><h2>What if the filing count changed?</h2>
    <p>Hold the ward total at ${num(r.N)} and the peer evidence fixed. Change the number assigned to ${escape(category.toLowerCase())} to see how this quarter’s score responds.</p>
    <label for="scenario-count">Hypothetical trade filings</label><div class="scenario-controls"><input id="scenario-count" type="range" min="0" max="${r.N}" step="1" value="${r.O}"><output id="scenario-value" for="scenario-count">${r.O}</output><button class="btn" id="reset-scenario">Reset to observed</button></div>
    <p class="scenario-answer" id="scenario-answer" aria-live="polite"></p><p class="small">This illustration varies the current-quarter count only. The official queue continues to use the recorded filings.</p></section>`:''}
    <div class="memo">These are recorded applications. A late batch or changed trade heading can affect the result. Independent evidence is needed to establish a business closure or a cause. <a href="#methods">Read the methodology</a>.</div>`;
  const get=id=>main.querySelector('#'+id);
  for(const id of ['lab-ward','lab-trade','lab-quarter','lab-peer']) get(id).onchange=()=>{
    const selected=Number(get('lab-ward').value), compared=Number(get('lab-peer').value);
    location.hash=link(selected,Number(get('lab-trade').value),Number(get('lab-quarter').value),compared===selected?0:compared);
  };
  if(steps){
    const updateScenario=()=>{
      const count=Number(get('scenario-count').value);
      const sigma=Math.sqrt(Math.max(1,2*r.N*steps.p*(1-steps.p)*(1+r.N/(r.T+index.parameters.borrowed))));
      const z=(count-r.N*steps.p)/sigma;
      get('scenario-value').textContent=num(count);
      const previousScore=r.prev?.z;
      let interpretation='Within this quarter’s threshold.';
      if(Math.abs(z)>=index.parameters.threshold){
        interpretation=previousScore!=null&&Math.abs(previousScore)>=index.parameters.threshold&&previousScore*z>0
          ? 'The two-quarter persistence rule would pass before any shared-movement or budget checks.'
          : 'This quarter would cross the threshold. The preceding quarter does not confirm it in the same direction.';
      }
      get('scenario-answer').textContent='Illustrative score '+scoreText(z)+'. '+interpretation;
    };
    get('scenario-count').oninput=updateScenario;
    get('reset-scenario').onclick=()=>{get('scenario-count').value=r.O;updateScenario();};
    updateScenario();
  }
  get('copy-case').onclick=async()=>{
    try {await navigator.clipboard.writeText(location.href);notify('Evidence link copied.');}
    catch {notify('Copy the current address to share this evidence.');}
  };
  get('export-case').onclick=()=>download('ward-wise-evidence-'+w+'-'+c+'-'+t+'.json',JSON.stringify({
    dataset:'BBMP trade applications 2020–2024',source:'BBMP via Vivek Matthew (Vonter), adapted by Team Codyssey · ODbL 1.0',
    quarter:short(t),ward:ward.name,category,decision:result,inputs:{observed:r.O,volume:r.N,historicalTrade:r.H,historicalAll:r.T,historicalPeerTrade:r.A,historicalPeerAll:r.B,currentPeerTrade:r.C,currentPeerAll:r.D},
    score:s,previousQuarterScore:previous?.score??null,parameters:index.parameters,comparison:other?{ward:byId.get(peer).name,observed:other.O,volume:other.N,score:other.score}:null,history:series.map(v=>({period:short(v.t),observed:v.O,volume:v.N,score:v.score,decision:decisions[v.reason][0]}))},null,2),'application/json');
  if(get('assess-case'))get('assess-case').onclick=()=>openCase(w,c,t);
}
