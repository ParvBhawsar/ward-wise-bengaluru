import {observeStory,observeSections,playMotion,scrollToElement} from './motion.js';

const number = new Intl.NumberFormat('en-IN');
const format = value => number.format(value);
const frames = [
  {id:151,year:'all',period:'2020–2024',field:'Five-year profile',color:'#ff9062',mode:'Total filings'},
  {id:150,year:'2024',period:'2024',field:'Annual profile',color:'#c6b8ff',mode:'New applications'},
  {id:85,year:'2024',period:'Q4 2024',field:'Radar case',color:'#a9e6bb',mode:'Accommodation filings'}
];
const escape = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

export function mountSpotlight(root, {wardById,rows,queues,showWard,showEvidence}) {
  const caseRecord=queues[19].find(r=>r.ward===85&&r.cat===1);
  const items=frames.filter(f=>f.id!==85||caseRecord).map((f,i)=>{
    const ward=wardById.get(f.id);
    const filings=rows.filter(r=>r[0]===f.id && (f.year==='all'||r[1]>=16));
    const newCount=filings.reduce((n,r)=>n+r[3],0);
    const renewal=filings.reduce((n,r)=>n+r[4],0);
    const total=newCount+renewal;
    const narratives=[
      'Across five years, '+format(renewal)+' of this ward’s '+format(total)+' filings were renewals. The atlas lets you follow its trade mix across each calendar year.',
      'New applications made up '+(100*newCount/total).toFixed(1)+'% of the ward’s '+format(total)+' filings in 2024. The ward profile breaks the total down by trade.',
      caseRecord?'Accommodation accounted for '+caseRecord.observed+' of '+caseRecord.volume+' filings in Q4. The model expected '+caseRecord.expected+'. Open the evidence card to see why this change entered the review queue.':''
    ];
    return {...f,ward,value:[total,newCount,caseRecord?.observed][i],narrative:narratives[i]};
  });
  const feature=root.querySelector('.story');
  feature.innerHTML='<div class="story-head"><div class="eyebrow">Ward spotlight</div><h2>Three wards, <i>up close.</i></h2></div>'+
    '<div class="story-grid"><div class="story-plate" aria-hidden="true"><div class="plate-top"><span>WARD OUTLINE</span><span class="plate-index"></span></div>'+
    '<svg class="ward-portrait" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><path fill-rule="evenodd"/></svg>'+
    '<div class="plate-foot"><span class="plate-number"></span><span class="plate-mode"></span></div></div><div class="story-list">'+
    items.map((item,i)=>'<article class="story-row" data-step="'+i+'"><div class="story-meta"><span class="story-step">'+String(i+1).padStart(2,'0')+'</span>'+item.field+' · '+item.period+'</div><h3>'+escape(item.ward.name)+'</h3><p>'+item.narrative+'</p><button class="story-jump" data-open-step="'+i+'">'+(item.id===85?'Open evidence card':'Locate on map')+' <span aria-hidden="true">↗</span></button></article>').join('')+'</div></div>';
  const plate=feature.querySelector('.story-plate');
  const portrait=plate.querySelector('svg');
  const shape=portrait.querySelector('path');
  const steps=[...feature.querySelectorAll('.story-row')];
  let active=-1;
  function select(index) {
    if(index===active)return;
    active=index;
    const item=items[index];
    steps.forEach((step,i)=>step.classList.toggle('is-current',i===index));
    plate.style.setProperty('--portrait-ink',item.color);
    plate.querySelector('.plate-index').textContent='BBMP / '+String(item.id).padStart(3,'0');
    plate.querySelector('.plate-number').textContent=format(item.value);
    plate.querySelector('.plate-mode').textContent=item.mode+' · '+item.period;
    shape.setAttribute('d',item.ward.path);
    const box=shape.getBBox();
    const pad=Math.max(box.width,box.height)*.12;
    portrait.setAttribute('viewBox',[box.x-pad,box.y-pad,box.width+2*pad,box.height+2*pad].join(' '));
    playMotion(portrait,[{opacity:.2,transform:'scale(.82) rotate(-5deg)'},{opacity:1,transform:'scale(1) rotate(0deg)'}],{duration:620,easing:'cubic-bezier(.18,.9,.2,1)'});
  }
  select(0);observeSections(root);observeStory(steps,select);
  feature.querySelectorAll('[data-open-step]').forEach(button=>{
    const i=Number(button.dataset.openStep);
    button.addEventListener('focus',()=>select(i));
    button.onclick=()=>{
      const item=items[i];
      if(item.id===85)showEvidence(caseRecord);
      else {
        showWard(item.id,item.year);
        const map=root.querySelector('.map-card');map.focus({preventScroll:true});scrollToElement(map);
      }
    };
  });
}
