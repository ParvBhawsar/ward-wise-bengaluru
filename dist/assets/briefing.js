// Fifteen minutes, including the operator-led demo on frame 7.
const frames=[
 {time:'0:00–1:00',label:'The question',title:'What changed in Dodda Nekkundi?',body:'In late 2024, this Bengaluru ward filed far fewer accommodation applications than its history and the citywide pattern suggested.',visual:'opening',note:'Introduce Team Codyssey and the ward-level business-facilitation decision. Ask the audience which number they would compare against 36. Return to this question on slide six.'},
 {time:'1:00–2:20',label:'Economic problem',title:'Where should three records checks go?',body:'A municipal reviewer has limited time after quarter-close. City totals hide local shifts, and raw count changes can simply reflect a filing season.',visual:'decision',note:'Three checks is our design assumption. The officer first checks batches and coding. Independent local evidence would be needed before interpreting a filing change as a change in business activity.'},
 {time:'2:20–3:50',label:'Data and geography',title:'Count each application once.',body:'One BBMP application can contain several trade lines. We reconcile the lines by application ID, then map every filing to one of 198 historical wards.',visual:'data',note:'Describe the September 2026 snapshot covering 2020–2024, the one-to-one historical ward crosswalk, and why mixed and unknown categories stay in every denominator. No individual trader records are published.'},
 {time:'3:50–5:15',label:'Research methodology',title:'Compare like seasons.',body:'January–March accounts for 76.5% of filings. A fall in Q2 is routine. We pool the same quarter in preceding years before comparing the local trade mix.',visual:'season',note:'The bars show citywide counts pooled over five years. Explain the difference between the number of firms, applications, and a category’s share of all applications. New and renewal filings enter the model together.'},
 {time:'5:15–7:05',label:'Statistical model',title:'Build a local expectation.',body:'Start with the ward’s seasonal history. Stabilise it with 40 peer filings, adjust for the change in peer odds, and multiply by the ward’s current filing volume.',visual:'model',note:'Peers exclude the focal ward. Explain the 25-filing minimum, expected counts of at least five on both sides, and the working dispersion of two. Two same-direction deviations beyond two standard deviations are required. Widespread changes can be suppressed before the three-card cap.'},
 {time:'7:05–8:45',label:'Worked output',title:'Reconstruct the 92.4.',body:'Accommodation once made up 190 of 455 local fourth-quarter filings. Its share in the other wards grew from 5.01% to 13.41%. The adjusted expected local share rose to 65.04%.',visual:'case',note:'Multiply 142 by 0.6504. Compare 36 observed with the working range 74.5–110.2. Q3 also fell below its own expectation. Although 25.35% locally is above the current peer share, it is far below the adjusted local expectation.'},
 {time:'8:45–11:15',label:'Working prototype',title:'Follow the evidence to a decision.',body:'Python scores the public aggregates before deployment. Vercel serves a JavaScript and SVG atlas. A reviewer can inspect the evidence and save an assessment in the browser.',visual:'demo',note:'Open the live demo link. Show Bellanduru’s 2024 split, then ward 85 in the evidence lab. Open its review card. If adding a note, label it Demo only. Show the Q3 empty queue. Use the Final briefing navigation to resume slide seven.'},
 {time:'11:15–12:55',label:'Model evaluation',title:'How often does the rule detect a change?',body:'We injected known drops into 400 eligible two-quarter pairs per scenario. The rule is selective. Smaller shifts were usually missed.',visual:'results',note:'Read the four rows. These are simulated detections before suppression and the queue cap. In Q1–Q3 2024, 2 of 6 radar selections persisted one more quarter, versus 0 of 6 for a budget-matched raw-count rule. Six observations cannot establish superiority.'},
 {time:'12:55–14:00',label:'Challenges',title:'A filing change has several explanations.',body:'Late batches, changed trade codes, sparse cells and historical revisions can all produce an apparent shift. Independent economic outcomes are unavailable.',visual:'limits',note:'The map retains all 198 wards, even if a ward rarely qualifies for scoring. The retrospective archive can include later corrections. Report the low sensitivity and the uncertainty in working bands plainly.'},
 {time:'14:00–15:00',label:'Conclusion and next step',title:'Pilot the queue with a licensing team.',body:'Run the radar alongside existing practice with the same time budget. Ask whether it produces more useful follow-ups per review hour.',visual:'pilot',note:'Define quarter-close with the partner. Sample selected and non-selected pairs. Distinguish administrative corrections, credible local explanations and inconclusive cases. We have a reproducible decision-support tool. Measured officer time savings and economic impact are the next research questions.'}
];
function stats(items) {
  return '<div class="deck-stats">'+items.map(([number,label])=>'<div><strong>'+number+'</strong><span>'+label+'</span></div>').join('')+'</div>';
}
function list(items) {return '<ol class="deck-list">'+items.map(x=>'<li>'+x+'</li>').join('')+'</ol>';}
function visual(type,a) {
  const q4=a.queues[19].find(r=>r.ward===85&&r.cat===1);
  switch(type) {
    case 'opening':return stats([[q4.observed,'accommodation filings'],[q4.expected,'expected filings'],['Q4 2024','ward 85']])+'<p class="small"><b>Ward Wise · Bengaluru Trade Atlas</b><br>Aditya Jha, Parv Bhawsar, Sarim Khan and Tvishi Dalmiya<br>SRM Institute of Science and Technology, Kattankulathur</p>';
    case 'decision':return list(['Find a persistent local change.','Trace it to source counts.','Document the next question.']);
    case 'data':return stats([['358,635','in-window trade lines'],['345,123','distinct filings'],['19,502','nonempty aggregate cells']]);
    case 'season': {
      const totals=[0,0,0,0]; for(const [,t,,n,r] of a.rows) totals[t%4]+=n+r;
      return '<div class="deck-bars">'+totals.map((n,i)=>'<div><span>Q'+(i+1)+'</span><i style="width:'+100*n/totals[0]+'%"></i><b>'+n.toLocaleString('en-IN')+'</b></div>').join('')+'</div>';
    }
    case 'model':return list(['Seasonal ward share → stabilised share','Other 197 wards → change in odds','Expected share × observed volume → expected filings']);
    case 'case':return '<figure><img src="briefing/ward-wise-evidence.jpg" alt="Submitted evidence card showing 36 observed filings, 92.4 expected and a working range of 74.5 to 110.2"><figcaption>Stage 2 prototype · Q4 2024 evidence card</figcaption></figure>';
    case 'demo':return '<figure><img src="briefing/ward-wise-atlas.jpg" alt="Submitted interactive Bengaluru ward map and ward profile"><figcaption>Stage 2 prototype · Bengaluru atlas · boundaries © DataMeet, lakes © ATREE-CSEI via OpenCity</figcaption></figure><div class="tools"><a class="btn" href="#atlas/150/2024">Open Bellanduru on map ↗</a><a class="btn" href="#lab/85/1/19">Open evidence lab ↗</a></div>';
    case 'results':return '<table class="datatable"><thead><tr><th>Injected drop</th><th>Detected / 400</th><th>Rate</th></tr></thead><tbody>'+a.evaluation.map(r=>'<tr><td>'+Math.round(r.drop*100)+'%</td><td>'+r.detected+' / '+r.trials+'</td><td>'+(r.detected/r.trials*100).toFixed(2)+'%</td></tr>').join('')+'</tbody></table>';
    case 'limits':return stats([['13.47%','unclassified filings'],['6','evaluable historical selections'],['0','field-adjudicated outcomes reported']]);
    case 'pilot':return list(['Time each review and record its disposition.','Ask a second reviewer which follow-ups were useful.','Revisit cases after source corrections.']);
  }
}
const frameHTML=(f,i,a)=>`<article class="deck-slide"><div class="deck-kicker">Team Codyssey <span>/</span> ${f.label}</div><h2>${f.title}</h2><p class="deck-lede">${f.body}</p><div class="deck-visual">${visual(f.visual,a)}</div><div class="deck-folio"><span>Ward Wise · Bengaluru Trade Atlas</span><span>${String(i+1).padStart(2,'0')} / 10</span></div></article>`;
export function briefing(main,atlas,page) {
  const i=Number.isInteger(page)&&page>=1&&page<=10?page-1:0;
  const f=frames[i];
  main.innerHTML=`<div class="brief-toolbar"><div><span class="over orange">Final presentation</span><h1>Research briefing</h1></div><div class="tools"><button class="btn" id="print-deck">Print / save slides</button><button class="btn" id="full-deck">Full screen</button></div></div>
  <div class="brief-current">${frameHTML(f,i,atlas)}</div><div class="deck-controls"><a class="btn" ${i?'href="#brief/'+i+'"':'aria-disabled="true"'}>← Previous</a><label>Slide <select id="deck-page">${frames.map((v,j)=>'<option value="'+(j+1)+'"'+(j===i?' selected':'')+'>'+(j+1)+' · '+v.label+'</option>').join('')}</select></label><a class="btn" ${i<9?'href="#brief/'+(i+2)+'"':'aria-disabled="true"'}>Next →</a></div>
  <details class="panel deck-notes"><summary>Presenter notes · ${f.time} of 15:00</summary><p>${f.note}</p></details>
  <details class="panel demo-setup"><summary>Run the demo on your laptop</summary><p>Clone the repository, serve the bundled site with Python 3 and open the local address. Once downloaded, the demo works without internet or API keys.</p><pre>git clone https://github.com/ParvBhawsar/ward-wise-bengaluru.git
cd ward-wise-bengaluru
python3 -m http.server 5173 --bind 127.0.0.1 --directory dist</pre><p>Open <a href="http://127.0.0.1:5173">http://127.0.0.1:5173</a>. On Windows you can use <code>py -3</code> in place of <code>python3</code>.</p><a href="https://github.com/ParvBhawsar/ward-wise-bengaluru">Source and reproducibility instructions ↗</a> · <a href="https://github.com/ParvBhawsar/ward-wise-bengaluru/archive/refs/heads/main.zip">Download offline demo ZIP</a></details>
  <div class="deck-print">${frames.map((frame,j)=>frameHTML(frame,j,atlas)).join('')}</div>`;
  main.querySelector('#deck-page').onchange=e=>location.hash='brief/'+e.target.value;
  main.querySelector('#print-deck').onclick=()=>window.print();
  const fullscreen=main.querySelector('#full-deck');
  if (!document.fullscreenEnabled) fullscreen.hidden=true;
  else {fullscreen.textContent=document.fullscreenElement?'Exit full screen':'Full screen';
    fullscreen.onclick=async()=>{try {if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
      catch {fullscreen.hidden=true;}};
  }
  return i+1;
}
