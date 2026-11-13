import {observeSections, playMotion} from './motion.js';
import {mountSpotlight} from './spotlight.js';
const main = document.querySelector('#content');
const dialog = document.querySelector('#dialog');
const sheet = document.querySelector('#dialog-body');
const nf = new Intl.NumberFormat('en-IN');
const fmt = n => nf.format(n);
const pct = (n,d) => d ? (100*n/d).toFixed(1)+'%' : '—';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const paths = {
  pin:'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1116 0z M15 10a3 3 0 11-6 0 3 3 0 016 0z',
  search:'M17 17l5 5 M19 11a8 8 0 11-16 0 8 8 0 0116 0z', down:'M3 16v4h18v-4 M12 3v12m-5-5 5 5 5-5',
  tune:'M3 8h9m5 0h4M3 16h2m5 0h11 M14.5 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z M7.5 13.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  box:'M3 6l9-4 9 4-9 4z M3 6v12l9 4 9-4V6 M12 10v12',
  arrow:'M3 12h16m-6-6 6 6-6 6', up:'M6 18 18 6 M6 6h12v12', close:'M5 5l14 14M19 5 5 19',
  plus:'M12 4v16M4 12h16', minus:'M4 12h16', reset:'M3 8a9 9 0 111 10 M3 3v5h5',
  chart:'M3 18l6-7 4 3 6-9', book:'M3 4h7a3 3 0 012 2 3 3 0 012-2h7v15h-7a3 3 0 00-2 2 3 3 0 00-2-2H3z'
};
const ic = n => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[n]+'"/></svg>';
const labels = ['New','Renewal'], typeColors=['#e68856','#7560a5'];
const catColors=['#e98256','#9c81b5','#8ba39a','#697eaa','#be865b','#8b75ab','#a7a4bd','#939868','#baa8a4','#c4beb3'];
const colors=['#64557e','#82709a','#a48caf','#c3a5b5','#e4b5a0','#ef996c','#f27444'];
const years=[2020,2021,2022,2023,2024];
let a,geo,lakes,coverage,wards,wardById,rows;
const state={year:'all',cat:'all',type:'all',ward:151,t:19,zoom:1,relief:false};
let activeChart;
let timelineTimer = null;
const view = () => ['radar','methods'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'atlas';
function message(txt){const n=document.querySelector('#notify');n.textContent=txt;setTimeout(()=>{if(n.textContent===txt)n.textContent=''},3800)}
function qname(t){return 'Q'+(t%4+1)+' '+(2020+Math.floor(t/4))}
function openSheet(html){
  sheet.innerHTML='<div class="sheet"><div class="sheetbar"><span class="eyebrow">Ward Wise / Field notes</span><button id="close" class="iconbtn" aria-label="Close dialog">'+ic('close')+'</button></div>'+html+'</div>';
  const title=sheet.querySelector('h2');if(title){title.id='modal-title';dialog.setAttribute('aria-labelledby',title.id)}
  stopTimeline();
  if(!dialog.open)dialog.showModal();sheet.querySelector('#close').onclick=()=>dialog.close();
}
dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close()}});
function hero(kicker,first,second,sub,button=''){return '<section class="hero"><div><div class="eyebrow">'+kicker+'</div><h1><span>'+first+'</span> <i>'+second+'</i></h1><p>'+sub+'</p></div>'+button+'</section>'}
function download(name,body,mime='text/csv;charset=utf-8'){
 const u=URL.createObjectURL(new Blob([body],{type:mime}));const tag=document.createElement('a');tag.href=u;tag.download=name;tag.click();setTimeout(()=>URL.revokeObjectURL(u),8000);
}
const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const csv=arr=>arr.map(line=>line.map(csvCell).join(',')).join('\r\n')+'\r\n';
function filterRows({year=state.year,cat=state.cat,type=state.type,ward=0}={}){
 return rows.filter(r=>(year==='all'||2020+Math.floor(r[1]/4)===Number(year))&&(cat==='all'||r[2]===Number(cat))&&(!ward||r[0]===ward))
   .map(r=>[r[0],r[1],r[2],type==='renewal'?0:r[3],type==='new'?0:r[4]]);
}
function summarize(data){
 const byWard=new Array(199).fill(0),byCat=new Array(a.categories.length).fill(0),byYear=new Array(5).fill(0),byQ=new Array(20).fill(0);
 let fresh=0,renew=0;
 for(const [w,t,c,n,r] of data){const count=n+r;byWard[w]+=count;byCat[c]+=count;byYear[Math.floor(t/4)]+=count;byQ[t]+=count;fresh+=n;renew+=r}
 return {byWard,byCat,byYear,byQ,fresh,renew,total:fresh+renew};
}
function opt(val,caption,selected){return '<option value="'+esc(val)+'"'+(String(val)===String(selected)?' selected':'')+'>'+esc(caption)+'</option>'}
function filters(){return '<div class="filters"><div class="filter-year"><span class="over">Period</span><div class="seg" aria-label="Calendar year">'+['all',...years].map(v=>'<button type="button" data-year="'+v+'" class="'+(state.year===String(v)?'on':'')+'" aria-pressed="'+(state.year===String(v))+'">'+(v==='all'?'All years':v)+'</button>').join('')+'</div></div><div class="filter-rest"><label class="select-wrap">'+ic('tune')+'<select id="type" aria-label="Application type">'+[['all','All applications'],['new','New applications'],['renewal','Renewal applications']].map(([k,v])=>opt(k,v,state.type)).join('')+'</select></label><label class="select-wrap">'+ic('box')+'<select id="category" aria-label="Trade category">'+opt('all','All trade categories',state.cat)+a.categories.map((v,i)=>opt(i,v,state.cat)).join('')+'</select></label></div></div>'}
function legendColors(){return colors.map(c=>'<b style="background:'+c+'"></b>').join('')}
function spark(data){const max=Math.max(...data,1),min=Math.min(...data);const pts=data.map((n,i)=>[3+i*25,38-29*(n-min)/Math.max(1,max-min)]);return '<svg aria-hidden="true" viewBox="0 0 108 45" class="spark"><path d="M'+pts.map(x=>x.join(' ')).join(' L')+'" fill="none" stroke="#776197" stroke-width="2"/>'+pts.map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="2.5" fill="#776197"/>').join('')+'</svg>'}
function chartSVG(values,xLabels,color='#79649e'){
 const W=490,H=135,L=38,R=16,T=12,B=24,max=Math.max(...values,1),x=i=>L+(W-L-R)*i/Math.max(1,values.length-1),y=n=>T+(H-B-T)*(1-n/max);
 let str='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(xLabels.map((l,i)=>l+' '+fmt(values[i])).join(', '))+'">';
 for(const ratio of [0,.5,1]){const n=max*ratio;str+='<path d="M'+L+' '+y(n)+'H'+(W-R)+'" stroke="#dfdcd2" stroke-dasharray="3 4"/><text x="'+(L-5)+'" y="'+(y(n)+4)+'" text-anchor="end">'+(n>=1000?(n/1000).toFixed(n>=10000?0:1)+'k':Math.round(n))+'</text>'}
 const line=values.map((n,i)=>[x(i),y(n)].join(' ')).join(' L');
 str+='<path d="M'+x(0)+' '+y(0)+' L'+line+' L'+x(values.length-1)+' '+y(0)+'Z" fill="'+color+'" opacity=".12"/><path class="trend-stroke" pathLength="1" d="M'+line+'" fill="none" stroke="'+color+'" stroke-width="2.8"/>';
 values.forEach((n,i)=>{str+='<circle cx="'+x(i)+'" cy="'+y(n)+'" r="3.7" fill="'+color+'" stroke="#fff" stroke-width="1.5"><title>'+esc(xLabels[i])+' · '+fmt(n)+'</title></circle><text x="'+x(i)+'" y="'+(H-4)+'" text-anchor="middle">'+esc(xLabels[i])+'</text>'});
 return str+'</svg>'
}
function bars(s,limit=5){const order=s.byCat.map((n,i)=>({n,i})).filter(x=>x.n>0).sort((x,y)=>y.n-x.n).slice(0,limit);
 return order.map(({n,i})=>'<div class="hbar"><span>'+esc(a.categories[i])+'</span><div class="track"><i style="width:'+100*n/order[0].n+'%;background:'+catColors[i]+'"></i></div><span class="val">'+fmt(n)+'</span></div>').join('')||'<p class="empty">No matching applications.</p>'}
function periodLabel(){return state.year==='all'?'2020–2024':state.year}
function inspector(s){
 const w=wardById.get(state.ward),ws=summarize(filterRows({ward:w.id}));
 const top=ws.byCat.indexOf(Math.max(...ws.byCat));const leader=ws.total?'<div class="leadtrade"><span class="over">Largest trade category</span><div>'+esc(a.categories[top])+' <b>'+pct(ws.byCat[top],ws.total)+'</b></div></div>':'';
 return '<div class="over orange">Selected ward · '+String(w.id).padStart(3,'0')+'</div><div class="inspect-title"><div><h2>'+esc(w.name)+'</h2><p class="small">'+esc(w.constituency)+' constituency</p></div><span class="pin-box">'+ic('pin')+'</span></div><div class="inspect-stat"><strong>'+fmt(ws.total)+'</strong><span>applications · '+periodLabel()+'</span></div><div class="proportions">'+[ws.fresh,ws.renew].map((n,i)=>'<span style="width:'+pct(n,ws.total)+';background:'+typeColors[i]+'"></span>').join('')+'</div><div class="key">'+[ws.fresh,ws.renew].map((n,i)=>'<span><i style="background:'+typeColors[i]+'"></i>'+labels[i]+' '+fmt(n)+'</span>').join('')+'</div>'+leader+'<div class="inspect-foot"><span class="small">'+pct(ws.total,s.total)+' of selection</span><button id="profile" class="textbtn">Ward profile '+ic('arrow')+'</button></div>'
}
function selectWard(id){
 state.ward=id;const old=main.querySelector('.ward.sel');if(old)old.classList.remove('sel');
 const path=main.querySelector('[data-ward="'+id+'"]');if(path)path.classList.add('sel');
 main.querySelector('#inspect').innerHTML=inspector(activeChart);main.querySelector('#profile').onclick=wardProfile;
 positionBeacon();
 playMotion(main.querySelector('.inspect-title'),[{opacity:.4,transform:'translateX(-8px)'},{opacity:1,transform:'translateX(0)'}],{duration:350,easing:'ease-out'});
 mapZoom();
}
function wardProfile(){
 const w=wardById.get(state.ward), all=summarize(filterRows({ward:w.id,year:'all'})), ws=summarize(filterRows({ward:w.id}));
 openSheet('<div class="over orange">Ward '+w.id+' · '+periodLabel()+'</div><h2>'+esc(w.name)+'</h2><p class="small">'+esc(w.constituency)+' constituency · 2012 BBMP boundaries</p><div class="evi-nums"><div><span class="over">Applications</span><strong>'+fmt(ws.total)+'</strong></div><div><span class="over">New</span><strong>'+fmt(ws.fresh)+'</strong></div><div><span class="over">Renewal</span><strong>'+fmt(ws.renew)+'</strong></div></div><div class="over">Five-year application history · current trade and type</div>'+chartSVG(all.byYear,years)+'<div class="over">Recorded trade mix · '+periodLabel()+'</div>'+bars(ws,10));
}
function searchWards(){
 openSheet('<h2>Find a ward</h2><label for="query">Ward name, number or constituency</label><input id="query" autocomplete="off" placeholder="Try Koramangala or 151"><div class="results"></div>');
 const inp=sheet.querySelector('#query'),res=sheet.querySelector('.results');
 function draw(){const q=inp.value.trim().toLowerCase();const list=wards.filter(w=>[w.name,w.constituency].join(' ').toLowerCase().includes(q)||String(w.id)===q).sort((x,y)=>x.name.localeCompare(y.name));res.innerHTML=list.map(w=>'<button class="result" data-id="'+w.id+'"><span>'+esc(w.name)+'</span><small>Ward '+w.id+'</small></button>').join('')||'<p class="empty">No ward matches this search.</p>'}
 res.onclick=e=>{const b=e.target.closest('[data-id]');if(b){selectWard(Number(b.dataset.id));state.zoom=1;mapZoom();dialog.close()}};
 inp.oninput=draw;draw();inp.focus()
}
function positionBeacon(){
 const beacon=main.querySelector('#ward-beacon');
 if(!beacon)return;
 const w=wardById.get(state.ward);
 const selected=main.querySelector('[data-ward="'+w.id+'"]');
 const height=state.relief?Number(selected?.dataset.height||0):0;
 beacon.setAttribute('transform','translate('+w.x+' '+(w.y-height)+')');
 const ring=beacon.querySelector('.beacon-ring');
 ring.getAnimations().forEach(animation=>animation.cancel());
 playMotion(ring,[{transform:'scale(.45)',opacity:1},{transform:'scale(2.15)',opacity:0}],{duration:920,easing:'ease-out'});
}
function mapZoom(){
 const g=main.querySelector('#terrain');if(!g)return;
 const w=wardById.get(state.ward),z=state.zoom;
 g.style.transform='matrix('+[z,0,0,z,(1-z)*w.x,(1-z)*w.y].join(',')+')';
}
let annualScale;
function mapCuts(s){
 let values=s.byWard.slice(1);
 if(state.year!=='all'){
   const key=state.type+'|'+state.cat;
   if(annualScale?.key!==key){
     const yearly=years.map(()=>new Array(199).fill(0));
     for(const [w,t,,n,r] of filterRows({year:'all'}))yearly[Math.floor(t/4)][w]+=n+r;
     annualScale={key,values:yearly.flatMap(series=>series.slice(1))};
   }
   values=annualScale.values;
 }
 const sorted=values.filter(n=>n>0).sort((x,y)=>x-y);
 return colors.slice(1).map((_,i)=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*(i+1)/7))]??0);
}
function updateMapColors(s){
 const cuts=mapCuts(s);
 const scale=main.querySelector('#scale');
 const basis=state.year==='all'?'five-year ward totals':'all five years of annual ward totals';
 scale.title='Seven bands based on '+basis+'. Count breaks: '+cuts.map(fmt).join(', ');
 main.querySelectorAll('.ward[data-ward]').forEach(face=>{
   const n=s.byWard[Number(face.dataset.ward)];
   const band=cuts.reduce((b,cut)=>b+Number(n>cut),0);
   face.setAttribute('fill',n?colors[band]:'#514b5e');
   const height=n?5+band*5:0;
   face.dataset.height=String(height);
   face.parentNode.style.setProperty('--lift',(-height)+'px');
 });
 positionBeacon();
}
function toggleRelief(){
 state.relief=!state.relief;
 const card=main.querySelector('.map-card');
 card.classList.toggle('relief-on',state.relief);
 main.querySelector('#relief').setAttribute('aria-pressed',String(state.relief));
 main.querySelector('.map-scale .map-note').textContent=state.relief?'Height + colour · volume':'Application volume';
 positionBeacon();
}
function paintMap(s){
 const stage=main.querySelector('#stage');
 const names=[[4,'Yelahanka',-30,-16],[21,'Hebbal',-12,-14],[83,'Kadugodi',-18,22],[123,'Vijayanagar',-28,12],[151,'Koramangala',38,19],[192,'Begur',0,15],[150,'Bellandur',18,20]];
 const sortedWards=[...wards].sort((a,b)=>a.y-b.y);
 const namesSVG=names.map(([id,label,dx,dy])=>{const w=wardById.get(id);return '<text class="place-label" x="'+(w.x+dx)+'" y="'+(w.y+dy)+'" text-anchor="middle" font-size="20">'+label+'</text>'}).join('');
 stage.innerHTML='<svg viewBox="-110 -34 1230 1100" preserveAspectRatio="xMidYMid meet" aria-label="Interactive map of 198 historical Bengaluru wards. Use Find a ward for keyboard selection." role="img"><defs>'+wards.map(w=>'<path id="ground-'+w.id+'" d="'+w.path+'" fill-rule="evenodd"/>').join('')+'<pattern id="grid" width="85" height="85" patternUnits="userSpaceOnUse"><path d="M85 0H0V85" fill="none" stroke="#57516b" opacity=".26" stroke-width="1.3"/><path d="M-3 0H3M0-3V3" stroke="#82768f" opacity=".43" stroke-width="2"/></pattern></defs><rect x="-1500" y="-1000" width="4000" height="4000" fill="url(#grid)"/><g class="map-camera"><g id="terrain"><g class="carto-orbits" fill="none" stroke="#8585b8" opacity=".25" stroke-width="1" stroke-dasharray="3 10"><circle cx="510" cy="535" r="510"/><circle cx="510" cy="535" r="444"/><path d="M-90 535H1130M510-30V1060"/></g><g id="shapes">'+sortedWards.map(w=>'<g class="ward-block"><g class="ward-depth" aria-hidden="true" pointer-events="none"><use href="#ground-'+w.id+'"/><use href="#ground-'+w.id+'"/><use href="#ground-'+w.id+'"/><use href="#ground-'+w.id+'"/></g><use class="ward'+(w.id===state.ward?' sel':'')+'" data-ward="'+w.id+'" href="#ground-'+w.id+'" fill="#8c749d"/></g>').join('')+'</g><g pointer-events="none"><g data-water>'+lakes.lakes.map(l=>'<path d="'+l.path+'" fill="#a8d7cb" stroke="#393e50" stroke-width="1.4"/>').join('')+'</g>'+namesSVG+'</g><g id="ward-beacon" pointer-events="none"><circle class="beacon-ring" r="22" fill="none" stroke="#fff7be" stroke-width="3"/><circle r="10" fill="#2a233c" stroke="#fff4c2" stroke-width="4"/><circle r="3.5" fill="#fff4c2"/></g></g></g></svg>';
 const tip=main.querySelector('#tip');const path=e=>e.target.closest('[data-ward]');
 let hovered=0;
 stage.onpointermove=e=>{
   const p=path(e);
   if(!p){tip.hidden=true;hovered=0;return}
   const w=wardById.get(+p.dataset.ward),bounds=stage.getBoundingClientRect();
   if(hovered!==w.id||tip.hidden){
     hovered=w.id;
     tip.innerHTML='<b>'+esc(w.name)+'</b><small>Ward '+w.id+' · '+fmt(activeChart.byWard[w.id])+' applications</small>';
   }
   tip.hidden=false;
   tip.style.transform='translate3d('+Math.max(6,Math.min(bounds.width-tip.offsetWidth-8,e.clientX-bounds.left+13))+'px,'+Math.max(6,Math.min(bounds.height-tip.offsetHeight-8,e.clientY-bounds.top+12))+'px,0)';
 };
 stage.onpointerleave=()=>{tip.hidden=true;hovered=0};
 stage.onclick=e=>{const p=path(e);if(p)selectWard(+p.dataset.ward)};
 updateMapColors(s);mapZoom();
}
function periodChart(s){
 const all=state.year==='all';
 const offset=(Number(state.year)-2020)*4;
 return chartSVG(all?s.byYear:s.byQ.slice(offset,offset+4),all?years:['Q1','Q2','Q3','Q4']);
}
function setTimelineButton(){
 const button=main.querySelector('#timeline-button');
 if(!button)return;
 const playing=timelineTimer!==null;
 button.setAttribute('aria-pressed',String(playing));
 button.setAttribute('aria-label',playing?'Pause timeline':'Play timeline');
 button.querySelector('.timeline-caption').textContent=playing?'Pause timeline':'Play timeline';
 button.querySelector('.transport-icon').textContent=playing?'Ⅱ':'▶';
}
function stopTimeline(){
 if(timelineTimer!==null)clearTimeout(timelineTimer);
 timelineTimer=null;setTimelineButton();
}
function playTimeline(){
 if(timelineTimer!==null){stopTimeline();return}
 if(state.year==='all'||state.year==='2024')updateYear(2020);
 function next(){
   const index=years.indexOf(Number(state.year));
   if(index<0||index>=years.length-1){stopTimeline();return}
   updateYear(years[index+1]);
   if(index+1===years.length-1){stopTimeline();return}
   timelineTimer=setTimeout(next,1800);
 }
 timelineTimer=setTimeout(next,1800);setTimelineButton();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTimeline()});
function updateYear(value){
 state.year=String(value);
 main.querySelectorAll('[data-year]').forEach(button=>{
   const selected=button.dataset.year===state.year;
   button.classList.toggle('on',selected);button.setAttribute('aria-pressed',String(selected));
 });
 refreshAtlas();
}
function metricDetail(s){
 return '<span><b>'+fmt(s.byWard.filter(Boolean).length)+'</b> wards with filings</span><span><b>'+fmt(s.fresh)+'</b> new</span><span><b>'+fmt(s.renew)+'</b> renewal</span>';
}
function refreshAtlas(){
 const s=summarize(filterRows());activeChart=s;
 updateMapColors(s);
 const tip=main.querySelector('#tip');tip.hidden=true;
 const amount=main.querySelector('.metric-number');
 amount.textContent=fmt(s.total);
 playMotion(amount,[{opacity:.42,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,easing:'ease-out'});
 main.querySelector('.metric-line').innerHTML=metricDetail(s);
 const history=summarize(filterRows({year:'all'}));
 main.querySelector('.spark').outerHTML=spark(history.byYear);
 main.querySelector('#inspect').innerHTML=inspector(s);main.querySelector('#profile').onclick=wardProfile;
 main.querySelector('#history-chart').innerHTML=periodChart(s);
 main.querySelector('#chart-period').textContent=state.year==='all'?'ANNUAL':'QUARTERLY';
 main.querySelector('#mix-bars').innerHTML=bars(s);
 main.querySelector('#mix-period').textContent=periodLabel();
 main.querySelector('.map-period').textContent=periodLabel();
 playMotion(main.querySelector('.map-period'),[{opacity:.45,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,easing:'ease-out'});
}
function atlas(){
 const s=summarize(filterRows());activeChart=s;const all=summarize(filterRows({year:'all'})), allYears=state.year==='all';
 main.innerHTML=hero('Bengaluru / Civic data atlas','Bengaluru','trade atlas','Explore trade-licence activity across 198 wards, from 2020 to 2024.','<button id="export" class="hero-action" aria-label="Export data">'+ic('down')+'<span>Export data</span></button>')+filters()+
 '<div class="main-grid"><section class="map-card'+(state.relief?' relief-on':'')+'" aria-label="Ward map" tabindex="-1"><div id="stage" class="map-stage"></div><div class="map-scan" aria-hidden="true"></div><div class="map-head"><div class="mapcat">BBMP ward map</div><h2>Bengaluru</h2><p>12.97° N &nbsp; 77.59° E</p><div class="map-period">'+periodLabel()+'</div></div><button class="map-search" id="find" aria-label="Find a ward">'+ic('search')+'<span>Find a ward</span></button><button id="relief" class="relief-button" type="button" aria-pressed="'+state.relief+'" title="Raise wards by application volume"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m2 9 10-5 10 5-10 5zM3 13l9 4.5 9-4.5M3 17l9 4.5 9-4.5"/></svg> Relief view</button><div id="tip" class="map-tip" hidden></div><div id="scale" class="map-scale"><div class="map-note">'+(state.relief?'Height + colour · volume':'Application volume')+'</div><div class="scale-ramp">'+legendColors()+'</div>Lower &nbsp; → &nbsp; Higher</div><button class="timeline-button" id="timeline-button" aria-pressed="false" aria-label="Play timeline"><span class="transport-icon" aria-hidden="true">▶</span><span class="timeline-caption">Play timeline</span></button><div class="north" aria-label="North is up">N <span>↑</span></div><div class="map-actions"><button id="zin" aria-label="Zoom in">'+ic('plus')+'</button><button id="zout" aria-label="Zoom out">'+ic('minus')+'</button><button id="reset" aria-label="Reset map view">'+ic('reset')+'</button></div></section>'+
 '<aside class="side-stack"><section class="metric"><div class="over">Citywide applications</div><div class="metric-mid"><div class="metric-number">'+fmt(s.total)+'</div>'+spark(all.byYear)+'</div><div class="metric-line">'+metricDetail(s)+'</div></section><section id="inspect" class="inspect">'+inspector(s)+'</section></aside></div>'+
 '<div class="town-credits">Historical ward boundaries · <a href="https://github.com/datameet/Municipal_Spatial_Data/tree/master/Bangalore">DataMeet</a> (2012, CC BY-SA 2.5 IN) · Lakes © ATREE-CSEI via OpenCity · Map shades show relative application volume in the selected view.</div>'+
 '<div class="below"><section class="panel"><div class="panel-header"><div><div class="over orange">Time series</div><h2>Application history</h2></div><span class="badge" id="chart-period">'+(allYears?'ANNUAL':'QUARTERLY')+'</span></div><div id="history-chart">'+periodChart(s)+'</div></section><section class="panel"><div class="panel-header"><div><div class="over orange">Category breakdown</div><h2>Trade composition</h2></div><span class="badge" id="mix-period">'+periodLabel()+'</span></div><div id="mix-bars">'+bars(s)+'</div></section></div><section class="story"></section>';
 paintMap(s);main.querySelector('#find').onclick=searchWards;main.querySelector('#profile').onclick=wardProfile;
 main.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>{stopTimeline();updateYear(b.dataset.year)});
 main.querySelector('#timeline-button').onclick=playTimeline;
 main.querySelector('#relief').onclick=toggleRelief;
 main.querySelector('#type').onchange=e=>{stopTimeline();state.type=e.target.value;refreshAtlas()};main.querySelector('#category').onchange=e=>{stopTimeline();state.cat=e.target.value;refreshAtlas()};
 for(const [id,delta] of [['zin',.45],['zout',-.45],['reset',0]])main.querySelector('#'+id).onclick=()=>{state.zoom=delta?Math.min(3.25,Math.max(1,state.zoom+delta)):1;mapZoom()};
 main.querySelector('#export').onclick=()=>{const data=filterRows().filter(r=>r[3]+r[4]>0);download('ward-wise-'+periodLabel()+'-applications.csv',csv([['ward_id','ward_name','year','quarter','trade','new','renewal','total'],...data.map(([w,t,c,n,r])=>[w,wardById.get(w).name,2020+Math.floor(t/4),t%4+1,a.categories[c],n,r,n+r])]));message('Filtered application counts exported.')};
 mountSpotlight(main,{wardById,rows,queues:a.queues,showWard:(id,year)=>{
   stopTimeline();state.cat='all';state.type='all';
   main.querySelector('#category').value='all';main.querySelector('#type').value='all';
   state.zoom=1.45;selectWard(id);updateYear(year);
 },showEvidence:r=>{
   if(location.hash==='#radar'){evidence(r);return}
   state.t=r.t;
   window.addEventListener('hashchange',()=>evidence(r),{once:true});
   location.hash='radar';
 }});
}
const statuses=['Plausible real change','Likely administrative cause','Need more information','Not relevant'];
const logKey='wardwise-review-v1';
let volatileReviews={};
const caseKey=r=>[r.ward,r.cat,r.t].join('-');
function reviews(){try{const v=JSON.parse(localStorage.getItem(logKey)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?{...v,...volatileReviews}:volatileReviews}catch{return volatileReviews}}
function logItems(){const saved=reviews();return a.queues.flat().filter(r=>statuses.includes(saved[caseKey(r)]?.status)).map(r=>({r,...saved[caseKey(r)]})).sort((x,y)=>String(y.updated).localeCompare(String(x.updated)))}
function evidence(r){
 const w=wardById.get(r.ward),saved=reviews()[caseKey(r)]||{},diff=r.observed-r.expected;
 openSheet('<div class="over orange">Evidence card · '+qname(r.t)+' · Ward '+r.ward+'</div><h2>'+esc(w.name)+'</h2><p><b>'+esc(a.categories[r.cat])+'</b> applications ran '+(diff>0?'above':'below')+' the expected range for two consecutive quarters.</p>'+
 '<div class="evi-nums"><div><span class="over">Observed</span><strong>'+r.observed+'</strong></div><div><span class="over">Expected</span><strong>'+r.expected+'</strong></div><div><span class="over">Model band</span><strong>'+r.low+'–'+r.high+'</strong></div></div>'+
 '<p>There were '+fmt(r.volume)+' applications across all trades in this ward. This category accounted for <b>'+pct(r.observed,r.volume)+'</b>, compared with '+r.cityShare+'% in the rest of Bengaluru this quarter. Its historical same-quarter share in this ward was '+r.pastShare+'%.</p>'+
 '<div class="memo"><b>What this tells us</b><br>A change in recorded trade mix merits a closer look. Recording practices, backlogs or category changes can affect the numbers. Business closures and their causes cannot be inferred here.</div>'+
 '<p class="small">2012 BBMP ward boundaries · Working model band uses a fixed dispersion assumption. This is an outreach review at ward level.</p>'+
 '<form id="review-form"><label for="verdict">Officer assessment</label><select required id="verdict"><option value="">Choose an assessment</option>'+statuses.map(v=>opt(v,v,saved.status)).join('')+'</select><label for="memo">Review note <span class="small">(optional)</span></label><textarea id="memo" maxlength="600" placeholder="What would you check next?">'+esc(saved.note||'')+'</textarea><button class="action" type="submit">Save review '+ic('arrow')+'</button></form>');
 sheet.querySelector('form').onsubmit=e=>{e.preventDefault();const status=sheet.querySelector('#verdict').value;if(!statuses.includes(status))return;
 const entry={status,note:sheet.querySelector('#memo').value.slice(0,600),updated:new Date().toISOString()};
 const logs={...reviews(),[caseKey(r)]:entry};let stored=true;
 try{localStorage.setItem(logKey,JSON.stringify(logs))}catch{volatileReviews=logs;stored=false}
 dialog.close();radar();message(stored?'Assessment saved on this device.':'Device storage unavailable. Export this session’s review log.')};
}
function radar(){
 const queue=[...a.queues[state.t]].sort((x,y)=>wardById.get(x.ward).name.localeCompare(wardById.get(y.ward).name)||a.categories[x.cat].localeCompare(a.categories[y.cat]));
 const logs=logItems();
 main.innerHTML=hero('Bengaluru / Officer workspace','Review','radar','Review persistent changes in recorded trade mix, one ward and category at a time.')+
 '<div class="period-row"><label for="quarter" class="over">Review period</label><span class="select-wrap"><select id="quarter">'+Array.from({length:20},(_,i)=>19-i).map(t=>opt(t,qname(t),state.t)).join('')+'</select></span></div>'+
 '<div class="rad-layout"><section class="panel"><div class="panel-header"><div><div class="over orange">Quarterly shortlist</div><h2>Cases for review</h2></div><span class="badge">'+queue.length+' / 3</span></div>'+
 (queue.length?queue.map((r,i)=>'<article class="signal-card"><div class="over">Ward '+String(r.ward).padStart(3,'0')+' · '+esc(a.categories[r.cat])+'</div><h3>'+esc(wardById.get(r.ward).name)+'</h3><p>'+r.observed+' applications observed. The model expected '+r.expected+' in '+qname(r.t)+'.</p><button data-case="'+i+'" class="textbtn">Open evidence card '+ic('arrow')+'</button></article>').join(''):'<p class="empty">'+(state.t<5?'This period contributes historical observations. More history is needed for a two-quarter comparison.':'No ward–category pair met the evidence and persistence rules this quarter.')+'</p>')+
 '</section><aside class="panel"><div class="over orange">Officer assessments</div><h2>Review log</h2><p class="small">Saved in this browser. Export a copy to share with your team.</p>'+
 (logs.length?logs.map(x=>'<div class="logline"><b>'+esc(wardById.get(x.r.ward).name)+'</b> · '+esc(x.status)+'<small>'+qname(x.r.t)+' · '+esc(a.categories[x.r.cat])+'</small>'+(x.note?'<p>'+esc(x.note)+'</p>':'')+'</div>').join('')+'<button id="export-log" class="btn">'+ic('down')+' Export reviews</button>':'<p class="empty">Open an evidence card and save your assessment to start the log.</p>')+
 '</aside></div><div class="memo">Up to three eligible cases per quarter, displayed alphabetically. Selection uses the largest absolute standardized deviations after the evidence, persistence and citywide checks. <a href="#methods">See methodology</a>.</div>';
 main.querySelector('#quarter').onchange=e=>{state.t=Number(e.target.value);radar()};
 main.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>evidence(queue[+b.dataset.case]));
 const btn=main.querySelector('#export-log');if(btn)btn.onclick=()=>download('ward-wise-review-log.json',JSON.stringify(logs.map(({r,status,note,updated})=>({ward:r.ward,category:a.categories[r.cat],period:qname(r.t),status,note,updated})),null,2),'application/json')
}
function methods(){
 const [d,raw]=[a.comparison.detector,a.comparison.raw];
 main.innerHTML=hero('Bengaluru / Research notebook','Data &','methodology','The records, assumptions and tests behind the atlas and review queue.')+
 '<div class="method-grid"><section class="panel"><div class="over orange">Source and coverage</div><h2>Five calendar years</h2><p>'+fmt(coverage.period_rows_before_deduplication)+' BBMP trade lines became <b>'+fmt(coverage.distinct_application_ids)+' distinct applications</b> after grouping by application ID. Every application maps to one of 198 historical wards.</p><table class="datatable"><tr><th>Calendar year</th><th>Applications</th></tr>'+years.map(y=>'<tr><td>'+y+'</td><td>'+fmt(coverage.calendar_year_totals[y])+'</td></tr>').join('')+'</table><p class="small">46,473 applications have no usable major-trade heading. The atlas keeps these visible as Unclassified. Multiple-category records have their own bucket.</p><a class="lightlink" href="data/application-counts.csv" download>Download the aggregate CSV</a></section>'+
 '<section class="panel"><div class="over orange">Detection rule</div><h2>Local or citywide?</h2><p>For each ward and trade category, the model learns the historical share in the same calendar quarter. It adjusts that share for the citywide shift among the other 197 wards, then multiplies by the ward’s observed application volume.</p><p>Historical shares borrow the equivalent of 40 applications from peers. A case needs at least 25 current and historical applications, an expected count of at least five on either side of the category split, and two consecutive deviations beyond two model standard deviations in the same direction.</p><p class="small">Shared signals across at least five wards and a quarter of eligible wards are suppressed for that category and direction. Unclassified and multiple-category records contribute to total volume and are excluded from case selection.</p></section>'+
 '<section class="panel"><div class="over orange">2024 scenario test</div><h2>Can it detect a change?</h2><p>We sampled 400 eligible pairs of consecutive quarters. We simulated counts at the expected share and after a known drop, then applied the two-quarter rule.</p><table class="datatable"><tr><th>Injected drop</th><th>Detected / 400</th></tr>'+a.evaluation.map(v=>'<tr><td>'+Math.round(100*v.drop)+'%</td><td>'+v.detected+' ('+pct(v.detected,v.trials)+')</td></tr>').join('')+'</table><p class="small">These are controlled simulations before the three-card cap. Small shifts are often missed. Simulated false alarms do not establish a real-world false-positive rate.</p></section>'+
 '<section class="panel"><div class="over orange">2024 historical check</div><h2>Did the signal persist?</h2><p>For Q1–Q3 2024, '+d[0]+' of '+d[1]+' evaluable selected cases still crossed the threshold in the same direction the following quarter. A budget-matched rule using the largest raw count changes had '+raw[0]+' of '+raw[1]+'.</p><p>The sample is small. The comparison measures short-term persistence. Field follow-up would be needed to verify an economic cause or measure an officer’s time savings.</p><p class="small">Working bands use fixed overdispersion (2). Quarterly comparisons use only previous years for the historical baseline. The same-quarter peer adjustment is retrospective and requires that quarter’s records to be available.</p></section>'+
 '<section class="panel"><div class="over orange">Credits and reuse</div><h2>Source register</h2><p><a class="lightlink" href="https://github.com/Vonter/bbmp-trade-license">BBMP applications compiled by Vivek Matthew</a> · ODbL 1.0. Adapted, deduplicated and aggregated by Team Codyssey.</p><p><a class="lightlink" href="https://github.com/datameet/Municipal_Spatial_Data/tree/master/Bangalore">DataMeet 2012 ward boundaries</a> · CC BY-SA 2.5 India. Lake outlines by ATREE-CSEI via OpenCity, CC BY.</p></section>'+
 '<section class="panel"><div class="over orange">Interpretation</div><h2>What the data measures</h2><p>Each count is an application filed with BBMP. A renewal application is evidence of a filing. The public extract does not establish its due date, whether it was timely, whether the shop closed, or how much revenue the business earned.</p><p class="small">Application density depends on the ward’s size, registration practices and mix of businesses. The map uses seven colour bands. Annual views share cutoffs calculated from all five years for the selected filters. The combined view uses five-year ward totals. Relief height encodes the same bands.</p></section></div>';
}
function route(){stopTimeline();if(dialog.open)dialog.close();const v=view();document.querySelectorAll('[data-nav]').forEach(n=>{if(n.dataset.nav===v)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current')});if(v==='radar')radar();else if(v==='methods')methods();else atlas();if(v!=='atlas')observeSections(main);window.scrollTo(0,0)}
async function start(){
 try{
  [a,geo,lakes,coverage]=await Promise.all(['atlas','wards','lakes','coverage'].map(async n=>{const r=await fetch('data/'+n+'.json');if(!r.ok)throw Error(n);return r.json()}));
  wards=geo.wards;wardById=new Map(wards.map(w=>[w.id,w]));rows=a.rows;
  route();window.addEventListener('hashchange',route);window.addEventListener('storage',e=>{if(e.key===logKey&&view()==='radar'&&!dialog.open)radar()})
 }catch{main.innerHTML='<p class="loading" role="alert">The atlas data could not be loaded. <button class="btn" id="retry">Try again</button></p>';main.querySelector('#retry').onclick=()=>location.reload()}
}
start();
